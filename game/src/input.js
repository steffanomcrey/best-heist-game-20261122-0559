// Input: keyboard (WASD/arrows, 1/2/3 tools, P pause, R restart, Enter confirm)
// and mouse (click a HUD tool button, or click the floor to walk there).
import { TOOL_BUTTONS } from './render.js';

export const ACTION_CONFIRM = 'confirm';
export const ACTION_PAUSE = 'pause';
export const ACTION_RESTART = 'restart';

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  let clickTarget = null;
  let clickTool = null;

  function code(e) {
    return e.code;
  }

  function onKeyDown(e) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!e.repeat) pressed.add(e.code);
    keys.add(e.code);
  }
  function onKeyUp(e) {
    keys.delete(e.code);
  }
  function onClick(e) {
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 1280;
    const y = ((e.clientY - rect.top) / rect.height) * 720;
    for (const b of TOOL_BUTTONS) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        clickTool = b.name;
        return;
      }
    }
    if (y > 64) clickTarget = { x, y };
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('click', onClick);

  function moveVector() {
    let mx = 0;
    let my = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) my -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) my += 1;
    return { mx, my };
  }

  /** Consume one-shot actions pressed since the last call. */
  function takeActions() {
    const actions = new Set();
    if (pressed.has('Enter') || pressed.has('Space')) actions.add(ACTION_CONFIRM);
    if (pressed.has('KeyP') || pressed.has('Escape')) actions.add(ACTION_PAUSE);
    if (pressed.has('KeyR')) actions.add(ACTION_RESTART);
    let tool = null;
    if (pressed.has('Digit1')) tool = 'smoke';
    else if (pressed.has('Digit2')) tool = 'emp';
    else if (pressed.has('Digit3')) tool = 'coin';
    pressed.clear();
    if (clickTool) { tool = clickTool; clickTool = null; }
    return { actions, tool };
  }

  function takeClickTarget() {
    const t = clickTarget;
    clickTarget = null;
    return t;
  }

  return { moveVector, takeActions, takeClickTarget };
}
