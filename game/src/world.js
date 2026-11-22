// World: the three levels of the Meridian Job, the game state, and the fixed-step
// rules (move, collide, vision, alarm, loot, tools, exit). Pure logic, no DOM.
import {
  ALARM_CAUGHT, ALARM_FALL, ALARM_RISE, HUD_H, PLAYER_R, PLAYER_SPEED, STEP,
} from './config.js';
import { cameraSees, createCamera, stepCamera } from './cameras.js';
import { createGuard, guardSees, hitsWall, stepGuard } from './guards.js';
import { createLaser, laserHits, stepLaser } from './lasers.js';
import { collectLoot, createLoot, targetsLeft } from './loot.js';
import { createTools, inSmoke, stepTools, useTool } from './tools.js';

export const EVENT_LOOT = 1;
export const EVENT_CAUGHT = 2;
export const EVENT_LEVEL = 4;
export const EVENT_WIN = 8;
export const EVENT_LASER = 16;
export const EVENT_TOOL = 32;

const WALL_TOP = { x: 0, y: HUD_H, w: 1280, h: 16 };
const WALL_BOTTOM = { x: 0, y: 704, w: 1280, h: 16 };
const WALL_LEFT = { x: 0, y: HUD_H, w: 16, h: 640 };
const WALL_RIGHT = { x: 1264, y: HUD_H, w: 16, h: 640 };

export const LEVELS = [
  {
    name: 'Level 1 — The Gallery',
    brief: 'Lift both paintings, then slip out the east door.',
    spawn: [60, 640],
    exit: [1252, 350],
    exitLabel: 'EAST DOOR',
    route: [[360, 450], [470, 450], [700, 300], [1100, 300]],
    walls: [
      WALL_TOP, WALL_BOTTOM, WALL_LEFT,
      { x: 1264, y: HUD_H, w: 16, h: 236 },
      { x: 1264, y: 400, w: 16, h: 304 },
      { x: 400, y: 80, w: 24, h: 300 },
      { x: 400, y: 500, w: 24, h: 204 },
      { x: 560, y: 440, w: 540, h: 24 },
      { x: 640, y: 180, w: 90, h: 50 },
      { x: 900, y: 560, w: 90, h: 50 },
    ],
    shadows: [
      { x: 170, y: 520, w: 200, h: 130 },
      { x: 680, y: 110, w: 230, h: 90 },
      { x: 1010, y: 520, w: 170, h: 120 },
    ],
    guards: [
      { path: [[520, 140], [920, 140]] },
      { path: [[760, 600], [760, 480]] },
    ],
    cameras: [{ x: 640, y: 80, base: Math.PI / 2, arc: 0.8, speed: 0.5 }],
    lasers: [],
    loot: [
      { id: 'p1', kind: 'painting', label: 'Sunset Over Meridian', x: 300, y: 150, value: 1200, target: true },
      { id: 'p2', kind: 'painting', label: 'The Copper Fox', x: 1020, y: 150, value: 1500, target: true },
      { id: 'g1', kind: 'gold', label: 'Gold bars', x: 880, y: 620, value: 800, target: false },
    ],
    tools: { smoke: 2, emp: 1, coin: 3 },
  },
  {
    name: 'Level 2 — The Vault Hall',
    brief: 'Take the Meridian Diamond and the Duchess, then leave by the south door.',
    spawn: [60, 120],
    exit: [650, 692],
    exitLabel: 'SOUTH DOOR',
    route: [[200, 460], [380, 460], [500, 480], [820, 500], [800, 410], [380, 620]],
    walls: [
      WALL_TOP, WALL_LEFT, WALL_RIGHT,
      { x: 0, y: 704, w: 600, h: 16 },
      { x: 700, y: 704, w: 580, h: 16 },
      { x: 520, y: 280, w: 240, h: 20 },
      { x: 520, y: 440, w: 240, h: 20 },
      { x: 520, y: 280, w: 20, h: 160 },
      { x: 740, y: 280, w: 20, h: 100 },
      { x: 300, y: 200, w: 24, h: 200 },
      { x: 300, y: 520, w: 24, h: 184 },
      { x: 900, y: 140, w: 24, h: 240 },
      { x: 900, y: 500, w: 24, h: 204 },
    ],
    shadows: [
      { x: 120, y: 120, w: 180, h: 100 },
      { x: 1020, y: 560, w: 180, h: 110 },
      { x: 420, y: 560, w: 160, h: 100 },
    ],
    guards: [
      { path: [[420, 140], [820, 140]] },
      { path: [[980, 300], [980, 620]] },
      { path: [[360, 600], [560, 600]] },
    ],
    cameras: [
      { x: 640, y: 80, base: Math.PI / 2, arc: 0.9, speed: 0.6 },
      { x: 1240, y: 400, base: Math.PI, arc: 0.7, speed: 0.45, phase: 1.5 },
    ],
    lasers: [
      { from: [324, 400], to: [324, 520], period: 4, on: 2.2, offset: 0 },
      { from: [760, 380], to: [760, 440], period: 3, on: 1.6, offset: 1 },
      { from: [480, 640], to: [820, 640], period: 5, on: 2.5, offset: 2 },
    ],
    loot: [
      { id: 'd1', kind: 'diamond', label: 'The Meridian Diamond', x: 640, y: 360, value: 5000, target: true },
      { id: 'p3', kind: 'painting', label: 'Duchess in Blue', x: 140, y: 600, value: 1400, target: true },
      { id: 'g2', kind: 'gold', label: 'Vault gold', x: 1100, y: 140, value: 1000, target: false },
    ],
    tools: { smoke: 2, emp: 2, coin: 3 },
  },
  {
    name: 'Level 3 — Rooftop Escape',
    brief: 'Grab the case and the stash, then reach the helicopter.',
    spawn: [60, 120],
    exit: [1150, 600],
    exitLabel: 'HELIPAD',
    route: [[200, 300], [700, 260], [1100, 300], [500, 620], [900, 520]],
    walls: [
      WALL_TOP, WALL_BOTTOM, WALL_LEFT, WALL_RIGHT,
      { x: 300, y: 200, w: 120, h: 80 },
      { x: 600, y: 120, w: 100, h: 70 },
      { x: 850, y: 300, w: 130, h: 80 },
      { x: 250, y: 480, w: 110, h: 80 },
      { x: 600, y: 500, w: 140, h: 80 },
      { x: 1000, y: 130, w: 110, h: 70 },
      { x: 450, y: 360, w: 90, h: 60 },
    ],
    shadows: [
      { x: 120, y: 300, w: 170, h: 120 },
      { x: 700, y: 600, w: 200, h: 90 },
      { x: 1050, y: 350, w: 150, h: 110 },
    ],
    guards: [
      { path: [[450, 240], [950, 240]] },
      { path: [[520, 440], [1020, 440]] },
      { path: [[200, 620], [700, 620]] },
    ],
    cameras: [
      { x: 640, y: 80, base: Math.PI / 2, arc: 1.0, speed: 0.7 },
      { x: 1240, y: 360, base: Math.PI, arc: 0.8, speed: 0.5, phase: 2 },
    ],
    lasers: [],
    loot: [
      { id: 'c1', kind: 'crate', label: 'The Meridian Case', x: 1120, y: 120, value: 2000, target: true },
      { id: 'g3', kind: 'gold', label: 'Rooftop stash', x: 120, y: 640, value: 1100, target: true },
      { id: 'g4', kind: 'gold', label: 'Smuggled crates', x: 340, y: 120, value: 900, target: false },
    ],
    tools: { smoke: 3, emp: 1, coin: 3 },
  },
];

export function createWorld() {
  const world = {
    levelIndex: 0,
    state: null,
    time: 0,
    totalLoot: 0,
    levelLoot: 0,
    status: 'playing', // playing | caught | levelDone | won
    levelTime: 0,
    runTime: 0,
  };
  loadLevel(world, 0);
  return world;
}

export function loadLevel(world, index) {
  const def = LEVELS[index];
  world.levelIndex = index;
  world.levelTime = 0;
  world.levelLoot = 0;
  world.status = 'playing';
  world.state = {
    def,
    player: { x: def.spawn[0], y: def.spawn[1] },
    guards: def.guards.map(createGuard),
    cameras: def.cameras.map(createCamera),
    lasers: def.lasers.map(createLaser),
    loot: def.loot.map(createLoot),
    tools: createTools(def.tools),
    alarm: 0,
    seen: false,
    seenBy: null,
    lastKnown: null,
    flash: 0,
    laserCooldown: 0,
    message: '',
    messageLeft: 0,
  };
  return world.state;
}

export function inShadow(state, x, y) {
  for (let i = 0; i < state.def.shadows.length; i += 1) {
    const s = state.def.shadows[i];
    if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) return true;
  }
  return false;
}

/** One fixed step. `input` = { mx, my, tool }. Returns an event bitmask. */
export function stepWorld(world, dt, input) {
  const s = world.state;
  if (world.status !== 'playing') return 0;
  let events = 0;
  world.time += dt;
  world.levelTime += dt;
  world.runTime += dt;

  // Tools.
  if (input.tool) {
    const cost = useTool(s.tools, input.tool, s.player.x, s.player.y, s.cameras, s.lasers);
    if (cost >= 0) {
      s.alarm = Math.min(ALARM_CAUGHT, s.alarm + cost);
      s.message = input.tool === 'smoke' ? 'SMOKE OUT' : input.tool === 'emp' ? 'EMP: CAMERAS DOWN' : 'COIN TOSSED';
      s.messageLeft = 1.4;
      events |= EVENT_TOOL;
    }
  }
  stepTools(s.tools, dt);

  // Player movement, axis-separated so walls slide instead of sticking.
  const len = Math.hypot(input.mx, input.my);
  if (len > 0.01) {
    const nx = s.player.x + (input.mx / len) * PLAYER_SPEED * dt;
    const ny = s.player.y + (input.my / len) * PLAYER_SPEED * dt;
    if (!hitsWall(nx, s.player.y, PLAYER_R, s.def.walls)) s.player.x = nx;
    if (!hitsWall(s.player.x, ny, PLAYER_R, s.def.walls)) s.player.y = ny;
  }

  // Patrols, cameras, lasers.
  const lure = s.tools.coinLeft > 0 ? { x: s.tools.coinX, y: s.tools.coinY } : null;
  for (let i = 0; i < s.guards.length; i += 1) {
    if (lure) stepGuard(s.guards[i], dt, s.def.walls, 60, lure);
    else stepGuard(s.guards[i], dt, s.def.walls, s.alarm, s.lastKnown);
  }
  for (let i = 0; i < s.cameras.length; i += 1) stepCamera(s.cameras[i], dt, world.time);
  for (let i = 0; i < s.lasers.length; i += 1) stepLaser(s.lasers[i], dt, world.time);

  // Vision.
  const shadow = inShadow(s, s.player.x, s.player.y);
  const smoke = inSmoke(s.tools, s.player.x, s.player.y);
  s.seen = false;
  s.seenBy = null;
  for (let i = 0; i < s.guards.length; i += 1) {
    if (guardSees(s.guards[i], s.player.x, s.player.y, s.def.walls, shadow, smoke)) {
      s.seen = true;
      s.seenBy = 'guard';
      break;
    }
  }
  if (!s.seen) {
    for (let i = 0; i < s.cameras.length; i += 1) {
      if (cameraSees(s.cameras[i], s.player.x, s.player.y, s.def.walls, shadow, smoke)) {
        s.seen = true;
        s.seenBy = 'camera';
        break;
      }
    }
  }
  if (s.seen) {
    s.alarm += ALARM_RISE * dt;
    s.lastKnown = { x: s.player.x, y: s.player.y };
  } else {
    s.alarm -= ALARM_FALL * dt;
  }
  s.alarm = Math.max(0, Math.min(ALARM_CAUGHT, s.alarm));

  // Lasers.
  if (s.laserCooldown > 0) s.laserCooldown -= dt;
  for (let i = 0; i < s.lasers.length; i += 1) {
    if (laserHits(s.lasers[i], s.player.x, s.player.y, PLAYER_R) && s.laserCooldown <= 0) {
      s.alarm = Math.min(ALARM_CAUGHT, s.alarm + 35);
      s.flash = 0.4;
      s.laserCooldown = 0.8;
      s.message = 'LASER TRIPPED';
      s.messageLeft = 1.2;
      events |= EVENT_LASER;
      break;
    }
  }
  if (s.flash > 0) s.flash -= dt;
  if (s.messageLeft > 0) s.messageLeft -= dt;

  // Loot.
  const got = collectLoot(s.loot, s.player.x, s.player.y, 30);
  if (got.gained > 0) {
    s.message = `+ $${got.gained.toLocaleString('en-US')} — ${got.names.join(', ')}`;
    s.messageLeft = 1.6;
    world.totalLoot += got.gained;
    world.levelLoot += got.gained;
    events |= EVENT_LOOT;
  }

  // Caught.
  if (s.alarm >= ALARM_CAUGHT) {
    world.status = 'caught';
    return events | EVENT_CAUGHT;
  }

  // Exit: opens once every target loot is taken.
  const dx = s.def.exit[0] - s.player.x;
  const dy = s.def.exit[1] - s.player.y;
  if (targetsLeft(s.loot) === 0 && Math.hypot(dx, dy) < 38) {
    if (world.levelIndex >= LEVELS.length - 1) {
      world.status = 'won';
      return events | EVENT_WIN;
    }
    world.status = 'levelDone';
    return events | EVENT_LEVEL;
  }
  return events;
}

export function nextLevel(world) {
  loadLevel(world, world.levelIndex + 1);
}

export { STEP };
