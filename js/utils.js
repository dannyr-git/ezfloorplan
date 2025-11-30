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
  
  // Round to nearest 1/16th for fraction display
  const sixteenths = Math.round(remaining * 16);
  const wholeInches = Math.floor(sixteenths / 16);
  const fracSixteenths = sixteenths % 16;
  
  // Adjust if we rounded up to 16/16
  let finalFeet = feet;
  let finalWholeInches = wholeInches;
  let finalFracSixteenths = fracSixteenths;
  
  if (finalWholeInches >= 12) {
    finalFeet += 1;
    finalWholeInches -= 12;
  }
  
  // Convert sixteenths to simplified fraction
  let inchesStr = "";
  if (finalFracSixteenths === 0) {
    inchesStr = String(finalWholeInches);
  } else {
    // Simplify the fraction
    const fracStr = simplifyFraction(finalFracSixteenths, 16);
    if (finalWholeInches === 0) {
      inchesStr = fracStr;
    } else {
      inchesStr = finalWholeInches + " " + fracStr;
    }
  }

  let result = finalFeet + "'" + " " + inchesStr + '"';
  return negative ? "-" + result : result;
}

function simplifyFraction(numerator, denominator) {
  // Find GCD
  function gcd(a, b) {
    return b === 0 ? a : gcd(b, a % b);
  }
  
  const divisor = gcd(numerator, denominator);
  const num = numerator / divisor;
  const den = denominator / divisor;
  
  // Use Unicode fraction characters for common fractions
  const fractionMap = {
    "1/2": "½",
    "1/4": "¼",
    "3/4": "¾",
    "1/8": "⅛",
    "3/8": "⅜",
    "5/8": "⅝",
    "7/8": "⅞",
    "1/16": "¹⁄₁₆",
    "3/16": "³⁄₁₆",
    "5/16": "⁵⁄₁₆",
    "7/16": "⁷⁄₁₆",
    "9/16": "⁹⁄₁₆",
    "11/16": "¹¹⁄₁₆",
    "13/16": "¹³⁄₁₆",
    "15/16": "¹⁵⁄₁₆"
  };
  
  const fracKey = num + "/" + den;
  return fractionMap[fracKey] || fracKey;
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
