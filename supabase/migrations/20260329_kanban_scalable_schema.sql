-- Fluxo Essencial - Kanban scalable schema migration (safe/idempotent)
-- Date: 2026-03-29
-- Notes:
-- 1) Does NOT drop existing tables/columns.
-- 2) Extends existing schema to Trello/Notion-like model.
-- 3) Keeps compatibility with current frontend (existing tasks.description/user_id remain).

begin;

create extension if not exists pgcrypto;

-- =====================================================
-- PROFILES (auth.users companion)
-- =====================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

-- Backfill profiles from auth.users
insert into public.profiles (id, email)
select u.id, u.email
from auth.users u
on conflict (id) do update
set email = excluded.email;

-- Optional: keep profiles in sync on signup
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update
  set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

-- =====================================================
-- BOARDS (adapt existing)
-- =====================================================
alter table public.boards
  add column if not exists updated_at timestamptz not null default now();

alter table public.boards
  add column if not exists created_at timestamptz not null default now();

-- FK: boards.user_id -> profiles.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'boards_user_id_profiles_fkey'
      AND conrelid = 'public.boards'::regclass
  ) THEN
    ALTER TABLE public.boards
      ADD CONSTRAINT boards_user_id_profiles_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;
END$$;

create index if not exists idx_boards_user_id on public.boards(user_id);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_boards_set_updated_at on public.boards;
create trigger trg_boards_set_updated_at
before update on public.boards
for each row
execute function public.set_updated_at();

-- =====================================================
-- COLUMNS (new table; quoted name to preserve desired naming)
-- =====================================================
create table if not exists public."columns" (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique(board_id, name)
);

create index if not exists idx_columns_board_id on public."columns"(board_id);
create index if not exists idx_columns_board_position on public."columns"(board_id, position);

-- Backfill default columns for existing boards (safe)
insert into public."columns" (board_id, name, position)
select b.id, c.name, c.position
from public.boards b
cross join (
  values
    ('Próximos', 0),
    ('Em andamento', 1),
    ('Concluído', 2)
) as c(name, position)
where not exists (
  select 1
  from public."columns" x
  where x.board_id = b.id
    and lower(x.name) = lower(c.name)
);

-- =====================================================
-- TASKS (adapt existing)
-- =====================================================
alter table public.tasks
  add column if not exists column_id uuid;

alter table public.tasks
  add column if not exists assignee text;

alter table public.tasks
  add column if not exists priority text not null default 'normal';

alter table public.tasks
  add column if not exists deadline date;

alter table public.tasks
  add column if not exists completed_at date;

alter table public.tasks
  add column if not exists position integer not null default 0;

alter table public.tasks
  add column if not exists created_at timestamptz not null default now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tasks_board_id_boards_fkey'
      AND conrelid = 'public.tasks'::regclass
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_board_id_boards_fkey
      FOREIGN KEY (board_id) REFERENCES public.boards(id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tasks_column_id_columns_fkey'
      AND conrelid = 'public.tasks'::regclass
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_column_id_columns_fkey
      FOREIGN KEY (column_id) REFERENCES public."columns"(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tasks_priority_check'
      AND conrelid = 'public.tasks'::regclass
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_priority_check
      CHECK (priority in ('normal', 'high'));
  END IF;
END$$;

create index if not exists idx_tasks_board_id on public.tasks(board_id);
create index if not exists idx_tasks_column_id on public.tasks(column_id);
create index if not exists idx_tasks_board_position on public.tasks(board_id, position);

-- Backfill column_id from status for legacy rows
update public.tasks t
set column_id = coalesce(
  (
    select c.id
    from public."columns" c
    where c.board_id = t.board_id
      and (
        (t.status = 'todo' and lower(c.name) in ('próximos', 'proximos'))
        or (t.status = 'inprogress' and lower(c.name) = 'em andamento')
        or (t.status = 'done' and lower(c.name) = 'concluído')
      )
    order by c.position asc
    limit 1
  ),
  (
    select c2.id
    from public."columns" c2
    where c2.board_id = t.board_id
    order by c2.position asc
    limit 1
  )
)
where t.column_id is null
  and t.board_id is not null;

-- Optional completed_at backfill for done tasks
update public.tasks
set completed_at = coalesce(completed_at, current_date)
where status = 'done'
  and completed_at is null;

-- =====================================================
-- TASK TAGS (new)
-- =====================================================
create table if not exists public.task_tags (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  tag text not null
);

create index if not exists idx_task_tags_task_id on public.task_tags(task_id);

-- =====================================================
-- COMMENTS (new)
-- =====================================================
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_comments_task_id on public.comments(task_id);
create index if not exists idx_comments_user_id on public.comments(user_id);

-- =====================================================
-- RLS
-- =====================================================
alter table public.profiles enable row level security;
alter table public.boards enable row level security;
alter table public."columns" enable row level security;
alter table public.tasks enable row level security;
alter table public.task_tags enable row level security;
alter table public.comments enable row level security;

-- profiles: user sees/updates only own profile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_select_own'
  ) THEN
    CREATE POLICY profiles_select_own ON public.profiles
      FOR SELECT USING (id = auth.uid());
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_update_own'
  ) THEN
    CREATE POLICY profiles_update_own ON public.profiles
      FOR UPDATE USING (id = auth.uid())
      WITH CHECK (id = auth.uid());
  END IF;
END$$;

-- boards: user_id = auth.uid()
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'boards' AND policyname = 'boards_select_own'
  ) THEN
    CREATE POLICY boards_select_own ON public.boards
      FOR SELECT USING (user_id = auth.uid());
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'boards' AND policyname = 'boards_insert_own'
  ) THEN
    CREATE POLICY boards_insert_own ON public.boards
      FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'boards' AND policyname = 'boards_update_own'
  ) THEN
    CREATE POLICY boards_update_own ON public.boards
      FOR UPDATE USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'boards' AND policyname = 'boards_delete_own'
  ) THEN
    CREATE POLICY boards_delete_own ON public.boards
      FOR DELETE USING (user_id = auth.uid());
  END IF;
END$$;

-- columns: accessible only through user's board
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'columns' AND policyname = 'columns_select_via_board_owner'
  ) THEN
    CREATE POLICY columns_select_via_board_owner ON public."columns"
      FOR SELECT USING (
        EXISTS (
          SELECT 1
          FROM public.boards b
          WHERE b.id = board_id
            AND b.user_id = auth.uid()
        )
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'columns' AND policyname = 'columns_insert_via_board_owner'
  ) THEN
    CREATE POLICY columns_insert_via_board_owner ON public."columns"
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.boards b
          WHERE b.id = board_id
            AND b.user_id = auth.uid()
        )
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'columns' AND policyname = 'columns_update_via_board_owner'
  ) THEN
    CREATE POLICY columns_update_via_board_owner ON public."columns"
      FOR UPDATE USING (
        EXISTS (
          SELECT 1
          FROM public.boards b
          WHERE b.id = board_id
            AND b.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.boards b
          WHERE b.id = board_id
            AND b.user_id = auth.uid()
        )
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'columns' AND policyname = 'columns_delete_via_board_owner'
  ) THEN
    CREATE POLICY columns_delete_via_board_owner ON public."columns"
      FOR DELETE USING (
        EXISTS (
          SELECT 1
          FROM public.boards b
          WHERE b.id = board_id
            AND b.user_id = auth.uid()
        )
      );
  END IF;
END$$;

-- tasks: accessible only through user's board
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tasks' AND policyname = 'tasks_select_via_board_owner'
  ) THEN
    CREATE POLICY tasks_select_via_board_owner ON public.tasks
      FOR SELECT USING (
        EXISTS (
          SELECT 1
          FROM public.boards b
          WHERE b.id = board_id
            AND b.user_id = auth.uid()
        )
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tasks' AND policyname = 'tasks_insert_via_board_owner'
  ) THEN
    CREATE POLICY tasks_insert_via_board_owner ON public.tasks
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.boards b
          WHERE b.id = board_id
            AND b.user_id = auth.uid()
        )
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tasks' AND policyname = 'tasks_update_via_board_owner'
  ) THEN
    CREATE POLICY tasks_update_via_board_owner ON public.tasks
      FOR UPDATE USING (
        EXISTS (
          SELECT 1
          FROM public.boards b
          WHERE b.id = board_id
            AND b.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.boards b
          WHERE b.id = board_id
            AND b.user_id = auth.uid()
        )
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tasks' AND policyname = 'tasks_delete_via_board_owner'
  ) THEN
    CREATE POLICY tasks_delete_via_board_owner ON public.tasks
      FOR DELETE USING (
        EXISTS (
          SELECT 1
          FROM public.boards b
          WHERE b.id = board_id
            AND b.user_id = auth.uid()
        )
      );
  END IF;
END$$;

-- task_tags: access via task -> board owner
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'task_tags' AND policyname = 'task_tags_select_via_board_owner'
  ) THEN
    CREATE POLICY task_tags_select_via_board_owner ON public.task_tags
      FOR SELECT USING (
        EXISTS (
          SELECT 1
          FROM public.tasks t
          JOIN public.boards b ON b.id = t.board_id
          WHERE t.id = task_id
            AND b.user_id = auth.uid()
        )
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'task_tags' AND policyname = 'task_tags_insert_via_board_owner'
  ) THEN
    CREATE POLICY task_tags_insert_via_board_owner ON public.task_tags
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.tasks t
          JOIN public.boards b ON b.id = t.board_id
          WHERE t.id = task_id
            AND b.user_id = auth.uid()
        )
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'task_tags' AND policyname = 'task_tags_delete_via_board_owner'
  ) THEN
    CREATE POLICY task_tags_delete_via_board_owner ON public.task_tags
      FOR DELETE USING (
        EXISTS (
          SELECT 1
          FROM public.tasks t
          JOIN public.boards b ON b.id = t.board_id
          WHERE t.id = task_id
            AND b.user_id = auth.uid()
        )
      );
  END IF;
END$$;

-- comments: access via task -> board owner
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'comments' AND policyname = 'comments_select_via_board_owner'
  ) THEN
    CREATE POLICY comments_select_via_board_owner ON public.comments
      FOR SELECT USING (
        EXISTS (
          SELECT 1
          FROM public.tasks t
          JOIN public.boards b ON b.id = t.board_id
          WHERE t.id = task_id
            AND b.user_id = auth.uid()
        )
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'comments' AND policyname = 'comments_insert_via_board_owner'
  ) THEN
    CREATE POLICY comments_insert_via_board_owner ON public.comments
      FOR INSERT WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
          SELECT 1
          FROM public.tasks t
          JOIN public.boards b ON b.id = t.board_id
          WHERE t.id = task_id
            AND b.user_id = auth.uid()
        )
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'comments' AND policyname = 'comments_update_via_board_owner'
  ) THEN
    CREATE POLICY comments_update_via_board_owner ON public.comments
      FOR UPDATE USING (
        EXISTS (
          SELECT 1
          FROM public.tasks t
          JOIN public.boards b ON b.id = t.board_id
          WHERE t.id = task_id
            AND b.user_id = auth.uid()
        )
      )
      WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
          SELECT 1
          FROM public.tasks t
          JOIN public.boards b ON b.id = t.board_id
          WHERE t.id = task_id
            AND b.user_id = auth.uid()
        )
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'comments' AND policyname = 'comments_delete_via_board_owner'
  ) THEN
    CREATE POLICY comments_delete_via_board_owner ON public.comments
      FOR DELETE USING (
        EXISTS (
          SELECT 1
          FROM public.tasks t
          JOIN public.boards b ON b.id = t.board_id
          WHERE t.id = task_id
            AND b.user_id = auth.uid()
        )
      );
  END IF;
END$$;

commit;
