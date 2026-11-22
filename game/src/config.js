// Copper Fox: The Meridian Job — shared constants (no DOM, no imports).
export const VIEW_W = 1280;
export const VIEW_H = 720;
export const HUD_H = 64;
export const STEP = 1 / 60;
export const PLAYER_R = 13;
export const PLAYER_SPEED = 175;
export const GUARD_SPEED = 78;
export const GUARD_CHASE_SPEED = 132;
export const CONE_RANGE = 230;
export const CONE_HALF = 0.62; // radians, about 35 degrees each side
export const CAM_RANGE = 260;
export const CAM_HALF = 0.5;
export const ALARM_RISE = 95; // per second of continuous sight: ~1.05 s to caught
export const ALARM_FALL = 26;
export const ALARM_CAUGHT = 100;
export const TOOL_SMOKE_COST = 10; // alarm points: using a tool makes noise
export const TOOL_EMP_COST = 14;
export const TOOL_COIN_COST = 6;
export const SMOKE_SECONDS = 5;
export const EMP_SECONDS = 6;

export const COLORS = {
  floor: '#141a26',
  floorAlt: '#171e2d',
  wall: '#3a4358',
  wallTop: '#4d5878',
  shadow: '#0b1220',
  cone: 'rgba(255, 176, 32, 0.30)',
  coneHot: 'rgba(255, 64, 48, 0.38)',
  camCone: 'rgba(255, 80, 80, 0.26)',
  laser: '#ff2e4d',
  gold: '#ffc93c',
  diamond: '#7fe7ff',
  fox: '#e8762a',
  guard: '#5b7bd5',
  exit: '#39d98a',
  text: '#f2f5ff',
  dim: '#9aa7c4',
};

export const BEST_KEY = 'copper-fox-best-loot';
