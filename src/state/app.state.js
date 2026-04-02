const state = {
  boards: [],
  activeBoardId: null,
  tasks: [],
  draggingTaskId: null,
  draggingColumnId: null,
  dragOverListId: null,
  editingTaskId: null,
  modalEditingTaskId: null,
  deleteConfirmTaskId: null,
  commentsOpenTaskId: null,
  editingBoardId: null,
  deleteConfirmBoardId: null,
  deleteConfirmBoardStep: 0,
  editingColumnId: null,
  deleteConfirmColumnId: null,
  deleteConfirmAllColumnsBoardId: null,
  deleteConfirmAllColumnsStep: 0,
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
