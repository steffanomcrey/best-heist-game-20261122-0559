// Tools: every tool costs alarm (noise) and a limited stock. Smoke hides the
// thief, EMP kills cameras and lasers, a tossed coin lures the nearest guard.
// Pure logic.
import { EMP_SECONDS, SMOKE_SECONDS, TOOL_COIN_COST, TOOL_EMP_COST, TOOL_SMOKE_COST } from './config.js';

export function createTools(stock) {
  return {
    smoke: stock?.smoke ?? 2,
    emp: stock?.emp ?? 1,
    coin: stock?.coin ?? 3,
    smokeLeft: 0,
    smokeX: 0,
    smokeY: 0,
    empLeft: 0,
    coinX: -1,
    coinY: -1,
    coinLeft: 0,
  };
}

export function stepTools(t, dt) {
  if (t.smokeLeft > 0) t.smokeLeft -= dt;
  if (t.empLeft > 0) t.empLeft -= dt;
  if (t.coinLeft > 0) t.coinLeft -= dt;
}

/** Use a tool. Returns an alarm cost, or -1 when the tool cannot be used. */
export function useTool(t, name, px, py, cameras, lasers) {
  if (name === 'smoke') {
    if (t.smoke <= 0 || t.smokeLeft > 0) return -1;
    t.smoke -= 1;
    t.smokeLeft = SMOKE_SECONDS;
    t.smokeX = px;
    t.smokeY = py;
    return TOOL_SMOKE_COST;
  }
  if (name === 'emp') {
    if (t.emp <= 0 || t.empLeft > 0) return -1;
    t.emp -= 1;
    t.empLeft = EMP_SECONDS;
    for (let i = 0; i < cameras.length; i += 1) cameras[i].disabled = EMP_SECONDS;
    for (let i = 0; i < lasers.length; i += 1) lasers[i].disabled = EMP_SECONDS;
    return TOOL_EMP_COST;
  }
  if (name === 'coin') {
    if (t.coin <= 0) return -1;
    t.coin -= 1;
    t.coinLeft = 6;
    t.coinX = px + 130;
    t.coinY = py;
    return TOOL_COIN_COST;
  }
  return -1;
}

export function inSmoke(t, px, py) {
  if (t.smokeLeft <= 0) return false;
  return Math.hypot(px - t.smokeX, py - t.smokeY) < 95;
}
