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
let modalEditingTaskId = null;
let deleteConfirmTaskId = null;
let editingBoardId = null;
let deleteConfirmBoardId = null;
let clearConfirmColumn = null;

const form = document.getElementById("task-form");
const titleInput = document.getElementById("task-title");
const descriptionInput = document.getElementById("task-description");
const boardName = document.getElementById("board-name");
const helpToggleButton = document.getElementById("help-toggle");
const helpModalOverlay = document.getElementById("help-modal-overlay");
const helpCloseButton = document.getElementById("help-close-btn");

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
const taskModalOverlay = document.getElementById("task-modal-overlay");
const taskModalClose = document.getElementById("task-modal-close");
const taskModalCancel = document.getElementById("task-modal-cancel");
const taskModalSave = document.getElementById("task-modal-save");
const taskEditTitle = document.getElementById("task-edit-title");
const taskEditCategory = document.getElementById("task-edit-category");
const taskEditAssignee = document.getElementById("task-edit-assignee");
const taskEditTags = document.getElementById("task-edit-tags");
const taskEditDeadline = document.getElementById("task-edit-deadline");
const taskEditPriority = document.getElementById("task-edit-priority");

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
taskModalClose?.addEventListener("click", closeTaskModal);
taskModalCancel?.addEventListener("click", closeTaskModal);
taskModalSave?.addEventListener("click", saveTaskModal);
taskModalOverlay?.addEventListener("click", onTaskModalOverlayClick);

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
helpToggleButton?.addEventListener("click", toggleHelpSection);
helpCloseButton?.addEventListener("click", closeHelpModal);
helpModalOverlay?.addEventListener("click", onHelpOverlayClick);
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
    priority: task.priority === "high" ? "high" : "normal",
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

  const parsed = parseTasks(title);

  if (parsed.length > 0) {
    const fallbackCategory = inferCategory(description);
    const enriched = parsed.map((task) => {
      if (!fallbackCategory || task.category) {
        return task;
      }

      return {
        ...task,
        description: fallbackCategory,
        category: fallbackCategory,
      };
    });

    tasks.push(...enriched);
  } else {
    tasks.push({
      id: crypto.randomUUID(),
      title,
      description,
      category: inferCategory(description),
      assignee: null,
      tags: [],
      deadline: null,
      status: "todo",
      priority: "normal",
      createdAt: new Date(),
    });
  }

  form.reset();
  titleInput.focus();
  saveTasks();
  render();
}

function onGenerateIATasks() {
  const text = normalizeSpaces(aiPlanInput?.value || "");
  const shouldUseExamples = text.length === 0 && tasks.length === 0;
  const planText = shouldUseExamples ? getExamplePlanInput() : text;

  if (!planText) {
    return;
  }

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
  return [
    "!organizar sprint semanal (manhã) @joao #backend #api +2026-04-06",
    "!!revisar fluxo de caixa (financeiro) @ana #financas #urgente +2026-04-07",
    "preparar campanha de leads (marketing) @bia #conteudo #social +2026-04-08",
  ].join("; ");
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
    .map((item) => normalizeSpaces(item))
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
  const trimmed = normalizeSpaces(rawText);
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

  let category = null;
  let baseText = withoutPriority;
  const categoryMatch = baseText.match(/\(([^)]+)\)/);
  if (categoryMatch) {
    category = categoryMatch[1].trim();
    baseText = baseText
      .replace(categoryMatch[0], " ")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  const assigneeMatch = baseText.match(/@\s*([^\s#\+]+)/);
  const assignee = assigneeMatch ? assigneeMatch[1].trim() : null;

  const tags = [];
  const tagMatches = baseText.match(/#\s*([^\s@+\#]+)/g) || [];
  tagMatches.forEach((match) => {
    const value = normalizeSpaces(match.slice(1));
    if (value && !tags.includes(value)) {
      tags.push(value);
    }
  });

  const deadlineMatch = baseText.match(/\+\s*([^\s@#\+]+)/);
  const deadline = deadlineMatch ? deadlineMatch[1].trim() : null;

  let title = baseText
    .replace(/@\s*([^\s#\+]+)/g, "")
    .replace(/#\s*([^\s@+\#]+)/g, "")
    .replace(/\+\s*([^\s@#\+]+)/g, "");
  title = normalizeSpaces(title);

  const isPriority = priorityCount >= 1;
  const isHighPriority = priorityCount >= 2;
  const priority = isHighPriority ? "high" : "normal";

  return {
    title,
    column: isPriority && !isHighPriority ? "em_andamento" : "proximos",
    category: category && category.length > 0 ? category : null,
    assignee,
    tags,
    deadline,
    priority,
    createdAt: new Date(),
  };
}

function normalizeSpaces(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
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

  if (taskModalOverlay && !taskModalOverlay.hidden) {
    closeTaskModal();
    return;
  }

  if (helpModalOverlay && !helpModalOverlay.hidden) {
    closeHelpModal();
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
  closeTaskModal();
  closeHelpModal();
  closeBoardsPanel();
  clearConfirmColumn = null;
  updateClearColumnButtons();
}

function updatePageLock() {
  const aiOpen = aiModalOverlay && !aiModalOverlay.hidden;
  const boardsOpen = boardsOverlay && !boardsOverlay.hidden;
  const helpOpen = helpModalOverlay && !helpModalOverlay.hidden;
  const taskOpen = taskModalOverlay && !taskModalOverlay.hidden;
  document.body.style.overflow = aiOpen || boardsOpen || helpOpen || taskOpen ? "hidden" : "";
}

function toggleHelpSection() {
  if (!helpModalOverlay || !helpToggleButton) {
    return;
  }

  if (helpModalOverlay.hidden) {
    openHelpModal();
  } else {
    closeHelpModal();
  }
}

function openHelpModal() {
  if (!helpModalOverlay || !helpToggleButton) {
    return;
  }

  helpModalOverlay.hidden = false;
  helpToggleButton.setAttribute("aria-expanded", "true");
  updatePageLock();
}

function closeHelpModal() {
  if (!helpModalOverlay || !helpToggleButton) {
    return;
  }

  helpModalOverlay.hidden = true;
  helpToggleButton.setAttribute("aria-expanded", "false");
  updatePageLock();
}

function onHelpOverlayClick(event) {
  if (event.target === helpModalOverlay) {
    closeHelpModal();
  }
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

    const columnTasks = tasks.filter((task) => task.status === column);
    const orderedTasks = orderTasksForColumn(columnTasks);

    orderedTasks.forEach((task) => list.appendChild(createTaskElement(task)));
  });
}

function orderTasksForColumn(columnTasks) {
  return [...columnTasks]
    .map((task, index) => ({ task, index }))
    .sort((a, b) => {
      const aHigh = a.task.priority === "high";
      const bHigh = b.task.priority === "high";

      if (aHigh !== bHigh) {
        return aHigh ? -1 : 1;
      }

      if (aHigh && bHigh) {
        const aCreated = getTaskCreatedAtTimestamp(a.task);
        const bCreated = getTaskCreatedAtTimestamp(b.task);
        if (aCreated !== bCreated) {
          return aCreated - bCreated;
        }
      }

      return a.index - b.index;
    })
    .map((entry) => entry.task);
}

function getTaskCreatedAtTimestamp(task) {
  if (task.createdAt instanceof Date) {
    const time = task.createdAt.getTime();
    return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
  }

  const parsed = new Date(task.createdAt);
  const time = parsed.getTime();
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
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
        if (!normalizedTag) {
          return;
        }

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

    if (hasMeta) {
      main.appendChild(meta);
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

  const titleButton = card.querySelector(".task-title-btn");
  titleButton?.addEventListener("dblclick", (event) => {
    event.stopPropagation();
    openTaskModal(task.id);
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

  card.addEventListener("dblclick", (event) => {
    const target = event.target;
    if (target instanceof Element && target.closest(".task-actions")) {
      return;
    }
    openTaskModal(task.id);
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

function openTaskModal(taskId) {
  if (!taskModalOverlay) {
    return;
  }

  const task = tasks.find((item) => item.id === taskId);
  if (!task) {
    return;
  }

  modalEditingTaskId = taskId;
  if (taskEditTitle) {
    taskEditTitle.value = task.title || "";
  }
  if (taskEditCategory) {
    taskEditCategory.value = task.category || "";
  }
  if (taskEditAssignee) {
    taskEditAssignee.value = task.assignee || "";
  }
  if (taskEditTags) {
    taskEditTags.value = Array.isArray(task.tags) ? task.tags.join(", ") : "";
  }
  if (taskEditDeadline) {
    taskEditDeadline.value = task.deadline || "";
  }
  if (taskEditPriority) {
    taskEditPriority.value = task.priority || "normal";
  }

  taskModalOverlay.hidden = false;
  updatePageLock();
  taskEditTitle?.focus();
}

function closeTaskModal() {
  if (!taskModalOverlay) {
    return;
  }

  taskModalOverlay.hidden = true;
  modalEditingTaskId = null;
  updatePageLock();
}

function onTaskModalOverlayClick(event) {
  if (event.target === taskModalOverlay) {
    closeTaskModal();
  }
}

function saveTaskModal() {
  if (!modalEditingTaskId) {
    return;
  }

  const task = tasks.find((item) => item.id === modalEditingTaskId);
  if (!task) {
    return;
  }

  const nextTitle = taskEditTitle?.value.trim() || "";
  if (!nextTitle) {
    taskEditTitle?.focus();
    return;
  }

  task.title = nextTitle;
  task.category = (taskEditCategory?.value || "").trim() || null;
  task.assignee = (taskEditAssignee?.value || "").trim() || null;
  const tags = (taskEditTags?.value || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
  task.tags = tags;
  task.deadline = (taskEditDeadline?.value || "").trim() || null;
  task.priority = taskEditPriority?.value || "normal";

  saveTasks();
  render();
  closeTaskModal();
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
