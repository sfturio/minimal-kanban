const state = {
  boards: [],
  activeBoardId: null,
  tasks: [],
  draggingTaskId: null,
  dragOverListId: null,
  editingTaskId: null,
  modalEditingTaskId: null,
  deleteConfirmTaskId: null,
  commentsOpenTaskId: null,
  editingBoardId: null,
  deleteConfirmBoardId: null,
  editingColumnId: null,
  deleteConfirmColumnId: null,
  clearConfirmColumn: null,
  boardsPanelMode: "tables",
  collapsedColumnsByBoard: {},
  focusColumnByBoard: {},
  sortModeByBoard: {},
  sortDirectionByBoard: {},
};

export function getAppState() {
  return state;
}

export function setAppState(patch) {
  Object.assign(state, patch);
}
