import { createTaskElement } from "./task.render.js";
import { orderTasksForColumn } from "../services/task.service.js";

export function updateBoardName(boardNameElement, activeBoard) {
  if (boardNameElement) {
    boardNameElement.textContent = activeBoard ? activeBoard.name : "Principal";
  }
}

export function renderBoardsPanel({ dom, state, boards, activeBoardId }) {
  if (!dom.boardsList) {
    return;
  }

  dom.boardsList.innerHTML = "";

  boards.forEach((board) => {
    const wrapper = document.createElement("div");
    wrapper.className = `board-item${board.id === activeBoardId ? " active-table" : ""}`;
    wrapper.dataset.boardId = board.id;

    const itemHtml = state.editingBoardId === board.id
      ? `
        <div class="board-edit-row">
          <input type="text" value="${escapeHtml(board.name)}" maxlength="60" data-board-name-input="${board.id}" />
          <button type="button" data-action="confirm-edit-board" data-board-id="${board.id}">Salvar</button>
          <button type="button" data-action="cancel-edit-board" data-board-id="${board.id}">Cancelar</button>
        </div>
      `
      : `
        <button type="button" class="board-select ${board.id === activeBoardId ? "active" : ""}" data-action="switch-board" data-board-id="${board.id}">${escapeHtml(board.name)}</button>
        <div class="board-actions">
          <button type="button" data-action="edit-board" data-board-id="${board.id}">Editar</button>
          <button type="button" data-action="delete-board" data-board-id="${board.id}" ${boards.length <= 1 ? "disabled" : ""}>Excluir</button>
        </div>
      `;

    wrapper.innerHTML = itemHtml;

    if (state.deleteConfirmBoardId === board.id) {
      const confirm = document.createElement("div");
      confirm.className = "board-delete-confirm";
      confirm.innerHTML = `
        <button type="button" class="danger" data-action="confirm-delete-board" data-board-id="${board.id}">Confirmar</button>
        <button type="button" data-action="cancel-delete-board" data-board-id="${board.id}">Cancelar</button>
      `;
      wrapper.appendChild(confirm);
    }

    dom.boardsList.appendChild(wrapper);
  });
}

export function renderColumnsPanel({ dom, state, activeColumns }) {
  if (!dom.columnsList) {
    return;
  }

  dom.columnsList.innerHTML = "";

  activeColumns.forEach((column, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "board-item";
    wrapper.dataset.columnId = column.id;

    const canDelete = activeColumns.length > 1;
    const baseHtml = state.editingColumnId === column.id
      ? `
        <div class="board-edit-row">
          <input type="text" value="${escapeHtml(column.name)}" maxlength="40" data-column-name-input="${column.id}" />
          <button type="button" data-action="confirm-edit-column" data-column-id="${column.id}">Salvar</button>
          <button type="button" data-action="cancel-edit-column" data-column-id="${column.id}">Cancelar</button>
        </div>
      `
      : `
        <button type="button" class="board-select active">${escapeHtml(column.name)}</button>
        <div class="board-actions">
          <button type="button" data-action="edit-column" data-column-id="${column.id}">Editar</button>
          <button type="button" data-action="delete-column" data-column-id="${column.id}" ${canDelete ? "" : "disabled"}>Excluir</button>
        </div>
      `;

    wrapper.innerHTML = baseHtml;

    if (state.deleteConfirmColumnId === column.id) {
      const confirm = document.createElement("div");
      confirm.className = "board-delete-confirm";
      const message = index === activeColumns.length - 1 ? "Excluir coluna?" : "Excluir coluna e tarefas?";
      confirm.innerHTML = `
        <span>${message}</span>
        <button type="button" class="danger" data-action="confirm-delete-column" data-column-id="${column.id}">Confirmar</button>
        <button type="button" data-action="cancel-delete-column" data-column-id="${column.id}">Cancelar</button>
      `;
      wrapper.appendChild(confirm);
    }

    dom.columnsList.appendChild(wrapper);
  });
}

export function renderBoardColumns({ dom, state, tasks, activeColumns, context }) {
  const board = dom.boardElement;
  if (!board) {
    return;
  }

  board.innerHTML = "";

  activeColumns.forEach((column) => {
    const article = document.createElement("article");
    article.className = "column";
    article.dataset.column = column.id;

    article.innerHTML = `
      <div class="column-head">
        <h2>${escapeHtml(column.name)}</h2>
        <button type="button" class="clear-column-btn" data-action="clear-column" data-column="${column.id}">Limpar</button>
      </div>
      <div class="task-list" id="${column.id}-list"></div>
    `;

    const taskList = article.querySelector(".task-list");
    const tasksInColumn = orderTasksForColumn(tasks.filter((task) => task.status === column.id));
    tasksInColumn.forEach((task) => {
      taskList.appendChild(createTaskElement(task, context));
    });

    board.appendChild(article);
  });

  updateColumnTaskScrollLimits(dom.boardElement);
}

export function updateColumnTaskScrollLimits(boardElement) {
  if (!boardElement) {
    return;
  }

  applyUniformTaskCardHeights(boardElement);

  const firstCards = Array.from(boardElement.querySelectorAll(".task-list > .task:first-child"));
  const tallestFirstCardHeight = firstCards.reduce((maxHeight, card) => Math.max(maxHeight, card.offsetHeight), 0);
  const singleCardShellHeight = Math.max(150, Math.ceil(tallestFirstCardHeight + 32));

  boardElement.querySelectorAll(".task-list").forEach((taskList) => {
    taskList.style.minHeight = `${singleCardShellHeight}px`;

    const cards = Array.from(taskList.querySelectorAll(":scope > .task"));
    const shouldCap = cards.length > 10;

    taskList.classList.toggle("task-list-capped", shouldCap);

    if (!shouldCap) {
      taskList.style.maxHeight = "";
      return;
    }

    const firstTen = cards.slice(0, 10);
    const totalHeight = firstTen.reduce((sum, card) => sum + card.offsetHeight, 0);
    const gap = firstTen.length > 1 ? (firstTen.length - 1) * 11.52 : 0;
    taskList.style.maxHeight = `${Math.ceil(totalHeight + gap + 4)}px`;
  });
}

function applyUniformTaskCardHeights(boardElement) {
  const cards = Array.from(boardElement.querySelectorAll(".task-list > .task"));
  if (cards.length === 0) {
    return;
  }

  cards.forEach((card) => {
    card.style.minHeight = "";
  });

  const tallestCardHeight = cards.reduce((maxHeight, card) => Math.max(maxHeight, card.offsetHeight), 0);
  const normalizedHeight = Math.max(130, Math.min(220, Math.ceil(tallestCardHeight)));

  cards.forEach((card) => {
    card.style.minHeight = `${normalizedHeight}px`;
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
