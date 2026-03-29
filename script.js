const LEGACY_STORAGE_KEY = "kanban.tasks.v1";
const TASKS_KEY_PREFIX = "kanban.tasks.board.v2.";
const BOARDS_KEY = "kanban.boards.v1";
const ACTIVE_BOARD_KEY = "kanban.active-board.v1";
const THEME_KEY = "kanban.theme.v1";
const FOCUS_KEY = "kanban.focus.v1";
const COLUMNS = ["todo", "inprogress", "done"];
const DEFAULT_BOARD_ID = "principal";

let boards = loadBoards();
let activeBoardId = loadActiveBoardId();
let tasks = loadTasksForBoard(activeBoardId).map(normalizeTask);
let draggingTaskId = null;
let dragOverListId = null;
let editingTaskId = null;
let deleteConfirmTaskId = null;
let editingBoardId = null;
let deleteConfirmBoardId = null;
let clearConfirmColumn = null;

const form = document.getElementById("task-form");
const titleInput = document.getElementById("task-title");
const descriptionInput = document.getElementById("task-description");
const boardName = document.getElementById("board-name");

const boardToggleButton = document.getElementById("board-toggle");
const boardsOverlay = document.getElementById("boards-overlay");
const boardsCloseButton = document.getElementById("boards-close");
const boardsList = document.getElementById("boards-list");
const newBoardInput = document.getElementById("new-board-input");
const createBoardButton = document.getElementById("create-board-btn");
const exportBackupButton = document.getElementById("export-backup-btn");
const importBackupButton = document.getElementById("import-backup-btn");
const backupFileInput = document.getElementById("backup-file-input");
const backupStatus = document.getElementById("backup-status");

const iaGenerateButton = document.getElementById("ia-generate-btn");
const aiModalOverlay = document.getElementById("ai-modal-overlay");
const aiPlanInput = document.getElementById("ai-plan-input");
const aiCancelButton = document.getElementById("ai-cancel-btn");
const aiGenerateConfirmButton = document.getElementById("ai-generate-confirm-btn");
const aiCloseButton = document.getElementById("ai-close-btn");

const themeToggleButton = document.getElementById("theme-toggle");
const themeIcon = document.getElementById("theme-icon");
const focusToggleButton = document.getElementById("focus-toggle");
const focusLabel = document.getElementById("focus-label");
const clearColumnButtons = document.querySelectorAll('[data-action="clear-column"]');

form.addEventListener("submit", onCreateTask);
iaGenerateButton?.addEventListener("click", openAIPlanningModal);
aiCancelButton?.addEventListener("click", closeAIPlanningModal);
aiGenerateConfirmButton?.addEventListener("click", onGenerateIATasks);
aiCloseButton?.addEventListener("click", closeAIPlanningModal);
aiModalOverlay?.addEventListener("click", onModalOverlayClick);

boardToggleButton?.addEventListener("click", toggleBoardsPanel);
boardsCloseButton?.addEventListener("click", closeBoardsPanel);
boardsOverlay?.addEventListener("click", onBoardsOverlayClick);
createBoardButton?.addEventListener("click", onCreateBoard);
newBoardInput?.addEventListener("keydown", onNewBoardInputKeydown);
exportBackupButton?.addEventListener("click", onExportBackup);
importBackupButton?.addEventListener("click", onImportBackupClick);
backupFileInput?.addEventListener("change", onBackupFileSelected);

boardsList?.addEventListener("click", onBoardsListClick);
boardsList?.addEventListener("keydown", onBoardsListKeydown);

document.addEventListener("keydown", onGlobalKeydown);
document.addEventListener("visibilitychange", onVisibilityChange);

themeToggleButton?.addEventListener("click", toggleTheme);
focusToggleButton?.addEventListener("click", toggleFocusMode);
clearColumnButtons.forEach((button) => {
  button.addEventListener("click", onClearColumnClick);
});

initTheme();
initFocusMode();
setupDropZones();
updateBoardName();
renderBoardsPanel();
updateClearColumnButtons();
render();

function initTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  const theme = stored || "dark";
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

function loadBoards() {
  try {
    const raw = localStorage.getItem(BOARDS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(parsed) ? parsed : [];

    const normalized = list
      .map((item) => ({
        id: String(item.id || "").trim(),
        name: String(item.name || "").trim(),
      }))
      .filter((item) => item.id && item.name);

    if (normalized.length === 0) {
      return [{ id: DEFAULT_BOARD_ID, name: "Principal" }];
    }

    return normalized;
  } catch {
    return [{ id: DEFAULT_BOARD_ID, name: "Principal" }];
  }
}

function saveBoards() {
  localStorage.setItem(BOARDS_KEY, JSON.stringify(boards));
}

function loadActiveBoardId() {
  const stored = localStorage.getItem(ACTIVE_BOARD_KEY);
  const valid = boards.find((board) => board.id === stored);
  const active = valid ? valid.id : boards[0].id;
  localStorage.setItem(ACTIVE_BOARD_KEY, active);
  return active;
}

function setActiveBoardId(boardId) {
  activeBoardId = boardId;
  localStorage.setItem(ACTIVE_BOARD_KEY, boardId);
}

function taskStorageKey(boardId) {
  return `${TASKS_KEY_PREFIX}${boardId}`;
}

function loadTasksForBoard(boardId) {
  try {
    const key = taskStorageKey(boardId);
    const raw = localStorage.getItem(key);

    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }

    if (boardId === DEFAULT_BOARD_ID) {
      const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacyRaw) {
        const legacyParsed = JSON.parse(legacyRaw);
        const legacyTasks = Array.isArray(legacyParsed) ? legacyParsed : [];
        localStorage.setItem(key, JSON.stringify(legacyTasks));
        return legacyTasks;
      }
    }

    return [];
  } catch {
    return [];
  }
}

function saveTasks() {
  localStorage.setItem(taskStorageKey(activeBoardId), JSON.stringify(tasks));
}

function normalizeTask(task) {
  return {
    id: task.id || crypto.randomUUID(),
    title: String(task.title || "").trim(),
    description: String(task.description || ""),
    category: normalizeCategory(task.category, task.description),
    assignee: typeof task.assignee === "string" ? task.assignee.trim() : null,
    tags: Array.isArray(task.tags) ? task.tags.filter(Boolean) : [],
    deadline: typeof task.deadline === "string" ? task.deadline.trim() : null,
    status: COLUMNS.includes(task.status) ? task.status : "todo",
    priority: task.priority === "high" ? "high" : task.priority === "medium" ? "medium" : "normal",
    createdAt: task.createdAt ? new Date(task.createdAt) : new Date(),
  };
}

function updateBoardName() {
  const active = boards.find((board) => board.id === activeBoardId);
  if (boardName) {
    boardName.textContent = active ? active.name : "Principal";
  }
}

function toggleBoardsPanel() {
  if (!boardsOverlay) {
    return;
  }

  if (boardsOverlay.hidden) {
    openBoardsPanel();
  } else {
    closeBoardsPanel();
  }
}

function openBoardsPanel() {
  if (!boardsOverlay) {
    return;
  }

  renderBoardsPanel();
  boardsOverlay.hidden = false;

  if (boardToggleButton) {
    boardToggleButton.setAttribute("aria-expanded", "true");
  }

  updatePageLock();
}

function closeBoardsPanel() {
  if (!boardsOverlay) {
    return;
  }

  boardsOverlay.hidden = true;
  editingBoardId = null;
  deleteConfirmBoardId = null;

  if (boardToggleButton) {
    boardToggleButton.setAttribute("aria-expanded", "false");
  }

  updatePageLock();
}

function onBoardsOverlayClick(event) {
  if (event.target === boardsOverlay) {
    closeBoardsPanel();
  }
}

function onCreateBoard() {
  const name = (newBoardInput?.value || "").trim();
  if (!name) {
    newBoardInput?.focus();
    return;
  }

  const board = {
    id: crypto.randomUUID(),
    name,
  };

  boards.push(board);
  saveBoards();

  if (newBoardInput) {
    newBoardInput.value = "";
  }

  switchBoard(board.id);
  openBoardsPanel();
}

function onExportBackup() {
  saveTasks();

  const payload = buildBackupPayload();
  const content = JSON.stringify(payload, null, 2);
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const stamp = new Date()
    .toISOString()
    .replaceAll(":", "-")
    .replaceAll(".", "-");
  const filename = `fluxo-essencial-backup-${stamp}.json`;

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  setBackupStatus("Backup exportado.");
}

function onImportBackupClick() {
  backupFileInput?.click();
}

async function onBackupFileSelected(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  const file = target.files?.[0];
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    applyBackupData(parsed);
    setBackupStatus("Backup importado.");
  } catch {
    setBackupStatus("Arquivo inválido.");
  } finally {
    target.value = "";
  }
}

function buildBackupPayload() {
  const tasksByBoard = {};

  boards.forEach((board) => {
    const boardTasks = loadTasksForBoard(board.id).map(normalizeTask);
    tasksByBoard[board.id] = boardTasks;
  });

  tasksByBoard[activeBoardId] = tasks.map(normalizeTask);

  return {
    app: "fluxo-essencial",
    version: 1,
    exportedAt: new Date().toISOString(),
    boards,
    activeBoardId,
    tasksByBoard,
    settings: {
      theme: document.body.classList.contains("dark") ? "dark" : "light",
      focusMode: document.body.classList.contains("focus-mode") ? "on" : "off",
    },
  };
}

function applyBackupData(data) {
  const importedBoards = Array.isArray(data?.boards)
    ? data.boards
        .map((item) => ({
          id: String(item?.id || "").trim(),
          name: String(item?.name || "").trim(),
        }))
        .filter((item) => item.id && item.name)
    : [];

  if (importedBoards.length === 0) {
    throw new Error("invalid backup");
  }

  const importedTasksByBoard =
    data && typeof data.tasksByBoard === "object" && data.tasksByBoard
      ? data.tasksByBoard
      : {};

  const nextActiveBoardId = importedBoards.some((board) => board.id === data?.activeBoardId)
    ? data.activeBoardId
    : importedBoards[0].id;

  const taskKeysToRemove = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key && key.startsWith(TASKS_KEY_PREFIX)) {
      taskKeysToRemove.push(key);
    }
  }
  taskKeysToRemove.forEach((key) => localStorage.removeItem(key));

  importedBoards.forEach((board) => {
    const rawTasks = Array.isArray(importedTasksByBoard[board.id])
      ? importedTasksByBoard[board.id]
      : [];
    const normalized = rawTasks.map(normalizeTask);
    localStorage.setItem(taskStorageKey(board.id), JSON.stringify(normalized));
  });

  boards = importedBoards;
  saveBoards();
  setActiveBoardId(nextActiveBoardId);
  tasks = loadTasksForBoard(nextActiveBoardId).map(normalizeTask);
  editingTaskId = null;
  deleteConfirmTaskId = null;
  editingBoardId = null;
  deleteConfirmBoardId = null;
  clearConfirmColumn = null;
  updateClearColumnButtons();

  const theme = data?.settings?.theme;
  if (theme === "dark" || theme === "light") {
    applyTheme(theme);
  }

  const focus = data?.settings?.focusMode;
  if (focus === "on" || focus === "off") {
    applyFocusMode(focus === "on");
  }

  updateBoardName();
  renderBoardsPanel();
  render();
}

function setBackupStatus(message) {
  if (!backupStatus) {
    return;
  }

  backupStatus.textContent = message;
  window.clearTimeout(setBackupStatus.timerId);
  setBackupStatus.timerId = window.setTimeout(() => {
    backupStatus.textContent = "";
  }, 2200);
}

function onNewBoardInputKeydown(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    onCreateBoard();
  }
}

function renderBoardsPanel() {
  if (!boardsList) {
    return;
  }

  boardsList.innerHTML = "";

  boards.forEach((board) => {
    const wrapper = document.createElement("div");
    wrapper.className = `board-item${board.id === activeBoardId ? " active-table" : ""}`;
    wrapper.dataset.id = board.id;

    const isActive = board.id === activeBoardId;
    const isEditing = board.id === editingBoardId;
    const isDeleteConfirm = board.id === deleteConfirmBoardId;

    if (isEditing) {
      wrapper.innerHTML = `
        <div class="board-edit-row">
          <input type="text" class="board-edit-input" value="${escapeHtml(board.name)}" maxlength="60" />
          <button type="button" data-action="confirm-rename">Salvar</button>
          <button type="button" data-action="cancel-rename">Cancelar</button>
        </div>
      `;
    } else {
      wrapper.innerHTML = `
        <button type="button" class="board-select${isActive ? " active" : ""}" data-action="select">${escapeHtml(board.name)}</button>
        <div class="board-actions">
          <button type="button" data-action="rename">Renomear</button>
          <button type="button" data-action="delete">Excluir</button>
        </div>
      `;
    }

    if (isDeleteConfirm) {
      const confirm = document.createElement("div");
      confirm.className = "board-delete-confirm";
      confirm.innerHTML = `
        <button type="button" class="danger" data-action="confirm-delete-board">Confirmar</button>
        <button type="button" data-action="cancel-delete-board">Cancelar</button>
      `;
      wrapper.appendChild(confirm);
    }

    boardsList.appendChild(wrapper);

    if (isEditing) {
      const input = wrapper.querySelector(".board-edit-input");
      input?.focus();
      input?.select();
    }
  });
}

function onBoardsListClick(event) {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const actionElement = target.closest("[data-action]");
  if (!(actionElement instanceof HTMLElement)) {
    return;
  }

  const action = actionElement.dataset.action;
  if (!action) {
    return;
  }

  const item = actionElement.closest(".board-item");
  const boardId = item?.dataset.id;
  if (!boardId) {
    return;
  }

  if (action === "select") {
    switchBoard(boardId);
    closeBoardsPanel();
    return;
  }

  if (action === "rename") {
    deleteConfirmBoardId = null;
    editingBoardId = boardId;
    renderBoardsPanel();
    return;
  }

  if (action === "cancel-rename") {
    editingBoardId = null;
    renderBoardsPanel();
    return;
  }

  if (action === "confirm-rename") {
    const input = item.querySelector(".board-edit-input");
    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    const nextName = input.value.trim();
    if (!nextName) {
      input.focus();
      return;
    }

    const board = boards.find((entry) => entry.id === boardId);
    if (!board) {
      return;
    }

    board.name = nextName;
    editingBoardId = null;
    saveBoards();
    updateBoardName();
    renderBoardsPanel();
    return;
  }

  if (action === "delete") {
    if (boards.length <= 1) {
      return;
    }

    editingBoardId = null;
    deleteConfirmBoardId = deleteConfirmBoardId === boardId ? null : boardId;
    renderBoardsPanel();
    return;
  }

  if (action === "cancel-delete-board") {
    deleteConfirmBoardId = null;
    renderBoardsPanel();
    return;
  }

  if (action === "confirm-delete-board") {
    deleteBoard(boardId);
  }
}

function onBoardsListKeydown(event) {
  if (event.key !== "Enter") {
    return;
  }

  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  if (target.classList.contains("board-edit-input")) {
    event.preventDefault();
    const row = target.closest(".board-item");
    const confirmButton = row?.querySelector('[data-action="confirm-rename"]');
    confirmButton?.click();
  }
}

function deleteBoard(boardId) {
  if (boards.length <= 1) {
    return;
  }

  const deletingActive = boardId === activeBoardId;
  boards = boards.filter((board) => board.id !== boardId);
  saveBoards();

  localStorage.removeItem(taskStorageKey(boardId));

  if (deletingActive) {
    const fallback = boards[0];
    switchBoard(fallback.id, { persistCurrentBoard: false });
  } else {
    renderBoardsPanel();
  }

  deleteConfirmBoardId = null;
  editingBoardId = null;
  renderBoardsPanel();
}

function switchBoard(boardId, options = {}) {
  const { persistCurrentBoard = true } = options;

  if (boardId === activeBoardId) {
    updateBoardName();
    renderBoardsPanel();
    return;
  }

  if (persistCurrentBoard) {
    saveTasks();
  }

  setActiveBoardId(boardId);
  tasks = loadTasksForBoard(boardId).map(normalizeTask);
  editingTaskId = null;
  deleteConfirmTaskId = null;

  updateBoardName();
  renderBoardsPanel();
  render();
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
    title,
    description,
    category: inferCategory(description),
    status: "todo",
  });

  form.reset();
  titleInput.focus();
  saveTasks();
  render();
}

function onGenerateIATasks() {
  const text = aiPlanInput?.value.trim() || "";
  const planText = text || getExamplePlanInput();

  const generatedCount = gerarTasksIA(planText);
  if (generatedCount === 0) {
    return;
  }

  if (aiPlanInput) {
    aiPlanInput.value = "";
  }

  closeAIPlanningModal();
}

function getExamplePlanInput() {
  return "revisar e-mails (manhã) ; treino de peito (academia) ; estudar JavaScript (noite)";
}

function gerarTasksIA(text) {
  const plannedTasks = parseTasks(text);

  if (plannedTasks.length === 0) {
    return 0;
  }

  tasks = [...plannedTasks, ...tasks];
  saveTasks();
  render();

  console.log("Planejando com IA:", plannedTasks);
  return plannedTasks.length;
}

function parseTasks(input) {
  const rawItems = String(input || "")
    .split(";")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return rawItems
    .map(parseTaskItem)
    .filter((task) => task.title.length > 0)
    .map((task) => ({
      id: crypto.randomUUID(),
      title: task.title,
      description: task.category || "",
      category: task.category,
      assignee: task.assignee,
      tags: task.tags,
      deadline: task.deadline,
      status: task.column === "em_andamento" ? "inprogress" : "todo",
      priority: task.priority,
      createdAt: task.createdAt,
    }));
}

function parseTaskItem(rawText) {
  const trimmed = String(rawText || "").trim();
  if (!trimmed) {
    return {
      title: "",
      column: "proximos",
      category: null,
      assignee: null,
      tags: [],
      deadline: null,
      priority: "normal",
      createdAt: new Date(),
    };
  }

  const priorityMatch = trimmed.match(/^!+/);
  const priorityCount = priorityMatch ? priorityMatch[0].length : 0;
  let withoutPriority = trimmed.replace(/^!+/, "").trim();

  const categoryMatch = withoutPriority.match(/^(.*)\(([^)]+)\)\s*$/);
  const baseText = categoryMatch ? categoryMatch[1].trim() : withoutPriority;
  const category = categoryMatch ? categoryMatch[2].trim() : null;

  const assigneeMatch = baseText.match(/@([^\s#\+]+)/);
  const assignee = assigneeMatch ? assigneeMatch[1].trim() : null;

  const tags = [];
  const tagMatches = baseText.match(/#([^\s@+\#]+)/g) || [];
  tagMatches.forEach((match) => {
    const value = match.slice(1).trim();
    if (value && !tags.includes(value)) {
      tags.push(value);
    }
  });

  const deadlineMatch = baseText.match(/\+([^\s@#\+]+)/);
  const deadline = deadlineMatch ? deadlineMatch[1].trim() : null;

  let title = baseText
    .replace(/@([^\s#\+]+)/g, "")
    .replace(/#([^\s@+\#]+)/g, "")
    .replace(/\+([^\s@#\+]+)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  const isPriority = priorityCount >= 1;
  const priority = priorityCount >= 2 ? "high" : isPriority ? "medium" : "normal";

  return {
    title,
    column: isPriority ? "em_andamento" : "proximos",
    category: category && category.length > 0 ? category : null,
    assignee,
    tags,
    deadline,
    priority,
    createdAt: new Date(),
  };
}

function openAIPlanningModal() {
  if (!aiModalOverlay) {
    return;
  }

  aiModalOverlay.hidden = false;
  updatePageLock();
  aiPlanInput?.focus();
}

function closeAIPlanningModal() {
  if (aiModalOverlay) {
    aiModalOverlay.hidden = true;
  }

  updatePageLock();
}

function onModalOverlayClick(event) {
  if (event.target === aiModalOverlay) {
    closeAIPlanningModal();
  }
}

function onGlobalKeydown(event) {
  if (event.key !== "Escape") {
    return;
  }

  if (aiModalOverlay && !aiModalOverlay.hidden) {
    closeAIPlanningModal();
    return;
  }

  if (boardsOverlay && !boardsOverlay.hidden) {
    closeBoardsPanel();
    return;
  }

  if (clearConfirmColumn) {
    clearConfirmColumn = null;
    updateClearColumnButtons();
  }
}

function onVisibilityChange() {
  if (document.visibilityState === "visible") {
    return;
  }

  closeAIPlanningModal();
  closeBoardsPanel();
  clearConfirmColumn = null;
  updateClearColumnButtons();
}

function updatePageLock() {
  const aiOpen = aiModalOverlay && !aiModalOverlay.hidden;
  const boardsOpen = boardsOverlay && !boardsOverlay.hidden;
  document.body.style.overflow = aiOpen || boardsOpen ? "hidden" : "";
}

function inferCategory(description) {
  const value = String(description || "").trim();
  return value;
}

function normalizeCategory(category, description) {
  if (typeof category === "string") {
    const value = category.trim();
    return value.length > 0 ? value : null;
  }

  const fromDescription = inferCategory(description || "");
  return fromDescription.length > 0 ? fromDescription : null;
}

function onClearColumnClick(event) {
  const target = event.currentTarget;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const column = target.dataset.column;
  if (!COLUMNS.includes(column)) {
    return;
  }

  if (clearConfirmColumn === column) {
    clearConfirmColumn = null;
    clearColumnTasks(column);
    updateClearColumnButtons();
    return;
  }

  clearConfirmColumn = column;
  updateClearColumnButtons();
}

function clearColumnTasks(column) {
  const previousCount = tasks.length;
  tasks = tasks.filter((task) => task.status !== column);

  if (tasks.length === previousCount) {
    return;
  }

  editingTaskId = null;
  deleteConfirmTaskId = null;
  saveTasks();
  render();
}

function updateClearColumnButtons() {
  clearColumnButtons.forEach((button) => {
    const column = button.dataset.column;
    const isConfirming = clearConfirmColumn === column;
    button.classList.toggle("confirming", isConfirming);
    button.textContent = isConfirming ? "Confirmar" : "Limpar";
  });
}

function render() {
  COLUMNS.forEach((column) => {
    const list = document.getElementById(`${column}-list`);
    if (!list) {
      return;
    }

    list.innerHTML = "";

    tasks
      .filter((task) => task.status === column)
      .forEach((task) => list.appendChild(createTaskElement(task)));
  });
}

function createTaskElement(task) {
  const card = document.createElement("article");
  const priorityClass = task.priority === "high" ? " priority-high" : task.priority === "medium" ? " priority-medium" : "";
  card.className = `task${task.status === "done" ? " done" : ""}${priorityClass}`;
  card.draggable = true;
  card.dataset.id = task.id;

  const isEditing = editingTaskId === task.id;
  const isDeleteConfirming = deleteConfirmTaskId === task.id;

  card.innerHTML = `
    <div class="task-main"></div>
    <div class="task-actions">
      <button type="button" data-action="left">←</button>
      <button type="button" data-action="right">→</button>
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
      <button type="button" class="task-title-btn" data-action="edit" aria-label="Renomear tarefa">
        <p class="task-title"></p>
      </button>
    `;

    if (task.category) {
      const category = document.createElement("span");
      category.className = "task-category";
      category.textContent = task.category;
      main.appendChild(category);
    }
  }

  const title = card.querySelector(".task-title");
  if (title) {
    title.textContent = task.title;
  }

  const leftButton = card.querySelector('[data-action="left"]');
  const rightButton = card.querySelector('[data-action="right"]');

  leftButton.disabled = task.status === "todo";
  rightButton.disabled = task.status === "done";

  card.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const action = target.dataset.action;
    if (!action) {
      return;
    }

    if (action === "left") {
      moveTask(task.id, -1);
      return;
    }

    if (action === "right") {
      moveTask(task.id, 1);
      return;
    }

    if (action === "edit") {
      deleteConfirmTaskId = null;
      editingTaskId = task.id;
      render();
      requestAnimationFrame(() => {
        const activeCard = document.querySelector(`.task[data-id="${task.id}"]`);
        const editInput = activeCard?.querySelector(".task-edit-input");
        editInput?.focus();
        editInput?.select();
      });
      return;
    }

    if (action === "confirm-edit") {
      const input = card.querySelector(".task-edit-input");
      if (!(input instanceof HTMLInputElement)) {
        return;
      }

      const nextTitle = input.value.trim();
      if (!nextTitle) {
        input.focus();
        return;
      }

      const selectedTask = tasks.find((item) => item.id === task.id);
      if (!selectedTask) {
        return;
      }

      selectedTask.title = nextTitle;
      editingTaskId = null;
      saveTasks();
      render();
      return;
    }

    if (action === "cancel-edit") {
      editingTaskId = null;
      render();
      return;
    }

    if (action === "delete") {
      editingTaskId = null;
      const confirmBox = card.querySelector(".task-delete-confirm");
      if (!(confirmBox instanceof HTMLElement)) {
        return;
      }

      if (deleteConfirmTaskId === task.id) {
        deleteConfirmTaskId = null;
        confirmBox.classList.remove("show");
        return;
      }

      closeAllTaskDeleteConfirms();
      deleteConfirmTaskId = task.id;
      confirmBox.classList.add("show");
      return;
    }

    if (action === "confirm-delete") {
      deleteTask(task.id);
      return;
    }

    if (action === "cancel-delete") {
      deleteConfirmTaskId = null;
      const confirmBox = card.querySelector(".task-delete-confirm");
      if (confirmBox instanceof HTMLElement) {
        confirmBox.classList.remove("show");
      }
    }
  });

  card.addEventListener("dragstart", (event) => {
    draggingTaskId = task.id;
    card.classList.add("dragging");

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", task.id);
    }
  });

  card.addEventListener("dragend", () => {
    draggingTaskId = null;
    dragOverListId = null;
    card.classList.remove("dragging");
    clearDropIndicators();
  });

  return card;
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
  editingTaskId = null;
  deleteConfirmTaskId = null;
  saveTasks();
  render();
}

function deleteTask(taskId) {
  tasks = tasks.filter((task) => task.id !== taskId);
  if (editingTaskId === taskId) {
    editingTaskId = null;
  }
  if (deleteConfirmTaskId === taskId) {
    deleteConfirmTaskId = null;
  }
  saveTasks();
  render();
}

function closeAllTaskDeleteConfirms() {
  document.querySelectorAll(".task-delete-confirm.show").forEach((element) => {
    element.classList.remove("show");
  });
}

function setupDropZones() {
  document.querySelectorAll(".column").forEach((columnElement) => {
    const taskList = columnElement.querySelector(".task-list");
    const column = columnElement.dataset.column;

    columnElement.addEventListener("dragover", (event) => {
      if (!(event.target instanceof Element)) {
        return;
      }

      if (event.target.closest(".task-list")) {
        return;
      }

      event.preventDefault();
      dragOverListId = taskList.id;
      taskList.classList.add("drag-over", "drop-at-end");
      taskList.dataset.dropBeforeId = "";
    });

    columnElement.addEventListener("drop", (event) => {
      if (!(event.target instanceof Element)) {
        return;
      }

      if (event.target.closest(".task-list")) {
        return;
      }

      event.preventDefault();
      taskList.classList.remove("drag-over", "drop-at-end");

      const draggedId = draggingTaskId || event.dataTransfer?.getData("text/plain");
      if (!draggedId) {
        return;
      }

      moveTaskByDrop(draggedId, column, null);
      clearDropIndicators();
    });

    taskList.addEventListener("dragover", (event) => {
      event.preventDefault();
      dragOverListId = taskList.id;
      taskList.classList.add("drag-over");
      updateDropIndicator(taskList, event.clientY);
    });

    taskList.addEventListener("dragleave", (event) => {
      const related = event.relatedTarget;
      if (related instanceof Node && taskList.contains(related)) {
        return;
      }

      if (dragOverListId === taskList.id) {
        dragOverListId = null;
      }

      taskList.classList.remove("drag-over");
      taskList.classList.remove("drop-at-end");
      taskList.dataset.dropBeforeId = "";
      clearCardIndicators(taskList);
    });

    taskList.addEventListener("drop", (event) => {
      event.preventDefault();
      taskList.classList.remove("drag-over");
      taskList.classList.remove("drop-at-end");

      const draggedId = draggingTaskId || event.dataTransfer?.getData("text/plain");
      if (!draggedId) {
        return;
      }

      const beforeTaskId = taskList.dataset.dropBeforeId || null;

      moveTaskByDrop(draggedId, column, beforeTaskId);
      clearDropIndicators();
    });
  });
}

function updateDropIndicator(taskList, cursorY) {
  const cards = Array.from(taskList.querySelectorAll(".task:not(.dragging)"));
  const nextCard = cards.find((card) => {
    const rect = card.getBoundingClientRect();
    return cursorY <= rect.top + rect.height / 2;
  });

  clearCardIndicators(taskList);
  taskList.classList.remove("drop-at-end");

  if (nextCard) {
    nextCard.classList.add("drop-indicator");
    taskList.dataset.dropBeforeId = nextCard.dataset.id || "";
    return;
  }

  taskList.dataset.dropBeforeId = "";
  taskList.classList.add("drop-at-end");
}

function clearCardIndicators(taskList) {
  taskList.querySelectorAll(".task.drop-indicator").forEach((card) => {
    card.classList.remove("drop-indicator");
  });
}

function clearDropIndicators() {
  document.querySelectorAll(".task-list").forEach((list) => {
    list.classList.remove("drag-over", "drop-at-end");
    list.dataset.dropBeforeId = "";
    clearCardIndicators(list);
  });
}

function moveTaskByDrop(taskId, targetColumn, beforeTaskId) {
  const draggedTask = tasks.find((task) => task.id === taskId);
  if (!draggedTask) {
    return;
  }

  if (beforeTaskId && beforeTaskId === taskId) {
    return;
  }

  const remaining = tasks.filter((task) => task.id !== taskId);
  const updatedTask = { ...draggedTask, status: targetColumn };

  let insertIndex = -1;

  if (beforeTaskId) {
    insertIndex = remaining.findIndex((task) => task.id === beforeTaskId);
  }

  if (insertIndex === -1) {
    insertIndex = lastIndexOfStatus(remaining, targetColumn) + 1;
    if (insertIndex < 0) {
      insertIndex = remaining.length;
    }
  }

  remaining.splice(insertIndex, 0, updatedTask);
  tasks = remaining;
  editingTaskId = null;
  deleteConfirmTaskId = null;
  saveTasks();
  render();
}

function lastIndexOfStatus(list, status) {
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (list[i].status === status) {
      return i;
    }
  }
  return -1;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
