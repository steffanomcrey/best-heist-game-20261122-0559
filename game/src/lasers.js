// Laser grids: beams across a corridor that blink on a fixed cycle. Crossing a
// live beam spikes the alarm. Pure logic (segment vs circle test).
export function createLaser(def) {
  return {
    x1: def.from[0], y1: def.from[1],
    x2: def.to[0], y2: def.to[1],
    period: def.period ?? 4,
    on: def.on ?? 2.2,
    offset: def.offset ?? 0,
    disabled: 0,
    live: true,
  };
}

export function stepLaser(l, dt, time) {
  if (l.disabled > 0) { l.disabled -= dt; l.live = false; return; }
  const t = (time + l.offset) % l.period;
  l.live = t < l.on;
}

/** True when the player circle touches a live beam. */
export function laserHits(l, px, py, r) {
  if (!l.live) return false;
  const dx = l.x2 - l.x1;
  const dy = l.y2 - l.y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - l.x1) * dx + (py - l.y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = l.x1 + dx * t;
  const cy = l.y1 + dy * t;
  const ddx = px - cx;
  const ddy = py - cy;
  return ddx * ddx + ddy * ddy < (r + 4) * (r + 4);
}
