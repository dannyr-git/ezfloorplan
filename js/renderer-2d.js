import * as state from './state.js';
import { formatInchesToFeetInches, lineKind, rayIntersectsSegment } from './utils.js';
import * as dom from './dom.js';

// Polyfill for roundRect if it doesn't exist
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    this.beginPath();
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
    return this;
  };
}

const JOINT_CLUSTER_TOLERANCE = 1; // inches
const JOINT_GAP_THRESHOLD = 0.25; // inches of separation before flagging

// === Coordinate conversion ========================================

export function worldToScreenX(wx) {
  return (wx - state.getViewOffsetX()) * state.getViewScale();
}

export function worldToScreenY(wy) {
  return (wy - state.getViewOffsetY()) * state.getViewScale();
}

export function screenToWorld(sx, sy) {
  return {
    x: sx / state.getViewScale() + state.getViewOffsetX(),
    y: sy / state.getViewScale() + state.getViewOffsetY(),
  };
}

// === Helpers for joints ==========================================

export function jointKeyFromWorld(x, y) {
  const kx = Math.round(x * 1000) / 1000;
  const ky = Math.round(y * 1000) / 1000;
  return kx + "," + ky;
}

function buildEndpointClusters(lines, tolerance = JOINT_CLUSTER_TOLERANCE) {
  const endpoints = [];
  for (const line of lines) {
    endpoints.push({ x: line.x1, y: line.y1, line, which: "start" });
    endpoints.push({ x: line.x2, y: line.y2, line, which: "end" });
  }

  const clusters = [];
  const visited = new Array(endpoints.length).fill(false);
  const tolSq = tolerance * tolerance;

  for (let i = 0; i < endpoints.length; i++) {
    if (visited[i]) continue;
    const queue = [i];
    visited[i] = true;
    const clusterEndpoints = [];

    while (queue.length) {
      const idx = queue.pop();
      const ep = endpoints[idx];
      clusterEndpoints.push(ep);
      for (let j = 0; j < endpoints.length; j++) {
        if (visited[j]) continue;
        const other = endpoints[j];
        const dx = ep.x - other.x;
        const dy = ep.y - other.y;
        if (dx * dx + dy * dy <= tolSq) {
          visited[j] = true;
          queue.push(j);
        }
      }
    }

    const centerX = clusterEndpoints.reduce((sum, ep) => sum + ep.x, 0) / clusterEndpoints.length;
    const centerY = clusterEndpoints.reduce((sum, ep) => sum + ep.y, 0) / clusterEndpoints.length;

    let maxPairDistance = 0;
    for (let a = 0; a < clusterEndpoints.length; a++) {
      for (let b = a + 1; b < clusterEndpoints.length; b++) {
        const dx = clusterEndpoints[a].x - clusterEndpoints[b].x;
        const dy = clusterEndpoints[a].y - clusterEndpoints[b].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > maxPairDistance) maxPairDistance = dist;
      }
    }

    clusters.push({
      x: centerX,
      y: centerY,
      endpoints: clusterEndpoints,
      maxPairDistance,
    });
  }

  return clusters;
}

function orderPointsAroundCenter(points, cx, cy) {
  return points
    .map((p) => ({ ...p, angle: Math.atan2(p.y - cy, p.x - cx) }))
    .sort((a, b) => a.angle - b.angle);
}

function fillJointPolygons(ctx, clusters, wallCorners) {
  ctx.fillStyle = "#e0e0e0";
  ctx.strokeStyle = "#cccccc";

  for (const cluster of clusters) {
    if (cluster.endpoints.length < 2) continue;
    if (cluster.maxPairDistance > JOINT_GAP_THRESHOLD) continue;

    const points = [];
    for (const ep of cluster.endpoints) {
      if (lineKind(ep.line) !== "wall") continue;
      const corners = wallCorners.get(ep.line.id);
      if (!corners) continue;
      const pair = ep.which === "start" ? corners.start : corners.end;
      points.push(pair[0], pair[1]);
    }

    if (points.length < 3) continue;

    const ordered = orderPointsAroundCenter(points, cluster.x, cluster.y);
    if (!ordered.length) continue;

    ctx.beginPath();
    ordered.forEach((point, idx) => {
      const sx = worldToScreenX(point.x);
      const sy = worldToScreenY(point.y);
      if (idx === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

export function recomputeJointIssues(clusters) {
  const jointIssues = new Map();

  for (const cluster of clusters) {
    if (cluster.endpoints.length < 2) continue;
    const gap = cluster.maxPairDistance;
    if (gap <= JOINT_GAP_THRESHOLD) continue;

    const issue = {
      x: cluster.x,
      y: cluster.y,
      offInches: gap,
      endpoints: cluster.endpoints,
    };

    for (const ep of cluster.endpoints) {
      const key = jointKeyFromWorld(ep.x, ep.y);
      jointIssues.set(key, issue);
    }
  }

  state.setJointIssues(jointIssues);
}

export function updateHoverJoint(sx, sy) {
  let hoverJoint = null;
  const thresholdPx = 10;
  let best = null;
  for (const issue of state.getJointIssues().values()) {
    const ssx = worldToScreenX(issue.x);
    const ssy = worldToScreenY(issue.y);
    const d = Math.hypot(sx - ssx, sy - ssy);
    if (d <= thresholdPx && (!best || d < best.d)) {
      best = { d, issue };
    }
  }
  state.setHoverJoint(best ? best.issue : null);
}

// === Wall offset calculations ====================================

function getElementsOnWall(wall, lines) {
  // Find all windows/doors on this wall
  const elementsOnWall = [];
  const wdx = wall.x2 - wall.x1;
  const wdy = wall.y2 - wall.y1;
  const wlen = Math.sqrt(wdx * wdx + wdy * wdy);
  if (wlen === 0) return elementsOnWall;

  const wux = wdx / wlen;
  const wuy = wdy / wlen;

  for (const el of lines) {
    if (lineKind(el) === "wall") continue;

    const elemMidX = (el.x1 + el.x2) / 2;
    const elemMidY = (el.y1 + el.y2) / 2;

    // Project to wall
    const t = ((elemMidX - wall.x1) * wux + (elemMidY - wall.y1) * wuy);
    if (t < -5 || t > wlen + 5) continue;

    // Check if close to wall
    const closestX = wall.x1 + wux * t;
    const closestY = wall.y1 + wuy * t;
    const dist = Math.sqrt((elemMidX - closestX) ** 2 + (elemMidY - closestY) ** 2);

    if (dist < 10) {
      const t1 = ((el.x1 - wall.x1) * wux + (el.y1 - wall.y1) * wuy);
      const t2 = ((el.x2 - wall.x1) * wux + (el.y2 - wall.y1) * wuy);
      elementsOnWall.push({
        element: el,
        tStart: Math.min(t1, t2),
        tEnd: Math.max(t1, t2),
      });
    }
  }
  return elementsOnWall;
}

function getWallDimensionOffset(wall, lines, wallThickness) {
  // Check if wall has windows/doors on it
  const elementsOnWall = getElementsOnWall(wall, lines);
  if (elementsOnWall.length === 0) {
    // No elements, use default offset
    return { offsetDirection: 1, fallbackDirection: -1 };
  }

  // Get wall direction
  const wdx = wall.x2 - wall.x1;
  const wdy = wall.y2 - wall.y1;
  const wlen = Math.sqrt(wdx * wdx + wdy * wdy);
  const wux = wdx / wlen;
  const wuy = wdy / wlen;

  // Perpendicular (outward normal) - try this direction first
  let wnx = -wdy / wlen;
  let wny = wdx / wlen;

  // Determine room interior using ray casting
  const midX = (wall.x1 + wall.x2) / 2;
  const midY = (wall.y1 + wall.y2) / 2;
  let hitsPositive = 0;
  let hitsNegative = 0;
  const rayLength = 10000;

  for (const otherLine of lines) {
    if (lineKind(otherLine) !== "wall" || otherLine.id === wall.id) continue;

    if (rayIntersectsSegment(midX, midY, midX + wnx * rayLength, midY + wny * rayLength,
                              otherLine.x1, otherLine.y1, otherLine.x2, otherLine.y2)) {
      hitsPositive++;
    }

    if (rayIntersectsSegment(midX, midY, midX - wnx * rayLength, midY - wny * rayLength,
                              otherLine.x1, otherLine.y1, otherLine.x2, otherLine.y2)) {
      hitsNegative++;
    }
  }

  const positiveIsInterior = (hitsPositive % 2) === 1;

  // Prefer exterior side
  if (positiveIsInterior) {
    return { offsetDirection: -1, fallbackDirection: 1 };
  } else {
    return { offsetDirection: 1, fallbackDirection: -1 };
  }
}

export function getWallOffsetsForElement(element) {
  // Find the parent wall this element (door/window) is on
  // Works identically for doors and windows
  const elemDx = element.x2 - element.x1;
  const elemDy = element.y2 - element.y1;
  const elemLen = Math.sqrt(elemDx * elemDx + elemDy * elemDy);
  if (elemLen === 0) return null;
  
  const elemUx = elemDx / elemLen;
  const elemUy = elemDy / elemLen;
  const elemMidX = (element.x1 + element.x2) / 2;
  const elemMidY = (element.y1 + element.y2) / 2;
  
  // Find the wall that this element is on
  let parentWall = null;
  let bestScore = Infinity;
  
  for (const wall of state.getLines()) {
    if (lineKind(wall) !== "wall") continue;
    
    const wdx = wall.x2 - wall.x1;
    const wdy = wall.y2 - wall.y1;
    const wlen = Math.sqrt(wdx * wdx + wdy * wdy);
    if (wlen === 0) continue;
    
    const wux = wdx / wlen;
    const wuy = wdy / wlen;
    
    // Project element endpoints onto wall direction
    const t1 = ((element.x1 - wall.x1) * wux + (element.y1 - wall.y1) * wuy);
    const t2 = ((element.x2 - wall.x1) * wux + (element.y2 - wall.y1) * wuy);
    const tMin = Math.min(t1, t2);
    const tMax = Math.max(t1, t2);
    
    // Check if element falls within the wall's extent (with small tolerance)
    const tolerance = 5;
    if (tMin < -tolerance || tMax > wlen + tolerance) continue;
    
    // Check if element midpoint is close to this wall (perpendicular distance)
    const t = ((elemMidX - wall.x1) * wdx + (elemMidY - wall.y1) * wdy) / (wdx * wdx + wdy * wdy);
    const closestX = wall.x1 + t * wdx;
    const closestY = wall.y1 + t * wdy;
    const dist = Math.sqrt((elemMidX - closestX) ** 2 + (elemMidY - closestY) ** 2);
    
    // Check if element is roughly parallel to wall
    const dotProduct = Math.abs(elemUx * wux + elemUy * wuy);
    
    if (dist < 10 && dotProduct > 0.9 && dist < bestScore) {
      bestScore = dist;
      parentWall = wall;
    }
  }
  
  if (!parentWall) return null;
  
  // Calculate distances along the parent wall
  const wdx = parentWall.x2 - parentWall.x1;
  const wdy = parentWall.y2 - parentWall.y1;
  const wlen = Math.sqrt(wdx * wdx + wdy * wdy);
  const wux = wdx / wlen;
  const wuy = wdy / wlen;
  
  // Project element endpoints onto wall direction
  const t1 = ((element.x1 - parentWall.x1) * wux + (element.y1 - parentWall.y1) * wuy);
  const t2 = ((element.x2 - parentWall.x1) * wux + (element.y2 - parentWall.y1) * wuy);
  
  const elemStartOnWall = Math.min(t1, t2);
  const elemEndOnWall = Math.max(t1, t2);
  
  const fromStart = Math.max(0, elemStartOnWall);
  const fromEnd = Math.max(0, wlen - elemEndOnWall);
  
  return {
    fromStart: fromStart,
    fromEnd: fromEnd,
    parentWall: parentWall,
    wallLength: wlen
  };
}

// === Main draw function ==========================================

export function draw() {
  const canvas = dom.getCanvas();
  const ctx = dom.getContext();
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);
  const lines = state.getLines();
  const clusters = buildEndpointClusters(lines);
  recomputeJointIssues(clusters);

  const worldLeft = state.getViewOffsetX();
  const worldTop = state.getViewOffsetY();
  const worldRight = state.getViewOffsetX() + w / state.getViewScale();
  const worldBottom = state.getViewOffsetY() + h / state.getViewScale();

  const startX = Math.floor(worldLeft / state.GRID_SPACING) * state.GRID_SPACING;
  const endX = Math.ceil(worldRight / state.GRID_SPACING) * state.GRID_SPACING;
  const startY = Math.floor(worldTop / state.GRID_SPACING) * state.GRID_SPACING;
  const endY = Math.ceil(worldBottom / state.GRID_SPACING) * state.GRID_SPACING;

  // Grid
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#f0f0f0";
  ctx.beginPath();
  for (let wx = startX; wx <= endX; wx += state.GRID_SPACING) {
    const sx = worldToScreenX(wx);
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, h);
  }
  for (let wy = startY; wy <= endY; wy += state.GRID_SPACING) {
    const sy = worldToScreenY(wy);
    ctx.moveTo(0, sy);
    ctx.lineTo(w, sy);
  }
  ctx.stroke();

  const showWallsCheckbox = dom.getShowWallsCheckbox();
  const wallThicknessInput = dom.getWallThicknessInput();
  
  const showWalls = showWallsCheckbox && showWallsCheckbox.checked ? true : false;
  let wallThickness = 0;
  if (showWalls && wallThicknessInput) {
    const val = parseFloat(wallThicknessInput.value);
    if (isFinite(val) && val > 0) wallThickness = val;
  }

  // Thick walls for wall-kind only
  // Each line represents a wall FACE - the surface you measured from
  // Wall thickness goes BEHIND that face (away from the open space the face looks into)
  if (showWalls && wallThickness > 0) {
    ctx.fillStyle = "#e0e0e0";
    ctx.strokeStyle = "#cccccc";
    ctx.lineWidth = 1;
    const wallCorners = new Map();
    
    // Compute centroid for default direction
    let sumX = 0, sumY = 0, count = 0;
    for (const l of lines) {
      if (lineKind(l) !== "wall") continue;
      sumX += l.x1 + l.x2;
      sumY += l.y1 + l.y2;
      count += 2;
    }
    const centroidX = count > 0 ? sumX / count : 0;
    const centroidY = count > 0 ? sumY / count : 0;
    
    for (const l of lines) {
      if (lineKind(l) !== "wall") continue;
      const dx = l.x2 - l.x1;
      const dy = l.y2 - l.y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len === 0) continue;
      
      // Normal vector (perpendicular to wall)
      let nx = -dy / len;
      let ny = dx / len;
      
      // Wall midpoint
      const midX = (l.x1 + l.x2) / 2;
      const midY = (l.y1 + l.y2) / 2;
      
      // Default: wall extends away from centroid
      const toCentroidX = centroidX - midX;
      const toCentroidY = centroidY - midY;
      const dot = nx * toCentroidX + ny * toCentroidY;
      
      if (dot > 0) {
        nx = -nx;
        ny = -ny;
      }
      
      // Apply manual flip if set
      if (l.facingFlipped) {
        nx = -nx;
        ny = -ny;
      }
      
      // Wall extends from the face (line) backward by thickness
      const ox = nx * wallThickness;
      const oy = ny * wallThickness;

      // The face (drawn line) - this is the measured surface
      const fx1 = l.x1;
      const fy1 = l.y1;
      const fx2 = l.x2;
      const fy2 = l.y2;
      
      // Back of wall (offset behind the face)
      const bx1 = l.x1 + ox;
      const by1 = l.y1 + oy;
      const bx2 = l.x2 + ox;
      const by2 = l.y2 + oy;

      wallCorners.set(l.id, {
        start: [
          { x: fx1, y: fy1 },
          { x: bx1, y: by1 },
        ],
        end: [
          { x: fx2, y: fy2 },
          { x: bx2, y: by2 },
        ],
      });

      ctx.beginPath();
      ctx.moveTo(worldToScreenX(fx1), worldToScreenY(fy1));
      ctx.lineTo(worldToScreenX(fx2), worldToScreenY(fy2));
      ctx.lineTo(worldToScreenX(bx2), worldToScreenY(by2));
      ctx.lineTo(worldToScreenX(bx1), worldToScreenY(by1));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    fillJointPolygons(ctx, clusters, wallCorners);
  }

  // Lines + endpoints + labels
  // First pass: identify walls with elements on them
  const wallsWithElements = new Set();
  for (const l of lines) {
    if (lineKind(l) !== "wall") continue;
    const elements = getElementsOnWall(l, lines);
    if (elements.length > 0) {
      wallsWithElements.add(l.id);
    }
  }

  for (const l of lines) {
    const kind = lineKind(l);
    const isSelected = l.id === state.getSelectedLineId();

    let strokeColor = "#333";
    if (kind === "door") strokeColor = "#aa5500";
    else if (kind === "window") strokeColor = "#0074d9";
    if (isSelected) strokeColor = "#ff4136";

    const dx = l.x2 - l.x1;
    const dy = l.y2 - l.y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    
    // Screen coordinates
    const sx1 = worldToScreenX(l.x1);
    const sy1 = worldToScreenY(l.y1);
    const sx2 = worldToScreenX(l.x2);
    const sy2 = worldToScreenY(l.y2);
    
    // Get label text and measure it
    const label = formatInchesToFeetInches(len, 2);
    ctx.save();
    ctx.font = "bold 11px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    const textWidth = ctx.measureText(label).width;
    const textPadding = 6;
    const gapWidth = textWidth + textPadding * 2;
    ctx.restore();
    
    // Screen length
    const screenLen = Math.sqrt((sx2 - sx1) ** 2 + (sy2 - sy1) ** 2);
    
    // Draw line with gap in center for label
    ctx.lineWidth = isSelected ? 3 : 2;
    ctx.strokeStyle = strokeColor;
    
    // Determine label position offset if wall has elements
    let labelOffsetRatio = 0.5; // default center
    if (kind === "wall" && wallsWithElements.has(l.id)) {
      // Get wall dimension offset direction
      const wallThicknessInput = dom.getWallThicknessInput();
      let wallThickness = 6;
      if (wallThicknessInput) {
        const val = parseFloat(wallThicknessInput.value);
        if (isFinite(val) && val > 0) wallThickness = val;
      }
      const offset = getWallDimensionOffset(l, lines, wallThickness);
      // Push label slightly away from elements (toward fallback direction)
      labelOffsetRatio = offset.offsetDirection > 0 ? 0.35 : 0.65;
    }
    
    if (screenLen > gapWidth + 20) {
      // Calculate gap position
      const midSx = sx1 + (sx2 - sx1) * labelOffsetRatio;
      const midSy = sy1 + (sy2 - sy1) * labelOffsetRatio;
      const ux = (sx2 - sx1) / screenLen;
      const uy = (sy2 - sy1) / screenLen;
      
      const gapStart = gapWidth / 2;
      
      // Draw first segment (start to gap)
      ctx.beginPath();
      ctx.moveTo(sx1, sy1);
      ctx.lineTo(midSx - ux * gapStart, midSy - uy * gapStart);
      ctx.stroke();
      
      // Draw second segment (gap to end)
      ctx.beginPath();
      ctx.moveTo(midSx + ux * gapStart, midSy + uy * gapStart);
      ctx.lineTo(sx2, sy2);
      ctx.stroke();
      
      // Draw label in the gap
      ctx.save();
      ctx.translate(midSx, midSy);
      
      // Calculate rotation angle
      let angle = Math.atan2(sy2 - sy1, sx2 - sx1);
      // Keep text readable (not upside down)
      if (angle > Math.PI / 2) angle -= Math.PI;
      if (angle < -Math.PI / 2) angle += Math.PI;
      
      ctx.rotate(angle);
      
      // Draw background pill
      const pillHeight = 14;
      const pillRadius = pillHeight / 2;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.roundRect(-gapWidth / 2, -pillHeight / 2, gapWidth, pillHeight, pillRadius);
      ctx.fill();
      
      // Draw border
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(-gapWidth / 2, -pillHeight / 2, gapWidth, pillHeight, pillRadius);
      ctx.stroke();
      
      // Draw text
      ctx.font = "bold 11px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      ctx.fillStyle = strokeColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, 0, 0);
      
      ctx.restore();
    } else {
      // Line too short for gap, just draw it straight
      ctx.beginPath();
      ctx.moveTo(sx1, sy1);
      ctx.lineTo(sx2, sy2);
      ctx.stroke();
    }

    // endpoints with possible misalignment highlight
    const r = isSelected ? 4 : 3;

    function drawEndpoint(x, y) {
      const key = jointKeyFromWorld(x, y);
      const issue = state.getJointIssues().get(key);

      const sx = worldToScreenX(x);
      const sy = worldToScreenY(y);

      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      if (issue) {
        ctx.fillStyle = isSelected ? "#ff4136" : strokeColor;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#ff4136";
        ctx.stroke();
      } else {
        ctx.fillStyle = isSelected ? "#ff4136" : strokeColor;
        ctx.fill();
      }
    }

    drawEndpoint(l.x1, l.y1);
    drawEndpoint(l.x2, l.y2);

    // Draw dimension brackets for windows and doors (unified - they're the same type of element)
    if ((kind === "window" || kind === "door") && len > 0) {
      drawOpeningDimensions(ctx, l, kind);
    }
  }

  // In-progress drawing
  if (state.getIsDrawing() && state.getCurrentDrawing()) {
    const l = state.getCurrentDrawing();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#ff4136";
    ctx.beginPath();
    ctx.moveTo(worldToScreenX(l.x1), worldToScreenY(l.y1));
    ctx.lineTo(worldToScreenX(l.x2), worldToScreenY(l.y2));
    ctx.stroke();

    ctx.fillStyle = "#ff4136";
    ctx.beginPath();
    ctx.arc(worldToScreenX(l.x1), worldToScreenY(l.y1), 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(worldToScreenX(l.x2), worldToScreenY(l.y2), 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Inline length input display
  if (state.getIsTypingLength() && state.getSelectedLineId() != null) {
    const line = state.getSelectedLine();
    if (line) {
      const sx1 = worldToScreenX(line.x1);
      const sy1 = worldToScreenY(line.y1);
      const sx2 = worldToScreenX(line.x2);
      const sy2 = worldToScreenY(line.y2);
      const midSx = (sx1 + sx2) / 2;
      const midSy = (sy1 + sy2) / 2;
      
      ctx.save();
      
      // Draw input box
      const displayText = state.getInlineLengthInput() + "▏";
      ctx.font = "bold 14px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      const textWidth = ctx.measureText(displayText).width;
      const boxWidth = Math.max(textWidth + 20, 80);
      const boxHeight = 24;
      
      // Background
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "#ff4136";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(midSx - boxWidth / 2, midSy - boxHeight / 2 - 20, boxWidth, boxHeight, 4);
      ctx.fill();
      ctx.stroke();
      
      // Text
      ctx.fillStyle = "#333";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(displayText, midSx, midSy - 20);
      
      // Hint text
      ctx.font = "11px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = "#888";
      ctx.fillText("Enter to apply, Esc to cancel", midSx, midSy + 10);
      
      ctx.restore();
    }
  }

  // Zoomed misalignment diagram
  if (state.getHoverJoint()) {
    const width = 180;
    const height = 90;
    const padding = 10;
    const boxX = w - width - padding;
    const boxY = padding;
    const hoverJoint = state.getHoverJoint();

    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.strokeStyle = "#999";
    ctx.lineWidth = 1;
    ctx.fillRect(boxX, boxY, width, height);
    ctx.strokeRect(boxX, boxY, width, height);

    ctx.fillStyle = "#333";
    ctx.font = "12px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Joint alignment", boxX + 10, boxY + 8);

    ctx.font = "11px system-ui, -apple-system, sans-serif";
    ctx.fillText(
      'Gap ≈ ' + hoverJoint.offInches.toFixed(2) + '"',
      boxX + 10,
      boxY + 28
    );
    ctx.fillText(
      `${hoverJoint.endpoints.length} connected edges`,
      boxX + 10,
      boxY + 46
    );
    ctx.fillStyle = "#ff4136";
    ctx.fillText("Adjust measurements to close gap", boxX + 10, boxY + 64);

    ctx.restore();
  }
}

function drawOpeningDimensions(ctx, openingLine, kind) {
  // Works for both doors and windows - they are the same type of element
  const dx = openingLine.x2 - openingLine.x1;
  const dy = openingLine.y2 - openingLine.y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return;
  
  // Normal to opening (perpendicular)
  let nx = -dy / len;
  let ny = dx / len;
  
  // Direction along opening
  const ux = dx / len;
  const uy = dy / len;
  
  // Get wall thickness for offset calculation
  const wallThicknessInput = dom.getWallThicknessInput();
  let wallThickness = 6;
  if (wallThicknessInput) {
    const val = parseFloat(wallThicknessInput.value);
    if (isFinite(val) && val > 0) wallThickness = val;
  }
  const half = wallThickness / 2;
  
  // Find the parent wall
  const midX = (openingLine.x1 + openingLine.x2) / 2;
  const midY = (openingLine.y1 + openingLine.y2) / 2;
  
  let parentWall = null;
  let bestScore = Infinity;
  
  for (const wall of state.getLines()) {
    if (lineKind(wall) !== "wall") continue;
    
    const pwdx = wall.x2 - wall.x1;
    const pwdy = wall.y2 - wall.y1;
    const pwlen = Math.sqrt(pwdx * pwdx + pwdy * pwdy);
    if (pwlen === 0) continue;
    
    const pwux = pwdx / pwlen;
    const pwuy = pwdy / pwlen;
    
    // Project opening endpoints onto wall direction
    const t1 = ((openingLine.x1 - wall.x1) * pwux + (openingLine.y1 - wall.y1) * pwuy);
    const t2 = ((openingLine.x2 - wall.x1) * pwux + (openingLine.y2 - wall.y1) * pwuy);
    const tMin = Math.min(t1, t2);
    const tMax = Math.max(t1, t2);
    
    // Check if opening falls within the wall's extent (with small tolerance)
    const tolerance = 5;
    if (tMin < -tolerance || tMax > pwlen + tolerance) continue;
    
    // Check if element midpoint is close to this wall (perpendicular distance)
    const t = ((midX - wall.x1) * pwdx + (midY - wall.y1) * pwdy) / (pwdx * pwdx + pwdy * pwdy);
    const closestX = wall.x1 + t * pwdx;
    const closestY = wall.y1 + t * pwdy;
    const dist = Math.sqrt((midX - closestX) ** 2 + (midY - closestY) ** 2);
    
    // Check if element is roughly parallel to wall
    const dotProduct = Math.abs(ux * pwux + uy * pwuy);
    
    if (dist < 10 && dotProduct > 0.9 && dist < bestScore) {
      bestScore = dist;
      parentWall = wall;
    }
  }
  
  if (!parentWall) return;
  
  // Determine which side is the room interior by checking for more walls
  const rayLength = 10000;
  let hitsPositive = 0;
  let hitsNegative = 0;
  
  for (const wall of state.getLines()) {
    if (lineKind(wall) !== "wall") continue;
    
    if (rayIntersectsSegment(midX, midY, midX + nx * rayLength, midY + ny * rayLength,
                              wall.x1, wall.y1, wall.x2, wall.y2)) {
      hitsPositive++;
    }
    
    if (rayIntersectsSegment(midX, midY, midX - nx * rayLength, midY - ny * rayLength,
                              wall.x1, wall.y1, wall.x2, wall.y2)) {
      hitsNegative++;
    }
  }
  
  // Odd number of hits means inside the room - flip to exterior
  const positiveIsInterior = (hitsPositive % 2) === 1;
  if (positiveIsInterior) {
    nx = -nx;
    ny = -ny;
  }
  
  // Calculate distances along the parent wall
  const pwdx = parentWall.x2 - parentWall.x1;
  const pwdy = parentWall.y2 - parentWall.y1;
  const pwlen = Math.sqrt(pwdx * pwdx + pwdy * pwdy);
  const pwux = pwdx / pwlen;
  const pwuy = pwdy / pwlen;
  
  // Project element endpoints onto wall direction
  const t1 = ((openingLine.x1 - parentWall.x1) * pwux + (openingLine.y1 - parentWall.y1) * pwuy);
  const t2 = ((openingLine.x2 - parentWall.x1) * pwux + (openingLine.y2 - parentWall.y1) * pwuy);
  
  const elemStartOnWall = Math.min(t1, t2);
  const elemEndOnWall = Math.max(t1, t2);
  
  const distFromStart = Math.max(0, elemStartOnWall);
  const distFromEnd = Math.max(0, pwlen - elemEndOnWall);
  
  ctx.save();
  // Use appropriate color based on element type
  const dimColor = kind === "door" ? "#aa5500" : "#0074d9";
  ctx.strokeStyle = dimColor;
  ctx.fillStyle = dimColor;
  ctx.lineWidth = 1;
  ctx.font = "10px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  
  // Offset beyond wall thickness + padding
  const bracketOffset = half + 8;
  
  // Draw bracket from wall start to element start
  if (distFromStart > 1) {
    const startX = parentWall.x1;
    const startY = parentWall.y1;
    const elemStartX = parentWall.x1 + pwux * elemStartOnWall;
    const elemStartY = parentWall.y1 + pwuy * elemStartOnWall;
    drawDimensionLine(ctx,
      startX, startY,
      elemStartX, elemStartY,
      nx, ny, bracketOffset, distFromStart
    );
  }
  
  // Draw bracket from element end to wall end
  if (distFromEnd > 1) {
    const elemEndX = parentWall.x1 + pwux * elemEndOnWall;
    const elemEndY = parentWall.y1 + pwuy * elemEndOnWall;
    const endX = parentWall.x2;
    const endY = parentWall.y2;
    drawDimensionLine(ctx,
      elemEndX, elemEndY,
      endX, endY,
      nx, ny, bracketOffset, distFromEnd
    );
  }
  
  ctx.restore();
}

function drawDimensionLine(ctx, x1, y1, x2, y2, nx, ny, offset, distance) {
  // Convert offset from world coordinates to screen
  const offsetScreen = offset * state.getViewScale();
  
  // Screen coordinates
  const sx1 = worldToScreenX(x1);
  const sy1 = worldToScreenY(y1);
  const sx2 = worldToScreenX(x2);
  const sy2 = worldToScreenY(y2);
  
  // Offset positions (away from wall, perpendicular to window line)
  const ox1 = sx1 + nx * offsetScreen;
  const oy1 = sy1 + ny * offsetScreen;
  const ox2 = sx2 + nx * offsetScreen;
  const oy2 = sy2 + ny * offsetScreen;
  
  // Draw vertical tick at start
  ctx.beginPath();
  ctx.moveTo(sx1, sy1);
  ctx.lineTo(ox1, oy1);
  ctx.stroke();
  
  // Draw vertical tick at end
  ctx.beginPath();
  ctx.moveTo(sx2, sy2);
  ctx.lineTo(ox2, oy2);
  ctx.stroke();
  
  // Draw dotted horizontal line
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(ox1, oy1);
  ctx.lineTo(ox2, oy2);
  ctx.stroke();
  ctx.setLineDash([]);
  
  // Draw dimension text above the line
  const midX = (ox1 + ox2) / 2;
  const midY = (oy1 + oy2) / 2;
  const textOffsetScreen = 4 * state.getViewScale();
  ctx.fillText(
    formatInchesToFeetInches(distance, 1),
    midX + nx * textOffsetScreen,
    midY + ny * textOffsetScreen
  );
}

// === Canvas sizing ===============================================

export function resizeCanvas() {
  const canvas = dom.getCanvas();
  const canvasContainer = dom.getCanvasContainer();
  const rect = canvasContainer.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
  draw();
}
