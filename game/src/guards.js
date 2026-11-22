// Guards: patrol waypoints, chase to the last known position when the alarm is
// high, and vision cones raycast against walls so cover really hides the thief.
// Pure logic: no DOM, no canvas. Angles in radians, 0 = east.
import { CONE_HALF, CONE_RANGE, GUARD_CHASE_SPEED, GUARD_SPEED } from './config.js';

/** Distance from (x,y) along `angle` to the nearest wall rect, capped at maxDist. */
export function castRay(x, y, angle, walls, maxDist) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let best = maxDist;
  for (let i = 0; i < walls.length; i += 1) {
    const w = walls[i];
    // Slab test against the axis-aligned rect.
    let tmin = 0;
    let tmax = best;
    let ok = true;
    if (Math.abs(dx) < 1e-9) {
      if (x < w.x || x > w.x + w.w) ok = false;
    } else {
      let t1 = (w.x - x) / dx;
      let t2 = (w.x + w.w - x) / dx;
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) ok = false;
    }
    if (ok) {
      if (Math.abs(dy) < 1e-9) {
        if (y < w.y || y > w.y + w.h) ok = false;
      } else {
        let t1 = (w.y - y) / dy;
        let t2 = (w.y + w.h - y) / dy;
        if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) ok = false;
      }
    }
    if (ok && tmin < best && tmin >= 0) best = tmin;
  }
  return best;
}

/** True when the segment (x1,y1)-(x2,y2) hits no wall rect. */
export function lineOfSight(x1, y1, x2, y2, walls) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-6) return true;
  const hit = castRay(x1, y1, Math.atan2(dy, dx), walls, dist - 0.01);
  return hit >= dist - 0.5;
}

/** Polygon points for a vision cone clipped by walls (for rendering). */
export function conePolygon(x, y, dir, range, half, walls) {
  const steps = 16;
  const pts = [[x, y]];
  for (let i = 0; i <= steps; i += 1) {
    const a = dir - half + (2 * half * i) / steps;
    const d = castRay(x, y, a, walls, range);
    pts.push([x + Math.cos(a) * d, y + Math.sin(a) * d]);
  }
  return pts;
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

export function createGuard(def) {
  return {
    x: def.path[0][0],
    y: def.path[0][1],
    path: def.path,
    leg: 0,
    forward: true,
    dir: def.dir ?? 0,
    speed: def.speed ?? GUARD_SPEED,
    range: def.range ?? CONE_RANGE,
    state: 'patrol', // patrol | chase
    pause: 0,
  };
}

/** Move one guard one step; chase the last known position while alarm is high. */
export function stepGuard(g, dt, walls, alarm, lastKnown) {
  let tx;
  let ty;
  let speed = g.speed;
  if (alarm > 50 && lastKnown) {
    g.state = 'chase';
    tx = lastKnown.x;
    ty = lastKnown.y;
    speed = GUARD_CHASE_SPEED;
  } else {
    g.state = 'patrol';
    const target = g.path[g.forward ? g.leg + 1 : g.leg - 1] ?? g.path[0];
    tx = target[0];
    ty = target[1];
  }
  const dx = tx - g.x;
  const dy = ty - g.y;
  const dist = Math.hypot(dx, dy);
  if (g.state === 'patrol' && dist < 6) {
    if (g.forward) {
      g.leg += 1;
      if (g.leg >= g.path.length - 1) { g.leg = g.path.length - 1; g.forward = false; g.pause = 0.9; }
    } else {
      g.leg -= 1;
      if (g.leg <= 0) { g.leg = 0; g.forward = true; g.pause = 0.9; }
    }
    return;
  }
  if (g.pause > 0) { g.pause -= dt; return; }
  if (dist < 1e-6) return;
  const move = Math.min(dist, speed * dt);
  const nx = g.x + (dx / dist) * move;
  const ny = g.y + (dy / dist) * move;
  // Guards walk around walls: axis-separated slide, same rule as the player.
  if (!hitsWall(nx, g.y, 12, walls)) g.x = nx;
  if (!hitsWall(g.x, ny, 12, walls)) g.y = ny;
  const want = Math.atan2(dy, dx);
  const d = angleDiff(want, g.dir);
  g.dir += Math.max(-3.2 * dt, Math.min(3.2 * dt, d));
}

export function hitsWall(x, y, r, walls) {
  for (let i = 0; i < walls.length; i += 1) {
    const w = walls[i];
    const cx = Math.max(w.x, Math.min(x, w.x + w.w));
    const cy = Math.max(w.y, Math.min(y, w.y + w.h));
    if ((x - cx) * (x - cx) + (y - cy) * (y - cy) < r * r) return true;
  }
  return false;
}

/**
 * Can this guard see the player? Shadow pools halve the effective range unless
 * the guard is close; smoke hides the player entirely.
 */
export function guardSees(g, px, py, walls, inShadow, inSmoke) {
  if (inSmoke) return false;
  const dx = px - g.x;
  const dy = py - g.y;
  const dist = Math.hypot(dx, dy);
  const range = inShadow ? g.range * 0.5 : g.range;
  if (dist > range) return false;
  if (Math.abs(angleDiff(Math.atan2(dy, dx), g.dir)) > CONE_HALF) return false;
  return lineOfSight(g.x, g.y, px, py, walls);
}
