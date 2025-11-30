// === Application State ============================================
// Simple object-based state that acts as a single source of truth

const appState = {
  // Viewport (zoom & pan)
  viewScale: 1,
  viewOffsetX: 0,
  viewOffsetY: 0,

  // Mode & element type
  mode: "draw",
  elementType: "wall",

  // lines: { id, kind, heightInches?, baseOffsetInches?, x1,y1,x2,y2 }
  lines: [],
  nextLineId: 1,

  // Undo history
  undoHistory: [],

  // Drawing state
  isDrawing: false,
  currentDrawing: null,

  // Selection
  selectedLineId: null,

  // Panning state
  isPanning: false,
  panStartScreenX: 0,
  panStartScreenY: 0,
  panStartOffsetX: 0,
  panStartOffsetY: 0,

  // Endpoint dragging state
  draggingEndpoint: null,
  dragStateSaved: false,

  // Inline length typing
  inlineLengthInput: "",
  isTypingLength: false,

  // Joint misalignment info
  jointIssues: new Map(),
  hoverJoint: null,

  // Three.js objects
  threeRenderer: null,
  threeScene: null,
  threeCamera: null,
};

// Constants
export const GRID_SPACING = 12;
export const SNAP_DISTANCE = 12;
export const MAX_UNDO_STEPS = 50;

// Getters for all properties
export function getViewScale() { return appState.viewScale; }
export function getViewOffsetX() { return appState.viewOffsetX; }
export function getViewOffsetY() { return appState.viewOffsetY; }
export function getMode() { return appState.mode; }
export function getElementType() { return appState.elementType; }
export function getLines() { return appState.lines; }
export function getNextLineId() { return appState.nextLineId; }
export function getUndoHistory() { return appState.undoHistory; }
export function getIsDrawing() { return appState.isDrawing; }
export function getCurrentDrawing() { return appState.currentDrawing; }
export function getSelectedLineId() { return appState.selectedLineId; }
export function getIsPanning() { return appState.isPanning; }
export function getPanStartScreenX() { return appState.panStartScreenX; }
export function getPanStartScreenY() { return appState.panStartScreenY; }
export function getPanStartOffsetX() { return appState.panStartOffsetX; }
export function getPanStartOffsetY() { return appState.panStartOffsetY; }
export function getDraggingEndpoint() { return appState.draggingEndpoint; }
export function getDragStateSaved() { return appState.dragStateSaved; }
export function getInlineLengthInput() { return appState.inlineLengthInput; }
export function getIsTypingLength() { return appState.isTypingLength; }
export function getJointIssues() { return appState.jointIssues; }
export function getHoverJoint() { return appState.hoverJoint; }
export function getThreeRenderer() { return appState.threeRenderer; }
export function getThreeScene() { return appState.threeScene; }
export function getThreeCamera() { return appState.threeCamera; }

// Setters for all properties
export function setViewScale(val) { appState.viewScale = val; }
export function setViewOffsetX(val) { appState.viewOffsetX = val; }
export function setViewOffsetY(val) { appState.viewOffsetY = val; }
export function setMode(val) { appState.mode = val; }
export function setElementType(val) { appState.elementType = val; }
export function setLines(val) { appState.lines = val; }
export function setNextLineId(val) { appState.nextLineId = val; }
export function setIsDrawing(val) { appState.isDrawing = val; }
export function setCurrentDrawing(val) { appState.currentDrawing = val; }
export function setSelectedLineId(val) { appState.selectedLineId = val; }
export function setIsPanning(val) { appState.isPanning = val; }
export function setPanStartScreenX(val) { appState.panStartScreenX = val; }
export function setPanStartScreenY(val) { appState.panStartScreenY = val; }
export function setPanStartOffsetX(val) { appState.panStartOffsetX = val; }
export function setPanStartOffsetY(val) { appState.panStartOffsetY = val; }
export function setDraggingEndpoint(val) { appState.draggingEndpoint = val; }
export function setDragStateSaved(val) { appState.dragStateSaved = val; }
export function setInlineLengthInput(val) { appState.inlineLengthInput = val; }
export function setIsTypingLength(val) { appState.isTypingLength = val; }
export function setJointIssues(val) { appState.jointIssues = val; }
export function setHoverJoint(val) { appState.hoverJoint = val; }
export function setThreeRenderer(val) { appState.threeRenderer = val; }
export function setThreeScene(val) { appState.threeScene = val; }
export function setThreeCamera(val) { appState.threeCamera = val; }

// Helper functions
export function addLine(line) {
  appState.lines.push(line);
}

export function removeLine(id) {
  const idx = appState.lines.findIndex(l => l.id === id);
  if (idx !== -1) {
    appState.lines.splice(idx, 1);
  }
}

export function getLineById(id) {
  return appState.lines.find(l => l.id === id) || null;
}

export function getSelectedLine() {
  return appState.lines.find((l) => l.id === appState.selectedLineId) || null;
}

export function saveState() {
  const state = JSON.stringify(appState.lines.map(l => ({
    id: l.id,
    kind: l.kind,
    heightInches: l.heightInches,
    baseOffsetInches: l.baseOffsetInches,
    x1: l.x1,
    y1: l.y1,
    x2: l.x2,
    y2: l.y2
  })));
  appState.undoHistory.push(state);
  if (appState.undoHistory.length > MAX_UNDO_STEPS) {
    appState.undoHistory.shift();
  }
}

export function undo(callbacks) {
  if (appState.undoHistory.length === 0) return;
  const previousState = appState.undoHistory.pop();
  const restoredLines = JSON.parse(previousState);
  appState.lines = restoredLines;
  appState.nextLineId = Math.max(...appState.lines.map(l => l.id), 0) + 1;
  if (callbacks && callbacks.onUndo) {
    callbacks.onUndo();
  }
}
