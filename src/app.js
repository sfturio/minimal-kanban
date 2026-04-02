import { KANBAN_PROMPT_TEMPLATE } from "./config/kanban.prompt.js";
import { getAppState } from "./state/app.state.js";
import {
  getBoards,
  setBoards,
  getActiveBoardId,
  setActiveBoardId,
  getActiveBoard,
  getActiveColumns,
  getPrimaryColumnId,
  getFocusColumnId,
} from "./state/board.state.js";
import { getTasks, setTasks } from "./state/task.state.js";
import {
  STORAGE_KEYS,
  DEFAULT_BOARD_ID,
  readJson,
  writeJson,
  readString,
  writeString,
  taskStorageKey,
} from "./storage/local.storage.js";
import {
  loadBoards,
  saveBoards as persistBoards,
  loadActiveBoardId,
  saveActiveBoardId,
  createBoard,
  createColumn,
  normalizeBoardColumns,
} from "./services/board.service.js";
import {
  normalizeTaskForColumns,
  moveTask,
  moveTaskByDrop,
} from "./services/task.service.js";
import { getExamplePlanInput, parseTasks } from "./utils/parser.js";
import { isUuid, normalizeSpaces, uid } from "./utils/helpers.js";
import { getDom } from "./ui/dom.js";
import {
  updateBoardName,
  renderBoardsPanel,
  renderColumnsPanel,
  renderBoardColumns,
} from "./ui/board.render.js";
import {
  updatePageLock,
  closeSettingsMenu,
  toggleSettingsMenu,
  openAIPlanningModal,
  closeAIPlanningModal,
  openHelpModal,
  closeHelpModal,
  openTaskModal,
  closeTaskModal,
  readTaskModalData,
} from "./ui/modal.ui.js";
import { initTheme, toggleTheme, applyTheme } from "./features/theme.service.js";
import { initFocusMode, toggleFocusMode, applyFocusMode } from "./features/focus.service.js";
import { setupDropZones, clearDropIndicators } from "./features/dragdrop.service.js";
import { buildBackupPayload, applyBackupData } from "./features/backup.service.js";
import {
  initAuthSession,
  signInWithPassword,
  signUpWithPassword,
  signOut,
  isLoggedIn,
  getCurrentUser,
  fetchOwnProfile,
  saveOwnUsername,
  pullCloudSnapshot,
  pushCloudSnapshot,
  deserializeTaskMeta,
} from "./features/supabase.service.js";

const state = getAppState();
const dom = getDom();
let authMode = "signin";
let cloudSyncTimer = null;
let isApplyingCloudSnapshot = false;
let usernamePromptResolver = null;
let shouldPromptUsernameOnNextAuth = false;
let authSessionReady = false;

boot();

async function boot() {
  state.boards = loadBoards();
  state.activeBoardId = loadActiveBoardId(state.boards);
  state.tasks = loadTasksForBoard(state.activeBoardId).map((task) => normalizeTask(task));

  bindEvents();
  initTheme(dom);
  initFocusMode(dom);
  seedInitialSampleTasks();
  await initAuth();

  render();
}

function bindEvents() {
  dom.form?.addEventListener("submit", onCreateTask);

  dom.iaGenerateButton?.addEventListener("click", () => openAIPlanningModal(dom));
  dom.aiCancelButton?.addEventListener("click", () => closeAIPlanningModal(dom));
  dom.aiGenerateConfirmButton?.addEventListener("click", onGenerateIATasks);
  dom.aiCloseButton?.addEventListener("click", () => closeAIPlanningModal(dom));
  dom.aiModalOverlay?.addEventListener("click", (event) => {
    if (event.target === dom.aiModalOverlay) closeAIPlanningModal(dom);
  });

  dom.taskModalClose?.addEventListener("click", () => closeTaskModal(dom));
  dom.taskModalCancel?.addEventListener("click", () => closeTaskModal(dom));
  dom.taskModalSave?.addEventListener("click", onSaveTaskModal);
  dom.taskModalOverlay?.addEventListener("click", (event) => {
    if (event.target === dom.taskModalOverlay) closeTaskModal(dom);
  });

  dom.helpToggleButton?.addEventListener("click", () => openHelpModal(dom));
  dom.helpCloseButton?.addEventListener("click", () => closeHelpModal(dom));
  dom.helpModalOverlay?.addEventListener("click", (event) => {
    if (event.target === dom.helpModalOverlay) closeHelpModal(dom);
  });
  dom.helpExportPromptButton?.addEventListener("click", onCopyPromptTemplate);

  dom.authToggleButton?.addEventListener("click", onAuthToggleClick);
  dom.authCloseButton?.addEventListener("click", closeAuthModal);
  dom.authCancelButton?.addEventListener("click", closeAuthModal);
  dom.authModeButton?.addEventListener("click", toggleAuthMode);
  dom.authForm?.addEventListener("submit", onAuthSubmit);
  dom.authSubmitButton?.addEventListener("click", onAuthSubmit);
  dom.authModalOverlay?.addEventListener("click", (event) => {
    if (event.target === dom.authModalOverlay) closeAuthModal();
  });
  dom.usernameForm?.addEventListener("submit", onUsernameSubmit);
  dom.usernameSaveButton?.addEventListener("click", onUsernameSubmit);
  dom.usernameSkipButton?.addEventListener("click", onUsernameSkip);
  dom.usernameModalOverlay?.addEventListener("click", (event) => {
    if (event.target === dom.usernameModalOverlay) onUsernameSkip();
  });

  dom.settingsToggleButton?.addEventListener("click", (event) => toggleSettingsMenu(dom, event));
  dom.boardToggleButton?.addEventListener("click", () => toggleBoardsPanel("tables"));
  dom.settingsColumnsToggleButton?.addEventListener("click", () => toggleBoardsPanel("columns"));
  dom.settingsChangeUsernameButton?.addEventListener("click", onChangeUsernameClick);
  dom.themeToggleButton?.addEventListener("click", () => toggleTheme(dom));
  dom.focusToggleButton?.addEventListener("click", onToggleFocusMode);

  dom.boardsCloseButton?.addEventListener("click", closeBoardsPanel);
  dom.boardsOverlay?.addEventListener("click", (event) => {
    if (event.target === dom.boardsOverlay) closeBoardsPanel();
  });

  dom.createBoardButton?.addEventListener("click", onCreateBoard);
  dom.newBoardInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onCreateBoard();
    }
  });

  dom.createColumnButton?.addEventListener("click", onCreateColumn);
  dom.newColumnInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onCreateColumn();
    }
  });

  dom.exportBackupButton?.addEventListener("click", onExportBackup);
  dom.importBackupButton?.addEventListener("click", () => dom.backupFileInput?.click());
  dom.backupFileInput?.addEventListener("change", onBackupFileSelected);

  dom.boardsList?.addEventListener("click", onBoardsListClick);
  dom.columnsList?.addEventListener("click", onColumnsListClick);

  dom.boardElement?.addEventListener("click", onBoardClick);

  document.addEventListener("keydown", onGlobalKeydown);
  document.addEventListener("click", onDocumentClick);
  document.addEventListener("visibilitychange", onVisibilityChange);

  document.addEventListener("wheel", onAppWheel, { passive: false });
}

function loadTasksForBoard(boardId) {
  const key = taskStorageKey(boardId);
  const raw = localStorage.getItem(key);

  if (raw) {
    const parsed = readJson(key, []);
    return Array.isArray(parsed) ? parsed : [];
  }

  if (boardId === DEFAULT_BOARD_ID) {
    const legacy = readJson(STORAGE_KEYS.LEGACY_STORAGE_KEY, []);
    if (Array.isArray(legacy) && legacy.length > 0) {
      writeJson(key, legacy);
      return legacy;
    }
  }

  return [];
}

function saveTasks() {
  writeJson(taskStorageKey(state.activeBoardId), state.tasks);
  scheduleCloudSync();
}

function saveBoards() {
  persistBoards(state.boards);
  scheduleCloudSync();
}

function normalizeTask(task) {
  return normalizeTaskForColumns(task, getActiveColumns());
}

async function initAuth() {
  if (!dom.authToggleButton) {
    return;
  }
  if (authSessionReady) {
    return;
  }

  updateChangeUsernameButtonLabel("");

  try {
    await initAuthSession({
      onAuthChange: async (user) => {
        await handleAuthState(user);
      },
    });
    authSessionReady = true;
    dom.authToggleButton.disabled = false;
    dom.authToggleButton.title = "";
  } catch {
    authSessionReady = false;
    dom.authToggleButton.disabled = false;
    dom.authToggleButton.textContent = "Entrar";
    dom.authToggleButton.title = "Autenticacao temporariamente indisponivel. Tente novamente.";
    setAuthStatus("Convidado");
    updateChangeUsernameButtonLabel("");
  }
}

function setAuthStatus(text) {
  if (dom.authStatus) {
    dom.authStatus.textContent = text || "Convidado";
  }
}

function updateChangeUsernameButtonLabel(username) {
  if (!dom.settingsChangeUsernameButton) {
    return;
  }

  const normalized = normalizeUsername(username || "");
  const label = normalized ? `@${normalized}` : "Usuario";
  dom.settingsChangeUsernameButton.innerHTML = `
    <span>${label}</span>
    <span class="material-symbols-outlined" aria-hidden="true">edit</span>
  `;
}

async function handleAuthState(user) {
  if (dom.authToggleButton) {
    dom.authToggleButton.textContent = user ? "Sair" : "Entrar";
  }

  if (!user) {
    if (!dom.usernameModalOverlay.hidden) {
      resolveUsernamePrompt("");
    }
    shouldPromptUsernameOnNextAuth = false;
    setAuthStatus("Convidado");
    updateChangeUsernameButtonLabel("");
    return;
  }

  let username = await getOwnUsernameSilently();
  if (shouldPromptUsernameOnNextAuth && !username) {
    shouldPromptUsernameOnNextAuth = false;
    closeAuthModal();
    username = await ensureOwnUsername();
  }
  shouldPromptUsernameOnNextAuth = false;
  setAuthStatus(username || user.email || "Convidado");
  updateChangeUsernameButtonLabel(username || "");

  const pulled = await pullCloudToLocal();
  if (!pulled) {
    await syncAllToCloud();
  }
}

async function ensureOwnUsername() {
  let current = "";

  try {
    const profile = await fetchOwnProfile();
    current = normalizeUsername(profile?.username || "");
  } catch {
    return "";
  }

  if (current) {
    return current;
  }

  return await requestUsernameInClient();
}

async function getOwnUsernameSilently() {
  try {
    const profile = await fetchOwnProfile();
    return normalizeUsername(profile?.username || "");
  } catch {
    return "";
  }
}

function normalizeUsername(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9._-]/g, "");
}

function isValidUsername(value) {
  return /^[a-z0-9._-]{3,24}$/.test(String(value || ""));
}

async function onAuthToggleClick() {
  if (getCurrentUser()) {
    signOut();
    return;
  }

  if (!authSessionReady) {
    await initAuth();
  }
  openAuthModal();
}

async function onChangeUsernameClick() {
  closeSettingsMenu(dom);

  const user = getCurrentUser();
  if (!user) {
    openAuthModal();
    if (dom.authError) {
      dom.authError.textContent = "Entre para alterar seu usuario.";
    }
    return;
  }

  let current = "";
  try {
    const profile = await fetchOwnProfile();
    current = normalizeUsername(profile?.username || "");
  } catch {
    current = "";
  }

  const next = await requestUsernameInClient({
    title: "Alterar usuario",
    subtitle: "Atualize o nome de usuario exibido no cabecalho.",
    submitLabel: "Salvar alteracao",
    skipLabel: "Cancelar",
    initialValue: current,
  });

  if (next) {
    setAuthStatus(next);
    updateChangeUsernameButtonLabel(next);
  }
}

function openAuthModal() {
  if (!dom.authModalOverlay) {
    return;
  }

  updateAuthModal();
  dom.authModalOverlay.hidden = false;
  updatePageLock(dom);
  dom.authEmailInput?.focus();
}

function closeAuthModal() {
  dom.authModalOverlay.hidden = true;
  if (dom.authError) {
    dom.authError.textContent = "";
  }
  updatePageLock(dom);
}

async function requestUsernameInClient(options = {}) {
  if (!dom.usernameModalOverlay || !dom.usernameInput) {
    return "";
  }

  const title = String(options.title || "Escolha seu usuario");
  const subtitle = String(options.subtitle || "Defina um usuario para aparecer no seu perfil.");
  const submitLabel = String(options.submitLabel || "Salvar usuario");
  const skipLabel = String(options.skipLabel || "Agora nao");
  const initialValue = String(options.initialValue || "");

  if (dom.usernameError) {
    dom.usernameError.textContent = "";
  }

  if (dom.usernameModalTitle) {
    dom.usernameModalTitle.textContent = title;
  }

  if (dom.usernameModalSubtitle) {
    dom.usernameModalSubtitle.textContent = subtitle;
  }

  if (dom.usernameSaveButton) {
    dom.usernameSaveButton.textContent = submitLabel;
  }

  if (dom.usernameSkipButton) {
    dom.usernameSkipButton.textContent = skipLabel;
  }

  dom.usernameInput.value = initialValue;
  dom.usernameModalOverlay.hidden = false;
  updatePageLock(dom);

  setTimeout(() => {
    dom.usernameInput?.focus();
  }, 0);

  return await new Promise((resolve) => {
    usernamePromptResolver = resolve;
  });
}

function closeUsernameModal() {
  if (!dom.usernameModalOverlay) {
    return;
  }

  dom.usernameModalOverlay.hidden = true;
  if (dom.usernameError) {
    dom.usernameError.textContent = "";
  }
  updatePageLock(dom);
}

function resolveUsernamePrompt(value) {
  const resolver = usernamePromptResolver;
  usernamePromptResolver = null;
  closeUsernameModal();
  if (resolver) {
    resolver(value || "");
  }
}

async function onUsernameSubmit(event) {
  event?.preventDefault();

  const raw = dom.usernameInput?.value || "";
  const candidate = normalizeUsername(raw);

  if (!isValidUsername(candidate)) {
    if (dom.usernameError) {
      dom.usernameError.textContent = "Use 3-24 caracteres: letras, numeros, ponto, underscore ou hifen.";
    }
    dom.usernameInput?.focus();
    return;
  }

  const { data, error } = await saveOwnUsername(candidate);
  if (!error) {
    resolveUsernamePrompt(normalizeUsername(data?.username || candidate));
    return;
  }

  const isConflict = String(error?.code || "") === "23505"
    || /duplicate|unique/i.test(String(error?.message || ""));
  const reason = String(error?.message || "").trim();

  if (dom.usernameError) {
    dom.usernameError.textContent = isConflict
      ? "Esse usuario ja esta em uso. Tente outro."
      : `Nao foi possivel salvar agora. ${reason || "Tente novamente."}`;
  }
}

function onUsernameSkip() {
  resolveUsernamePrompt("");
}

function toggleAuthMode() {
  authMode = authMode === "signin" ? "signup" : "signin";
  updateAuthModal();
}

function updateAuthModal() {
  if (
    !dom.authModalTitle ||
    !dom.authModalSubtitle ||
    !dom.authModeButton ||
    !dom.authToggleText ||
    !dom.authSubmitButton
  ) {
    return;
  }

  const isSignup = authMode === "signup";
  dom.authModalTitle.textContent = isSignup ? "Criar conta" : "Entrar";
  dom.authModalSubtitle.textContent = isSignup
    ? "Crie sua conta para sincronizar suas tarefas."
    : "Acesse sua conta para sincronizar suas tarefas.";
  dom.authToggleText.textContent = isSignup ? "J\u00e1 tem conta?" : "Ainda n\u00e3o tem conta?";
  dom.authModeButton.textContent = isSignup ? "Entrar" : "Criar conta";
  dom.authSubmitButton.textContent = isSignup ? "Criar conta" : "Entrar";
}

async function onAuthSubmit(event) {
  event?.preventDefault();

  const email = normalizeSpaces(dom.authEmailInput?.value || "");
  const password = (dom.authPasswordInput?.value || "").trim();
  if (!email || !password) {
    return;
  }

  if (dom.authError) {
    dom.authError.textContent = "";
  }
  if (!authSessionReady) {
    await initAuth();
  }

  if (!authSessionReady) {
    if (dom.authError) {
      dom.authError.textContent = "Servico de autenticacao indisponivel. Tente novamente.";
    }
    return;
  }

  let result;
  try {
    result = authMode === "signup"
      ? await signUpWithPassword(email, password)
      : await signInWithPassword(email, password);
  } catch (error) {
    if (dom.authError) {
      dom.authError.textContent = `Erro de autenticacao: ${String(error?.message || "tente novamente")}`;
    }
    return;
  }

  if (result.error) {
    if (dom.authError) {
      dom.authError.textContent = result.error.message;
    }
    return;
  }

  shouldPromptUsernameOnNextAuth = true;
  closeAuthModal();
}

async function pullCloudToLocal() {
  if (!isLoggedIn()) {
    return false;
  }

  try {
    const snapshot = await pullCloudSnapshot();
    if (!snapshot || snapshot.boards.length === 0) {
      return false;
    }

    const previousBoardIds = state.boards.map((board) => board.id);
    const localById = new Map(state.boards.map((board) => [board.id, board]));
    const cloudColumnsByBoard = new Map();
    (snapshot.columns || []).forEach((column) => {
      const boardId = String(column.board_id || "").trim();
      if (!boardId) return;
      if (!cloudColumnsByBoard.has(boardId)) {
        cloudColumnsByBoard.set(boardId, []);
      }
      cloudColumnsByBoard.get(boardId).push(column);
    });

    const cloudBoards = snapshot.boards
      .map((board) => {
        const boardId = String(board.id || "").trim();
        const localMatch = localById.get(boardId);
        const cols = buildLocalColumnsFromCloud({
          cloudColumns: cloudColumnsByBoard.get(boardId) || [],
          localColumns: localMatch?.columns || [],
        });
        return {
          id: boardId,
          name: String(board.name || "").trim(),
          columns: cols.length > 0 ? cols : normalizeBoardColumns(localMatch?.columns),
        };
      })
      .filter((board) => board.id && board.name);

    if (cloudBoards.length === 0) {
      return false;
    }

    const fallbackBoardId = cloudBoards[0].id;
    const tasksByBoard = new Map(cloudBoards.map((board) => [board.id, []]));
    const tagsByTask = new Map();
    const commentsByTask = new Map();

    (snapshot.taskTags || []).forEach((row) => {
      const taskId = String(row.task_id || "").trim();
      const tag = normalizeSpaces(row.tag || "");
      if (!taskId || !tag) return;
      if (!tagsByTask.has(taskId)) {
        tagsByTask.set(taskId, []);
      }
      tagsByTask.get(taskId).push(tag);
    });

    (snapshot.comments || []).forEach((row) => {
      const taskId = String(row.task_id || "").trim();
      const content = normalizeSpaces(row.content || "");
      if (!taskId || !content) return;
      if (!commentsByTask.has(taskId)) {
        commentsByTask.set(taskId, []);
      }
      commentsByTask.get(taskId).push({
        id: row.id || uid(),
        text: content,
        createdAt: row.created_at || new Date(),
      });
    });

    snapshot.tasks.forEach((row) => {
      const meta = deserializeTaskMeta(row.description);
      const rowBoardId = String(row.board_id || "");
      const boardId = tasksByBoard.has(rowBoardId) ? rowBoardId : fallbackBoardId;
      const board = cloudBoards.find((item) => item.id === boardId);
      const boardColumns = board?.columns || getActiveColumns();
      const statusFromColumnId = resolveLocalColumnIdByCloudId(boardColumns, row.column_id);

      tasksByBoard.get(boardId).push(
        normalizeTaskForColumns(
          {
            id: row.id,
            title: row.title,
            description: meta.description,
            category: row.category || "",
            assignee: row.assignee || meta.assignee,
            tags: tagsByTask.get(String(row.id || "")) || meta.tags,
            comments: commentsByTask.get(String(row.id || "")) || meta.comments,
            deadline: row.deadline || meta.deadline,
            completedAt: row.completed_at || meta.completedAt,
            priority: row.priority || meta.priority,
            status: statusFromColumnId || row.status || boardColumns[0]?.id || getPrimaryColumnId(),
            createdAt: row.created_at || new Date(),
          },
          boardColumns,
        ),
      );
    });

    isApplyingCloudSnapshot = true;
    state.boards = cloudBoards;
    saveBoards();

    previousBoardIds.forEach((boardId) => {
      if (!state.boards.some((board) => board.id === boardId)) {
        localStorage.removeItem(taskStorageKey(boardId));
      }
    });

    state.boards.forEach((board) => {
      writeJson(taskStorageKey(board.id), tasksByBoard.get(board.id) || []);
    });

    const previousActiveId = String(state.activeBoardId || "").trim();
    state.activeBoardId = state.boards.some((board) => board.id === previousActiveId)
      ? previousActiveId
      : state.boards[0].id;
    saveActiveBoardId(state.activeBoardId);

    state.tasks = loadTasksForBoard(state.activeBoardId).map((task) => normalizeTask(task));
    resetTaskTransientState();
    state.clearConfirmColumn = null;
    render();
    isApplyingCloudSnapshot = false;
    return true;
  } catch (error) {
    console.error("Erro ao carregar snapshot da nuvem:", error);
    isApplyingCloudSnapshot = false;
    return false;
  }
}

function getAllLocalTasksForCloud() {
  const tasks = [];
  const taskTags = [];
  const comments = [];
  const columns = [];

  state.boards.forEach((board) => {
    const normalizedColumns = normalizeBoardColumns(board.columns).map((column, index) => ({
      ...column,
      cloudId: isUuid(column.cloudId) ? column.cloudId : uid(),
      position: index,
    }));
    board.columns = normalizedColumns;

    normalizedColumns.forEach((column) => {
      columns.push({
        id: column.cloudId,
        board_id: board.id,
        name: column.name,
        position: column.position,
      });
    });

    const boardTasks = loadTasksForBoard(board.id).map((task) =>
      normalizeTaskForColumns(task, normalizedColumns),
    );

    boardTasks.forEach((task, index) => {
      const mappedColumn = normalizedColumns.find((col) => col.id === task.status);
      const cloudColumnId = mappedColumn?.cloudId || normalizedColumns[0]?.cloudId || null;

      tasks.push({
        id: task.id,
        boardId: board.id,
        columnId: cloudColumnId,
        title: task.title,
        description: task.description || "",
        category: task.category || "",
        assignee: task.assignee || null,
        priority: task.priority || "normal",
        deadline: task.deadline || null,
        completedAt: task.completedAt || null,
        position: index,
        status: task.status,
        createdAt:
          task.createdAt instanceof Date
            ? task.createdAt.toISOString()
            : new Date(task.createdAt || Date.now()).toISOString(),
      });

      (task.tags || []).forEach((tag) => {
        const normalizedTag = normalizeSpaces(tag);
        if (!normalizedTag) return;
        taskTags.push({
          id: uid(),
          task_id: task.id,
          tag: normalizedTag,
        });
      });

      (task.comments || []).forEach((comment) => {
        const text = normalizeSpaces(comment?.text || "");
        if (!text) return;
        comments.push({
          id: comment.id || uid(),
          task_id: task.id,
          content: text,
          created_at:
            comment.createdAt instanceof Date
              ? comment.createdAt.toISOString()
              : new Date(comment.createdAt || Date.now()).toISOString(),
        });
      });
    });
  });

  return { tasks, taskTags, comments, columns };
}

function remapBoardKeyedMap(map, idMap) {
  const source = map && typeof map === "object" ? map : {};
  const next = {};
  Object.entries(source).forEach(([boardId, value]) => {
    next[idMap[boardId] || boardId] = value;
  });
  return next;
}

function migrateLegacyBoardIdsToUuid() {
  const idMap = {};
  state.boards.forEach((board) => {
    if (!isUuid(board.id)) {
      idMap[board.id] = uid();
    }
  });

  if (Object.keys(idMap).length === 0) {
    return;
  }

  state.boards = state.boards.map((board) => (
    idMap[board.id]
      ? { ...board, id: idMap[board.id] }
      : board
  ));

  Object.entries(idMap).forEach(([oldId, newId]) => {
    const oldKey = taskStorageKey(oldId);
    const migratedTasks = readJson(oldKey, null);
    if (Array.isArray(migratedTasks)) {
      writeJson(taskStorageKey(newId), migratedTasks);
    }
    localStorage.removeItem(oldKey);
  });

  state.activeBoardId = idMap[state.activeBoardId] || state.activeBoardId;
  state.focusColumnByBoard = remapBoardKeyedMap(state.focusColumnByBoard, idMap);
  state.collapsedColumnsByBoard = remapBoardKeyedMap(state.collapsedColumnsByBoard, idMap);
  state.sortModeByBoard = remapBoardKeyedMap(state.sortModeByBoard, idMap);
  state.sortDirectionByBoard = remapBoardKeyedMap(state.sortDirectionByBoard, idMap);

  persistBoards(state.boards);
  saveActiveBoardId(state.activeBoardId);
  state.tasks = loadTasksForBoard(state.activeBoardId).map((task) => normalizeTask(task));
}

function scheduleCloudSync() {
  if (!isLoggedIn() || isApplyingCloudSnapshot) {
    return;
  }

  if (cloudSyncTimer) {
    clearTimeout(cloudSyncTimer);
  }

  cloudSyncTimer = setTimeout(() => {
    cloudSyncTimer = null;
    syncAllToCloud().catch((error) => {
      console.error("Erro ao sincronizar com a nuvem:", error);
    });
  }, 350);
}

async function syncAllToCloud() {
  if (!isLoggedIn() || isApplyingCloudSnapshot) {
    return;
  }

  migrateLegacyBoardIdsToUuid();

  const boards = state.boards.map((board) => ({ id: board.id, name: board.name }));
  const { tasks, taskTags, comments, columns } = getAllLocalTasksForCloud();
  await pushCloudSnapshot({ boards, columns, tasks, taskTags, comments });
}

function buildLocalColumnsFromCloud({ cloudColumns, localColumns }) {
  const localByCloudId = new Map(
    (localColumns || [])
      .filter((column) => isUuid(column.cloudId))
      .map((column) => [column.cloudId, column]),
  );

  const usedLocalIds = new Set((localColumns || []).map((column) => column.id));
  const sorted = [...cloudColumns].sort((a, b) => (a.position || 0) - (b.position || 0));
  return sorted.map((cloudColumn) => {
    const cloudId = String(cloudColumn.id || "");
    const name = normalizeSpaces(cloudColumn.name || "Coluna");
    const existing = localByCloudId.get(cloudId);
    if (existing) {
      return {
        id: existing.id,
        name,
        cloudId,
      };
    }

    const localId = makeColumnLocalId(name, usedLocalIds);
    usedLocalIds.add(localId);
    return {
      id: localId,
      name,
      cloudId,
    };
  });
}

function resolveLocalColumnIdByCloudId(columns, cloudId) {
  if (!cloudId) return null;
  const match = (columns || []).find((column) => column.cloudId === cloudId);
  return match?.id || null;
}

function makeColumnLocalId(name, usedLocalIds) {
  const normalizedName = normalizeSpaces(name).toLowerCase();
  if (normalizedName === "próximos" || normalizedName === "proximos") {
    if (!usedLocalIds.has("todo")) return "todo";
  }
  if (normalizedName === "em andamento") {
    if (!usedLocalIds.has("inprogress")) return "inprogress";
  }
  if (normalizedName === "concluído" || normalizedName === "concluido") {
    if (!usedLocalIds.has("done")) return "done";
  }

  let base = normalizedName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (!base) base = "coluna";
  let candidate = base;
  let index = 2;
  while (usedLocalIds.has(candidate)) {
    candidate = `${base}-${index}`;
    index += 1;
  }
  return candidate;
}

function render() {
  const activeBoard = getActiveBoard();
  updateBoardName(dom.boardName, activeBoard);

  renderBoardsPanel({
    dom,
    state,
    boards: getBoards(),
    activeBoardId: getActiveBoardId(),
  });

  renderColumnsPanel({
    dom,
    state,
    activeColumns: getActiveColumns(),
    activeBoardId: getActiveBoardId(),
  });

  renderBoardColumns({
    dom,
    state,
    tasks: getTasks(),
    activeColumns: getActiveColumns(),
    context: {
      ui: dom,
      state,
      getActiveColumns,
      actions: {
        onTaskAction,
        openTaskModal: onOpenTaskModal,
        clearDropIndicators: () => clearDropIndicators(dom.boardElement),
      },
    },
  });

  setupDropZones({
    boardElement: dom.boardElement,
    getDraggingTaskId: () => state.draggingTaskId,
    setDragOverListId: (value) => {
      state.dragOverListId = value;
    },
    clearDropIndicators,
    moveTaskByDrop: onMoveTaskByDrop,
  });

  applyFocusTargetColumn();
  updateClearColumnButtons();
}

function getSelectedFocusColumnId() {
  const columns = getActiveColumns();
  if (columns.length === 0) {
    return null;
  }

  const selected = state.focusColumnByBoard[state.activeBoardId];
  if (selected && columns.some((column) => column.id === selected)) {
    return selected;
  }

  return getFocusColumnId();
}

function onToggleFocusMode() {
  toggleFocusMode(dom);
  render();
}

function onTaskAction({ action, task, card, target }) {
  if (action === "left") {
    state.tasks = moveTask(state.tasks, task.id, -1, getActiveColumns());
    resetTaskTransientState();
    saveTasks();
    render();
    return;
  }

  if (action === "right") {
    state.tasks = moveTask(state.tasks, task.id, 1, getActiveColumns());
    resetTaskTransientState();
    saveTasks();
    render();
    return;
  }

  if (action === "toggle-comments") {
    state.commentsOpenTaskId = state.commentsOpenTaskId === task.id ? null : task.id;
    render();
    return;
  }

  if (action === "add-comment") {
    const assigneeInput = card.querySelector(".task-comment-assignee");
    const input = card.querySelector(".task-comment-input");
    if (!(input instanceof HTMLInputElement) || !(assigneeInput instanceof HTMLInputElement)) {
      return;
    }

    const text = normalizeSpaces(input.value);
    if (!text) {
      input.focus();
      return;
    }

    const assignee = normalizeSpaces(assigneeInput.value).replace(/^@+/, "");
    const selectedTask = state.tasks.find((item) => item.id === task.id);
    if (!selectedTask) {
      return;
    }

    if (!Array.isArray(selectedTask.comments)) {
      selectedTask.comments = [];
    }

    selectedTask.comments.push({
      id: uid(),
      text: assignee ? `${text} @${assignee}` : text,
      createdAt: new Date(),
    });

    state.commentsOpenTaskId = task.id;
    saveTasks();
    render();
    return;
  }

  if (action === "delete-comment") {
    const item = target.closest(".task-comment-item");
    const commentId = item?.getAttribute("data-comment-id");
    if (!commentId) return;

    const selectedTask = state.tasks.find((it) => it.id === task.id);
    if (!selectedTask || !Array.isArray(selectedTask.comments)) return;

    selectedTask.comments = selectedTask.comments.filter((comment) => String(comment.id) !== commentId);
    state.commentsOpenTaskId = task.id;
    saveTasks();
    render();
    return;
  }

  if (action === "edit") {
    state.deleteConfirmTaskId = null;
    state.editingTaskId = task.id;
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

    const nextTitle = normalizeSpaces(input.value);
    if (!nextTitle) {
      input.focus();
      return;
    }

    const selectedTask = state.tasks.find((item) => item.id === task.id);
    if (!selectedTask) {
      return;
    }

    selectedTask.title = nextTitle;
    state.editingTaskId = null;
    saveTasks();
    render();
    return;
  }

  if (action === "cancel-edit") {
    state.editingTaskId = null;
    render();
    return;
  }

  if (action === "delete") {
    state.editingTaskId = null;
    state.deleteConfirmTaskId = state.deleteConfirmTaskId === task.id ? null : task.id;
    render();
    return;
  }

  if (action === "confirm-delete") {
    state.tasks = state.tasks.filter((item) => item.id !== task.id);
    resetTaskTransientState(task.id);
    saveTasks();
    render();
    return;
  }

  if (action === "cancel-delete") {
    state.deleteConfirmTaskId = null;
    render();
  }
}

function resetTaskTransientState(taskId = null) {
  if (!taskId || state.editingTaskId === taskId) state.editingTaskId = null;
  if (!taskId || state.deleteConfirmTaskId === taskId) state.deleteConfirmTaskId = null;
  if (!taskId || state.commentsOpenTaskId === taskId) state.commentsOpenTaskId = null;
}

function onOpenTaskModal(taskId) {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) {
    return;
  }
  state.modalEditingTaskId = taskId;
  openTaskModal(dom, task);
}

function onSaveTaskModal() {
  if (!state.modalEditingTaskId) {
    return;
  }

  const task = state.tasks.find((item) => item.id === state.modalEditingTaskId);
  if (!task) {
    return;
  }

  const data = readTaskModalData(dom);
  if (!data.title) {
    dom.taskEditTitle?.focus();
    return;
  }

  Object.assign(task, data);

  saveTasks();
  render();
  state.modalEditingTaskId = null;
  closeTaskModal(dom);
}

function onMoveTaskByDrop(draggedId, targetColumnId, beforeTaskId) {
  state.tasks = moveTaskByDrop(state.tasks, draggedId, targetColumnId, beforeTaskId);
  resetTaskTransientState();
  saveTasks();
  render();
}

function normalizeColumnKey(name) {
  return normalizeSpaces(name).toLowerCase();
}

function resolveOrCreateColumnId(columnName) {
  const board = getActiveBoard();
  if (!board) {
    return getPrimaryColumnId();
  }

  const requestedName = normalizeSpaces(columnName || "");
  if (!requestedName) {
    return board.columns[0]?.id || getPrimaryColumnId();
  }

  const findByName = (name) => {
    const key = normalizeColumnKey(name);
    if (!key) return null;
    return board.columns.find((column) => normalizeColumnKey(column.name) === key) || null;
  };

  const found = findByName(requestedName);

  if (found) {
    return found.id;
  }

  const newColumn = createColumn(requestedName, board.columns);
  board.columns = [...normalizeBoardColumns(board.columns), newColumn];
  saveBoards();
  return newColumn.id;
}

function mapGeneratedTasksToBoard(generated, fallbackTask = null) {
  const source = Array.isArray(generated) ? generated : [];
  const list = source.length > 0 ? source : (fallbackTask ? [fallbackTask] : []);
  if (list.length === 0) {
    return [];
  }

  return list.map((task) => {
    const status = resolveOrCreateColumnId(task?.columnName);
    return normalizeTask({
      ...task,
      id: uid(),
      status,
    });
  });
}

function onCreateTask(event) {
  event.preventDefault();

  const rawTitle = normalizeSpaces(dom.titleInput?.value || "");
  const rawDescription = normalizeSpaces(dom.descriptionInput?.value || "");

  if (!rawTitle) {
    dom.titleInput?.focus();
    return;
  }

  const parsed = parseTasks(rawTitle, { columnNames: getActiveColumns().map((column) => column.name) });
  const fallbackTask = {
    title: rawTitle,
    description: rawDescription,
    category: rawDescription ? rawDescription.toUpperCase() : null,
    assignee: null,
    tags: [],
    comments: [],
    deadline: null,
    completedAt: null,
    columnName: null,
    priority: "normal",
    createdAt: new Date(),
  };

  const mapped = mapGeneratedTasksToBoard(parsed, fallbackTask);

  state.tasks = [...state.tasks, ...mapped];
  saveTasks();

  if (dom.form instanceof HTMLFormElement) {
    dom.form.reset();
  }
  dom.titleInput?.focus();

  render();
}

function onGenerateIATasks() {
  const input = normalizeSpaces(dom.aiPlanInput?.value || "");
  if (!input) {
    if (state.tasks.length === 0) {
      const generatedDefault = parseTasks(getExamplePlanInput(), {
        columnNames: getActiveColumns().map((column) => column.name),
      });
      const defaultTasks = mapGeneratedTasksToBoard(generatedDefault);
      if (defaultTasks.length > 0) {
        state.tasks = [...state.tasks, ...defaultTasks];
        saveTasks();
        closeAIPlanningModal(dom);
        dom.aiPlanInput.value = "";
        render();
      }
      return;
    }

    dom.aiPlanInput.value = "";
    dom.aiPlanInput.focus();
    return;
  }

  const generated = parseTasks(input, {
    columnNames: getActiveColumns().map((column) => column.name),
  });
  const next = mapGeneratedTasksToBoard(generated);
  if (next.length === 0) {
    dom.aiPlanInput.focus();
    return;
  }

  state.tasks = [...state.tasks, ...next];
  saveTasks();
  closeAIPlanningModal(dom);
  dom.aiPlanInput.value = "";
  render();
}

function seedInitialSampleTasks() {
  if (readString(STORAGE_KEYS.INITIAL_SAMPLE_KEY, "") === "done") {
    return;
  }

  if (state.tasks.length > 0) {
    writeString(STORAGE_KEYS.INITIAL_SAMPLE_KEY, "done");
    return;
  }

  const sample = parseTasks(getExamplePlanInput(), {
    columnNames: getActiveColumns().map((column) => column.name),
  });
  state.tasks = mapGeneratedTasksToBoard(sample);

  saveTasks();
  writeString(STORAGE_KEYS.INITIAL_SAMPLE_KEY, "done");
}

function toggleBoardsPanel(mode = "tables") {
  closeSettingsMenu(dom);
  if (!dom.boardsOverlay) {
    return;
  }

  if (dom.boardsOverlay.hidden || state.boardsPanelMode !== mode) {
    openBoardsPanel(mode);
  } else {
    closeBoardsPanel();
  }
}

function openBoardsPanel(mode = "tables") {
  state.boardsPanelMode = mode === "columns" ? "columns" : "tables";
  applyBoardsPanelMode();
  dom.boardsOverlay.hidden = false;
  render();
  updatePageLock(dom);

  if (state.boardsPanelMode === "columns") {
    setTimeout(() => dom.newColumnInput?.focus(), 0);
  }
}

function closeBoardsPanel() {
  dom.boardsOverlay.hidden = true;
  state.editingBoardId = null;
  state.deleteConfirmBoardId = null;
  state.editingColumnId = null;
  state.deleteConfirmColumnId = null;
  state.deleteConfirmAllColumnsBoardId = null;
  state.deleteConfirmAllColumnsStep = 0;
  updatePageLock(dom);
}

function applyBoardsPanelMode() {
  const showingColumns = state.boardsPanelMode === "columns";
  if (dom.boardsTitle) {
    dom.boardsTitle.textContent = showingColumns ? "Colunas" : "Tabelas";
  }
  if (dom.boardsTablesSection) dom.boardsTablesSection.hidden = showingColumns;
  if (dom.boardsColumnsSection) dom.boardsColumnsSection.hidden = !showingColumns;
  if (dom.boardsBackupSection) dom.boardsBackupSection.hidden = showingColumns;
}

function onCreateBoard() {
  const name = normalizeSpaces(dom.newBoardInput?.value || "");
  if (!name) {
    dom.newBoardInput?.focus();
    return;
  }

  state.boards.push(createBoard(name));
  saveBoards();
  dom.newBoardInput.value = "";

  const next = state.boards[state.boards.length - 1];
  switchBoard(next.id);
  openBoardsPanel("tables");
}

function onCreateColumn() {
  const name = normalizeSpaces(dom.newColumnInput?.value || "");
  if (!name) {
    dom.newColumnInput?.focus();
    return;
  }

  const active = getActiveBoard();
  if (!active) {
    return;
  }

  const newCol = createColumn(name, active.columns);
  active.columns = [...normalizeBoardColumns(active.columns), newCol];
  saveBoards();
  dom.newColumnInput.value = "";
  render();
}

function onBoardsListClick(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const action = target.dataset.action;
  const boardId = target.dataset.boardId;
  if (!action || !boardId) {
    return;
  }

  if (action === "switch-board") {
    switchBoard(boardId);
    return;
  }

  if (action === "edit-board") {
    state.editingBoardId = boardId;
    state.deleteConfirmBoardId = null;
    render();
    return;
  }

  if (action === "cancel-edit-board") {
    state.editingBoardId = null;
    render();
    return;
  }

  if (action === "confirm-edit-board") {
    const input = dom.boardsList.querySelector(`[data-board-name-input="${boardId}"]`);
    if (!(input instanceof HTMLInputElement)) return;

    const name = normalizeSpaces(input.value);
    if (!name) {
      input.focus();
      return;
    }

    const board = state.boards.find((item) => item.id === boardId);
    if (!board) return;
    board.name = name;
    state.editingBoardId = null;
    saveBoards();
    render();
    return;
  }

  if (action === "delete-board") {
    state.editingBoardId = null;
    state.deleteConfirmBoardId = state.deleteConfirmBoardId === boardId ? null : boardId;
    render();
    return;
  }

  if (action === "cancel-delete-board") {
    state.deleteConfirmBoardId = null;
    render();
    return;
  }

  if (action === "confirm-delete-board") {
    deleteBoard(boardId);
  }
}

function onColumnsListClick(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const action = target.dataset.action;
  if (!action) {
    return;
  }

  if (action === "delete-all-columns") {
    state.editingColumnId = null;
    state.deleteConfirmColumnId = null;
    if (state.deleteConfirmAllColumnsBoardId === state.activeBoardId) {
      state.deleteConfirmAllColumnsBoardId = null;
      state.deleteConfirmAllColumnsStep = 0;
    } else {
      state.deleteConfirmAllColumnsBoardId = state.activeBoardId;
      state.deleteConfirmAllColumnsStep = 1;
    }
    render();
    return;
  }

  if (action === "proceed-delete-all-columns") {
    state.deleteConfirmAllColumnsBoardId = state.activeBoardId;
    state.deleteConfirmAllColumnsStep = 2;
    render();
    return;
  }

  if (action === "cancel-delete-all-columns") {
    state.deleteConfirmAllColumnsBoardId = null;
    state.deleteConfirmAllColumnsStep = 0;
    render();
    return;
  }

  if (action === "confirm-delete-all-columns") {
    deleteAllColumns();
    return;
  }

  const columnId = target.dataset.columnId;
  if (!columnId) {
    return;
  }

  if (action === "edit-column") {
    state.editingColumnId = columnId;
    state.deleteConfirmColumnId = null;
    render();
    return;
  }

  if (action === "cancel-edit-column") {
    state.editingColumnId = null;
    render();
    return;
  }

  if (action === "confirm-edit-column") {
    const input = dom.columnsList.querySelector(`[data-column-name-input="${columnId}"]`);
    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    const name = normalizeSpaces(input.value);
    if (!name) {
      input.focus();
      return;
    }

    const board = getActiveBoard();
    if (!board) return;

    const column = board.columns.find((item) => item.id === columnId);
    if (!column) return;

    column.name = name;
    state.editingColumnId = null;
    saveBoards();
    render();
    return;
  }

  if (action === "delete-column") {
    state.editingColumnId = null;
    state.deleteConfirmAllColumnsBoardId = null;
    state.deleteConfirmAllColumnsStep = 0;
    state.deleteConfirmColumnId = state.deleteConfirmColumnId === columnId ? null : columnId;
    render();
    return;
  }

  if (action === "cancel-delete-column") {
    state.deleteConfirmColumnId = null;
    render();
    return;
  }

  if (action === "confirm-delete-column") {
    deleteColumn(columnId);
  }
}

function switchBoard(boardId) {
  const target = state.boards.find((board) => board.id === boardId);
  if (!target) {
    return;
  }

  state.activeBoardId = boardId;
  saveActiveBoardId(boardId);
  state.tasks = loadTasksForBoard(boardId).map((task) => normalizeTaskForColumns(task, target.columns));

  state.editingTaskId = null;
  state.deleteConfirmTaskId = null;
  state.commentsOpenTaskId = null;
  state.clearConfirmColumn = null;
  state.deleteConfirmAllColumnsBoardId = null;
  state.deleteConfirmAllColumnsStep = 0;

  render();
}

function deleteBoard(boardId) {
  if (state.boards.length <= 1) {
    return;
  }

  const filtered = state.boards.filter((board) => board.id !== boardId);
  if (filtered.length === 0) {
    return;
  }

  state.boards = filtered;
  saveBoards();

  if (state.activeBoardId === boardId) {
    state.activeBoardId = filtered[0].id;
    saveActiveBoardId(state.activeBoardId);
    state.tasks = loadTasksForBoard(state.activeBoardId).map((task) => normalizeTask(task));
  }

  state.deleteConfirmBoardId = null;
  state.editingBoardId = null;
  render();
}

function deleteColumn(columnId) {
  const board = getActiveBoard();
  if (!board || board.columns.length <= 1) {
    return;
  }

  const columns = [...board.columns];
  const index = columns.findIndex((column) => column.id === columnId);
  if (index === -1) {
    return;
  }

  const fallback = index > 0 ? columns[index - 1].id : columns[1]?.id;
  columns.splice(index, 1);

  state.tasks = state.tasks
    .filter((task) => task.status !== columnId)
    .map((task) => {
      if (!columns.some((column) => column.id === task.status)) {
        return { ...task, status: fallback || columns[0].id };
      }
      return task;
    });

  board.columns = columns;
  saveBoards();
  saveTasks();

  state.deleteConfirmColumnId = null;
  state.deleteConfirmAllColumnsBoardId = null;
  state.deleteConfirmAllColumnsStep = 0;
  state.editingColumnId = null;
  state.clearConfirmColumn = null;
  render();
}

function deleteAllColumns() {
  const board = getActiveBoard();
  if (!board) {
    return;
  }

  board.columns = [createColumn("Proximos", [])];
  state.tasks = [];

  saveBoards();
  saveTasks();

  state.deleteConfirmAllColumnsBoardId = null;
  state.deleteConfirmAllColumnsStep = 0;
  state.deleteConfirmColumnId = null;
  state.editingColumnId = null;
  state.clearConfirmColumn = null;
  render();
}

function onBoardClick(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const actionTarget = target.closest("[data-action]");
  if (!(actionTarget instanceof HTMLElement)) {
    return;
  }

  const action = actionTarget.dataset.action;
  if (action === "sort-mode") {
    const mode = actionTarget.dataset.sortMode;
    if (!mode) {
      return;
    }

    state.sortModeByBoard[state.activeBoardId] = mode;
    const wrapper = actionTarget.closest(".sort-wrap");
    if (wrapper instanceof HTMLDetailsElement) {
      wrapper.open = false;
    }
    render();
    return;
  }

  if (action === "sort-direction") {
    const direction = actionTarget.dataset.sortDirection;
    if (!direction) {
      return;
    }

    state.sortDirectionByBoard[state.activeBoardId] = direction;
    const wrapper = actionTarget.closest(".sort-wrap");
    if (wrapper instanceof HTMLDetailsElement) {
      wrapper.open = false;
    }
    render();
    return;
  }

  if (action === "set-focus-column") {
    const column = actionTarget.dataset.column;
    if (!column) {
      return;
    }

    state.focusColumnByBoard[state.activeBoardId] = column;
    render();
    return;
  }

  if (action === "toggle-column-collapse") {
    const column = actionTarget.dataset.column;
    if (!column) {
      return;
    }

    if (!state.collapsedColumnsByBoard[state.activeBoardId]) {
      state.collapsedColumnsByBoard[state.activeBoardId] = {};
    }

    const boardCollapsed = state.collapsedColumnsByBoard[state.activeBoardId];
    boardCollapsed[column] = !boardCollapsed[column];
    render();
    return;
  }

  if (action !== "clear-column") {
    return;
  }

  const column = actionTarget.dataset.column;
  if (!column) {
    return;
  }

  if (state.clearConfirmColumn === column) {
    state.tasks = state.tasks.filter((task) => task.status !== column);
    state.clearConfirmColumn = null;
    saveTasks();
    render();
    return;
  }

  state.clearConfirmColumn = column;
  updateClearColumnButtons();
}

function updateClearColumnButtons() {
  document.querySelectorAll(".clear-column-btn").forEach((button) => {
    const column = button.dataset.column;
    const isConfirming = state.clearConfirmColumn === column;
    button.classList.toggle("confirming", isConfirming);
    button.textContent = isConfirming ? "Confirmar" : "Limpar";
  });
}

function applyFocusTargetColumn() {
  const columns = getActiveColumns();
  const focusColumn = getSelectedFocusColumnId();
  const hasFocusColumn = columns.some((column) => column.id === focusColumn);
  if (!hasFocusColumn) {
    return;
  }

  document.querySelectorAll(".column").forEach((col) => {
    const isTarget = col.dataset.column === focusColumn;
    col.dataset.focusMain = isTarget ? "true" : "false";
  });
}

function onDocumentClick(event) {
  if (!(event.target instanceof Element)) {
    return;
  }

  if (!event.target.closest(".sort-wrap")) {
    document.querySelectorAll(".sort-wrap[open]").forEach((item) => {
      if (item instanceof HTMLDetailsElement) {
        item.open = false;
      }
    });
  }

  if (event.target.closest(".settings-wrap")) {
    return;
  }

  closeSettingsMenu(dom);
}

function onGlobalKeydown(event) {
  if (event.key === "Escape") {
    if (document.body.classList.contains("focus-mode")) {
      applyFocusMode(false, dom);
      render();
      return;
    }

    if (!dom.aiModalOverlay.hidden) {
      closeAIPlanningModal(dom);
      return;
    }

    if (!dom.taskModalOverlay.hidden) {
      closeTaskModal(dom);
      return;
    }

    if (!dom.helpModalOverlay.hidden) {
      closeHelpModal(dom);
      return;
    }

    if (!dom.usernameModalOverlay.hidden) {
      onUsernameSkip();
      return;
    }

    if (!dom.authModalOverlay.hidden) {
      closeAuthModal();
      return;
    }

    if (!dom.boardsOverlay.hidden) {
      closeBoardsPanel();
      return;
    }

    closeSettingsMenu(dom);
  }
}

function onVisibilityChange() {
  if (document.hidden) {
    closeSettingsMenu(dom);
  }
}

function onAppWheel(event) {
  if (!(event.target instanceof Element) || !dom.appMainScroll) {
    return;
  }

  if (
    event.target.closest(".modal-overlay") ||
    event.target.closest(".boards-overlay") ||
    event.target.closest(".settings-menu")
  ) {
    return;
  }

  const list = event.target.closest(".task-list.task-list-capped");
  if (list) {
    return;
  }

  const shouldRouteToMain =
    event.target.closest(".app-main-scroll") ||
    event.target.closest(".app") ||
    !event.target.closest(".app");

  if (!shouldRouteToMain) {
    return;
  }

  event.preventDefault();
  dom.appMainScroll.scrollTop += event.deltaY;
}

function onCopyPromptTemplate() {
  navigator.clipboard
    .writeText(KANBAN_PROMPT_TEMPLATE)
    .then(() => {
      if (!dom.helpExportPromptButton) return;
      const original = dom.helpExportPromptButton.textContent;
      dom.helpExportPromptButton.textContent = "Copiado";
      setTimeout(() => {
        dom.helpExportPromptButton.textContent = original;
      }, 1200);
    })
    .catch(() => {
      if (!dom.helpExportPromptButton) return;
      dom.helpExportPromptButton.textContent = "Erro ao copiar";
      setTimeout(() => {
        dom.helpExportPromptButton.textContent = "Copiar prompt para IA";
      }, 1400);
    });
}

function onExportBackup() {
  saveTasks();

  const payload = buildBackupPayload({
    boards: state.boards,
    activeBoardId: state.activeBoardId,
    loadTasksForBoard,
    tasks: state.tasks,
    theme: document.body.classList.contains("dark") ? "dark" : "light",
    focusMode: document.body.classList.contains("focus-mode") ? "on" : "off",
  });

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  const filename = `minimal-kanban-backup-${stamp}.json`;

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  setBackupStatus("Backup exportado.");
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

    applyBackupData({
      data: parsed,
      setBoards: (nextBoards) => {
        state.boards = nextBoards;
        saveBoards();
      },
      setActiveBoardId: (boardId) => {
        state.activeBoardId = boardId;
        saveActiveBoardId(boardId);
      },
      setTasks: (nextTasks) => {
        state.tasks = nextTasks.map((task) => normalizeTask(task));
        saveTasks();
      },
      applyTheme: (theme) => applyTheme(theme, dom),
      applyFocusMode: (on) => applyFocusMode(on, dom),
      loadTasksForBoard: (boardId) => {
        const board = state.boards.find((item) => item.id === boardId);
        const columns = board?.columns || getActiveColumns();
        return loadTasksForBoard(boardId).map((task) => normalizeTaskForColumns(task, columns));
      },
    });

    setBackupStatus("Backup importado.");
    render();
  } catch {
    setBackupStatus("Arquivo inválido.");
  } finally {
    target.value = "";
  }
}

function setBackupStatus(message) {
  if (!dom.backupStatus) {
    return;
  }

  dom.backupStatus.textContent = message;
  clearTimeout(setBackupStatus.timerId);
  setBackupStatus.timerId = setTimeout(() => {
    dom.backupStatus.textContent = "";
  }, 2200);
}



