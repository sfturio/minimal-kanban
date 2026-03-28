const STORAGE_KEY = "kanban.tasks.v1";
const THEME_KEY = "kanban.theme.v1";
const FOCUS_KEY = "kanban.focus.v1";
const COLUMNS = ["todo", "inprogress", "done"];

let tasks = loadTasks().map(normalizeTask);
let draggingTaskId = null;

const form = document.getElementById("task-form");
const titleInput = document.getElementById("task-title");
const descriptionInput = document.getElementById("task-description");
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

form.addEventListener("submit", onCreateTask);
iaGenerateButton?.addEventListener("click", openAIPlanningModal);
aiCancelButton?.addEventListener("click", closeAIPlanningModal);
aiGenerateConfirmButton?.addEventListener("click", onGenerateIATasks);
aiCloseButton?.addEventListener("click", closeAIPlanningModal);
aiModalOverlay?.addEventListener("click", onModalOverlayClick);
document.addEventListener("keydown", onGlobalKeydown);
document.addEventListener("visibilitychange", onVisibilityChange);
themeToggleButton?.addEventListener("click", toggleTheme);
focusToggleButton?.addEventListener("click", toggleFocusMode);

initTheme();
initFocusMode();
setupDropZones();
render();

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
      // Force reflow so repeated activations replay the animation.
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
  return {
    ...task,
    category: task.category || inferCategory(task.description || ""),
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
  if (!text) {
    return;
  }

  const generated = gerarTasksIA(text);
  if (generated === 0) {
    return;
  }

  if (aiPlanInput) {
    aiPlanInput.value = "";
  }

  closeAIPlanningModal();
}

function gerarTasksIA(text) {
  const plannedTitles = text
    .split(";")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  if (plannedTitles.length === 0) {
    return 0;
  }

  const plannedTasks = plannedTitles.map((title) => ({
    id: crypto.randomUUID(),
    title,
    description: "",
    category: "Geral",
    status: "todo",
  }));

  // Add planned tasks at the top of "Próximos".
  tasks = [...plannedTasks, ...tasks];
  saveTasks();
  render();

  console.log("Planejando com IA:", plannedTitles);
  return plannedTasks.length;
}

function openAIPlanningModal() {
  if (!aiModalOverlay) {
    return;
  }

  aiModalOverlay.hidden = false;
  document.body.style.overflow = "hidden";
  aiPlanInput?.focus();
}

function closeAIPlanningModal() {
  if (!aiModalOverlay) {
    document.body.style.overflow = "";
    return;
  }

  aiModalOverlay.hidden = true;
  document.body.style.overflow = "";
}

function onModalOverlayClick(event) {
  const target = event.target;
  const clickedInsideModal =
    target instanceof Element && Boolean(target.closest(".ai-modal"));

  if (!clickedInsideModal) {
    closeAIPlanningModal();
  }
}

function onGlobalKeydown(event) {
  if (event.key === "Escape" && aiModalOverlay && !aiModalOverlay.hidden) {
    closeAIPlanningModal();
  }
}

function onVisibilityChange() {
  if (document.visibilityState !== "visible") {
    closeAIPlanningModal();
  }
}

function inferCategory(description) {
  if (!description) {
    return "Geral";
  }

  return description.slice(0, 16).trim();
}

function render() {
  COLUMNS.forEach((column) => {
    const list = document.getElementById(`${column}-list`);
    list.innerHTML = "";

    tasks
      .filter((task) => task.status === column)
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
    <span class="task-category"></span>
    <div class="task-actions">
      <button type="button" data-action="left">←</button>
      <button type="button" data-action="right">→</button>
      <button type="button" class="delete" data-action="delete">Excluir</button>
    </div>
  `;

  card.querySelector(".task-title").textContent = task.title;
  card.querySelector(".task-category").textContent = task.category || "Geral";

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
      deleteTask(task.id);
      return;
    }

    if (action === "left") {
      moveTask(task.id, -1);
      return;
    }

    if (action === "right") {
      moveTask(task.id, 1);
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
      if (!task || task.status === column) {
        return;
      }

      task.status = column;
      saveTasks();
      render();
    });
  });
}
