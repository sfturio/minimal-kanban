import { STORAGE_KEYS, taskStorageKey, removeByPrefix, writeJson } from "../storage/local.storage.js";
import { normalizeBoard } from "../services/board.service.js";
import { normalizeTaskForColumns } from "../services/task.service.js";

export function buildBackupPayload({ boards, activeBoardId, loadTasksForBoard, tasks, theme, focusMode }) {
  const tasksByBoard = {};

  boards.forEach((board) => {
    tasksByBoard[board.id] = loadTasksForBoard(board.id).map((task) => normalizeTaskForColumns(task, board.columns));
  });

  tasksByBoard[activeBoardId] = tasks;

  return {
    app: "minimal-kanban",
    version: 1,
    exportedAt: new Date().toISOString(),
    boards,
    activeBoardId,
    tasksByBoard,
    settings: {
      theme,
      focusMode,
    },
  };
}

export function applyBackupData({ data, setBoards, setActiveBoardId, setTasks, applyTheme, applyFocusMode, loadTasksForBoard }) {
  const importedBoards = Array.isArray(data?.boards)
    ? data.boards.map(normalizeBoard).filter((item) => item.id && item.name)
    : [];

  if (importedBoards.length === 0) {
    throw new Error("invalid backup");
  }

  const importedTasksByBoard = data && typeof data.tasksByBoard === "object" && data.tasksByBoard
    ? data.tasksByBoard
    : {};

  const nextActiveBoardId = importedBoards.some((board) => board.id === data?.activeBoardId)
    ? data.activeBoardId
    : importedBoards[0].id;

  removeByPrefix(STORAGE_KEYS.TASKS_KEY_PREFIX);

  importedBoards.forEach((board) => {
    const rawTasks = Array.isArray(importedTasksByBoard[board.id]) ? importedTasksByBoard[board.id] : [];
    const normalized = rawTasks.map((task) => normalizeTaskForColumns(task, board.columns));
    writeJson(taskStorageKey(board.id), normalized);
  });

  setBoards(importedBoards);
  setActiveBoardId(nextActiveBoardId);
  setTasks(loadTasksForBoard(nextActiveBoardId));

  const theme = data?.settings?.theme;
  if (theme === "dark" || theme === "light") {
    applyTheme(theme);
  }

  const focus = data?.settings?.focusMode;
  if (focus === "on" || focus === "off") {
    applyFocusMode(focus === "on");
  }
}
