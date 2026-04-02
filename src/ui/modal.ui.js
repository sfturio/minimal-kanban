import { normalizeDeadline } from "../utils/date.js";

export function updatePageLock(dom) {
  const hasOverlayOpen =
    !dom.aiModalOverlay?.hidden
    || !dom.boardsOverlay?.hidden
    || !dom.taskModalOverlay?.hidden
    || !dom.helpModalOverlay?.hidden
    || !dom.emojiModalOverlay?.hidden
    || !dom.authModalOverlay?.hidden
    || !dom.usernameModalOverlay?.hidden;
  document.body.classList.toggle("overlay-open", Boolean(hasOverlayOpen));
}

export function closeSettingsMenu(dom) {
  if (!dom.settingsMenu || !dom.settingsToggleButton) {
    return;
  }
  dom.settingsMenu.hidden = true;
  dom.settingsToggleButton.setAttribute("aria-expanded", "false");
}

export function toggleSettingsMenu(dom, event) {
  event?.stopPropagation();
  if (!dom.settingsMenu || !dom.settingsToggleButton) {
    return;
  }
  const isHidden = dom.settingsMenu.hidden;
  dom.settingsMenu.hidden = !isHidden;
  dom.settingsToggleButton.setAttribute("aria-expanded", String(isHidden));
}

export function openAIPlanningModal(dom) {
  if (!dom.aiModalOverlay) return;
  dom.aiModalOverlay.hidden = false;
  updatePageLock(dom);
  dom.aiPlanInput?.focus();
}

export function closeAIPlanningModal(dom) {
  if (!dom.aiModalOverlay) return;
  dom.aiModalOverlay.hidden = true;
  updatePageLock(dom);
}

export function openHelpModal(dom) {
  if (!dom.helpModalOverlay) return;
  dom.helpModalOverlay.hidden = false;
  dom.helpToggleButton?.setAttribute("aria-expanded", "true");
  updatePageLock(dom);
}

export function closeHelpModal(dom) {
  if (!dom.helpModalOverlay) return;
  dom.helpModalOverlay.hidden = true;
  dom.helpToggleButton?.setAttribute("aria-expanded", "false");
  updatePageLock(dom);
}

export function openEmojiModal(dom) {
  if (!dom.emojiModalOverlay) return;
  dom.emojiModalOverlay.hidden = false;
  updatePageLock(dom);
}

export function closeEmojiModal(dom) {
  if (!dom.emojiModalOverlay) return;
  dom.emojiModalOverlay.hidden = true;
  updatePageLock(dom);
}

export function openTaskModal(dom, task) {
  if (!dom.taskModalOverlay || !task) return;

  if (dom.taskEditTitle) dom.taskEditTitle.value = task.title || "";
  if (dom.taskEditDescription) dom.taskEditDescription.value = task.description || "";
  if (dom.taskEditCategory) dom.taskEditCategory.value = task.category || "";
  if (dom.taskEditAssignee) dom.taskEditAssignee.value = task.assignee || "";
  if (dom.taskEditTags) dom.taskEditTags.value = Array.isArray(task.tags) ? task.tags.join(", ") : "";
  if (dom.taskEditDeadline) dom.taskEditDeadline.value = task.deadline || "";
  if (dom.taskEditCompletedAt) dom.taskEditCompletedAt.value = task.completedAt || "";
  if (dom.taskEditPriority) dom.taskEditPriority.value = task.priority || "normal";

  dom.taskModalOverlay.hidden = false;
  updatePageLock(dom);
  dom.taskEditTitle?.focus();
}

export function closeTaskModal(dom) {
  if (!dom.taskModalOverlay) return;
  dom.taskModalOverlay.hidden = true;
  updatePageLock(dom);
}

export function readTaskModalData(dom) {
  return {
    title: dom.taskEditTitle?.value?.trim() || "",
    description: dom.taskEditDescription?.value?.trim() || "",
    category: dom.taskEditCategory?.value?.trim() || null,
    assignee: dom.taskEditAssignee?.value?.trim() || null,
    tags: (dom.taskEditTags?.value || "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    deadline: normalizeDeadline(dom.taskEditDeadline?.value || ""),
    completedAt: normalizeDeadline(dom.taskEditCompletedAt?.value || ""),
    priority: dom.taskEditPriority?.value || "normal",
  };
}
