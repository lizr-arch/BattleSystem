export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function clamp01(value) {
  return clamp(value, 0, 1);
}

export function length2(x, y) {
  return Math.hypot(x, y);
}

export function normalize2(x, y) {
  const len = length2(x, y);
  if (len <= 0.000001) {
    return { x: 0, y: 0, length: 0 };
  }

  return { x: x / len, y: y / len, length: len };
}

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
