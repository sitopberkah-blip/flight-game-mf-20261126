// The HUD: the instruments a pilot actually flies by — altitude, airspeed,
// heading compass, throttle, fuel, score, the mission clock and the objective
// — drawn in screen space over the world.

import { COLOURS, RUNWAY } from './config.js';
import { currentMission, currentTarget, isFinalApproach } from './missions.js';

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = COLOURS.hudPanel;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(234, 246, 255, 0.18)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function label(ctx, x, y, text) {
  ctx.fillStyle = 'rgba(234, 246, 255, 0.65)';
  ctx.font = '600 10px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, x, y);
}

function value(ctx, x, y, text, colour) {
  ctx.fillStyle = colour || COLOURS.hudText;
  ctx.font = '700 22px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, x, y);
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function headingName(heading) {
  const deg = ((heading * 180 / Math.PI) % 360 + 360) % 360;
  const names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return names[Math.round(deg / 45) % 8];
}

function headingDegrees(heading) {
  return Math.round(((heading * 180 / Math.PI) % 360 + 360) % 360);
}

export function drawHud(ctx, w, h, plane, missions, now) {
  // --- Left: altitude, speed, vertical speed -------------------------------
  panel(ctx, 14, 14, 168, 92);
  label(ctx, 26, 32, 'ALTITUDE  FT');
  value(ctx, 26, 56, String(Math.round(plane.alt)), plane.alt < 120 && plane.airborne ? COLOURS.hudAmber : COLOURS.hudText);
  label(ctx, 108, 32, 'SPEED  KT');
  value(ctx, 108, 56, String(Math.round(plane.speed)));
  label(ctx, 26, 80, 'VERTICAL');
  ctx.fillStyle = plane.vspeed > 2 ? COLOURS.hudGreen : plane.vspeed < -8 ? COLOURS.hudRed : COLOURS.hudText;
  ctx.font = '700 15px system-ui, sans-serif';
  ctx.fillText((plane.vspeed >= 0 ? '+' : '') + Math.round(plane.vspeed) + ' ft/s', 26, 96);

  // --- Right: score, fuel, mission clock -----------------------------------
  panel(ctx, w - 182, 14, 168, 92);
  label(ctx, w - 170, 32, 'SCORE');
  value(ctx, w - 170, 56, String(missions.score));
  label(ctx, w - 92, 32, 'TIME');
  ctx.fillStyle = COLOURS.hudText;
  ctx.font = '700 22px system-ui, sans-serif';
  ctx.fillText(formatTime(missions.elapsed), w - 92, 56);
  label(ctx, w - 170, 80, 'FUEL');
  const fuelW = 144;
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(w - 170, 86, fuelW, 9);
  ctx.fillStyle = plane.fuel < 25 ? COLOURS.hudRed : plane.fuel < 50 ? COLOURS.hudAmber : COLOURS.hudGreen;
  ctx.fillRect(w - 170, 86, fuelW * (plane.fuel / 100), 9);
  if (plane.fuel < 25) {
    ctx.fillStyle = COLOURS.hudRed;
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.fillText('LOW FUEL', w - 170 + fuelW + 6, 95);
  }

  // --- Bottom centre: compass strip ----------------------------------------
  const compassW = 340;
  const cx = w / 2;
  panel(ctx, cx - compassW / 2, h - 52, compassW, 38);
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - compassW / 2, h - 52, compassW, 38);
  ctx.clip();
  const deg = headingDegrees(plane.heading);
  ctx.fillStyle = COLOURS.hudText;
  ctx.font = '700 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (let d = -180; d <= 180; d += 15) {
    const tickDeg = (deg + d + 360) % 360;
    const x = cx + (d / 180) * (compassW / 2 - 8);
    const major = tickDeg % 45 === 0;
    ctx.strokeStyle = 'rgba(234,246,255,0.5)';
    ctx.beginPath();
    ctx.moveTo(x, h - 38);
    ctx.lineTo(x, h - (major ? 28 : 33));
    ctx.stroke();
    if (major) {
      const names = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
      ctx.fillText(names[tickDeg] || String(tickDeg), x, h - 18);
    }
  }
  ctx.restore();
  // The lubber line.
  ctx.fillStyle = COLOURS.hudAmber;
  ctx.beginPath();
  ctx.moveTo(cx - 6, h - 52);
  ctx.lineTo(cx + 6, h - 52);
  ctx.lineTo(cx, h - 42);
  ctx.closePath();
  ctx.fill();

  // --- Bottom left: throttle ------------------------------------------------
  panel(ctx, 14, h - 52, 168, 38);
  label(ctx, 26, h - 34, 'THROTTLE');
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(96, h - 42, 72, 9);
  ctx.fillStyle = '#7ec3e8';
  ctx.fillRect(96, h - 42, 72 * plane.throttle, 9);

  // --- Mission line under the top bar --------------------------------------
  const mission = currentMission(missions);
  if (mission) {
    ctx.fillStyle = COLOURS.hudText;
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const target = currentTarget(missions);
    const kind = target ? target.kind : '';
    const left = kind === 'ring'
      ? `Mission ${missions.index + 1}: ${mission.name} — ring ${missions.ringIndex + 1} of ${mission.rings.length}`
      : isFinalApproach(missions)
        ? `Mission ${missions.index + 1}: ${mission.name} — land on runway 07`
        : `Mission ${missions.index + 1}: ${mission.name}`;
    ctx.fillText(left, w / 2, 128);
  }

  // --- Centre flash message --------------------------------------------------
  if (missions.message && now < missions.messageUntil) {
    ctx.font = '700 16px system-ui, sans-serif';
    const width = ctx.measureText(missions.message).width + 36;
    ctx.beginPath();
    ctx.roundRect(w / 2 - width / 2, h - 120, width, 34, 8);
    ctx.fill();
    ctx.fillStyle = COLOURS.hudText;
    ctx.textAlign = 'center';
    ctx.fillText(missions.message, w / 2, h - 97);
  }

  // --- Low-fuel warning ------------------------------------------------------
  if (plane.fuel < 25 && plane.airborne) {
    ctx.fillStyle = Math.sin(now * 6) > 0 ? COLOURS.hudRed : COLOURS.hudAmber;
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LOW FUEL — find a green ring', w / 2, 158);
  }
}
