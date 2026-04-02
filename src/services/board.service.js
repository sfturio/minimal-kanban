import {
  DEFAULT_BOARD_ID,
  DEFAULT_COLUMNS,
  STORAGE_KEYS,
  readJson,
  readString,
  writeJson,
  writeString,
} from "../storage/local.storage.js";
import { isUuid, normalizeSpaces, uid } from "../utils/helpers.js";

export function normalizeBoardColumns(columns) {
  const list = Array.isArray(columns) ? columns : [];
  const normalized = list
    .map((column) => {
      const id = normalizeSpaces(column?.id || "").toLowerCase();
      const name = normalizeSpaces(column?.name || "");
      if (!id || !name) {
      return null;
      }
      return {
        id,
        name,
        cloudId: isUuid(column?.cloudId) ? String(column.cloudId) : null,
        important: Boolean(column?.important),
      };
    })
    .filter(Boolean);

  if (normalized.length === 0) {
    return DEFAULT_COLUMNS.map((column) => ({ ...column }));
  }

  const deduped = [];
  const used = new Set();
  normalized.forEach((column) => {
    if (used.has(column.id)) {
      return;
    }
    used.add(column.id);
    deduped.push(column);
  });

  return deduped;
}

export function normalizeBoard(board) {
  return {
    id: normalizeSpaces(board?.id) || uid(),
    name: normalizeSpaces(board?.name) || "Tabela",
    columns: normalizeBoardColumns(board?.columns),
  };
}

export function loadBoards() {
  const parsed = readJson(STORAGE_KEYS.BOARDS_KEY, []);
  const list = Array.isArray(parsed) ? parsed : [];

  const normalized = list.map(normalizeBoard).filter((item) => item.id && item.name);
  if (normalized.length === 0) {
    return [normalizeBoard({ id: DEFAULT_BOARD_ID, name: "TRABALHA 📌", columns: DEFAULT_COLUMNS })];
  }

  return normalized;
}

export function saveBoards(boards) {
  writeJson(STORAGE_KEYS.BOARDS_KEY, boards);
}

export function loadActiveBoardId(boards) {
  const stored = readString(STORAGE_KEYS.ACTIVE_BOARD_KEY, "");
  const exists = boards.find((board) => board.id === stored);
  const active = exists ? exists.id : boards[0].id;
  writeString(STORAGE_KEYS.ACTIVE_BOARD_KEY, active);
  return active;
}

export function saveActiveBoardId(boardId) {
  writeString(STORAGE_KEYS.ACTIVE_BOARD_KEY, boardId);
}

export function createBoard(name) {
  return normalizeBoard({
    id: uid(),
    name,
    columns: DEFAULT_COLUMNS.map((column) => ({ ...column })),
  });
}

export function createColumn(name, existingColumns) {
  const normalizedName = normalizeSpaces(name);
  const existing = normalizeBoardColumns(existingColumns);
  const existingIds = new Set(existing.map((column) => column.id));

  let baseId = normalizedName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (!baseId) {
    baseId = `col-${existing.length + 1}`;
  }

  let nextId = baseId;
  let suffix = 2;
  while (existingIds.has(nextId)) {
    nextId = `${baseId}-${suffix}`;
    suffix += 1;
  }

  return { id: nextId, name: normalizedName, cloudId: null, important: false };
}
