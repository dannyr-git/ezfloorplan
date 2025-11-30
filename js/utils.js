// === Length parsing & formatting =================================

export function parseLengthToInches(input) {
  if (!input) return null;
  let s = String(input).trim().toLowerCase();
  if (!s) return null;

  s = s.replace(/′/g, "'").replace(/″/g, '"');

  // 10' 6" or 10ft 6in
  let m = s.match(
    /^\s*([0-9]+(?:\.[0-9]+)?)\s*(?:ft|')\s+([0-9]+(?:\.[0-9]+)?)\s*(?:in|")?\s*$/
  );
  if (m) {
    const ft = parseFloat(m[1]);
    const inches = parseFloat(m[2]);
    if (isNaN(ft) || isNaN(inches)) return null;
    return ft * 12 + inches;
  }

  // 10' or 10ft
  m = s.match(/^\s*([0-9]+(?:\.[0-9]+)?)\s*(?:ft|')\s*$/);
  if (m) {
    const ft = parseFloat(m[1]);
    if (isNaN(ft)) return null;
    return ft * 12;
  }

  // 120" or 120in
  m = s.match(/^\s*([0-9]+(?:\.[0-9]+)?)\s*(?:in|")\s*$/);
  if (m) {
    const inches = parseFloat(m[1]);
    if (isNaN(inches)) return null;
    return inches;
  }

  // bare number => decimal feet
  m = s.match(/^\s*([0-9]+(?:\.[0-9]+)?)\s*$/);
  if (m) {
    const ft = parseFloat(m[1]);
    if (isNaN(ft)) return null;
    return ft * 12;
  }

  return null;
}

export function formatInchesToFeetInches(inches, precision) {
  if (inches == null || !isFinite(inches)) return "—";
  precision = typeof precision === "number" ? precision : 2;

  let negative = inches < 0;
  if (negative) inches = -inches;

  let feet = Math.floor(inches / 12);
  let remaining = inches - feet * 12;
  let rounded = parseFloat(remaining.toFixed(precision));

  if (rounded >= 12) {
    feet += 1;
    rounded -= 12;
  }

  let inchesStr =
    precision === 0 ? String(Math.round(rounded)) : rounded.toFixed(precision);
  inchesStr = parseFloat(inchesStr).toString();

  let result = feet + "'" + " " + inchesStr + '"';
  return negative ? "-" + result : result;
}

// === Geometry helpers ============================================

export function distancePointToSegmentWorld(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) {
    return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
  }
  const t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
  const tClamped = Math.max(0, Math.min(1, t));
  const cx = x1 + tClamped * dx;
  const cy = y1 + tClamped * dy;
  return Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
}

export function rayIntersectsSegment(rx1, ry1, rx2, ry2, sx1, sy1, sx2, sy2) {
  // Check if ray from (rx1,ry1) to (rx2,ry2) intersects segment (sx1,sy1)-(sx2,sy2)
  const dx = rx2 - rx1;
  const dy = ry2 - ry1;
  const dsx = sx2 - sx1;
  const dsy = sy2 - sy1;
  
  const denom = dx * dsy - dy * dsx;
  if (Math.abs(denom) < 1e-10) return false;
  
  const t = ((sx1 - rx1) * dsy - (sy1 - ry1) * dsx) / denom;
  const u = ((sx1 - rx1) * dy - (sy1 - ry1) * dx) / denom;
  
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

export function lineKind(l) {
  return l.kind || "wall";
}
