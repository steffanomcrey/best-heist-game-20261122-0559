// CCTV cameras: wall-mounted, sweeping a cone back and forth. Pure logic.
import { CAM_HALF, CAM_RANGE } from './config.js';
import { lineOfSight } from './guards.js';

export function createCamera(def) {
  return {
    x: def.x,
    y: def.y,
    base: def.base, // centre angle of the sweep
    arc: def.arc ?? 0.9,
    speed: def.speed ?? 0.55,
    phase: def.phase ?? 0,
    dir: def.base,
    range: def.range ?? CAM_RANGE,
    disabled: 0, // seconds left of EMP shutdown
  };
}

export function stepCamera(c, dt, time) {
  if (c.disabled > 0) { c.disabled -= dt; return; }
  c.dir = c.base + Math.sin(time * c.speed + c.phase) * c.arc;
}

export function cameraSees(c, px, py, walls, inShadow, inSmoke) {
  if (c.disabled > 0 || inSmoke) return false;
  const dx = px - c.x;
  const dy = py - c.y;
  const dist = Math.hypot(dx, dy);
  const range = inShadow ? c.range * 0.5 : c.range;
  if (dist > range) return false;
  let d = Math.atan2(dy, dx) - c.dir;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  if (Math.abs(d) > CAM_HALF) return false;
  return lineOfSight(c.x, c.y, px, py, walls);
}
