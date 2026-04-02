import { normalizeDeadline } from "./date.js";
import { normalizeCategory, normalizeSpaces } from "./helpers.js";

function extractLeadingColumnCommand(text) {
  const match = text.match(/^\[([^\]]+)\]\s*(.*)$/u);
  if (!match) {
    return { columnName: null, remainder: text };
  }

  return {
    columnName: normalizeSpaces(match[1]),
    remainder: normalizeSpaces(match[2]),
  };
}

function parseTaskItem(rawText) {
  let text = normalizeSpaces(rawText);
  if (!text) {
    return null;
  }

  let priority = "normal";
  let columnName = null;

  if (text.startsWith("!")) {
    priority = "high";
    text = normalizeSpaces(text.slice(1));
  }

  if (text.startsWith("[")) {
    const extracted = extractLeadingColumnCommand(text);
    columnName = extracted.columnName;
    text = extracted.remainder;
  }

  const categoryMatch = text.match(/\(([^)]+)\)/);
  const category = categoryMatch ? normalizeCategory(categoryMatch[1], "") : null;
  if (categoryMatch) {
    text = normalizeSpaces(text.replace(categoryMatch[0], " "));
  }

  const assigneeMatch = text.match(/@([\wÀ-ÖØ-öø-ÿ.-]+)/u);
  const assignee = assigneeMatch ? normalizeSpaces(assigneeMatch[1]) : null;
  if (assigneeMatch) {
    text = normalizeSpaces(text.replace(assigneeMatch[0], " "));
  }

  const tags = [];
  text = text.replace(/#([\wÀ-ÖØ-öø-ÿ.-]+)/gu, (_, tag) => {
    const next = normalizeSpaces(tag);
    if (next) {
      tags.push(next);
    }
    return " ";
  });

  let deadline = null;
  text = text.replace(/[+*]([0-9./\-]{4,12})/g, (_, rawDate) => {
    const normalized = normalizeDeadline(rawDate);
    if (normalized) {
      deadline = normalized;
    }
    return " ";
  });

  const title = normalizeSpaces(text);
  if (!title) {
    return null;
  }

  return {
    title,
    description: "",
    category,
    assignee,
    tags,
    comments: [],
    deadline,
    completedAt: null,
    columnName,
    priority,
    createdAt: new Date(),
  };
}

export function parseTasks(input) {
  return String(input || "")
    .split(";")
    .map((item) => parseTaskItem(item))
    .filter(Boolean);
}

export function gerarTasksIA(text) {
  return parseTasks(text);
}

export function getExamplePlanInput() {
  return "[em andamento] organizar sprint semanal (manha) @joao #backend #api +06042026; !revisar fluxo de caixa (financeiro) @ana #financas #urgente +07042026; [proximos] preparar campanha de leads (marketing) @bia #conteudo #social +08042026";
}