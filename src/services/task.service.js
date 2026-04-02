import { normalizeDeadline } from "../utils/date.js";
import { normalizeCategory, normalizeSpaces, uid } from "../utils/helpers.js";
import { normalizeBoardColumns } from "./board.service.js";

export function normalizeTaskComments(comments) {
  if (!Array.isArray(comments)) {
    return [];
  }

  return comments
    .map((comment) => {
      const text = normalizeSpaces(comment?.text || "");
      if (!text) {
        return null;
      }
      return {
        id: comment?.id || uid(),
        text,
        createdAt: comment?.createdAt ? new Date(comment.createdAt) : new Date(),
      };
    })
    .filter(Boolean);
}

export function normalizeTaskForColumns(task, columns) {
  const normalizedColumns = normalizeBoardColumns(columns);
  const validStatuses = new Set(normalizedColumns.map((column) => column.id));
  const fallbackStatus = normalizedColumns[0]?.id || "todo";

  return {
    id: task?.id || uid(),
    title: normalizeSpaces(task?.title || ""),
    description: String(task?.description || ""),
    category: normalizeCategory(task?.category, task?.description),
    assignee: normalizeSpaces(task?.assignee || "") || null,
    tags: Array.isArray(task?.tags)
      ? task.tags.map((tag) => normalizeSpaces(tag)).filter(Boolean)
      : [],
    comments: normalizeTaskComments(task?.comments),
    deadline: normalizeDeadline(task?.deadline),
    completedAt: normalizeDeadline(task?.completedAt),
    status: validStatuses.has(task?.status) ? task.status : fallbackStatus,
    priority: task?.priority === "high" ? "high" : "normal",
    createdAt: task?.createdAt ? new Date(task.createdAt) : new Date(),
  };
}

export function normalizeTasksForColumns(tasks, columns) {
  return (Array.isArray(tasks) ? tasks : [])
    .map((task) => normalizeTaskForColumns(task, columns))
    .filter((task) => Boolean(task.title));
}

export function orderTasksForColumn(columnTasks, sort = { mode: "manual", direction: "asc" }) {
  const source = Array.isArray(columnTasks) ? [...columnTasks] : [];
  const mode = sort?.mode || "manual";
  const direction = sort?.direction === "desc" ? "desc" : "asc";

  if (mode === "manual") {
    return source;
  }

  if (mode === "priority") {
    return source.sort((a, b) => {
      const weightA = a.priority === "high" ? 0 : 1;
      const weightB = b.priority === "high" ? 0 : 1;
      const result = weightA - weightB;
      return direction === "desc" ? result * -1 : result;
    });
  }

  if (mode === "deadline") {
    return source.sort((a, b) => {
      const timeA = getDeadlineTimestamp(a?.deadline);
      const timeB = getDeadlineTimestamp(b?.deadline);
      const result = timeA - timeB;
      return direction === "desc" ? result * -1 : result;
    });
  }

  return source;
}

export function getTaskCreatedAtTimestamp(task) {
  const source = task?.createdAt;
  const date = source instanceof Date ? source : new Date(source || 0);
  const stamp = date.getTime();
  return Number.isFinite(stamp) ? stamp : Number.MAX_SAFE_INTEGER;
}

export function moveTask(tasks, taskId, direction, columns) {
  const columnIds = columns.map((column) => column.id);
  const next = [...tasks];
  const task = next.find((item) => item.id === taskId);
  if (!task) {
    return next;
  }

  const index = columnIds.indexOf(task.status);
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= columnIds.length) {
    return next;
  }

  task.status = columnIds[nextIndex];
  if (task.status !== columnIds[columnIds.length - 1]) {
    task.completedAt = null;
  }
  return next;
}

export function moveTaskByDrop(tasks, taskId, targetColumnId, beforeTaskId) {
  const dragged = tasks.find((task) => task.id === taskId);
  if (!dragged) {
    return tasks;
  }

  if (beforeTaskId && beforeTaskId === taskId) {
    return tasks;
  }

  const remaining = tasks.filter((task) => task.id !== taskId);
  const updated = { ...dragged, status: targetColumnId };
  let insertIndex = -1;

  if (beforeTaskId) {
    insertIndex = remaining.findIndex((task) => task.id === beforeTaskId);
  }

  if (insertIndex === -1) {
    insertIndex = lastIndexOfStatus(remaining, targetColumnId) + 1;
    if (insertIndex < 0) {
      insertIndex = remaining.length;
    }
  }

  remaining.splice(insertIndex, 0, updated);
  return remaining;
}

export function lastIndexOfStatus(list, status) {
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (list[i].status === status) {
      return i;
    }
  }
  return -1;
}

function getDeadlineTimestamp(deadline) {
  if (!deadline) {
    return Number.MAX_SAFE_INTEGER;
  }

  const value = String(deadline).trim();
  const match = value.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (match) {
    const [, dd, mm, yyyy] = match;
    return Number(`${yyyy}${mm}${dd}`);
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}
