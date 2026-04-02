import { safeJsonParse } from "../utils/helpers.js";

export const STORAGE_KEYS = {
  LEGACY_STORAGE_KEY: "kanban.tasks.v1",
  TASKS_KEY_PREFIX: "kanban.tasks.board.v2.",
  BOARDS_KEY: "kanban.boards.v1",
  ACTIVE_BOARD_KEY: "kanban.active-board.v1",
  THEME_KEY: "kanban.theme.v1",
  FOCUS_KEY: "kanban.focus.v1",
  INITIAL_SAMPLE_KEY: "kanban.initial-sample-seeded.v1",
  AUTH_LAST_EMAIL_KEY: "kanban.auth.last-email.v1",
};

export const DEFAULT_COLUMNS = [
  { id: "todo", name: "Próximos ⏭️" },
  { id: "inprogress", name: "Em andamento 🎯" },
  { id: "done", name: "Concluído ✅" },
  { id: "notes", name: "Notas 🧠" },
];

export const DEFAULT_BOARD_ID = "principal";

export function taskStorageKey(boardId) {
  return `${STORAGE_KEYS.TASKS_KEY_PREFIX}${boardId}`;
}

export function readJson(key, fallback) {
  return safeJsonParse(localStorage.getItem(key), fallback);
}

export function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function readString(key, fallback = "") {
  const value = localStorage.getItem(key);
  return value == null ? fallback : value;
}

export function writeString(key, value) {
  localStorage.setItem(key, String(value));
}

export function removeByPrefix(prefix) {
  const keys = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) {
      keys.push(key);
    }
  }
  keys.forEach((key) => localStorage.removeItem(key));
}
