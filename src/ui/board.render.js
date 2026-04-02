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
    wrapper.draggable = state.editingBoardId !== board.id;

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
          <button type="button" data-action="edit-board" data-board-id="${board.id}">Renomear</button>
          <button type="button" data-action="delete-board" data-board-id="${board.id}" ${boards.length <= 1 ? "disabled" : ""}>Excluir</button>
        </div>
      `;

    wrapper.innerHTML = itemHtml;

    if (state.deleteConfirmBoardId === board.id) {
      const isFinalStep = state.deleteConfirmBoardStep === 2;
      const confirm = document.createElement("div");
      confirm.className = "board-delete-confirm";
      confirm.innerHTML = `
        <span>${isFinalStep ? "Ultima confirmacao: excluir tabela e tarefas?" : "Tem certeza? Isso remove a tabela e tarefas."}</span>
        <button type="button" class="danger" data-action="${isFinalStep ? "confirm-delete-board" : "proceed-delete-board"}" data-board-id="${board.id}">${isFinalStep ? "Excluir tabela" : "Continuar"}</button>
        <button type="button" data-action="cancel-delete-board" data-board-id="${board.id}">Cancelar</button>
      `;
      wrapper.appendChild(confirm);
    }

    dom.boardsList.appendChild(wrapper);
  });
}

export function renderColumnsPanel({ dom, state, activeColumns, activeBoardId }) {
  if (!dom.columnsList) {
    return;
  }

  dom.columnsList.innerHTML = "";

  activeColumns.forEach((column, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "board-item";
    wrapper.dataset.columnId = column.id;
    wrapper.draggable = state.editingColumnId !== column.id;

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
          <button
            type="button"
            class="${column.important ? "important-toggle active" : "important-toggle"}"
            data-action="toggle-column-important"
            data-column-id="${column.id}"
            title="${column.important ? "Remover destaque da coluna" : "Marcar coluna como importante"}"
            aria-label="${column.important ? "Remover destaque da coluna" : "Marcar coluna como importante"}"
          >!</button>
          <button type="button" data-action="edit-column" data-column-id="${column.id}">Renomear</button>
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

  if (!dom.columnsDangerSlot) {
    return;
  }

  const isConfirming = state.deleteConfirmAllColumnsBoardId === activeBoardId;
  const isFinalStep = isConfirming && state.deleteConfirmAllColumnsStep === 2;

  if (isConfirming) {
    dom.columnsDangerSlot.innerHTML = `
      <div class="board-delete-confirm columns-danger-confirm">
        <span>${isFinalStep ? "Ultima confirmacao: excluir tudo desta tabela?" : "Tem certeza? Isso remove todas as colunas e tarefas."}</span>
        <button type="button" class="danger" data-action="${isFinalStep ? "confirm-delete-all-columns" : "proceed-delete-all-columns"}">${isFinalStep ? "Excluir tudo" : "Continuar"}</button>
        <button type="button" data-action="cancel-delete-all-columns">Cancelar</button>
      </div>
    `;
  } else {
    dom.columnsDangerSlot.innerHTML = `
      <button type="button" class="columns-danger-btn" data-action="delete-all-columns">Excluir todas as colunas</button>
    `;
  }
}

export function renderBoardColumns({ dom, state, tasks, activeColumns, context }) {
  const board = dom.boardElement;
  if (!board) {
    return;
  }

  board.innerHTML = "";
  const selectedColumn = state.focusColumnByBoard?.[state.activeBoardId];
  const fallbackColumn =
    activeColumns.find((column) => column.id === "inprogress")?.id ||
    activeColumns[0]?.id ||
    null;
  const focusColumnId = activeColumns.some((column) => column.id === selectedColumn)
    ? selectedColumn
    : fallbackColumn;
  const isFocusModeOn = document.body.classList.contains("focus-mode");
  const sortMode = state.sortModeByBoard?.[state.activeBoardId] || "manual";
  const sortDirection = state.sortDirectionByBoard?.[state.activeBoardId] || "asc";

  activeColumns.forEach((column) => {
    const collapsedByBoard = state.collapsedColumnsByBoard?.[state.activeBoardId] || {};
    const isCollapsed = Boolean(collapsedByBoard[column.id]);
    const isFocusSelected = column.id === focusColumnId;
    const focusPickerHtml = isFocusModeOn && isFocusSelected
      ? `
        <details class="focus-column-picker">
          <summary class="focus-column-trigger" aria-label="Trocar coluna de foco">
            <span>Colunas</span>
          </summary>
          <div class="focus-column-menu">
            ${activeColumns.map((option) => `
              <button
                type="button"
                class="focus-column-option${option.id === focusColumnId ? " active" : ""}"
                data-action="set-focus-column"
                data-column="${escapeHtml(option.id)}"
              >${escapeHtml(option.name)}</button>
            `).join("")}
          </div>
        </details>
      `
      : "";
    const sortPickerHtml = `
      <details class="sort-wrap">
        <summary class="sort-toggle" aria-label="Ordenar tarefas">
          <span class="sort-icon-up" aria-hidden="true">↑</span>
          <span class="sort-icon-down" aria-hidden="true">↓</span>
        </summary>
        <div class="sort-menu">
          <button type="button" class="sort-item${sortMode === "manual" ? " active" : ""}" data-action="sort-mode" data-sort-mode="manual">Manual</button>
          <button type="button" class="sort-item${sortMode === "priority" ? " active" : ""}" data-action="sort-mode" data-sort-mode="priority">Prioridade</button>
          <button type="button" class="sort-item${sortMode === "deadline" ? " active" : ""}" data-action="sort-mode" data-sort-mode="deadline">Data de início</button>
          <div class="sort-separator"></div>
          <button type="button" class="sort-item${sortDirection === "asc" ? " active" : ""}" data-action="sort-direction" data-sort-direction="asc">↑ Crescente</button>
          <button type="button" class="sort-item${sortDirection === "desc" ? " active" : ""}" data-action="sort-direction" data-sort-direction="desc">↓ Decrescente</button>
        </div>
      </details>
    `;
    const tasksInColumn = orderTasksForColumn(
      tasks.filter((task) => task.status === column.id),
      { mode: sortMode, direction: sortDirection },
    );
    const isImportantColumn = Boolean(column.important);

    const article = document.createElement("article");
    article.className = `column${isCollapsed ? " is-collapsed" : ""}${isImportantColumn ? " is-important-column" : ""}`;
    article.dataset.column = column.id;

    article.innerHTML = `
      <div class="column-head">
        <h2 class="column-title-static">${escapeHtml(column.name)}</h2>
        <div class="column-controls">
          ${sortPickerHtml}
          ${focusPickerHtml}
          <button type="button" class="clear-column-btn" data-action="clear-column" data-column="${column.id}">Limpar</button>
        </div>
      </div>
      <div class="task-list${isCollapsed ? " is-collapsed-list" : ""}" id="${column.id}-list"></div>
      <button
        type="button"
        class="column-collapse-btn"
        data-action="toggle-column-collapse"
        data-column="${column.id}"
        aria-expanded="${isCollapsed ? "false" : "true"}"
        aria-label="${isCollapsed ? "Expandir coluna" : "Recolher coluna"}"
        title="${isCollapsed ? "Expandir coluna" : "Recolher coluna"}"
      ></button>
    `;

    const taskList = article.querySelector(".task-list");
    tasksInColumn.forEach((task) => {
      taskList.appendChild(createTaskElement(task, context));
    });

    board.appendChild(article);
  });

  updateColumnTaskScrollLimits(dom.boardElement);
  updateColumnMasonrySpans(dom.boardElement);
}

export function updateColumnTaskScrollLimits(boardElement) {
  if (!boardElement) {
    return;
  }

  applyUniformTaskCardHeights(boardElement);

  const firstCards = Array.from(boardElement.querySelectorAll(".task-list:not(.is-collapsed-list) > .task:first-child"));
  const tallestFirstCardHeight = firstCards.reduce((maxHeight, card) => Math.max(maxHeight, card.offsetHeight), 0);
  const singleCardShellHeight = Math.max(126, Math.ceil(tallestFirstCardHeight + 24));

  boardElement.querySelectorAll(".task-list").forEach((taskList) => {
    if (taskList.classList.contains("is-collapsed-list")) {
      taskList.style.minHeight = "";
      taskList.style.maxHeight = "";
      taskList.classList.remove("task-list-capped");
      return;
    }

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

export function updateColumnMasonrySpans(boardElement) {
  if (!boardElement) {
    return;
  }

  const boardStyle = window.getComputedStyle(boardElement);
  const rowSize = Number.parseFloat(boardStyle.gridAutoRows || "0");
  const gap = Number.parseFloat(boardStyle.rowGap || "0");

  if (!rowSize || rowSize <= 1) {
    boardElement.querySelectorAll(".column").forEach((column) => {
      column.style.removeProperty("--column-row-span");
    });
    return;
  }

  requestAnimationFrame(() => {
    boardElement.querySelectorAll(".column").forEach((column) => {
      const columnHeight = column.getBoundingClientRect().height;
      const span = Math.max(1, Math.ceil((columnHeight + gap) / (rowSize + gap)));
      column.style.setProperty("--column-row-span", String(span));
    });
  });
}

function applyUniformTaskCardHeights(boardElement) {
  const cards = Array.from(boardElement.querySelectorAll(".task-list:not(.is-collapsed-list) > .task"));
  if (cards.length === 0) {
    return;
  }

  cards.forEach((card) => {
    card.style.minHeight = "";
  });

  const tallestCardHeight = cards.reduce((maxHeight, card) => Math.max(maxHeight, card.offsetHeight), 0);
  const normalizedHeight = Math.max(108, Math.min(190, Math.ceil(tallestCardHeight)));

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
