import * as state from './state.js';
import * as dom from './dom.js';
import { draw, getWallOffsetsForElement } from './renderer-2d.js';
import { generate3DScene, close3DScene } from './renderer-3d.js';
import { parseLengthToInches, formatInchesToFeetInches, lineKind } from './utils.js';

// === Selection panel update ======================================

export function updateSelectionPanel() {
  const selectedTypeDisplay = dom.getSelectedTypeDisplay();
  const lengthDisplay = dom.getLengthDisplay();
  const lengthInchesDisplay = dom.getLengthInchesDisplay();
  const angleDisplay = dom.getAngleDisplay();
  const selectedHeightDisplay = dom.getSelectedHeightDisplay();
  const selectedOffsetDisplay = dom.getSelectedOffsetDisplay();
  const lengthInput = dom.getLengthInput();
  const angleInput = dom.getAngleInput();
  const heightInput = dom.getHeightInput();
  const offsetInput = dom.getOffsetInput();
  
  const wallOffsetStartLine = dom.getWallOffsetStartLine();
  const wallOffsetEndLine = dom.getWallOffsetEndLine();
  const wallOffsetStartDisplay = dom.getWallOffsetStartDisplay();
  const wallOffsetEndDisplay = dom.getWallOffsetEndDisplay();
  const wallOffsetStartField = dom.getWallOffsetStartField();
  const wallOffsetEndField = dom.getWallOffsetEndField();
  const wallOffsetStartBtnField = dom.getWallOffsetStartBtnField();
  const wallOffsetEndBtnField = dom.getWallOffsetEndBtnField();
  const wallOffsetStartInput = dom.getWallOffsetStartInput();
  const wallOffsetEndInput = dom.getWallOffsetEndInput();
  
  const flipWallFacingField = dom.getFlipWallFacingField();
  const flipWallFacingHint = dom.getFlipWallFacingHint();
  const selectedElementPanel = document.getElementById("selectedElementPanel");

  const line = state.getSelectedLine();
  if (!line) {
    selectedTypeDisplay.textContent = "—";
    lengthDisplay.textContent = "—";
    lengthInchesDisplay.textContent = "—";
    angleDisplay.textContent = "—";
    selectedHeightDisplay.textContent = "—";
    selectedOffsetDisplay.textContent = "—";
    if (lengthInput) lengthInput.value = "";
    if (angleInput) angleInput.value = "";
    if (heightInput) heightInput.value = "";
    if (offsetInput) offsetInput.value = "";
    // Hide wall offset fields
    wallOffsetStartLine.style.display = "none";
    wallOffsetEndLine.style.display = "none";
    wallOffsetStartField.style.display = "none";
    wallOffsetEndField.style.display = "none";
    wallOffsetStartBtnField.style.display = "none";
    wallOffsetEndBtnField.style.display = "none";
    // Hide flip wall facing
    if (flipWallFacingField) flipWallFacingField.style.display = "none";
    if (flipWallFacingHint) flipWallFacingHint.style.display = "none";
    // Hide entire Selected Element panel
    if (selectedElementPanel) selectedElementPanel.style.display = "none";
    return;
  }

  // Show Selected Element panel
  if (selectedElementPanel) selectedElementPanel.style.display = "flex";

  const kind = lineKind(line);
  const kindLabel = kind.charAt(0).toUpperCase() + kind.slice(1);
  selectedTypeDisplay.textContent = kindLabel;

  const dx = line.x2 - line.x1;
  const dy = line.y2 - line.y1;
  const lenInches = Math.sqrt(dx * dx + dy * dy);
  const angleRad = Math.atan2(dy, dx);
  const angleDeg = (angleRad * 180) / Math.PI;

  lengthDisplay.textContent = formatInchesToFeetInches(lenInches, 2);
  lengthInchesDisplay.textContent = lenInches.toFixed(2) + '"';
  angleDisplay.textContent = angleDeg.toFixed(1) + "°";

  if (lengthInput) {
    lengthInput.value = formatInchesToFeetInches(lenInches, 2);
  }
  if (angleInput) {
    angleInput.value = angleDeg.toFixed(1);
  }

  if (kind === "door" || kind === "window") {
    const h = line.heightInches;
    if (h != null && isFinite(h)) {
      selectedHeightDisplay.textContent = formatInchesToFeetInches(h, 2);
      if (heightInput) {
        heightInput.value = formatInchesToFeetInches(h, 2);
      }
    } else {
      selectedHeightDisplay.textContent = "—";
      if (heightInput) heightInput.value = "";
    }

    const offset = line.baseOffsetInches != null ? line.baseOffsetInches : 0;
    selectedOffsetDisplay.textContent = formatInchesToFeetInches(offset, 2);
    if (offsetInput) {
      offsetInput.value = formatInchesToFeetInches(offset, 2);
    }

    // Calculate wall offsets for doors/windows
    const wallOffsets = getWallOffsetsForElement(line);
    if (wallOffsets) {
      wallOffsetStartLine.style.display = "flex";
      wallOffsetEndLine.style.display = "flex";
      wallOffsetStartField.style.display = "flex";
      wallOffsetEndField.style.display = "flex";
      wallOffsetStartBtnField.style.display = "flex";
      wallOffsetEndBtnField.style.display = "flex";
      
      wallOffsetStartDisplay.textContent = formatInchesToFeetInches(wallOffsets.fromStart, 2);
      wallOffsetEndDisplay.textContent = formatInchesToFeetInches(wallOffsets.fromEnd, 2);
      wallOffsetStartInput.value = formatInchesToFeetInches(wallOffsets.fromStart, 2);
      wallOffsetEndInput.value = formatInchesToFeetInches(wallOffsets.fromEnd, 2);
    } else {
      wallOffsetStartLine.style.display = "none";
      wallOffsetEndLine.style.display = "none";
      wallOffsetStartField.style.display = "none";
      wallOffsetEndField.style.display = "none";
      wallOffsetStartBtnField.style.display = "none";
      wallOffsetEndBtnField.style.display = "none";
    }
    // Hide flip wall facing for doors/windows
    if (flipWallFacingField) flipWallFacingField.style.display = "none";
    if (flipWallFacingHint) flipWallFacingHint.style.display = "none";
  } else {
    selectedHeightDisplay.textContent = "—";
    selectedOffsetDisplay.textContent = "—";
    if (heightInput) heightInput.value = "";
    if (offsetInput) offsetInput.value = "";
    // Hide wall offset fields for walls
    wallOffsetStartLine.style.display = "none";
    wallOffsetEndLine.style.display = "none";
    wallOffsetStartField.style.display = "none";
    wallOffsetEndField.style.display = "none";
    wallOffsetStartBtnField.style.display = "none";
    wallOffsetEndBtnField.style.display = "none";
    // Show flip wall facing for walls
    if (flipWallFacingField) flipWallFacingField.style.display = "flex";
    if (flipWallFacingHint) flipWallFacingHint.style.display = "block";
  }
}

// === Editing: length / angle / height / offset ===================

function applyNewLength() {
  const lengthInput = dom.getLengthInput();
  const line = state.getSelectedLine();
  if (!line) return;

  const inches = parseLengthToInches(lengthInput.value);
  if (inches == null || !isFinite(inches) || inches <= 0) {
    alert(
      "Couldn't understand that length.\n\nTry examples like:\n  10'\n  120\"\n  10' 6\"\n  100.5"
    );
    return;
  }

  state.saveState();
  const dx = line.x2 - line.x1;
  const dy = line.y2 - line.y1;
  const currentLen = Math.sqrt(dx * dx + dy * dy);
  if (currentLen === 0) return;

  const scale = inches / currentLen;
  line.x2 = line.x1 + dx * scale;
  line.y2 = line.y1 + dy * scale;

  updateSelectionPanel();
  draw();
}

function applyNewAngle() {
  const angleInput = dom.getAngleInput();
  const line = state.getSelectedLine();
  if (!line) return;

  const deg = parseFloat(angleInput.value);
  if (!isFinite(deg)) {
    alert("Enter a valid angle in degrees (e.g. 0, 90, 180).");
    return;
  }

  state.saveState();
  const dx = line.x2 - line.x1;
  const dy = line.y2 - line.y1;
  let len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) len = 12;

  const rad = (deg * Math.PI) / 180;
  const ndx = Math.cos(rad) * len;
  const ndy = Math.sin(rad) * len;

  line.x2 = line.x1 + ndx;
  line.y2 = line.y1 + ndy;

  updateSelectionPanel();
  draw();
}

function applyNewHeight() {
  const heightInput = dom.getHeightInput();
  const line = state.getSelectedLine();
  if (!line) return;
  const kind = lineKind(line);
  if (kind !== "door" && kind !== "window") return;

  const inches = parseLengthToInches(heightInput.value);
  if (inches == null || !isFinite(inches) || inches <= 0) {
    alert(
      "Couldn't understand that height.\n\nTry examples like:\n  80\"\n  6' 8\"\n  7'"
    );
    return;
  }
  state.saveState();
  line.heightInches = inches;
  updateSelectionPanel();
  draw();
}

function applyNewOffset() {
  const offsetInput = dom.getOffsetInput();
  const line = state.getSelectedLine();
  if (!line) return;
  const kind = lineKind(line);
  if (kind !== "door" && kind !== "window") return;

  const inches = parseLengthToInches(offsetInput.value);
  if (inches == null || !isFinite(inches) || inches < 0) {
    alert(
      "Couldn't understand that bottom offset.\n\nTry examples like:\n  0\"\n  3'\n  2\""
    );
    return;
  }
  state.saveState();
  line.baseOffsetInches = inches;
  updateSelectionPanel();
  draw();
}

function applyWallOffsetStart() {
  const wallOffsetStartInput = dom.getWallOffsetStartInput();
  const line = state.getSelectedLine();
  if (!line) return;
  const kind = lineKind(line);
  if (kind !== "door" && kind !== "window") return;
  
  const newOffset = parseLengthToInches(wallOffsetStartInput.value);
  if (newOffset == null || !isFinite(newOffset) || newOffset < 0) {
    alert("Couldn't understand that offset.\n\nTry examples like:\n  2'\n  24\"");
    return;
  }
  
  const currentOffsets = getWallOffsetsForElement(line);
  if (!currentOffsets || !currentOffsets.parentWall) {
    alert("Could not find the parent wall for this element.");
    return;
  }
  
  const currentFromStart = currentOffsets.fromStart;
  const delta = newOffset - currentFromStart;
  
  // Use the parent wall's direction for movement
  const wall = currentOffsets.parentWall;
  const wdx = wall.x2 - wall.x1;
  const wdy = wall.y2 - wall.y1;
  const wlen = Math.sqrt(wdx * wdx + wdy * wdy);
  const wux = wdx / wlen;
  const wuy = wdy / wlen;
  
  state.saveState();
  
  // Move element along wall direction
  line.x1 += wux * delta;
  line.y1 += wuy * delta;
  line.x2 += wux * delta;
  line.y2 += wuy * delta;
  
  updateSelectionPanel();
  draw();
}

function applyWallOffsetEnd() {
  const wallOffsetEndInput = dom.getWallOffsetEndInput();
  const line = state.getSelectedLine();
  if (!line) return;
  const kind = lineKind(line);
  if (kind !== "door" && kind !== "window") return;
  
  const newOffset = parseLengthToInches(wallOffsetEndInput.value);
  if (newOffset == null || !isFinite(newOffset) || newOffset < 0) {
    alert("Couldn't understand that offset.\n\nTry examples like:\n  2'\n  24\"");
    return;
  }
  
  const currentOffsets = getWallOffsetsForElement(line);
  if (!currentOffsets || !currentOffsets.parentWall) {
    alert("Could not find the parent wall for this element.");
    return;
  }
  
  const currentFromEnd = currentOffsets.fromEnd;
  const delta = newOffset - currentFromEnd;
  
  // Use the parent wall's direction for movement
  const wall = currentOffsets.parentWall;
  const wdx = wall.x2 - wall.x1;
  const wdy = wall.y2 - wall.y1;
  const wlen = Math.sqrt(wdx * wdx + wdy * wdy);
  const wux = wdx / wlen;
  const wuy = wdy / wlen;
  
  state.saveState();
  
  // Move element opposite to wall direction (towards start)
  line.x1 -= wux * delta;
  line.y1 -= wuy * delta;
  line.x2 -= wux * delta;
  line.y2 -= wuy * delta;
  
  updateSelectionPanel();
  draw();
}

// === Export / Import =============================================

function exportToJson() {
  const jsonArea = dom.getJsonArea();
  const simpleLines = state.getLines().map((l) => {
    const obj = {
      x1: +l.x1,
      y1: +l.y1,
      x2: +l.x2,
      y2: +l.y2,
      kind: lineKind(l),
    };
    if (l.heightInches != null && isFinite(l.heightInches)) {
      obj.heightInches = +l.heightInches;
    }
    if (l.baseOffsetInches != null && isFinite(l.baseOffsetInches)) {
      obj.baseOffsetInches = +l.baseOffsetInches;
    }
    if (l.facingFlipped) {
      obj.facingFlipped = true;
    }
    return obj;
  });
  
  // Get wall and trim settings
  const showWallsCheckbox = dom.getShowWallsCheckbox();
  const wallThicknessInput = dom.getWallThicknessInput();
  const ceilingHeightInput = dom.getCeilingHeightInput();
  const doorTrimInput = dom.getDoorTrimInput();
  const windowTrimInput = dom.getWindowTrimInput();
  
  const settings = {};
  if (showWallsCheckbox) settings.showWalls = showWallsCheckbox.checked;
  if (wallThicknessInput && wallThicknessInput.value) settings.wallThickness = wallThicknessInput.value;
  if (ceilingHeightInput && ceilingHeightInput.value) settings.ceilingHeight = ceilingHeightInput.value;
  if (doorTrimInput && doorTrimInput.value) settings.doorTrim = doorTrimInput.value;
  if (windowTrimInput && windowTrimInput.value) settings.windowTrim = windowTrimInput.value;
  
  const obj = { lines: simpleLines, settings };
  jsonArea.value = JSON.stringify(obj, null, 2);
}

function importFromJson() {
  const jsonArea = dom.getJsonArea();
  const text = jsonArea.value;
  if (!text || !text.trim()) {
    alert("JSON area is empty.");
    return;
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    alert("Invalid JSON: " + e.message);
    return;
  }

  let arr;
  if (Array.isArray(data)) {
    arr = data;
  } else if (data && Array.isArray(data.lines)) {
    arr = data.lines;
  } else {
    alert('JSON must be an array of lines or { "lines": [...] }');
    return;
  }

  const newLines = [];
  let idCounter = 1;
  for (const item of arr) {
    if (typeof item !== "object" || item == null) continue;
    const x1 = Number(item.x1);
    const y1 = Number(item.y1);
    const x2 = Number(item.x2);
    const y2 = Number(item.y2);
    if (!isFinite(x1) || !isFinite(y1) || !isFinite(x2) || !isFinite(y2))
      continue;
    const kindRaw =
      typeof item.kind === "string" ? item.kind.toLowerCase() : "wall";
    const kind =
      kindRaw === "door" || kindRaw === "window" ? kindRaw : "wall";
    const heightInches =
      item.heightInches != null && isFinite(Number(item.heightInches))
        ? Number(item.heightInches)
        : null;
    const baseOffsetInches =
      item.baseOffsetInches != null &&
      isFinite(Number(item.baseOffsetInches))
        ? Number(item.baseOffsetInches)
        : null;

    const facingFlipped = item.facingFlipped === true;

    const newLine = {
      id: idCounter,
      kind,
      heightInches,
      baseOffsetInches,
      facingFlipped,
      x1,
      y1,
      x2,
      y2,
    };
    newLines.push(newLine);
    idCounter++;
  }

  state.setLines(newLines);
  state.setNextLineId(idCounter);
  state.setSelectedLineId(null);
  state.setViewOffsetX(0);
  state.setViewOffsetY(0);
  state.setViewScale(1);
  console.log("Imported " + newLines.length + " lines:", newLines);
  console.log("Lines in state after import:", state.getLines());
  
  // Restore settings if present
  if (data && data.settings) {
    const settings = data.settings;
    const showWallsCheckbox = dom.getShowWallsCheckbox();
    const wallThicknessInput = dom.getWallThicknessInput();
    const ceilingHeightInput = dom.getCeilingHeightInput();
    const doorTrimInput = dom.getDoorTrimInput();
    const windowTrimInput = dom.getWindowTrimInput();
    
    if (showWallsCheckbox && settings.showWalls !== undefined) {
      showWallsCheckbox.checked = settings.showWalls;
    }
    if (wallThicknessInput && settings.wallThickness) {
      wallThicknessInput.value = settings.wallThickness;
    }
    if (ceilingHeightInput && settings.ceilingHeight) {
      ceilingHeightInput.value = settings.ceilingHeight;
    }
    if (doorTrimInput && settings.doorTrim) {
      doorTrimInput.value = settings.doorTrim;
    }
    if (windowTrimInput && settings.windowTrim) {
      windowTrimInput.value = settings.windowTrim;
    }
  }
  
  updateSelectionPanel();
  draw();
}

// === UI Event Handlers ===========================================

export function initUIEventHandlers() {
  const canvas = dom.getCanvas();
  const applyLengthBtn = dom.getApplyLengthBtn();
  const lengthInput = dom.getLengthInput();
  const applyAngleBtn = dom.getApplyAngleBtn();
  const angleInput = dom.getAngleInput();
  const applyHeightBtn = dom.getApplyHeightBtn();
  const heightInput = dom.getHeightInput();
  const applyOffsetBtn = dom.getApplyOffsetBtn();
  const offsetInput = dom.getOffsetInput();
  const applyWallOffsetStartBtn = dom.getApplyWallOffsetStartBtn();
  const wallOffsetStartInput = dom.getWallOffsetStartInput();
  const applyWallOffsetEndBtn = dom.getApplyWallOffsetEndBtn();
  const wallOffsetEndInput = dom.getWallOffsetEndInput();
  const showWallsCheckbox = dom.getShowWallsCheckbox();
  const wallThicknessInput = dom.getWallThicknessInput();
  const generate3DBtn = dom.getGenerate3DBtn();
  const threeCloseBtn = dom.getThreeCloseBtn();
  const exportJsonBtn = dom.getExportJsonBtn();
  const importJsonBtn = dom.getImportJsonBtn();
  const modeRadios = dom.getModeRadios();
  const elementTypeRadios = dom.getElementTypeRadios();

  // Length/angle/height/offset buttons
  applyLengthBtn.addEventListener("click", applyNewLength);
  lengthInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") applyNewLength();
  });

  applyAngleBtn.addEventListener("click", applyNewAngle);
  angleInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") applyNewAngle();
  });

  applyHeightBtn.addEventListener("click", applyNewHeight);
  heightInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") applyNewHeight();
  });

  applyOffsetBtn.addEventListener("click", applyNewOffset);
  offsetInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") applyNewOffset();
  });

  applyWallOffsetStartBtn.addEventListener("click", applyWallOffsetStart);
  wallOffsetStartInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") applyWallOffsetStart();
  });

  applyWallOffsetEndBtn.addEventListener("click", applyWallOffsetEnd);
  wallOffsetEndInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") applyWallOffsetEnd();
  });

  // Flip wall facing direction
  const flipWallFacingBtn = dom.getFlipWallFacingBtn();
  if (flipWallFacingBtn) {
    flipWallFacingBtn.addEventListener("click", () => {
      const line = state.getSelectedLine();
      if (!line || lineKind(line) !== "wall") return;
      
      state.saveState();
      // Toggle the facingFlipped property
      line.facingFlipped = !line.facingFlipped;
      draw();
    });
  }

  // Wall display settings
  if (showWallsCheckbox) {
    showWallsCheckbox.addEventListener("change", draw);
  }
  if (wallThicknessInput) {
    wallThicknessInput.addEventListener("input", draw);
  }

  // 3D buttons
  generate3DBtn.addEventListener("click", generate3DScene);
  threeCloseBtn.addEventListener("click", close3DScene);

  // Export/Import
  exportJsonBtn.addEventListener("click", exportToJson);
  importJsonBtn.addEventListener("click", importFromJson);
  
  // Local Save/Load
  const localSaveBtn = dom.getLocalSaveBtn();
  const localLoadBtn = dom.getLocalLoadBtn();
  if (localSaveBtn) {
    localSaveBtn.addEventListener("click", saveToLocalStorage);
  }
  if (localLoadBtn) {
    localLoadBtn.addEventListener("click", loadFromLocalStorage);
  }
  
  // Copy to clipboard
  const copyJsonBtn = dom.getCopyJsonBtn();
  if (copyJsonBtn) {
    copyJsonBtn.addEventListener("click", () => {
      const jsonArea = dom.getJsonArea();
      if (jsonArea && jsonArea.value) {
        navigator.clipboard.writeText(jsonArea.value).then(() => {
          const originalText = copyJsonBtn.textContent;
          copyJsonBtn.textContent = "✓";
          setTimeout(() => {
            copyJsonBtn.textContent = originalText;
          }, 1500);
        }).catch(() => {
          // Fallback for older browsers
          jsonArea.select();
          document.execCommand("copy");
        });
      }
    });
  }

  // Mode & element type
  modeRadios.forEach((r) => {
    r.addEventListener("change", () => {
      state.setMode(r.value);
      canvas.style.cursor = state.mode === "draw" ? "crosshair" : "default";
    });
  });

  elementTypeRadios.forEach((r) => {
    r.addEventListener("change", () => {
      state.setElementType(r.value);
      updateElementTypeVisibility();
    });
  });
}

// === Update element type visibility =============================

function updateElementTypeVisibility() {
  const elementType = state.getElementType();
  const doorSettingsField = document.getElementById("doorSettingsField");
  const doorOffsetSettingsField = document.getElementById("doorOffsetSettingsField");
  const windowSettingsField = document.getElementById("windowSettingsField");
  const windowOffsetSettingsField = document.getElementById("windowOffsetSettingsField");
  const elementTypeHint = document.getElementById("elementTypeHint");

  const showDoor = elementType === "door";
  const showWindow = elementType === "window";

  if (doorSettingsField) doorSettingsField.style.display = showDoor ? "flex" : "none";
  if (doorOffsetSettingsField) doorOffsetSettingsField.style.display = showDoor ? "flex" : "none";
  if (windowSettingsField) windowSettingsField.style.display = showWindow ? "flex" : "none";
  if (windowOffsetSettingsField) windowOffsetSettingsField.style.display = showWindow ? "flex" : "none";
  if (elementTypeHint) elementTypeHint.style.display = (showDoor || showWindow) ? "block" : "none";
}

// === Local Storage Save/Load ====================================

function saveToLocalStorage() {
  const lines = state.getLines();
  const data = {
    lines,
    timestamp: new Date().toISOString()
  };
  const json = JSON.stringify(data, null, 2);
  
  try {
    localStorage.setItem("ezfloorplan_autosave", json);
    const btn = dom.getLocalSaveBtn();
    const originalText = btn.textContent;
    btn.textContent = "✓ Saved";
    setTimeout(() => {
      btn.textContent = originalText;
    }, 1500);
  } catch (err) {
    alert("Failed to save to local storage: " + err.message);
  }
}

function loadFromLocalStorage() {
  try {
    const json = localStorage.getItem("ezfloorplan_autosave");
    if (!json) {
      alert("No local save found");
      return;
    }
    
    const data = JSON.parse(json);
    if (data.lines && Array.isArray(data.lines)) {
      state.setLines(data.lines);
      state.setNextLineId(Math.max(...data.lines.map(l => l.id), 0) + 1);
      state.setSelectedLineId(null);
      state.setSelectedLines([]);
      updateSelectionPanel();
      draw();
    }
  } catch (err) {
    alert("Failed to load from local storage: " + err.message);
  }
}
  }
}
