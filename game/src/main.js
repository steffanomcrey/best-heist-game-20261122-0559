// Copper Fox: The Meridian Job — boot and the one loop. Input is read every frame,
// the world advances in fixed 1/60 s steps, and the renderer paints what is there.
// Screens: title, play, paused, caught, level-clear, win.
//
// ?seed=N fixes nothing random in this game (all motion is scripted patrols and
// sweeps), but ?shot=cover|tools|escape|title stages that scene instead of running
// the loop, paints it twice and sets window.__shotReady for a screenshot.
// ?shot=playtest plays all three levels with the autopilot and reports the result
// in window.__testResult.
import { BEST_KEY, STEP } from './config.js';
import { createWorld, EVENT_CAUGHT, EVENT_LASER, EVENT_LEVEL, EVENT_LOOT, EVENT_WIN, nextLevel, stepWorld } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createAudio } from './audio.js';
import {
  createRenderer, SCREEN_LEVEL, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY,
  SCREEN_TITLE, SCREEN_WIN,
} from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld();
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off: the best loot then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  if (scene.test) {
    window.__testResult = scene.test;
    document.title = `playtest: ${scene.test.status} level ${scene.test.level} loot $${scene.test.loot}`;
  }
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let clickTarget = null;
  let stepCount = 0;

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    const fresh = createWorld();
    world.levelIndex = fresh.levelIndex;
    world.state = fresh.state;
    world.time = 0;
    world.totalLoot = 0;
    world.levelLoot = 0;
    world.status = 'playing';
    world.levelTime = 0;
    world.runTime = 0;
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce('Playing. Grab every target, then reach the exit.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    audio.caught();
    audio.setAlarm(0);
    if (world.totalLoot > best) {
      best = world.totalLoot;
      saveBest(best);
    }
    announce(`Caught. Loot $${world.totalLoot}. Best $${best}.`);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const elapsed = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    const { actions, tool } = input.takeActions();
    const clicked = input.takeClickTarget();
    if (clicked) clickTarget = clicked;

    if (actions.has(ACTION_PAUSE) && (screen === SCREEN_PLAY || screen === SCREEN_PAUSED)) {
      screen = screen === SCREEN_PLAY ? SCREEN_PAUSED : SCREEN_PLAY;
      announce(screen === SCREEN_PAUSED ? 'Paused.' : 'Playing.');
    }
    if (actions.has(ACTION_RESTART) && (screen === SCREEN_OVER || screen === SCREEN_WIN)) startGame();
    if (actions.has(ACTION_CONFIRM)) {
      if (screen === SCREEN_TITLE) startGame();
      else if (screen === SCREEN_LEVEL) {
        nextLevel(world);
        screen = SCREEN_PLAY;
        audio.levelDone();
      }
    }

    if (screen === SCREEN_PLAY) {
      accumulator += elapsed;
      while (accumulator >= STEP) {
        accumulator -= STEP;
        stepCount += 1;
        const v = input.moveVector();
        let mx = v.mx;
        let my = v.my;
        if (mx === 0 && my === 0 && clickTarget) {
          const dx = clickTarget.x - world.state.player.x;
          const dy = clickTarget.y - world.state.player.y;
          if (Math.hypot(dx, dy) < 14) clickTarget = null;
          else {
            const len = Math.hypot(dx, dy);
            mx = dx / len;
            my = dy / len;
          }
        }
        const events = stepWorld(world, STEP, { mx, my, tool });
        if (stepCount % 20 === 0) audio.footstep();
        if (events & EVENT_LOOT) audio.pickup();
        if (events & EVENT_CAUGHT) endGame();
        else if (events & EVENT_LEVEL) {
          screen = SCREEN_LEVEL;
          audio.levelDone();
          announce(`${world.state.def.name} cleared.`);
        } else if (events & EVENT_WIN) {
          screen = SCREEN_WIN;
          audio.win();
          audio.setAlarm(0);
          if (world.totalLoot > best) { best = world.totalLoot; saveBest(best); }
          announce(`Job complete. Loot $${world.totalLoot}.`);
        }
        if (events & EVENT_LOOT || events & EVENT_LASER) audio.setAlarm(world.state.alarm / 100);
      }
      audio.setAlarm(world.state.alarm / 100);
    }
    renderer.draw(world, screen, best);
  }

  announce('Copper Fox: The Meridian Job. Press Enter to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
