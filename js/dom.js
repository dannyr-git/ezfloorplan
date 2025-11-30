// === DOM References Module =======================================
// Centralized DOM element access

let canvas = null;
let ctx = null;
let canvasContainer = null;
let threeContainer = null;
let threeCloseBtn = null;

// Selection panel elements
let selectedTypeDisplay = null;
let lengthDisplay = null;
let lengthInchesDisplay = null;
let angleDisplay = null;
let selectedHeightDisplay = null;
let selectedOffsetDisplay = null;

// Input elements
let lengthInput = null;
let applyLengthBtn = null;
let angleInput = null;
let applyAngleBtn = null;
let heightInput = null;
let applyHeightBtn = null;
let offsetInput = null;
let applyOffsetBtn = null;

// Wall offset controls
let wallOffsetStartLine = null;
let wallOffsetEndLine = null;
let wallOffsetStartDisplay = null;
let wallOffsetEndDisplay = null;
let wallOffsetStartField = null;
let wallOffsetEndField = null;
let wallOffsetStartBtnField = null;
let wallOffsetEndBtnField = null;
let wallOffsetStartInput = null;
let wallOffsetEndInput = null;
let applyWallOffsetStartBtn = null;
let applyWallOffsetEndBtn = null;
let flipWallFacingField = null;
let flipWallFacingBtn = null;
let flipWallFacingHint = null;

// Settings elements
let showWallsCheckbox = null;
let wallThicknessInput = null;
let ceilingHeightInput = null;
let doorTrimInput = null;
let windowTrimInput = null;
let generate3DBtn = null;

// Default element settings
let doorHeightInput = null;
let doorBaseOffsetInput = null;
let windowHeightInput = null;
let windowBaseOffsetInput = null;

// Export/Import
let jsonArea = null;
let exportJsonBtn = null;
let importJsonBtn = null;
let copyJsonBtn = null;
let localSaveBtn = null;
let localLoadBtn = null;

// Mode controls
let modeRadios = null;
let elementTypeRadios = null;

// Initialize all DOM references
export function initDOM() {
  canvas = document.getElementById("floorCanvas");
  ctx = canvas.getContext("2d");
  canvasContainer = document.getElementById("canvasContainer");
  threeContainer = document.getElementById("threeContainer");
  threeCloseBtn = document.getElementById("threeCloseBtn");

  selectedTypeDisplay = document.getElementById("selectedTypeDisplay");
  lengthDisplay = document.getElementById("lengthDisplay");
  lengthInchesDisplay = document.getElementById("lengthInchesDisplay");
  angleDisplay = document.getElementById("angleDisplay");
  selectedHeightDisplay = document.getElementById("selectedHeightDisplay");
  selectedOffsetDisplay = document.getElementById("selectedOffsetDisplay");

  lengthInput = document.getElementById("lengthInput");
  applyLengthBtn = document.getElementById("applyLengthBtn");
  angleInput = document.getElementById("angleInput");
  applyAngleBtn = document.getElementById("applyAngleBtn");
  heightInput = document.getElementById("heightInput");
  applyHeightBtn = document.getElementById("applyHeightBtn");
  offsetInput = document.getElementById("offsetInput");
  applyOffsetBtn = document.getElementById("applyOffsetBtn");

  wallOffsetStartLine = document.getElementById("wallOffsetStartLine");
  wallOffsetEndLine = document.getElementById("wallOffsetEndLine");
  wallOffsetStartDisplay = document.getElementById("wallOffsetStartDisplay");
  wallOffsetEndDisplay = document.getElementById("wallOffsetEndDisplay");
  wallOffsetStartField = document.getElementById("wallOffsetStartField");
  wallOffsetEndField = document.getElementById("wallOffsetEndField");
  wallOffsetStartBtnField = document.getElementById("wallOffsetStartBtnField");
  wallOffsetEndBtnField = document.getElementById("wallOffsetEndBtnField");
  wallOffsetStartInput = document.getElementById("wallOffsetStartInput");
  wallOffsetEndInput = document.getElementById("wallOffsetEndInput");
  applyWallOffsetStartBtn = document.getElementById("applyWallOffsetStartBtn");
  applyWallOffsetEndBtn = document.getElementById("applyWallOffsetEndBtn");
  flipWallFacingField = document.getElementById("flipWallFacingField");
  flipWallFacingBtn = document.getElementById("flipWallFacingBtn");
  flipWallFacingHint = document.getElementById("flipWallFacingHint");

  showWallsCheckbox = document.getElementById("showWallsCheckbox");
  wallThicknessInput = document.getElementById("wallThicknessInput");
  ceilingHeightInput = document.getElementById("ceilingHeightInput");
  doorTrimInput = document.getElementById("doorTrimInput");
  windowTrimInput = document.getElementById("windowTrimInput");
  generate3DBtn = document.getElementById("generate3DBtn");

  doorHeightInput = document.getElementById("doorHeightInput");
  doorBaseOffsetInput = document.getElementById("doorBaseOffsetInput");
  windowHeightInput = document.getElementById("windowHeightInput");
  windowBaseOffsetInput = document.getElementById("windowBaseOffsetInput");

  jsonArea = document.getElementById("jsonArea");
  exportJsonBtn = document.getElementById("exportJsonBtn");
  importJsonBtn = document.getElementById("importJsonBtn");
  copyJsonBtn = document.getElementById("copyJsonBtn");
  localSaveBtn = document.getElementById("localSaveBtn");
  localLoadBtn = document.getElementById("localLoadBtn");

  modeRadios = document.querySelectorAll('input[name="mode"]');
  elementTypeRadios = document.querySelectorAll('input[name="elementType"]');
}

// Getters for all DOM elements
export function getCanvas() { return canvas; }
export function getContext() { return ctx; }
export function getCanvasContainer() { return canvasContainer; }
export function getThreeContainer() { return threeContainer; }
export function getThreeCloseBtn() { return threeCloseBtn; }

export function getSelectedTypeDisplay() { return selectedTypeDisplay; }
export function getLengthDisplay() { return lengthDisplay; }
export function getLengthInchesDisplay() { return lengthInchesDisplay; }
export function getAngleDisplay() { return angleDisplay; }
export function getSelectedHeightDisplay() { return selectedHeightDisplay; }
export function getSelectedOffsetDisplay() { return selectedOffsetDisplay; }

export function getLengthInput() { return lengthInput; }
export function getApplyLengthBtn() { return applyLengthBtn; }
export function getAngleInput() { return angleInput; }
export function getApplyAngleBtn() { return applyAngleBtn; }
export function getHeightInput() { return heightInput; }
export function getApplyHeightBtn() { return applyHeightBtn; }
export function getOffsetInput() { return offsetInput; }
export function getApplyOffsetBtn() { return applyOffsetBtn; }

export function getWallOffsetStartLine() { return wallOffsetStartLine; }
export function getWallOffsetEndLine() { return wallOffsetEndLine; }
export function getWallOffsetStartDisplay() { return wallOffsetStartDisplay; }
export function getWallOffsetEndDisplay() { return wallOffsetEndDisplay; }
export function getWallOffsetStartField() { return wallOffsetStartField; }
export function getWallOffsetEndField() { return wallOffsetEndField; }
export function getWallOffsetStartBtnField() { return wallOffsetStartBtnField; }
export function getWallOffsetEndBtnField() { return wallOffsetEndBtnField; }
export function getWallOffsetStartInput() { return wallOffsetStartInput; }
export function getWallOffsetEndInput() { return wallOffsetEndInput; }
export function getApplyWallOffsetStartBtn() { return applyWallOffsetStartBtn; }
export function getApplyWallOffsetEndBtn() { return applyWallOffsetEndBtn; }
export function getFlipWallFacingField() { return flipWallFacingField; }
export function getFlipWallFacingBtn() { return flipWallFacingBtn; }
export function getFlipWallFacingHint() { return flipWallFacingHint; }

export function getShowWallsCheckbox() { return showWallsCheckbox; }
export function getWallThicknessInput() { return wallThicknessInput; }
export function getCeilingHeightInput() { return ceilingHeightInput; }
export function getDoorTrimInput() { return doorTrimInput; }
export function getWindowTrimInput() { return windowTrimInput; }
export function getGenerate3DBtn() { return generate3DBtn; }

export function getDoorHeightInput() { return doorHeightInput; }
export function getDoorBaseOffsetInput() { return doorBaseOffsetInput; }
export function getWindowHeightInput() { return windowHeightInput; }
export function getWindowBaseOffsetInput() { return windowBaseOffsetInput; }

export function getJsonArea() { return jsonArea; }
export function getExportJsonBtn() { return exportJsonBtn; }
export function getImportJsonBtn() { return importJsonBtn; }
export function getCopyJsonBtn() { return copyJsonBtn; }
export function getLocalSaveBtn() { return localSaveBtn; }
export function getLocalLoadBtn() { return localLoadBtn; }

export function getModeRadios() { return modeRadios; }
export function getElementTypeRadios() { return elementTypeRadios; }
