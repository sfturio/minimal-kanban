const STORAGE_KEY = "kanban.tasks.v1";
const BOARDS_KEY = "kanban.boards.v1";
const ACTIVE_BOARD_KEY = "kanban.active-board.v1";
const THEME_KEY = "kanban.theme.v1";
const FOCUS_KEY = "kanban.focus.v1";
const COLUMNS = ["todo", "inprogress", "done"];
const DEFAULT_BOARD_NAME = "Principal";

let boards = loadBoards();
let activeBoardId = loadActiveBoardId(boards);
let tasks = loadTasks().map(normalizeTask);
let draggingTaskId = null;

const form = document.getElementById("task-form");
const titleInput = document.getElementById("task-title");
const descriptionInput = document.getElementById("task-description");
const themeToggleButton = document.getElementById("theme-toggle");
const themeIcon = document.getElementById("theme-icon");
const focusToggleButton = document.getElementById("focus-toggle");
const focusLabel = document.getElementById("focus-label");
const boardMenuToggle = document.getElementById("board-menu-toggle");
const boardMenuOverlay = document.getElementById("board-menu-overlay");
const boardList = document.getElementById("board-list");
const addBoardButton = document.getElementById("add-board-btn");
const currentBoardName = document.getElementById("current-board-name");
const closeBoardMenuButton = document.getElementById("close-board-menu-btn");

form.addEventListener("submit", onCreateTask);
themeToggleButton?.addEventListener("click", toggleTheme);
focusToggleButton?.addEventListener("click", toggleFocusMode);
boardMenuToggle?.addEventListener("click", toggleBoardMenu);
addBoardButton?.addEventListener("click", addBoard);
closeBoardMenuButton?.addEventListener("click", closeBoardMenu);
boardMenuOverlay?.addEventListener("click", (event) => {
  if (!event.target.closest(".board-menu")) {
    closeBoardMenu();
  }
});
document.addEventListener("keydown", (event) => {
  if ((event.key === "Escape" || event.key === "Esc") && boardMenuOverlay && !boardMenuOverlay.hasAttribute("hidden")) {
    closeBoardMenu();
  }
});

initTheme();
initFocusMode();
setupDropZones();
render();
renderBoardMenu();
updateCurrentBoardName();

function loadBoards() {
  try {
    const raw = localStorage.getItem(BOARDS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [createBoard(DEFAULT_BOARD_NAME)];
    }

    const sanitized = parsed
      .filter((board) => board && typeof board.id === "string" && typeof board.name === "string")
      .map((board) => ({ id: board.id, name: board.name.trim() || DEFAULT_BOARD_NAME }));

    return sanitized.length ? sanitized : [createBoard(DEFAULT_BOARD_NAME)];
  } catch {
    return [createBoard(DEFAULT_BOARD_NAME)];
  }
}

function loadActiveBoardId(boardItems) {
  const stored = localStorage.getItem(ACTIVE_BOARD_KEY);
  if (stored && boardItems.some((board) => board.id === stored)) {
    return stored;
  }
  return boardItems[0].id;
}

function saveBoards() {
  localStorage.setItem(BOARDS_KEY, JSON.stringify(boards));
  localStorage.setItem(ACTIVE_BOARD_KEY, activeBoardId);
}

function createBoard(name) {
  return {
    id: crypto.randomUUID(),
    name: (name || DEFAULT_BOARD_NAME).trim(),
  };
}

function toggleBoardMenu() {
  if (!boardMenuOverlay) {
    return;
  }

  const shouldOpen = boardMenuOverlay.hasAttribute("hidden");
  if (shouldOpen) {
    openBoardMenu();
  } else {
    closeBoardMenu();
  }
}

function openBoardMenu() {
  if (!boardMenuOverlay) {
    return;
  }

  renderBoardMenu();
  boardMenuOverlay.hidden = false;
}

function closeBoardMenu() {
  if (!boardMenuOverlay) {
    return;
  }

  boardMenuOverlay.hidden = true;
}

function renderBoardMenu() {
  if (!boardList) {
    return;
  }

  boardList.innerHTML = "";

  boards.forEach((board) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `board-item${board.id === activeBoardId ? " active" : ""}`;
    button.textContent = board.name;
    button.addEventListener("click", () => {
      activeBoardId = board.id;
      saveBoards();
      updateCurrentBoardName();
      render();
      renderBoardMenu();
      closeBoardMenu();
    });

    boardList.appendChild(button);
  });
}

function addBoard() {
  const input = window.prompt("Nome da nova board:", "Nova board");
  if (!input) {
    return;
  }

  const name = input.trim();
  if (!name) {
    return;
  }

  const board = createBoard(name);
  boards.push(board);
  activeBoardId = board.id;
  saveBoards();
  updateCurrentBoardName();
  render();
  renderBoardMenu();
  closeBoardMenu();
}

function updateCurrentBoardName() {
  if (!currentBoardName) {
    return;
  }

  const board = boards.find((item) => item.id === activeBoardId);
  currentBoardName.textContent = board ? board.name : DEFAULT_BOARD_NAME;
}

function initTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = stored || (prefersDark ? "dark" : "light");
  applyTheme(theme);
}

function toggleTheme() {
  const isDark = document.body.classList.contains("dark");
  applyTheme(isDark ? "light" : "dark");
}

function applyTheme(theme) {
  const isDark = theme === "dark";
  document.body.classList.toggle("dark", isDark);
  localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");

  if (themeIcon) {
    themeIcon.textContent = isDark ? "light_mode" : "dark_mode";
  }

  if (themeToggleButton) {
    themeToggleButton.setAttribute("aria-pressed", String(isDark));
  }
}

function initFocusMode() {
  const stored = localStorage.getItem(FOCUS_KEY) === "on";
  applyFocusMode(stored);
}

function toggleFocusMode() {
  const isOn = document.body.classList.contains("focus-mode");
  applyFocusMode(!isOn);
}

function applyFocusMode(on) {
  document.body.classList.toggle("focus-mode", on);
  localStorage.setItem(FOCUS_KEY, on ? "on" : "off");

  if (focusToggleButton) {
    focusToggleButton.classList.toggle("active", on);
    focusToggleButton.setAttribute("aria-pressed", String(on));
    focusToggleButton.setAttribute(
      "aria-label",
      on ? "Desativar modo foco" : "Ativar modo foco",
    );
    if (on) {
      focusToggleButton.classList.remove("pulse");
      void focusToggleButton.offsetWidth;
      focusToggleButton.classList.add("pulse");
    }
  }

  if (focusLabel) {
    focusLabel.textContent = on ? "Sair do foco" : "Modo Foco";
  }
}

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeTask(task) {
  const description = (task.description || "").trim();
  const rawCategory = (task.category || "").trim();
  const categoryFromDescription = description ? inferCategory(description) : "";
  const category =
    rawCategory && rawCategory.toLowerCase() !== "geral"
      ? rawCategory
      : categoryFromDescription;

  return {
    ...task,
    boardId: task.boardId || activeBoardId,
    category,
  };
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function onCreateTask(event) {
  event.preventDefault();

  const title = titleInput.value.trim();
  const description = descriptionInput.value.trim();

  if (!title) {
    titleInput.focus();
    return;
  }

  tasks.push({
    id: crypto.randomUUID(),
    boardId: activeBoardId,
    title,
    description,
    category: description ? inferCategory(description) : "",
    status: "todo",
  });

  form.reset();
  titleInput.focus();
  saveTasks();
  render();
}

function inferCategory(description) {
  return description.slice(0, 16).trim();
}

function render() {
  COLUMNS.forEach((column) => {
    const list = document.getElementById(`${column}-list`);
    list.innerHTML = "";

    tasks
      .filter((task) => task.boardId === activeBoardId && task.status === column)
      .forEach((task) => list.appendChild(createTaskElement(task)));
  });
}

function createTaskElement(task) {
  const card = document.createElement("article");
  card.className = `task${task.status === "done" ? " done" : ""}`;
  card.draggable = true;
  card.dataset.id = task.id;

  card.innerHTML = `
    <p class="task-title"></p>
    <div class="rename-row">
      <input class="rename-input" type="text" maxlength="120" />
      <button type="button" class="confirm-rename" data-action="confirm-rename">Rename</button>
    </div>
    <span class="task-category"></span>
    <div class="task-actions">
      <button type="button" data-action="left">←</button>
      <button type="button" data-action="right">→</button>
      <button type="button" class="delete" data-action="delete">Delete</button>
      <button type="button" class="confirm-delete-btn" data-action="confirm-delete">Confirm</button>
      <button type="button" class="cancel-delete-btn" data-action="cancel-delete">Cancel</button>
    </div>
  `;

  card.querySelector(".task-title").textContent = task.title;
  const titleEl = card.querySelector(".task-title");
  const renameInput = card.querySelector(".rename-input");
  renameInput.value = task.title;

  titleEl.addEventListener("click", () => {
    card.classList.remove("confirm-delete");
    card.classList.add("renaming");
    renameInput.value = task.title;
    renameInput.focus();
    renameInput.select();
  });

  renameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      renameTask(task.id, renameInput.value, card);
    }
    if (event.key === "Escape") {
      event.preventDefault();
      card.classList.remove("renaming");
      renameInput.value = task.title;
    }
  });

  renameInput.addEventListener("blur", () => {
    setTimeout(() => {
      if (!card.contains(document.activeElement)) {
        card.classList.remove("renaming");
        renameInput.value = task.title;
      }
    }, 0);
  });

  const categoryEl = card.querySelector(".task-category");
  categoryEl.textContent = task.category || "";
  categoryEl.style.display = task.category ? "inline-block" : "none";

  const leftButton = card.querySelector('[data-action="left"]');
  const rightButton = card.querySelector('[data-action="right"]');

  leftButton.disabled = task.status === "todo";
  rightButton.disabled = task.status === "done";

  card.addEventListener("click", (event) => {
    const action = event.target.dataset.action;
    if (!action) {
      return;
    }

    if (action === "delete") {
      card.classList.remove("renaming");
      card.classList.add("confirm-delete");
      return;
    }

    if (action === "confirm-delete") {
      deleteTask(task.id);
      return;
    }

    if (action === "cancel-delete") {
      card.classList.remove("confirm-delete");
      return;
    }

    if (action === "left") {
      card.classList.remove("confirm-delete");
      moveTask(task.id, -1);
      return;
    }

    if (action === "right") {
      card.classList.remove("confirm-delete");
      moveTask(task.id, 1);
      return;
    }

    if (action === "confirm-rename") {
      card.classList.remove("confirm-delete");
      renameTask(task.id, renameInput.value, card);
    }
  });

  card.addEventListener("dragstart", () => {
    draggingTaskId = task.id;
    card.classList.add("dragging");
  });

  card.addEventListener("dragend", () => {
    draggingTaskId = null;
    card.classList.remove("dragging");
    document.querySelectorAll(".task-list").forEach((list) => {
      list.classList.remove("drag-over");
    });
  });

  return card;
}

function renameTask(taskId, nextTitle, cardElement) {
  const title = (nextTitle || "").trim();
  if (!title) {
    return;
  }

  const task = tasks.find((item) => item.id === taskId);
  if (!task) {
    return;
  }

  task.title = title;
  saveTasks();
  render();

  if (cardElement) {
    cardElement.classList.remove("renaming");
  }
}

function moveTask(taskId, direction) {
  const task = tasks.find((item) => item.id === taskId);
  if (!task) {
    return;
  }

  const index = COLUMNS.indexOf(task.status);
  const nextIndex = index + direction;

  if (nextIndex < 0 || nextIndex >= COLUMNS.length) {
    return;
  }

  task.status = COLUMNS[nextIndex];
  saveTasks();
  render();
}

function deleteTask(taskId) {
  tasks = tasks.filter((task) => task.id !== taskId);
  saveTasks();
  render();
}

function setupDropZones() {
  document.querySelectorAll(".column").forEach((columnElement) => {
    const taskList = columnElement.querySelector(".task-list");
    const column = columnElement.dataset.column;

    taskList.addEventListener("dragover", (event) => {
      event.preventDefault();
      taskList.classList.add("drag-over");
    });

    taskList.addEventListener("dragleave", () => {
      taskList.classList.remove("drag-over");
    });

    taskList.addEventListener("drop", (event) => {
      event.preventDefault();
      taskList.classList.remove("drag-over");

      if (!draggingTaskId) {
        return;
      }

      const task = tasks.find((item) => item.id === draggingTaskId);
      if (!task || task.status === column || task.boardId !== activeBoardId) {
        return;
      }

      task.status = column;
      saveTasks();
      render();
    });
  });
}
