import * as state from './state.js';
import * as dom from './dom.js';
import { draw, screenToWorld, updateHoverJoint } from './renderer-2d.js';
import { updateSelectionPanel } from './ui.js';
import { parseLengthToInches, distancePointToSegmentWorld } from './utils.js';

// === Helper functions ============================================

export function getMousePos(evt) {
  const canvas = dom.getCanvas();
  const rect = canvas.getBoundingClientRect();
  return {
    sx: evt.clientX - rect.left,
    sy: evt.clientY - rect.top,
  };
}

export function getAllPoints() {
  const pts = [];
  for (const l of state.getLines()) {
    pts.push({ x: l.x1, y: l.y1 });
    pts.push({ x: l.x2, y: l.y2 });
  }
  return pts;
}

export function findLineAtPoint(worldPt, tolerancePx) {
  let best = null;
  for (const l of state.getLines()) {
    const dWorld = distancePointToSegmentWorld(
      worldPt.x,
      worldPt.y,
      l.x1,
      l.y1,
      l.x2,
      l.y2
    );
    const dScreen = dWorld * state.getViewScale();
    if (dScreen <= tolerancePx && (!best || dScreen < best.dScreen)) {
      best = { dScreen, line: l };
    }
  }
  return best ? best.line : null;
}

export function findEndpointAtScreen(sx, sy, radiusPx) {
  let best = null;
  const worldToScreenX = (wx) => (wx - state.getViewOffsetX()) * state.getViewScale();
  const worldToScreenY = (wy) => (wy - state.getViewOffsetY()) * state.getViewScale();
  
  for (const l of state.getLines()) {
    const sx1 = worldToScreenX(l.x1);
    const sy1 = worldToScreenY(l.y1);
    const sx2 = worldToScreenX(l.x2);
    const sy2 = worldToScreenY(l.y2);

    const ds = Math.hypot(sx - sx1, sy - sy1);
    const de = Math.hypot(sx - sx2, sy - sy2);

    if (ds <= radiusPx && (!best || ds < best.d)) {
      best = { d: ds, line: l, which: "start" };
    }
    if (de <= radiusPx && (!best || de < best.d)) {
      best = { d: de, line: l, which: "end" };
    }
  }
  return best;
}

export function selectLine(line) {
  state.setSelectedLineId(line ? line.id : null);
  state.setIsTypingLength(false);
  state.setInlineLengthInput("");
  updateSelectionPanel();
  draw();
}

export function snapPoint(worldRaw, anchorWorld) {
  let wx = worldRaw.x;
  let wy = worldRaw.y;

  let best = null;
  const pts = getAllPoints();
  for (const p of pts) {
    const dx = (p.x - worldRaw.x) * state.getViewScale();
    const dy = (p.y - worldRaw.y) * state.getViewScale();
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d <= state.SNAP_DISTANCE && (!best || d < best.d)) {
      best = { d, x: p.x, y: p.y };
    }
  }

  const gridX = Math.round(worldRaw.x / state.GRID_SPACING) * state.GRID_SPACING;
  const gridY = Math.round(worldRaw.y / state.GRID_SPACING) * state.GRID_SPACING;
  const dgx = (gridX - worldRaw.x) * state.getViewScale();
  const dgy = (gridY - worldRaw.y) * state.getViewScale();
  const dg = Math.sqrt(dgx * dgx + dgy * dgy);
  if (dg <= state.SNAP_DISTANCE && (!best || dg < best.d)) {
    best = { d: dg, x: gridX, y: gridY };
  }

  if (best) {
    wx = best.x;
    wy = best.y;
  }

  if (anchorWorld) {
    const dx = wx - anchorWorld.x;
    const dy = wy - anchorWorld.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0) {
      if (absDy < absDx * 0.2) {
        wy = anchorWorld.y;
      } else if (absDx < absDy * 0.2) {
        wx = anchorWorld.x;
      }
    }
  }

  return { x: wx, y: wy };
}

// === Event handlers ==============================================

export function initCanvasEventHandlers() {
  const canvas = dom.getCanvas();
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener("mousedown", handleMouseDown);
  canvas.addEventListener("mousemove", handleMouseMove);
  canvas.addEventListener("mouseup", handleMouseUp);
  canvas.addEventListener("mouseleave", handleMouseLeave);
  canvas.addEventListener("wheel", handleWheel, { passive: false });
}

function handleMouseDown(evt) {
  const { sx, sy } = getMousePos(evt);
  const worldPt = screenToWorld(sx, sy);
  const doorHeightInput = dom.getDoorHeightInput();
  const doorBaseOffsetInput = dom.getDoorBaseOffsetInput();
  const windowHeightInput = dom.getWindowHeightInput();
  const windowBaseOffsetInput = dom.getWindowBaseOffsetInput();

  if (evt.button === 2) {
    state.setIsPanning(true);
    state.setPanStartScreenX(sx);
    state.setPanStartScreenY(sy);
    state.setPanStartOffsetX(state.getViewOffsetX());
    state.setPanStartOffsetY(state.getViewOffsetY());
    return;
  }

  if (evt.button === 0 && state.getMode() === "select") {
    const endpointHit = findEndpointAtScreen(sx, sy, 8);
    if (endpointHit) {
      state.saveState();
      state.setDragStateSaved(true);
      state.setDraggingEndpoint({
        lineId: endpointHit.line.id,
        which: endpointHit.which,
      });
      selectLine(endpointHit.line);
      return;
    }

    const line = findLineAtPoint(worldPt, 6);
    if (line) {
      selectLine(line);
    } else {
      selectLine(null);
    }
    return;
  }

  if (evt.button === 0 && state.getMode() === "draw") {
    state.setIsDrawing(true);

    let heightInches = null;
    let baseOffsetInches = null;

    if (state.getElementType() === "door") {
      heightInches = parseLengthToInches(doorHeightInput.value);
      if (!heightInches || !isFinite(heightInches) || heightInches <= 0) {
        heightInches = 80;
      }
      baseOffsetInches = parseLengthToInches(doorBaseOffsetInput.value);
      if (baseOffsetInches == null || !isFinite(baseOffsetInches) || baseOffsetInches < 0) {
        baseOffsetInches = 0;
      }
    } else if (state.getElementType() === "window") {
      heightInches = parseLengthToInches(windowHeightInput.value);
      if (!heightInches || !isFinite(heightInches) || heightInches <= 0) {
        heightInches = 48;
      }
      baseOffsetInches = parseLengthToInches(windowBaseOffsetInput.value);
      if (baseOffsetInches == null || !isFinite(baseOffsetInches) || baseOffsetInches < 0) {
        baseOffsetInches = 36;
      }
    }

    const snappedStart = snapPoint(worldPt, null);
    state.setCurrentDrawing({
      kind: state.getElementType(),
      heightInches,
      baseOffsetInches,
      x1: snappedStart.x,
      y1: snappedStart.y,
      x2: snappedStart.x,
      y2: snappedStart.y,
    });
  }
}

function handleMouseMove(evt) {
  const { sx, sy } = getMousePos(evt);
  const worldPt = screenToWorld(sx, sy);

  if (state.getIsPanning()) {
    const dxScreen = sx - state.getPanStartScreenX();
    const dyScreen = sy - state.getPanStartScreenY();
    state.setViewOffsetX(state.getPanStartOffsetX() - dxScreen / state.getViewScale());
    state.setViewOffsetY(state.getPanStartOffsetY() - dyScreen / state.getViewScale());
    draw();
    return;
  }

  if (state.getMode() === "draw" && state.getIsDrawing() && state.getCurrentDrawing()) {
    const snappedEnd = snapPoint(worldPt, {
      x: state.getCurrentDrawing().x1,
      y: state.getCurrentDrawing().y1,
    });
    state.getCurrentDrawing().x2 = snappedEnd.x;
    state.getCurrentDrawing().y2 = snappedEnd.y;
    draw();
    return;
  }

  if (state.getMode() === "select" && state.getDraggingEndpoint()) {
    const line = state.getLineById(state.getDraggingEndpoint().lineId);
    if (!line) {
      state.setDraggingEndpoint(null);
      return;
    }
    const anchor =
      state.getDraggingEndpoint().which === "start"
        ? { x: line.x2, y: line.y2 }
        : { x: line.x1, y: line.y1 };
    const snapped = snapPoint(worldPt, anchor);
    if (state.getDraggingEndpoint().which === "start") {
      line.x1 = snapped.x;
      line.y1 = snapped.y;
    } else {
      line.x2 = snapped.x;
      line.y2 = snapped.y;
    }
    updateSelectionPanel();
    draw();
    return;
  }

  updateHoverJoint(sx, sy);
  draw();
}

function handleMouseUp() {
  if (state.getIsPanning()) {
    state.setIsPanning(false);
    return;
  }

  if (state.getMode() === "draw") {
    if (state.getIsDrawing() && state.getCurrentDrawing()) {
      const dx = state.getCurrentDrawing().x2 - state.getCurrentDrawing().x1;
      const dy = state.getCurrentDrawing().y2 - state.getCurrentDrawing().y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 2) {
        state.saveState();
        const newLine = {
          id: state.getNextLineId(),
          kind: state.getCurrentDrawing().kind || "wall",
          heightInches: state.getCurrentDrawing().heightInches,
          baseOffsetInches: state.getCurrentDrawing().baseOffsetInches,
          x1: state.getCurrentDrawing().x1,
          y1: state.getCurrentDrawing().y1,
          x2: state.getCurrentDrawing().x2,
          y2: state.getCurrentDrawing().y2,
        };
        state.setNextLineId(state.getNextLineId() + 1);
        state.addLine(newLine);
        selectLine(newLine);
      }
    }
    state.setIsDrawing(false);
    state.setCurrentDrawing(null);
    draw();
  }

  if (state.getMode() === "select" && state.getDraggingEndpoint()) {
    state.setDraggingEndpoint(null);
    state.setDragStateSaved(false);
  }
}

function handleMouseLeave() {
  state.setIsDrawing(false);
  state.setCurrentDrawing(null);
  state.setIsPanning(false);
  state.setDraggingEndpoint(null);
  state.setDragStateSaved(false);
  state.setHoverJoint(null);
  draw();
}

function handleWheel(e) {
  e.preventDefault();
  const { sx, sy } = getMousePos(e);
  const worldBefore = screenToWorld(sx, sy);

  const zoomFactor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
  const newScale = Math.min(20, Math.max(0.1, state.getViewScale() * zoomFactor));
  state.setViewScale(newScale);

  state.setViewOffsetX(worldBefore.x - sx / state.getViewScale());
  state.setViewOffsetY(worldBefore.y - sy / state.getViewScale());

  draw();
}

// === Keyboard event handlers =====================================

export function initKeyboardEventHandlers() {
  document.addEventListener("keydown", handleKeyDown);
}

function handleKeyDown(e) {
  const target = e.target;
  if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
    if (!(e.ctrlKey && e.key === "z")) {
      return;
    }
  }

  if (e.ctrlKey && e.key === "z") {
    e.preventDefault();
    state.undo({
      onUndo: () => {
        state.setSelectedLineId(null);
        updateSelectionPanel();
      }
    });
    state.setIsTypingLength(false);
    state.setInlineLengthInput("");
    draw();
    return;
  }

  if (state.getSelectedLineId() != null) {
    const validChars = "0123456789.'\" ";
    
    if (e.key === "Enter" && state.getIsTypingLength() && state.getInlineLengthInput().trim()) {
      e.preventDefault();
      const inches = parseLengthToInches(state.getInlineLengthInput());
      if (inches != null && isFinite(inches) && inches > 0) {
        const line = state.getSelectedLine();
        if (line) {
          state.saveState();
          const dx = line.x2 - line.x1;
          const dy = line.y2 - line.y1;
          const currentLen = Math.sqrt(dx * dx + dy * dy);
          if (currentLen > 0) {
            const scale = inches / currentLen;
            line.x2 = line.x1 + dx * scale;
            line.y2 = line.y1 + dy * scale;
            updateSelectionPanel();
          }
        }
      }
      state.setIsTypingLength(false);
      state.setInlineLengthInput("");
      draw();
      return;
    }
    
    if (e.key === "Escape") {
      state.setIsTypingLength(false);
      state.setInlineLengthInput("");
      draw();
      e.preventDefault();
      return;
    }
    
    if (e.key === "Backspace" && state.getIsTypingLength()) {
      state.setInlineLengthInput(state.getInlineLengthInput().slice(0, -1));
      if (state.getInlineLengthInput() === "") {
        state.setIsTypingLength(false);
      }
      draw();
      e.preventDefault();
      return;
    }
    
    if (validChars.includes(e.key) && e.key.length === 1) {
      state.setIsTypingLength(true);
      state.setInlineLengthInput(state.getInlineLengthInput() + e.key);
      draw();
      e.preventDefault();
      return;
    }
  }

  if ((e.key === "Delete" || e.key === "Backspace") && state.getSelectedLineId() != null && !state.getIsTypingLength()) {
    state.saveState();
    state.removeLine(state.getSelectedLineId());
    state.setSelectedLineId(null);
    updateSelectionPanel();
    draw();
    e.preventDefault();
  }
}
