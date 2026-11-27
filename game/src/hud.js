// The cockpit and the screens. One job: everything drawn on the glass —
// a panel of round, lit instruments across the bottom (airspeed,
// altimeter, artificial horizon, compass, vertical speed, fuel, hull and
// throttle), the mission bar and target arrow up top, and the title,
// briefing, pause and end-of-sortie screens.

import { toFeet, toKnots, toFpm, SCREENS } from './config.js';
import { clamp, wrapAngle } from './random.js';
import { currentRing, allRingsTaken, MISSION_DEFS } from './missions.js';
import { makeView, project } from './render.js';
import { drawTexts } from './effects.js';

const FONT = "'Segoe UI', system-ui, -apple-system, sans-serif";
const PANEL = 'rgba(13,20,29,0.88)';
const PANEL_EDGE = 'rgba(120,160,200,0.35)';
const INK = '#eaf3fb';
const DIM = '#9db8cc';
const AMBER = '#ffb84d';
const RED = '#ff5a4d';
const GREEN = '#59e08a';
const GOLD = '#ffd23e';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function dialFace(ctx, cx, cy, r, label) {
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.15, cx, cy, r);
  g.addColorStop(0, '#2b3d50');
  g.addColorStop(0.8, '#16222f');
  g.addColorStop(1, '#0b141f');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(160,195,230,0.5)';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  if (label) {
    ctx.fillStyle = DIM;
    ctx.font = `700 ${Math.max(8, r * 0.21)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(label, cx, cy + r * 0.68);
  }
}

function needle(ctx, cx, cy, r, angle, colour = '#f5f8fb') {
  ctx.strokeStyle = colour;
  ctx.lineWidth = Math.max(2, r * 0.07);
  ctx.beginPath();
  ctx.moveTo(cx - Math.cos(angle) * r * 0.18, cy - Math.sin(angle) * r * 0.18);
  ctx.lineTo(cx + Math.cos(angle) * r * 0.82, cy + Math.sin(angle) * r * 0.82);
  ctx.stroke();
  ctx.fillStyle = '#d7e4f0';
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.1, 0, Math.PI * 2);
  ctx.fill();
}

/** Airspeed indicator: 0–160 kt with a green arc and a red line. */
export function drawAirspeedDial(ctx, cx, cy, r, knots) {
  dialFace(ctx, cx, cy, r, null);
  const a0 = Math.PI * 0.75;
  const sweep = Math.PI * 1.5;
  ctx.strokeStyle = GREEN;
  ctx.lineWidth = r * 0.09;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.86, a0 + sweep * (45 / 160), a0 + sweep * (120 / 160));
  ctx.stroke();
  ctx.strokeStyle = RED;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.86, a0 + sweep * (138 / 160), a0 + sweep * (142 / 160));
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.font = `600 ${Math.max(7, r * 0.19)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let v = 0; v <= 160; v += 20) {
    const a = a0 + sweep * (v / 160);
    ctx.fillText(String(v), cx + Math.cos(a) * r * 0.62, cy + Math.sin(a) * r * 0.62);
  }
  needle(ctx, cx, cy, r, a0 + sweep * clamp(knots / 160, 0, 1));
  ctx.fillStyle = DIM;
  ctx.font = `600 ${Math.max(7, r * 0.17)}px ${FONT}`;
  ctx.fillText('KT', cx, cy - r * 0.32);
  // Digital drum at the bottom of the dial, like the altimeter's.
  ctx.fillStyle = '#0b141f';
  ctx.fillRect(cx - r * 0.34, cy + r * 0.3, r * 0.68, r * 0.3);
  ctx.strokeStyle = PANEL_EDGE;
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - r * 0.34, cy + r * 0.3, r * 0.68, r * 0.3);
  ctx.fillStyle = INK;
  ctx.font = `800 ${Math.max(9, r * 0.27)}px ${FONT}`;
  ctx.fillText(String(Math.round(knots)), cx, cy + r * 0.46);
}

/** Altimeter: a hundreds needle, a thousands needle and a digital drum. */
export function drawAltimeter(ctx, cx, cy, r, feet) {
  dialFace(ctx, cx, cy, r, null);
  ctx.fillStyle = INK;
  ctx.font = `600 ${Math.max(7, r * 0.19)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let v = 0; v < 10; v += 1) {
    const a = -Math.PI / 2 + (v / 10) * Math.PI * 2;
    ctx.fillText(String(v), cx + Math.cos(a) * r * 0.66, cy + Math.sin(a) * r * 0.66);
  }
  const hundreds = ((feet % 1000) / 1000) * Math.PI * 2 - Math.PI / 2;
  const thousands = ((feet % 10000) / 10000) * Math.PI * 2 - Math.PI / 2;
  ctx.strokeStyle = '#ffd23e';
  ctx.lineWidth = Math.max(1.6, r * 0.05);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(thousands) * r * 0.5, cy + Math.sin(thousands) * r * 0.5);
  ctx.stroke();
  needle(ctx, cx, cy, r, hundreds);
  ctx.fillStyle = '#0b141f';
  ctx.fillRect(cx - r * 0.42, cy + r * 0.3, r * 0.84, r * 0.3);
  ctx.strokeStyle = PANEL_EDGE;
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - r * 0.42, cy + r * 0.3, r * 0.84, r * 0.3);
  ctx.fillStyle = INK;
  ctx.font = `800 ${Math.max(9, r * 0.27)}px ${FONT}`;
  ctx.fillText(`${String(Math.max(0, Math.round(feet))).padStart(4, '0')} FT`, cx, cy + r * 0.46);
}

/** Artificial horizon: the ball rolls and pitches with the plane. */
export function drawArtificialHorizon(ctx, cx, cy, r, plane) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(-plane.bank);
  const pitchPx = clamp(plane.pitch, -0.5, 0.5) * r * 1.5;
  ctx.fillStyle = '#3f7fbf';
  ctx.fillRect(-r, -r + pitchPx, r * 2, r * 2);
  ctx.fillStyle = '#8a6a48';
  ctx.fillRect(-r, pitchPx, r * 2, r * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1.4;
  for (const off of [-0.5, -0.25, 0.25, 0.5]) {
    const y = pitchPx + off * r * 1.5;
    ctx.beginPath();
    ctx.moveTo(-r * 0.3, y);
    ctx.lineTo(r * 0.3, y);
    ctx.stroke();
  }
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r, pitchPx);
  ctx.lineTo(r, pitchPx);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = 'rgba(160,195,230,0.5)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  // The fixed aircraft symbol.
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = Math.max(2.4, r * 0.08);
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.55, cy);
  ctx.lineTo(cx - r * 0.18, cy);
  ctx.lineTo(cx - r * 0.18, cy + r * 0.14);
  ctx.moveTo(cx + r * 0.55, cy);
  ctx.lineTo(cx + r * 0.18, cy);
  ctx.lineTo(cx + r * 0.18, cy + r * 0.14);
  ctx.stroke();
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.05, 0, Math.PI * 2);
  ctx.fill();
}

/** Heading compass: a rotating card under a fixed lubber line. */
export function drawCompass(ctx, cx, cy, r, heading) {
  dialFace(ctx, cx, cy, r, 'HEADING');
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.92, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = INK;
  ctx.font = `700 ${Math.max(8, r * 0.26)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const points = [[0, 'N'], [45, 'NE'], [90, 'E'], [135, 'SE'], [180, 'S'], [225, 'SW'], [270, 'W'], [315, 'NW']];
  for (const [deg, label] of points) {
    const a = ((deg * Math.PI) / 180) - heading - Math.PI / 2;
    const x = cx + Math.cos(a) * r * 0.62;
    const y = cy + Math.sin(a) * r * 0.62;
    ctx.fillStyle = deg === 0 ? RED : INK;
    ctx.fillText(label, x, y);
  }
  for (let d = 0; d < 360; d += 15) {
    const a = ((d * Math.PI) / 180) - heading - Math.PI / 2;
    ctx.strokeStyle = 'rgba(230,240,250,0.6)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r * 0.8, cy + Math.sin(a) * r * 0.8);
    ctx.lineTo(cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.moveTo(cx - 6, cy - r - 2);
  ctx.lineTo(cx + 6, cy - r - 2);
  ctx.lineTo(cx, cy - r + 8);
  ctx.closePath();
  ctx.fill();
  const deg = Math.round(((heading * 180) / Math.PI + 360) % 360);
  ctx.fillStyle = INK;
  ctx.font = `800 ${Math.max(10, r * 0.3)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(`${String(deg).padStart(3, '0')}°`, cx, cy);
}

function barGauge(ctx, x, y, w, h, frac, colour, label, valueText, warn) {
  ctx.fillStyle = DIM;
  ctx.font = `700 ${Math.max(8, h * 0.52)}px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(label, x, y - 4);
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = warn ? RED : colour;
  if (frac > 0.01) {
    roundRect(ctx, x, y, Math.max(h, w * clamp(frac, 0, 1)), h, h / 2);
    ctx.fill();
  }
  ctx.fillStyle = INK;
  ctx.font = `800 ${Math.max(9, h * 0.62)}px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText(valueText, x + w, y - 4);
}

function lamp(ctx, x, y, w, h, on, colour, label) {
  ctx.fillStyle = on ? colour : 'rgba(255,255,255,0.10)';
  roundRect(ctx, x, y, w, h, 4);
  ctx.fill();
  ctx.fillStyle = on ? '#10151c' : DIM;
  ctx.font = `800 ${Math.max(8, h * 0.52)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2 + 0.5);
}

/** The whole bottom panel: dials left and centre, bars and lamps right. */
export function drawPanel(ctx, state) {
  const { w, h, plane } = state;
  const panelH = clamp(h * 0.185, 104, 158);
  const y0 = h - panelH;
  ctx.fillStyle = PANEL;
  ctx.fillRect(0, y0, w, panelH);
  ctx.fillStyle = PANEL_EDGE;
  ctx.fillRect(0, y0, w, 1.5);
  const cy = y0 + panelH * 0.52;
  const r = Math.min(panelH * 0.4, w * (w < 700 ? 0.066 : 0.052));
  const gap = r * 2.35;
  let x = r + 18;
  drawAirspeedDial(ctx, x, cy, r, toKnots(plane.speed));
  x += gap;
  drawAltimeter(ctx, x, cy, r, toFeet(Math.max(0, plane.alt - 14)));
  x += gap;
  drawArtificialHorizon(ctx, x, cy, r, plane);
  x += gap;
  drawCompass(ctx, x, cy, r, plane.heading);

  // Right-hand stack: vertical speed readout, bars, lamps, throttle.
  const stackW = clamp(w * 0.21, 168, 250);
  const sx = w - stackW - 16;
  const fpm = Math.round(toFpm(plane.vspeed) / 10) * 10;
  ctx.fillStyle = DIM;
  ctx.font = `700 10px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText('VERTICAL SPEED', sx, y0 + 20);
  ctx.fillStyle = fpm < -900 ? RED : INK;
  ctx.font = `800 19px ${FONT}`;
  ctx.fillText(`${fpm > 0 ? '+' : ''}${fpm} FT/MIN`, sx, y0 + 42);
  const barW = stackW - 8;
  const barH = 11;
  barGauge(ctx, sx, y0 + 62, barW, barH, plane.fuel / 100, '#59e08a', 'FUEL', `${Math.round(plane.fuel)}%`, plane.fuel < 25);
  barGauge(ctx, sx, y0 + 62 + 30, barW, barH, plane.hull / 100, '#e0a44a', 'HULL', `${Math.round(plane.hull)}%`, plane.hull < 35);
  const lampW = (barW - 12) / 3;
  const lampY = y0 + 62 + 58;
  lamp(ctx, sx, lampY, lampW, 17, plane.stalled, RED, 'STALL');
  lamp(ctx, sx + lampW + 6, lampY, lampW, 17, plane.fuel < 25, AMBER, 'LOW FUEL');
  lamp(ctx, sx + (lampW + 6) * 2, lampY, lampW, 17, plane.gearDown, GREEN, 'GEAR ▼');

  // Throttle quadrant along the panel's left-of-stack edge — skipped on
  // touch devices, where the big rail on the right does this job.
  if (!state.touch.active) {
    const tx = sx - 34;
    ctx.fillStyle = DIM;
    ctx.font = `700 9px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('THR', tx + 9, y0 + 20);
    ctx.fillStyle = 'rgba(255,255,255,0.13)';
    roundRect(ctx, tx, y0 + 26, 18, panelH - 40, 6);
    ctx.fill();
    ctx.fillStyle = '#7ec3e8';
    const th = (panelH - 40) * plane.throttle;
    roundRect(ctx, tx, y0 + 26 + (panelH - 40) - th, 18, th, 6);
    ctx.fill();
  }
}

/** Mission bar across the top, plus score, combo and clock. */
export function drawMissionBar(ctx, state) {
  const { w, plane } = state;
  const active = state.missions.active;
  ctx.fillStyle = 'rgba(13,20,29,0.66)';
  roundRect(ctx, 12, 10, clamp(w * 0.46, 250, 470), 54, 9);
  ctx.fill();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  if (active) {
    const done = allRingsTaken(active);
    ctx.fillStyle = INK;
    ctx.font = `800 15px ${FONT}`;
    ctx.fillText(`Sortie ${active.index + 1}: ${active.def.name}`, 24, 33);
    ctx.fillStyle = done ? GREEN : GOLD;
    ctx.font = `600 12.5px ${FONT}`;
    const label = done
      ? 'All rings flown — land on Runway 07 to finish'
      : `Ring ${Math.min(active.ringIndex + 1, active.rings.length)} of ${active.rings.length} — follow the gold beam`;
    ctx.fillText(label, 24, 53);
    // Ring pips.
    active.rings.forEach((r, i) => {
      ctx.fillStyle = r.taken ? GREEN : (i === active.ringIndex ? GOLD : 'rgba(255,255,255,0.3)');
      ctx.beginPath();
      ctx.arc(30 + i * 17, 74, 5, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  // Score block, top right.
  const bw = 196;
  ctx.fillStyle = 'rgba(13,20,29,0.66)';
  roundRect(ctx, w - bw - 12, 10, bw, 54, 9);
  ctx.fill();
  ctx.fillStyle = DIM;
  ctx.font = `700 10px ${FONT}`;
  ctx.fillText('SCORE', w - bw + 2, 28);
  ctx.fillStyle = INK;
  ctx.font = `800 21px ${FONT}`;
  ctx.fillText(String(active ? active.score : 0), w - bw + 2, 52);
  const mm = String(Math.floor((active ? active.elapsed : 0) / 60)).padStart(2, '0');
  const ss = String(Math.floor((active ? active.elapsed : 0) % 60)).padStart(2, '0');
  ctx.fillStyle = DIM;
  ctx.font = `700 10px ${FONT}`;
  ctx.fillText('TIME', w - 74, 28);
  ctx.fillStyle = INK;
  ctx.font = `800 17px ${FONT}`;
  ctx.fillText(`${mm}:${ss}`, w - 74, 52);
  // Combo badge under the score when the chain is alive.
  if (active && active.combo > 1) {
    const frac = clamp(active.comboTimer / 7, 0, 1);
    ctx.fillStyle = 'rgba(255,178,36,0.92)';
    roundRect(ctx, w - 108, 72, 96, 26, 13);
    ctx.fill();
    ctx.fillStyle = '#23180a';
    ctx.font = `800 15px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(`COMBO ×${active.combo}`, w - 60, 90);
    ctx.fillStyle = 'rgba(35,24,10,0.45)';
    ctx.fillRect(w - 108, 95, 96 * frac, 3);
    ctx.textAlign = 'left';
  }
  void plane;
}

/** An arrow and range readout guiding the pilot to the next ring. */
export function drawTargetArrow(ctx, state) {
  const active = state.missions.active;
  if (!active || state.screen !== SCREENS.PLAY) return;
  const target = currentRing(active);
  const view = makeView(state);
  let tx;
  let ty;
  let dist;
  let label;
  if (target) {
    const p = project(view, target.x, target.y, target.alt);
    dist = Math.hypot(target.x - state.plane.x, target.y - state.plane.y);
    label = `RING ${active.ringIndex + 1}`;
    if (p && p.x > 30 && p.x < state.w - 30 && p.y > 20 && p.y < state.h - 190) return; // on screen already
    if (p) { tx = p.x; ty = p.y; } else {
      const behind = Math.atan2(target.x - state.plane.x, -(target.y - state.plane.y));
      const rel = wrapAngle(behind - state.plane.heading);
      tx = state.w / 2 + Math.sin(rel) * state.w * 0.4;
      ty = state.h * 0.4 - Math.cos(rel) * state.h * 0.22;
    }
  } else {
    const rw = state.terrain.runway;
    const p = project(view, rw.x, rw.y, rw.elevation + 30);
    dist = Math.hypot(rw.x - state.plane.x, rw.y - state.plane.y);
    label = 'RUNWAY 07';
    if (p && p.x > 30 && p.x < state.w - 30 && p.y > 20 && p.y < state.h - 190) return;
    if (p) { tx = p.x; ty = p.y; } else {
      const behind = Math.atan2(rw.x - state.plane.x, -(rw.y - state.plane.y));
      const rel = wrapAngle(behind - state.plane.heading);
      tx = state.w / 2 + Math.sin(rel) * state.w * 0.4;
      ty = state.h * 0.4 - Math.cos(rel) * state.h * 0.22;
    }
  }
  tx = clamp(tx, 66, state.w - 66);
  ty = clamp(ty, 92, state.h - 210);
  const ang = Math.atan2(ty - state.h * 0.42, tx - state.w / 2);
  ctx.save();
  ctx.translate(tx, ty);
  ctx.rotate(ang + Math.PI / 2);
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.moveTo(0, -15);
  ctx.lineTo(10, 9);
  ctx.lineTo(0, 3);
  ctx.lineTo(-10, 9);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = INK;
  ctx.font = `800 12px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(`${label} · ${Math.round(dist)} m`, tx, ty + 30);
  ctx.textAlign = 'left';
}

// ---------- screens ----------

function centrePanel(ctx, state, w, h) {
  const x = (state.w - w) / 2;
  const y = (state.h - h) / 2;
  ctx.fillStyle = 'rgba(10,17,26,0.82)';
  roundRect(ctx, x, y, w, h, 14);
  ctx.fill();
  ctx.strokeStyle = PANEL_EDGE;
  ctx.lineWidth = 1.5;
  roundRect(ctx, x, y, w, h, 14);
  ctx.stroke();
  return { x, y };
}

export function drawTitleScreen(ctx, state) {
  const { w, h } = state;
  const grad = ctx.createLinearGradient(0, 0, 0, h * 0.6);
  grad.addColorStop(0, 'rgba(8,14,22,0.55)');
  grad.addColorStop(1, 'rgba(8,14,22,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h * 0.6);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 ${clamp(w * 0.062, 34, 74)}px ${FONT}`;
  ctx.fillText('MERIDIAN RINGS', w / 2, h * 0.16);
  ctx.fillStyle = GOLD;
  ctx.font = `700 ${clamp(w * 0.016, 12, 19)}px ${FONT}`;
  ctx.fillText('A CHASE-VIEW FLIGHT GAME · FIVE SORTIES OVER ONE ISLAND', w / 2, h * 0.16 + 34);
  ctx.fillStyle = 'rgba(230,242,252,0.92)';
  ctx.font = `600 ${clamp(w * 0.0135, 11, 16)}px ${FONT}`;
  ctx.fillText('Thread the gold rings, mind your fuel and hull, and bring her home to Runway 07.', w / 2, h * 0.16 + 62);

  // Mission select: five rows the mouse can click (hit rects on state.ui).
  const bw = clamp(w * 0.44, 320, 560);
  const bh = 47;
  const x0 = (w - bw) / 2;
  let y = h * 0.16 + 92;
  state.ui.missions = [];
  MISSION_DEFS.forEach((def, i) => {
    const done = state.missions.completed.has(i);
    const hover = state.ui.hoverMission === i;
    ctx.fillStyle = hover ? 'rgba(38,58,80,0.92)' : 'rgba(13,22,33,0.85)';
    roundRect(ctx, x0, y, bw, bh, 9);
    ctx.fill();
    ctx.strokeStyle = done ? GREEN : PANEL_EDGE;
    ctx.lineWidth = 1.2;
    roundRect(ctx, x0, y, bw, bh, 9);
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.fillStyle = GOLD;
    ctx.font = `800 16px ${FONT}`;
    ctx.fillText(`${i + 1}. ${def.name}`, x0 + 16, y + 21);
    ctx.fillStyle = DIM;
    ctx.font = `600 11.5px ${FONT}`;
    ctx.fillText(`${def.rings.length} rings · ${def.weather}${done ? ' · flown ✓' : ''}`, x0 + 16, y + 38);
    ctx.fillStyle = INK;
    ctx.font = `800 13px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText('FLY ▸', x0 + bw - 16, y + 30);
    ctx.textAlign = 'center';
    state.ui.missions.push({ x: x0, y, w: bw, h: bh, index: i });
    y += bh + 8;
  });
  ctx.fillStyle = 'rgba(220,236,250,0.85)';
  ctx.font = `600 12.5px ${FONT}`;
  ctx.fillText('Fly: mouse or arrow keys · Throttle: W / S · Gear: G · Brake: B · Pause: P · Sound: M', w / 2, y + 18);
  ctx.fillText('On a phone: left thumb steers, right thumb works the throttle.', w / 2, y + 38);
}

export function drawBriefing(ctx, state) {
  const active = state.missions.active;
  if (!active) return;
  const { x, y } = centrePanel(ctx, state, clamp(state.w * 0.52, 330, 600), 218);
  const w = clamp(state.w * 0.52, 330, 600);
  ctx.textAlign = 'center';
  ctx.fillStyle = GOLD;
  ctx.font = `800 13px ${FONT}`;
  ctx.fillText(`SORTIE ${active.index + 1} OF 5 · WEATHER: ${active.def.weather.toUpperCase()}`, state.w / 2, y + 38);
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 30px ${FONT}`;
  ctx.fillText(active.def.name, state.w / 2, y + 76);
  ctx.fillStyle = 'rgba(228,240,250,0.92)';
  ctx.font = `600 14.5px ${FONT}`;
  wrapText(ctx, active.def.brief, state.w / 2, y + 108, w - 64, 21);
  ctx.fillStyle = GREEN;
  ctx.font = `800 15px ${FONT}`;
  ctx.fillText('ENTER — throttle up and fly   ·   ESC — back to the menu', state.w / 2, y + 190);
  void x;
}

function wrapText(ctx, text, cx, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (ctx.measureText(trial).width > maxW && line) {
      ctx.fillText(line, cx, yy);
      line = word;
      yy += lineH;
    } else line = trial;
  }
  if (line) ctx.fillText(line, cx, yy);
  return yy;
}

export function drawPauseScreen(ctx, state) {
  ctx.fillStyle = 'rgba(8,13,20,0.55)';
  ctx.fillRect(0, 0, state.w, state.h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 40px ${FONT}`;
  ctx.fillText('PAUSED', state.w / 2, state.h * 0.42);
  ctx.fillStyle = 'rgba(228,240,250,0.9)';
  ctx.font = `600 15px ${FONT}`;
  ctx.fillText('P or Enter — resume   ·   R — restart the sortie   ·   Esc — menu', state.w / 2, state.h * 0.42 + 38);
}

export function drawEndScreen(ctx, state) {
  const active = state.missions.active;
  const done = state.screen === SCREENS.COMPLETE;
  const crashed = state.screen === SCREENS.CRASHED;
  const { y } = centrePanel(ctx, state, clamp(state.w * 0.5, 330, 560), crashed ? 190 : 252);
  ctx.textAlign = 'center';
  ctx.fillStyle = crashed ? RED : GREEN;
  ctx.font = `900 30px ${FONT}`;
  ctx.fillText(crashed ? 'CRASHED' : done ? 'SORTIE COMPLETE' : 'DOWN SAFELY', state.w / 2, y + 48);
  ctx.font = `600 14.5px ${FONT}`;
  ctx.fillStyle = 'rgba(228,240,250,0.94)';
  if (crashed) {
    wrapText(ctx, state.plane.crashReason || 'The sortie ended against the scenery.', state.w / 2, y + 82, 470, 21);
    ctx.fillStyle = GOLD;
    ctx.font = `800 15px ${FONT}`;
    ctx.fillText('R — fly her again   ·   ESC — menu', state.w / 2, y + 158);
    return;
  }
  const landing = state.landing;
  let yy = y + 84;
  ctx.fillStyle = 'rgba(228,240,250,0.94)';
  if (landing) {
    wrapText(ctx, landing.label, state.w / 2, yy, 470, 21);
    yy += 40;
    ctx.font = `700 14px ${FONT}`;
    ctx.fillText(`Landing bonus ${landing.landingBase ?? landing.total}   ·   Fuel saved +${landing.fuelBonus ?? 0}`, state.w / 2, yy);
    yy += 26;
  }
  ctx.fillStyle = INK;
  ctx.font = `800 19px ${FONT}`;
  ctx.fillText(`Sortie score: ${active ? active.score : 0}`, state.w / 2, yy + 6);
  ctx.fillStyle = DIM;
  ctx.font = `700 13px ${FONT}`;
  ctx.fillText(`Campaign total: ${state.missions.campaignScore}`, state.w / 2, yy + 32);
  ctx.fillStyle = GOLD;
  ctx.font = `800 15px ${FONT}`;
  const next = active && active.index + 1 < MISSION_DEFS.length && done;
  ctx.fillText(next ? 'ENTER — next sortie   ·   ESC — menu' : 'ENTER — fly again   ·   ESC — menu', state.w / 2, y + 224);
}

/** Touch controls: a stick on the left thumb, a throttle rail on the right. */
export function drawTouchControls(ctx, state) {
  const t = state.touch;
  if (!t || !t.active || state.screen !== SCREENS.PLAY) return;
  const { w, h } = state;
  // Stick well and knob.
  ctx.fillStyle = 'rgba(16,26,38,0.4)';
  ctx.beginPath();
  ctx.arc(t.stick.cx, t.stick.cy, 56, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(200,225,250,0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = 'rgba(220,238,252,0.75)';
  ctx.beginPath();
  ctx.arc(t.stick.cx + t.stick.dx * 34, t.stick.cy + t.stick.dy * 34, 24, 0, Math.PI * 2);
  ctx.fill();
  // Throttle rail.
  const railX = w - 52;
  const railTop = h * 0.3;
  const railH = h * 0.38;
  ctx.fillStyle = 'rgba(16,26,38,0.4)';
  roundRect(ctx, railX - 17, railTop, 34, railH, 12);
  ctx.fill();
  ctx.fillStyle = '#7ec3e8';
  const th = railH * state.plane.throttle;
  roundRect(ctx, railX - 17, railTop + railH - th, 34, th, 12);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.font = `800 10px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('THR', railX, railTop - 8);
  // Gear button.
  ctx.fillStyle = state.plane.gearDown ? 'rgba(46,120,72,0.75)' : 'rgba(140,60,50,0.75)';
  ctx.beginPath();
  ctx.arc(w - 52, h * 0.22, 21, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 11px ${FONT}`;
  ctx.fillText('GEAR', w - 52, h * 0.22 + 4);
  ctx.textAlign = 'left';
}

/** Master HUD entry: panel and bars in flight, screens over the world. */
export function drawHud(ctx, state) {
  const inFlight = [SCREENS.PLAY, SCREENS.PAUSED, SCREENS.COMPLETE, SCREENS.CRASHED, SCREENS.LANDED].includes(state.screen);
  if (inFlight) {
    drawMissionBar(ctx, state);
    drawTargetArrow(ctx, state);
    drawPanel(ctx, state);
    drawTouchControls(ctx, state);
  }
  if (state.screen === SCREENS.TITLE) drawTitleScreen(ctx, state);
  if (state.screen === SCREENS.BRIEF) drawBriefing(ctx, state);
  if (state.screen === SCREENS.PAUSED) drawPauseScreen(ctx, state);
  if ([SCREENS.COMPLETE, SCREENS.CRASHED, SCREENS.LANDED].includes(state.screen)) drawEndScreen(ctx, state);
  drawTexts(ctx, state.effects);
}
