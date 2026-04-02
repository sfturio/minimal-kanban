import { normalizeSpaces } from "../utils/helpers.js";

export function appendCommentTextWithMentions(container, text) {
  const source = String(text || "");
  const mentionRegex = /(@[a-zA-Z0-9_.-]+)/g;
  let lastIndex = 0;
  let match;

  while ((match = mentionRegex.exec(source)) !== null) {
    if (match.index > lastIndex) {
      container.appendChild(document.createTextNode(source.slice(lastIndex, match.index)));
    }

    const mention = document.createElement("span");
    mention.className = "task-comment-mention";
    mention.textContent = match[1];
    container.appendChild(mention);

    lastIndex = mentionRegex.lastIndex;
  }

  if (lastIndex < source.length) {
    container.appendChild(document.createTextNode(source.slice(lastIndex)));
  }
}

export function createTaskElement(task, context) {
  const {
    getActiveColumns,
    ui,
    state,
    actions,
  } = context;

  const card = document.createElement("article");
  const columns = getActiveColumns();
  const lastColumnId = columns[columns.length - 1]?.id;
  const priorityClass = task.priority === "high" ? " priority-high" : "";
  card.className = `task${task.status === lastColumnId ? " done" : ""}${priorityClass}`;
  card.draggable = true;
  card.dataset.id = task.id;

  const isEditing = state.editingTaskId === task.id;
  const isDeleteConfirming = state.deleteConfirmTaskId === task.id;

  card.innerHTML = `
    <div class="task-main"></div>
    <div class="task-actions">
      <button type="button" class="comment" data-action="toggle-comments" aria-label="Comentários">🗨</button>
      <button type="button" data-action="edit">Renomear</button>
      <button type="button" class="delete" data-action="delete">Excluir</button>
    </div>
    <div class="task-delete-confirm${isDeleteConfirming ? " show" : ""}">
      <span>Excluir tarefa?</span>
      <button type="button" class="danger" data-action="confirm-delete">Confirmar</button>
      <button type="button" data-action="cancel-delete">Cancelar</button>
    </div>
  `;

  const main = card.querySelector(".task-main");
  if (isEditing) {
    main.innerHTML = `
      <div class="task-edit-row">
        <input type="text" class="task-edit-input" value="${escapeHtml(task.title)}" maxlength="120" />
        <button type="button" data-action="confirm-edit">Salvar</button>
        <button type="button" data-action="cancel-edit">Cancelar</button>
      </div>
    `;
  } else {
    main.innerHTML = `
      <button type="button" class="task-title-btn" aria-label="Editar tarefa">
        <p class="task-title"></p>
      </button>
    `;

    const meta = document.createElement("div");
    meta.className = "task-meta";
    let hasMeta = false;

    if (task.category) {
      const category = document.createElement("span");
      category.className = "task-chip task-category";
      category.textContent = task.category;
      meta.appendChild(category);
      hasMeta = true;
    }

    if (task.assignee) {
      const assignee = document.createElement("span");
      assignee.className = "task-chip task-assignee";
      assignee.textContent = `@${task.assignee}`;
      meta.appendChild(assignee);
      hasMeta = true;
    }

    if (Array.isArray(task.tags) && task.tags.length > 0) {
      task.tags.forEach((tag) => {
        const normalizedTag = normalizeSpaces(tag);
        if (!normalizedTag) return;

        const tagElement = document.createElement("span");
        tagElement.className = "task-chip task-tag";
        tagElement.textContent = `#${normalizedTag}`;
        meta.appendChild(tagElement);
        hasMeta = true;
      });
    }

    if (task.deadline) {
      const deadline = document.createElement("span");
      deadline.className = "task-chip task-deadline";
      deadline.textContent = task.deadline;
      meta.appendChild(deadline);
      hasMeta = true;
    }

    if (task.completedAt) {
      const completedAt = document.createElement("span");
      completedAt.className = "task-chip task-completed-date";
      completedAt.textContent = `Finalizado em ${task.completedAt}`;
      meta.appendChild(completedAt);
      hasMeta = true;
    }

    if (hasMeta) {
      main.appendChild(meta);
    }

    const comments = Array.isArray(task.comments) ? task.comments : [];
    const isCommentsOpen = state.commentsOpenTaskId === task.id;
    const commentsWrap = document.createElement("div");
    commentsWrap.className = `task-comments${isCommentsOpen ? " open" : ""}`;

    if (comments.length > 0) {
      const list = document.createElement("div");
      list.className = "task-comments-list";
      comments.forEach((comment) => {
        const item = document.createElement("div");
        item.className = "task-comment-item";
        item.dataset.commentId = String(comment.id || "");

        const text = document.createElement("p");
        text.className = "task-comment-text";
        appendCommentTextWithMentions(text, comment.text);

        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "task-comment-delete";
        removeButton.dataset.action = "delete-comment";
        removeButton.setAttribute("aria-label", "Excluir comentário");
        removeButton.textContent = "×";

        item.appendChild(text);
        item.appendChild(removeButton);
        list.appendChild(item);
      });
      commentsWrap.appendChild(list);
    } else {
      const empty = document.createElement("p");
      empty.className = "task-comment-empty";
      empty.textContent = "Sem comentários";
      commentsWrap.appendChild(empty);
    }

    const commentForm = document.createElement("div");
    commentForm.className = "task-comment-form";
    commentForm.innerHTML = `
      <div class="task-comment-input-wrap">
        <input type="text" class="task-comment-input" maxlength="180" placeholder="comentário" />
        <span class="task-comment-prefix">@</span>
        <input type="text" class="task-comment-assignee" maxlength="40" placeholder="nome" />
      </div>
      <button type="button" data-action="add-comment">Adicionar</button>
    `;

    commentsWrap.appendChild(commentForm);
    main.appendChild(commentsWrap);
  }

  const title = card.querySelector(".task-title");
  if (title) {
    title.textContent = task.title;
  }

  card.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const action = target.dataset.action;
    if (!action) return;

    actions.onTaskAction({ action, task, card, target });
  });

  const titleButton = card.querySelector(".task-title-btn");
  titleButton?.addEventListener("dblclick", (event) => {
    event.stopPropagation();
    actions.openTaskModal(task.id);
  });

  card.addEventListener("dragstart", (event) => {
    state.draggingTaskId = task.id;
    card.classList.add("dragging");

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", task.id);
    }
  });

  card.addEventListener("dragend", () => {
    state.draggingTaskId = null;
    state.dragOverListId = null;
    card.classList.remove("dragging");
    actions.clearDropIndicators();
  });

  card.addEventListener("dblclick", (event) => {
    const target = event.target;
    if (target instanceof Element && target.closest(".task-actions")) {
      return;
    }
    actions.openTaskModal(task.id);
  });

  const commentInput = card.querySelector(".task-comment-input");
  const commentAssigneeInput = card.querySelector(".task-comment-assignee");
  const onCommentEnter = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      const addButton = card.querySelector('[data-action="add-comment"]');
      if (addButton instanceof HTMLElement) {
        addButton.click();
      }
    }
  };

  commentInput?.addEventListener("keydown", onCommentEnter);
  commentAssigneeInput?.addEventListener("keydown", onCommentEnter);

  return card;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
