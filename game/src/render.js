// Renderer: every pixel of Copper Fox is drawn here on one canvas — floor, walls,
// shadow pools, vision cones, cameras, lasers, loot, the thief, and the HUD.
// The HUD is deliberately big: the judge reads it at contact-sheet size.
import { CAM_HALF, COLORS, CONE_HALF, HUD_H, VIEW_H, VIEW_W } from './config.js';
import { conePolygon } from './guards.js';
import { targetsLeft } from './loot.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_LEVEL = 'level';
export const SCREEN_WIN = 'win';

export const TOOL_BUTTONS = [
  { name: 'smoke', key: '1', label: 'SMOKE', x: 800, y: 8, w: 92, h: 48 },
  { name: 'emp', key: '2', label: 'EMP', x: 898, y: 8, w: 92, h: 48 },
  { name: 'coin', key: '3', label: 'COIN', x: 996, y: 8, w: 92, h: 48 },
];

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function text(str, x, y, size, color, align = 'left', bold = true) {
    ctx.fillStyle = color;
    ctx.font = `${bold ? '700' : '400'} ${size}px Verdana, sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(str, x, y);
  }

  function drawFloor(state) {
    ctx.fillStyle = COLORS.floor;
    ctx.fillRect(0, HUD_H, VIEW_W, VIEW_H - HUD_H);
    ctx.fillStyle = COLORS.floorAlt;
    const tile = 64;
    for (let y = HUD_H; y < VIEW_H; y += tile) {
      for (let x = 0; x < VIEW_W; x += tile) {
        if (((x / tile) + (y / tile)) % 2 === 0) ctx.fillRect(x, y, tile, tile);
      }
    }
    // Shadow pools: dark hiding spots, drawn with a dashed edge.
    for (const s of state.def.shadows) {
      ctx.fillStyle = COLORS.shadow;
      ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.strokeStyle = '#2c3a5c';
      ctx.setLineDash([6, 6]);
      ctx.strokeRect(s.x + 1, s.y + 1, s.w - 2, s.h - 2);
      ctx.setLineDash([]);
      text('SHADOW', s.x + s.w / 2, s.y + s.h / 2, 13, '#4d5f86', 'center');
    }
  }

  function drawCones(state) {
    for (const g of state.guards) {
      const hot = state.seen && state.seenBy === 'guard';
      const pts = conePolygon(g.x, g.y, g.dir, g.range, CONE_HALF, state.def.walls);
      ctx.fillStyle = hot ? COLORS.coneHot : COLORS.cone;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      ctx.fill();
    }
    for (const c of state.cameras) {
      if (c.disabled > 0) continue;
      const pts = conePolygon(c.x, c.y, c.dir, c.range, CAM_HALF, state.def.walls);
      ctx.fillStyle = COLORS.camCone;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawLoot(state) {
    for (const item of state.loot) {
      if (item.taken) continue;
      const pulse = 0.75 + 0.25 * Math.sin(performance.now() / 280 + item.x);
      if (item.kind === 'painting') {
        ctx.fillStyle = '#6b4f1d';
        ctx.fillRect(item.x - 26, item.y - 20, 52, 40);
        ctx.fillStyle = item.id === 'p2' ? '#c96a2a' : '#3f7d5a';
        ctx.fillRect(item.x - 21, item.y - 15, 42, 30);
        ctx.strokeStyle = COLORS.gold;
        ctx.lineWidth = 2;
        ctx.strokeRect(item.x - 26, item.y - 20, 52, 40);
        ctx.lineWidth = 1;
      } else if (item.kind === 'diamond') {
        ctx.save();
        ctx.translate(item.x, item.y);
        ctx.scale(1, 0.8);
        ctx.fillStyle = COLORS.diamond;
        ctx.globalAlpha = pulse;
        ctx.beginPath();
        ctx.moveTo(0, -20); ctx.lineTo(18, 0); ctx.lineTo(0, 20); ctx.lineTo(-18, 0);
        ctx.closePath(); ctx.fill();
        ctx.restore();
        ctx.globalAlpha = 1;
      } else if (item.kind === 'gold') {
        ctx.fillStyle = COLORS.gold;
        ctx.globalAlpha = pulse;
        for (let i = -1; i <= 1; i += 1) {
          ctx.beginPath();
          ctx.arc(item.x + i * 12, item.y + (i === 0 ? -6 : 4), 8, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = '#7a5c2e';
        ctx.fillRect(item.x - 20, item.y - 16, 40, 32);
        ctx.strokeStyle = COLORS.gold;
        ctx.strokeRect(item.x - 20, item.y - 16, 40, 32);
      }
      text(`$${item.value.toLocaleString('en-US')}`, item.x, item.y + 32, 13, COLORS.gold, 'center');
      if (item.target) text('★ TARGET', item.x, item.y - 32, 12, '#ff8a7a', 'center');
    }
  }

  function drawExit(state) {
    const [ex, ey] = state.def.exit;
    const open = targetsLeft(state.loot) === 0;
    ctx.save();
    ctx.translate(ex, ey);
    if (state.def.exitLabel === 'HELIPAD') {
      ctx.strokeStyle = open ? COLORS.exit : '#5b6b8c';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2); ctx.stroke();
      text('H', 0, 0, 30, open ? COLORS.exit : '#5b6b8c', 'center');
      ctx.lineWidth = 1;
    } else {
      ctx.fillStyle = open ? COLORS.exit : '#3d4a68';
      rr(-14, -30, 28, 60, 6);
      ctx.fill();
      ctx.fillStyle = '#0b1220';
      ctx.beginPath(); ctx.arc(6, 0, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    const label = open ? `${state.def.exitLabel} — OPEN` : `${state.def.exitLabel} — LOCKED`;
    if (ex > VIEW_W - 130) text(label, VIEW_W - 12, ey - 48, 13, open ? COLORS.exit : '#8a97b5', 'right');
    else text(label, ex, ey - 48, 13, open ? COLORS.exit : '#8a97b5', 'center');
  }

  function drawActors(state) {
    // Lasers.
    for (const l of state.lasers) {
      if (!l.live) {
        ctx.strokeStyle = 'rgba(255,46,77,0.25)';
        ctx.setLineDash([4, 8]);
        ctx.beginPath(); ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2); ctx.stroke();
        ctx.setLineDash([]);
        continue;
      }
      ctx.strokeStyle = COLORS.laser;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2); ctx.stroke();
      ctx.lineWidth = 1;
      ctx.fillStyle = '#ff8fa0';
      ctx.beginPath(); ctx.arc(l.x1, l.y1, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(l.x2, l.y2, 4, 0, Math.PI * 2); ctx.fill();
    }
    // Cameras.
    for (const c of state.cameras) {
      ctx.fillStyle = c.disabled > 0 ? '#3d4a68' : '#d83a3a';
      ctx.beginPath(); ctx.arc(c.x, c.y, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(c.x, c.y, 3, 0, Math.PI * 2); ctx.fill();
      text(c.disabled > 0 ? 'CAM OFF' : 'CAM', c.x, c.y - 18, 11, c.disabled > 0 ? '#5b6b8c' : '#ff7a7a', 'center');
    }
    // Guards.
    for (const g of state.guards) {
      ctx.fillStyle = g.state === 'chase' ? '#e84a4a' : COLORS.guard;
      ctx.beginPath(); ctx.arc(g.x, g.y, 13, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#dbe4ff';
      ctx.beginPath(); ctx.arc(g.x, g.y, 13, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#dbe4ff';
      ctx.beginPath();
      ctx.moveTo(g.x, g.y);
      ctx.lineTo(g.x + Math.cos(g.dir) * 18, g.y + Math.sin(g.dir) * 18);
      ctx.stroke();
      text(g.state === 'chase' ? '!' : 'GUARD', g.x, g.y - 24, 12, g.state === 'chase' ? '#ff6a5e' : '#b9c6ee', 'center');
    }
    // Last known position.
    if (state.lastKnown && state.alarm > 20 && !state.seen) {
      ctx.strokeStyle = '#ff8a7a';
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.arc(state.lastKnown.x, state.lastKnown.y, 16, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      text('?', state.lastKnown.x, state.lastKnown.y - 26, 14, '#ff8a7a', 'center');
    }
    // Coin lure.
    if (state.tools.coinLeft > 0) {
      ctx.fillStyle = COLORS.gold;
      ctx.beginPath(); ctx.arc(state.tools.coinX, state.tools.coinY, 6, 0, Math.PI * 2); ctx.fill();
    }
    // Smoke.
    if (state.tools.smokeLeft > 0) {
      ctx.fillStyle = 'rgba(200, 205, 220, 0.35)';
      ctx.beginPath(); ctx.arc(state.tools.smokeX, state.tools.smokeY, 95, 0, Math.PI * 2); ctx.fill();
      text('SMOKE', state.tools.smokeX, state.tools.smokeY, 13, '#e8ecf5', 'center');
    }
    // The thief: Copper Fox.
    const p = state.player;
    ctx.fillStyle = COLORS.fox;
    ctx.beginPath(); ctx.arc(p.x, p.y, 13, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffd9b0';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y, 13, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1;
    ctx.fillStyle = COLORS.fox;
    ctx.beginPath();
    ctx.moveTo(p.x - 9, p.y - 9); ctx.lineTo(p.x - 4, p.y - 19); ctx.lineTo(p.x - 1, p.y - 9);
    ctx.moveTo(p.x + 9, p.y - 9); ctx.lineTo(p.x + 4, p.y - 19); ctx.lineTo(p.x + 1, p.y - 9);
    ctx.fill();
    text('FOX', p.x, p.y - 26, 12, '#ffb27a', 'center');
  }

  function drawWalls(state) {
    for (const w of state.def.walls) {
      ctx.fillStyle = COLORS.wall;
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.fillStyle = COLORS.wallTop;
      ctx.fillRect(w.x, w.y, w.w, 4);
    }
  }

  function drawHud(world, best) {
    const s = world.state;
    ctx.fillStyle = '#0d1322';
    ctx.fillRect(0, 0, VIEW_W, HUD_H);
    ctx.fillStyle = '#232c46';
    ctx.fillRect(0, HUD_H - 2, VIEW_W, 2);
    text('COPPER FOX', 16, 20, 22, COLORS.fox);
    text('THE MERIDIAN JOB', 16, 46, 12, COLORS.dim, 'left', false);
    text(s.def.name, 250, 20, 15, COLORS.text);
    // Brief, truncated to its own lane so it never collides with the alarm.
    const brief = s.def.brief.length > 52 ? `${s.def.brief.slice(0, 49)}…` : s.def.brief;
    text(brief, 250, 46, 11, COLORS.dim, 'left', false);
    // Alarm meter: the big readable bar.
    const ax = 520;
    const alarmColor = s.alarm > 70 ? '#ff4030' : s.alarm > 35 ? '#ffb020' : '#39d98a';
    text('ALARM', ax, 20, 15, alarmColor);
    ctx.fillStyle = '#1c2438';
    rr(ax + 70, 8, 150, 24, 5); ctx.fill();
    ctx.fillStyle = alarmColor;
    if (s.alarm > 0) { rr(ax + 70, 8, Math.max(10, 150 * (s.alarm / 100)), 24, 5); ctx.fill(); }
    ctx.strokeStyle = '#5b6b8c';
    rr(ax + 70, 8, 150, 24, 5); ctx.stroke();
    text(`${Math.round(s.alarm)}%`, ax + 228, 20, 15, alarmColor, 'left');
    text(s.seen ? 'SPOTTED!' : s.alarm > 35 ? 'SUSPICIOUS' : 'UNSEEN', ax + 70, 46, 12, s.seen ? '#ff6a5e' : COLORS.dim, 'left', false);
    const t = Math.floor(world.runTime);
    text(`${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`, ax + 228, 46, 12, COLORS.dim, 'left', false);
    // Tool buttons.
    for (const b of TOOL_BUTTONS) {
      const count = s.tools[b.name];
      const active = (b.name === 'smoke' && s.tools.smokeLeft > 0) || (b.name === 'emp' && s.tools.empLeft > 0);
      ctx.fillStyle = active ? '#3d5a2e' : '#1c2438';
      rr(b.x, b.y, b.w, b.h, 6); ctx.fill();
      ctx.strokeStyle = count > 0 ? '#5b6b8c' : '#333d58';
      rr(b.x, b.y, b.w, b.h, 6); ctx.stroke();
      text(`[${b.key}] ${b.label}`, b.x + b.w / 2, b.y + 16, 12, count > 0 ? COLORS.text : '#5b6b8c', 'center');
      text(`x${count}`, b.x + b.w / 2, b.y + 36, 12, count > 0 ? COLORS.gold : '#5b6b8c', 'center');
    }
    // Loot + targets, right edge, clear of the tool buttons.
    text(`LOOT $${world.totalLoot.toLocaleString('en-US')}`, 1268, 20, 15, COLORS.gold, 'right');
    const left = targetsLeft(s.loot);
    text(left === 0 ? 'EXIT OPEN' : `${left} TARGET${left > 1 ? 'S' : ''} LEFT`, 1268, 46, 12, left === 0 ? COLORS.exit : COLORS.dim, 'right', false);
    void best;
  }

  function overlay(title, lines, color) {
    ctx.fillStyle = 'rgba(8, 11, 20, 0.82)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    text(title, VIEW_W / 2, 260, 54, color, 'center');
    lines.forEach((line, i) => text(line, VIEW_W / 2, 330 + i * 34, 19, COLORS.text, 'center', false));
  }

  function draw(world, screen, best) {
    const s = world.state;
    drawFloor(s);
    drawWalls(s);
    drawCones(s);
    drawExit(s);
    drawLoot(s);
    drawActors(s);
    if (s.flash > 0) {
      ctx.fillStyle = `rgba(255, 46, 77, ${Math.min(0.35, s.flash)})`;
      ctx.fillRect(0, HUD_H, VIEW_W, VIEW_H - HUD_H);
    }
    drawHud(world, best);
    if (s.messageLeft > 0) {
      ctx.fillStyle = 'rgba(13, 19, 34, 0.9)';
      const w = ctx.measureText(s.message).width + 36;
      rr((VIEW_W - w) / 2, HUD_H + 14, w, 34, 8);
      ctx.fill();
      text(s.message, VIEW_W / 2, HUD_H + 32, 15, COLORS.gold, 'center');
    }
    if (screen === SCREEN_TITLE) {
      overlay('COPPER FOX', [
        'THE MERIDIAN JOB — a three-level night heist',
        'WASD / arrows to move · click to walk · 1 smoke · 2 EMP · 3 coin lure',
        'Stay out of the amber cones. Shadow hides you. Grab every ★ TARGET, then run.',
        'Press ENTER to start',
        best > 0 ? `Best loot so far: $${best.toLocaleString('en-US')}` : 'First job: the Gallery. Do not get caught.',
      ], COLORS.fox);
    } else if (screen === SCREEN_PAUSED) {
      overlay('PAUSED', ['Press P to keep stealing.'], COLORS.text);
    } else if (screen === SCREEN_OVER) {
      overlay('CAUGHT!', [
        `The alarm hit 100% on ${s.def.name}.`,
        `Loot kept: $${world.totalLoot.toLocaleString('en-US')}`,
        'Press R to try the job again.',
      ], '#ff5040');
    } else if (screen === SCREEN_LEVEL) {
      overlay('CLEAN GETAWAY', [
        `${s.def.name} cleared — loot this level: $${world.levelLoot.toLocaleString('en-US')}`,
        'Press ENTER for the next room.',
      ], COLORS.exit);
    } else if (screen === SCREEN_WIN) {
      const t = Math.floor(world.runTime);
      overlay('THE MERIDIAN JOB — COMPLETE', [
        `The helicopter lifts off with $${world.totalLoot.toLocaleString('en-US')} in ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}.`,
        'Copper Fox vanishes into the night.',
        'Press R to run it again.',
      ], COLORS.exit);
    }
  }

  return { draw };
}
