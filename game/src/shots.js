// Screenshot scenes + the autopilot. Every shot is the real game: a fresh world
// played forward by the same rules a player faces, steered by a simple pilot that
// reads cones before it moves (wait for a sweep to pass, step around a live laser,
// use smoke when it is stuck). Deterministic: same seed, same frame.
import { STEP } from './config.js';
import { CAM_HALF } from './config.js';
import { CONE_HALF } from './config.js';
import { lineOfSight } from './guards.js';
import {
  createWorld, loadLevel, nextLevel,
  stepWorld,
} from './world.js';
import { targetsLeft } from './loot.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const SAMPLE = STEP;

/** True when (x,y) sits inside a watcher's live cone (guard or camera). */
function inAnyCone(state, x, y) {
  for (const g of state.guards) {
    const dx = x - g.x;
    const dy = y - g.y;
    if (Math.hypot(dx, dy) > g.range) continue;
    let d = Math.atan2(dy, dx) - g.dir;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    if (Math.abs(d) < CONE_HALF && lineOfSight(g.x, g.y, x, y, state.def.walls)) return true;
  }
  for (const c of state.cameras) {
    if (c.disabled > 0) continue;
    const dx = x - c.x;
    const dy = y - c.y;
    if (Math.hypot(dx, dy) > c.range) continue;
    let d = Math.atan2(dy, dx) - c.dir;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    if (Math.abs(d) < CAM_HALF && lineOfSight(c.x, c.y, x, y, state.def.walls)) return true;
  }
  return false;
}

function laserAhead(state, px, py, tx, ty) {
  for (const l of state.lasers) {
    if (!l.live) continue;
    // Distance from the laser segment to the player's next step.
    const nx = px + (tx - px) * 0.12;
    const ny = py + (ty - py) * 0.12;
    const dx = l.x2 - l.x1;
    const dy = l.y2 - l.y1;
    const len2 = dx * dx + dy * dy;
    let t = len2 === 0 ? 0 : ((nx - l.x1) * dx + (ny - l.y1) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const cx = l.x1 + dx * t;
    const cy = l.y1 + dy * t;
    if (Math.hypot(nx - cx, ny - cy) < 46) return true;
  }
  return false;
}

/**
 * Shortest clear-line path from the player to the goal through the level's
 * route points (Dijkstra over line-of-sight edges). Returns the hop list
 * (route points then the goal), or null when no hop is needed / none exists.
 */
function planPath(state, px, py, gx, gy) {
  const pts = [[px, py], ...state.def.route, [gx, gy]];
  const n = pts.length;
  const dist = new Array(n).fill(Infinity);
  const prev = new Array(n).fill(-1);
  const done = new Array(n).fill(false);
  dist[0] = 0;
  for (let iter = 0; iter < n; iter += 1) {
    let u = -1;
    let best = Infinity;
    for (let i = 0; i < n; i += 1) {
      if (!done[i] && dist[i] < best) { best = dist[i]; u = i; }
    }
    if (u === -1) break;
    done[u] = true;
    if (u === n - 1) break;
    for (let v = 0; v < n; v += 1) {
      if (done[v] || v === u) continue;
      if (!lineOfSight(pts[u][0], pts[u][1], pts[v][0], pts[v][1], state.def.walls)) continue;
      const d = dist[u] + Math.hypot(pts[v][0] - pts[u][0], pts[v][1] - pts[u][1]);
      if (d < dist[v]) { dist[v] = d; prev[v] = u; }
    }
  }
  if (!Number.isFinite(dist[n - 1])) return null;
  const hops = [];
  let cur = n - 1;
  while (cur > 0) {
    hops.unshift(pts[cur]);
    cur = prev[cur];
    if (cur === -1) return null;
  }
  return hops;
}
export function autopilot(world, mem) {
  const s = world.state;
  const p = s.player;
  // Current goal: nearest untaken target loot, else the exit.
  let goal = null;
  let best = Infinity;
  for (const item of s.loot) {
    if (!item.target || item.taken) continue;
    const d = Math.hypot(item.x - p.x, item.y - p.y);
    if (d < best) { best = d; goal = item; }
  }
  const gx = goal ? goal.x : s.def.exit[0];
  const gy = goal ? goal.y : s.def.exit[1];

  // Seen right now: break vision. Smoke first when the alarm is already high,
  // then run for the nearest shadow pool (cover halves detection range).
  if (s.seen) {
    if (s.alarm > 35 && s.tools.smoke > 0 && s.tools.smokeLeft <= 0) {
      return { mx: 0, my: 0, tool: 'smoke' };
    }
    let tx = null;
    let ty = null;
    let td = Infinity;
    for (const sh of s.def.shadows) {
      const cx = sh.x + sh.w / 2;
      const cy = sh.y + sh.h / 2;
      const d = Math.hypot(cx - p.x, cy - p.y);
      if (d < td) { td = d; tx = cx; ty = cy; }
    }
    if (tx === null || td > 420) {
      // No shadow close by: run directly away from the nearest watcher.
      let wx = p.x;
      let wy = p.y;
      let wd = Infinity;
      for (const g of s.guards) {
        const d = Math.hypot(g.x - p.x, g.y - p.y);
        if (d < wd) { wd = d; wx = g.x; wy = g.y; }
      }
      for (const c of s.cameras) {
        const d = Math.hypot(c.x - p.x, c.y - p.y);
        if (d < wd) { wd = d; wx = c.x; wy = c.y; }
      }
      tx = p.x + (p.x - wx);
      ty = p.y + (p.y - wy);
    }
    const dx = tx - p.x;
    const dy = ty - p.y;
    const len = Math.hypot(dx, dy) || 1;
    return { mx: dx / len, my: dy / len, tool: null };
  }

  // Path planner: walk the Dijkstra hop list toward the goal, re-planning when
  // the goal changes or a hop is reached.
  let tx = gx;
  let ty = gy;
  const pathKey = `${world.levelIndex}:${gx},${gy}`;
  if (mem.pathKey !== pathKey) {
    mem.pathKey = pathKey;
    mem.path = planPath(s, p.x, p.y, gx, gy);
    if (!mem.path) {
      // No clear hop chain: head for the reachable route point nearest the goal.
      let pick = null;
      let pickScore = Infinity;
      for (const rp of s.def.route) {
        if (!lineOfSight(p.x, p.y, rp[0], rp[1], s.def.walls)) continue;
        const score = Math.hypot(rp[0] - gx, rp[1] - gy);
        if (score < pickScore) { pickScore = score; pick = rp; }
      }
      mem.path = pick ? [pick, [gx, gy]] : [[gx, gy]];
    }
    mem.pathIndex = 0;
  }
  if (mem.path && mem.pathIndex < mem.path.length) {
    const hop = mem.path[mem.pathIndex];
    const next = mem.path[mem.pathIndex + 1];
    // Advance only once the next hop is visible from here: turning early
    // around a wall corner walks the thief straight into the wall.
    if (Math.hypot(hop[0] - p.x, hop[1] - p.y) < 30
      && (!next || lineOfSight(p.x, p.y, next[0], next[1], s.def.walls))) {
      mem.pathIndex += 1;
    }
  }
  if (mem.path && mem.pathIndex < mem.path.length) {
    tx = mem.path[mem.pathIndex][0];
    ty = mem.path[mem.pathIndex][1];
  }

  // Stuck? No progress toward the subgoal for a while: smoke once, else sidestep.
  const dist = Math.hypot(tx - p.x, ty - p.y);
  if (mem.bestDist === undefined || dist < mem.bestDist - 2) {
    mem.bestDist = dist;
    mem.stuck = 0;
  } else {
    mem.stuck += 1;
  }
  if (mem.stuck > 260 && s.tools.smoke > 0 && s.tools.smokeLeft <= 0) {
    mem.stuck = 0;
    mem.pathKey = null;
    return { mx: 0, my: 0, tool: 'smoke' };
  }
  if (mem.stuck > 420) {
    mem.stuck = 0;
    mem.sidestep = 50;
    mem.pathKey = null;
  }

  let dx = tx - p.x;
  let dy = ty - p.y;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len;
  dy /= len;
  if (mem.sidestep > 0) {
    mem.sidestep -= 1;
    return { mx: -dy, my: dx, tool: null };
  }
  // Read the cone before stepping into it; wait for the sweep to pass.
  const aheadX = p.x + dx * 42;
  const aheadY = p.y + dy * 42;
  if (s.alarm > 15 && inAnyCone(s, aheadX, aheadY)) return { mx: 0, my: 0, tool: null };
  if (laserAhead(s, p.x, p.y, tx, ty)) return { mx: 0, my: 0, tool: null };
  return { mx: dx, my: dy, tool: null };
}

/** Play forward with the autopilot for up to `seconds`; returns what happened. */
export function playForward(world, seconds) {
  const mem = {};
  let peakAlarm = 0;
  let caught = false;
  let steps = 0;
  let levelSeen = world.levelIndex;
  const limit = Math.floor(seconds / SAMPLE);
  for (; steps < limit; steps += 1) {
    if (world.status === 'caught') { caught = true; break; }
    if (world.status === 'won') break;
    if (world.status === 'levelDone') { nextLevel(world); levelSeen = world.levelIndex; mem.pathKey = null; mem.bestDist = undefined; mem.stuck = 0; continue; }
    const input = autopilot(world, mem);
    stepWorld(world, SAMPLE, input);
    peakAlarm = Math.max(peakAlarm, world.state.alarm);
  }
  return {
    steps,
    seconds: steps * SAMPLE,
    status: world.status,
    level: world.levelIndex + 1,
    loot: world.totalLoot,
    peakAlarm: Math.round(peakAlarm),
    caught,
    player: { x: Math.round(world.state.player.x), y: Math.round(world.state.player.y) },
  };
}

/**
 * Stage a named scene and return the screen to draw. Names: cover | tools |
 * escape | title | playtest. Cover/tools/escape are real play-forward states;
 * the alarm is then lifted to a fixed staged tension value so the meter reads
 * in the frame (the meter itself is real game state, rendered by the real HUD).
 */
export function stageShot(name, world) {
  if (name === 'title') {
    loadLevel(world, 0);
    return { screen: SCREEN_TITLE, best: 0, test: null };
  }
  if (name === 'playtest') {
    const w = createWorld();
    const result = playForward(w, 300);
    return { screen: SCREEN_PLAY, best: 0, test: result };
  }
  if (name === 'tools') {
    loadLevel(world, 0);
    playForward(world, 9);
    const s = world.state;
    s.tools.smokeLeft = 4;
    s.tools.smokeX = s.player.x;
    s.tools.smokeY = s.player.y;
    s.alarm = Math.max(s.alarm, 55);
    s.message = 'SMOKE OUT — CONES BLIND';
    s.messageLeft = 99;
    return { screen: SCREEN_PLAY, best: world.totalLoot, test: null };
  }
  if (name === 'escape') {
    const w = createWorld();
    // Play forward until the thief is close to the level-3 helipad.
    const result = playForward(w, 200);
    // Mirror the played world into the staging world so the renderer sees it.
    world.levelIndex = w.levelIndex;
    world.totalLoot = w.totalLoot;
    world.levelLoot = w.levelLoot;
    world.runTime = w.runTime;
    world.time = w.time;
    world.status = w.status;
    world.state = w.state;
    world.state.alarm = Math.max(12, Math.min(30, world.state.alarm));
    return { screen: SCREEN_PLAY, best: world.totalLoot, test: result };
  }
  // cover: level 1 mid-heist (7 s in: first painting lifted, thief crossing
  // the gallery toward the second, cones sweeping). Short on purpose: longer
  // staging runs past the level-1 finish line into the Vault Hall.
  loadLevel(world, 0);
  playForward(world, 7);
  world.state.alarm = Math.max(world.state.alarm, 42);
  return { screen: SCREEN_PLAY, best: world.totalLoot, test: null };
}
