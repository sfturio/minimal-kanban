const SUPABASE_URL = "https://gytlcnjscwasycgnyzhx.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dGxjbmpzY3dhc3ljZ255emh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NTg4NzUsImV4cCI6MjA5MDMzNDg3NX0.3xrMZKIO1ZQUhg8TpKQ753DGOUJ6pqNEzcSYyFSqVtM";

let supabaseClient = null;
let currentUser = null;

export async function initSupabaseClient() {
  if (supabaseClient) {
    return supabaseClient;
  }

  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);
  return supabaseClient;
}

export function getCurrentUser() {
  return currentUser;
}

export function isLoggedIn() {
  return Boolean(supabaseClient && currentUser);
}

export async function initAuthSession({ onAuthChange }) {
  const client = await initSupabaseClient();
  const { data } = await client.auth.getSession();
  currentUser = data?.session?.user || null;
  await onAuthChange(currentUser);

  client.auth.onAuthStateChange(async (_event, session) => {
    currentUser = session?.user || null;
    await onAuthChange(currentUser);
  });
}

export async function signInWithPassword(email, password) {
  const client = await initSupabaseClient();
  return client.auth.signInWithPassword({ email, password });
}

export async function signUpWithPassword(email, password) {
  const client = await initSupabaseClient();
  return client.auth.signUp({ email, password });
}

export async function signOut() {
  if (!supabaseClient) {
    return;
  }
  await supabaseClient.auth.signOut();
}

export async function fetchOwnProfile() {
  if (!isLoggedIn()) {
    return null;
  }

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id,email,username")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data || null;
}

export async function saveOwnUsername(username) {
  if (!isLoggedIn()) {
    return { data: null, error: new Error("Usuário não autenticado") };
  }

  const normalized = String(username || "").trim();
  const payload = {
    id: currentUser.id,
    email: currentUser.email || null,
    username: normalized,
  };

  const { data, error } = await supabaseClient
    .from("profiles")
    .upsert(payload, { onConflict: "id" })
    .select("username")
    .single();

  if (error) {
    return { data: null, error };
  }

  return { data, error: null };
}

export async function pullCloudSnapshot() {
  if (!isLoggedIn()) {
    return null;
  }

  const userId = currentUser.id;

  const { data: cloudBoards, error: boardsError } = await supabaseClient
    .from("boards")
    .select("id,name,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (boardsError) {
    throw new Error(boardsError.message);
  }

  const { data: cloudColumns, error: columnsError } = await supabaseClient
    .from("columns")
    .select("id,board_id,name,position,created_at")
    .order("position", { ascending: true });

  if (columnsError) {
    throw new Error(columnsError.message);
  }

  const { data: cloudTasks, error: tasksError } = await supabaseClient
    .from("tasks")
    .select("id,board_id,column_id,title,description,category,assignee,priority,deadline,completed_at,position,status,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (tasksError) {
    throw new Error(tasksError.message);
  }

  const { data: cloudTaskTags, error: taskTagsError } = await supabaseClient
    .from("task_tags")
    .select("id,task_id,tag");

  if (taskTagsError) {
    throw new Error(taskTagsError.message);
  }

  const { data: cloudComments, error: commentsError } = await supabaseClient
    .from("comments")
    .select("id,task_id,user_id,content,created_at")
    .order("created_at", { ascending: true });

  if (commentsError) {
    throw new Error(commentsError.message);
  }

  return {
    boards: Array.isArray(cloudBoards) ? cloudBoards : [],
    columns: Array.isArray(cloudColumns) ? cloudColumns : [],
    tasks: Array.isArray(cloudTasks) ? cloudTasks : [],
    taskTags: Array.isArray(cloudTaskTags) ? cloudTaskTags : [],
    comments: Array.isArray(cloudComments) ? cloudComments : [],
  };
}

export async function pushCloudSnapshot({ boards, columns, tasks, taskTags, comments }) {
  if (!isLoggedIn()) {
    return;
  }

  const userId = currentUser.id;

  await supabaseClient.from("tasks").delete().eq("user_id", userId);
  if (boards.length > 0) {
    await supabaseClient.from("columns").delete().in("board_id", boards.map((board) => board.id));
  }
  await supabaseClient.from("boards").delete().eq("user_id", userId);

  if (boards.length > 0) {
    const payloadBoards = boards.map((board) => ({
      id: board.id,
      user_id: userId,
      name: board.name,
      created_at: new Date().toISOString(),
    }));

    const { error: boardInsertError } = await supabaseClient.from("boards").insert(payloadBoards);
    if (boardInsertError) {
      throw new Error(boardInsertError.message);
    }
  }

  if (columns.length > 0) {
    const payloadColumns = columns.map((column) => ({
      id: column.id,
      board_id: column.board_id,
      name: column.name,
      position: column.position,
      created_at: column.created_at || new Date().toISOString(),
    }));

    const { error: columnInsertError } = await supabaseClient.from("columns").insert(payloadColumns);
    if (columnInsertError) {
      throw new Error(columnInsertError.message);
    }
  }

  if (tasks.length > 0) {
    const payloadTasks = tasks.map((item) => ({
      id: item.id,
      user_id: userId,
      board_id: item.boardId,
      column_id: item.columnId || null,
      title: item.title,
      description: item.description,
      category: item.category || "",
      assignee: item.assignee || null,
      priority: item.priority || "normal",
      deadline: item.deadline || null,
      completed_at: item.completedAt || null,
      position: Number.isInteger(item.position) ? item.position : 0,
      status: item.status,
      created_at: item.createdAt,
    }));

    const { error: taskInsertError } = await supabaseClient.from("tasks").insert(payloadTasks);
    if (taskInsertError) {
      throw new Error(taskInsertError.message);
    }
  }

  if (taskTags.length > 0) {
    const payloadTags = taskTags.map((row) => ({
      id: row.id,
      task_id: row.task_id,
      tag: row.tag,
    }));
    const { error: tagInsertError } = await supabaseClient.from("task_tags").insert(payloadTags);
    if (tagInsertError) {
      throw new Error(tagInsertError.message);
    }
  }

  if (comments.length > 0) {
    const payloadComments = comments.map((row) => ({
      id: row.id,
      task_id: row.task_id,
      user_id: userId,
      content: row.content,
      created_at: row.created_at || new Date().toISOString(),
    }));
    const { error: commentInsertError } = await supabaseClient.from("comments").insert(payloadComments);
    if (commentInsertError) {
      throw new Error(commentInsertError.message);
    }
  }
}

export function serializeTaskMeta(task) {
  return JSON.stringify({
    description: task.description || "",
    assignee: task.assignee || null,
    tags: Array.isArray(task.tags) ? task.tags : [],
    comments: Array.isArray(task.comments) ? task.comments : [],
    deadline: task.deadline || null,
    completedAt: task.completedAt || null,
    priority: task.priority || "normal",
  });
}

export function deserializeTaskMeta(rawDescription) {
  const fallback = {
    description: rawDescription || "",
    assignee: null,
    tags: [],
    comments: [],
    deadline: null,
    completedAt: null,
    priority: "normal",
  };

  if (!rawDescription) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(rawDescription);
    return {
      description: parsed?.description || "",
      assignee: parsed?.assignee || null,
      tags: Array.isArray(parsed?.tags) ? parsed.tags : [],
      comments: Array.isArray(parsed?.comments) ? parsed.comments : [],
      deadline: parsed?.deadline || null,
      completedAt: parsed?.completedAt || null,
      priority: parsed?.priority === "high" ? "high" : "normal",
    };
  } catch {
    return fallback;
  }
}
