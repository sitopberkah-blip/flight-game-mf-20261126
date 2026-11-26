// The renderer: sky, the island turning beneath the plane, clouds, rings,
// the plane itself, the HUD and the title / pause / end screens. The plane
// always sits near the centre of the screen pointing up; the world rotates
// around it so the nose is the direction of travel.

import { COLOURS, RINGS, RUNWAY, WORLD, SCREENS } from './config.js';
import { drawPlane } from './plane.js';
import { drawHud } from './hud.js';
import { currentTarget, currentMission, isFinalApproach } from './missions.js';

function skyGradient(ctx, w, h, alt) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  const high = Math.min(1, alt / 4000);
  g.addColorStop(0, mix(COLOURS.skyTop, '#5aa7d6', high));
  g.addColorStop(0.55, mix(COLOURS.skyMid, '#8ec8e8', high));
  g.addColorStop(1, mix(COLOURS.skyLow, '#cfe8f2', high));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function mix(a, b, t) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function zoomFor(alt) {
  // Higher means a wider view of the island.
  return 0.62 - Math.min(0.3, alt / 9000);
}

/** Rotate a world offset into screen space for the current heading. */
function toScreen(dx, dy, heading, zoom) {
  const theta = -Math.PI / 2 - heading;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  return { x: (dx * cos - dy * sin) * zoom, y: (dx * sin + dy * cos) * zoom };
}

function drawRings(ctx, plane, missions, time) {
  const mission = currentMission(missions);
  if (!mission) return;
  const zoom = zoomFor(plane.alt);
  mission.rings.forEach((ring, index) => {
    const passed = index < missions.ringIndex;
    const isNext = index === missions.ringIndex;
    const s = toScreen(ring.x - plane.x, ring.y - plane.y, plane.heading, zoom);
    const cx = ctx.canvas.width / 2 + s.x;
    const cy = ctx.canvas.height / 2 + s.y;
    const r = RINGS.radius * zoom;
    if (cx < -r - 80 || cx > ctx.canvas.width + r + 80 || cy < -r - 80 || cy > ctx.canvas.height + r + 80) return;
    const colour = passed ? COLOURS.ringDone : ring.refuel ? COLOURS.ringRefuel : COLOURS.ring;
    ctx.save();
    ctx.globalAlpha = passed ? 0.35 : 1;
    // The beacon: a soft column of light so the ring is visible from afar.
    if (isNext) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 3);
      const grad = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 3.2);
      grad.addColorStop(0, colour + '44');
      grad.addColorStop(1, colour + '00');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 4 + pulse * 2;
    } else {
      ctx.lineWidth = 3;
    }
    ctx.strokeStyle = colour;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.globalAlpha *= 0.6;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.72, 0, Math.PI * 2);
    ctx.stroke();
    // The number of the ring, floating in its centre.
    if (!passed) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = colour;
      ctx.font = '700 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(index + 1), cx, cy);
    }
    ctx.restore();
  });
}

function drawClouds(ctx, plane, terrain, dt) {
  const zoom = zoomFor(plane.alt);
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  for (const cloud of terrain.clouds) {
    cloud.x += cloud.speed * dt;
    if (cloud.x > WORLD.size + 400) cloud.x = -400;
    // Parallax: clouds slide at a little over half the ground's speed.
    const s = toScreen((cloud.x - plane.x) * 0.55, (cloud.y - plane.y) * 0.55, plane.heading, zoom);
    const cx = w / 2 + s.x;
    const cy = h / 2 + s.y;
    const r = cloud.r * zoom * 0.8;
    if (cx < -r * 2 || cx > w + r * 2 || cy < -r * 2 || cy > h + r * 2) continue;
    ctx.save();
    ctx.globalAlpha = 0.55 * cloud.shade;
    ctx.fillStyle = '#ffffff';
    // Three separate puffs, each its own fill, so the cloud has no seams.
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.55, cy + r * 0.08, r * 0.6, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + r * 0.55, cy + r * 0.06, r * 0.65, r * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawTargetArrow(ctx, plane, missions) {
  const target = currentTarget(missions);
  if (!target) return;
  const zoom = zoomFor(plane.alt);
  const s = toScreen(target.x - plane.x, target.y - plane.y, plane.heading, zoom);
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const cx = w / 2 + s.x;
  const cy = h / 2 + s.y;
  const margin = 70;
  if (cx > margin && cx < w - margin && cy > margin && cy < h - margin) return;
  const angle = Math.atan2(cy - h / 2, cx - w / 2);
  const ax = w / 2 + Math.cos(angle) * (Math.min(w, h) / 2 - 90);
  const ay = h / 2 + Math.sin(angle) * (Math.min(w, h) / 2 - 90);
  const dist = Math.round(Math.hypot(target.x - plane.x, target.y - plane.y) * 3.2);
  ctx.save();
  ctx.translate(ax, ay);
  ctx.rotate(angle);
  ctx.fillStyle = target.kind === 'runway' ? '#7ec3e8' : COLOURS.ring;
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(-10, -11);
  ctx.lineTo(-5, 0);
  ctx.lineTo(-10, 11);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // The distance label sits beside the arrow, never over the mission line.
  ctx.fillStyle = COLOURS.hudText;
  ctx.font = '700 12px system-ui, sans-serif';
  const label = target.kind === 'runway' ? 'RUNWAY ' + dist + ' ft' : 'RING ' + dist + ' ft';
  if (ax > w * 0.6) {
    ctx.textAlign = 'right';
    ctx.fillText(label, ax - 26, ay + 4);
  } else {
    ctx.textAlign = 'left';
    ctx.fillText(label, ax + 26, ay + 4);
  }
}

function drawVignette(ctx, w, h) {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.72);
  g.addColorStop(0, 'rgba(10, 30, 50, 0)');
  g.addColorStop(1, 'rgba(10, 30, 50, 0.28)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function overlayPanel(ctx, w, h, lines, title) {
  ctx.fillStyle = 'rgba(8, 20, 32, 0.55)';
  ctx.fillRect(0, 0, w, h);
  const pw = Math.min(560, w - 48);
  const ph = 92 + lines.length * 30;
  const px = (w - pw) / 2;
  const py = (h - ph) / 2;
  ctx.fillStyle = 'rgba(12, 28, 44, 0.92)';
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(234, 246, 255, 0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = COLOURS.hudText;
  ctx.font = '800 30px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, w / 2, py + 48);
  ctx.font = '400 15px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(234, 246, 255, 0.85)';
  lines.forEach((line, i) => {
    ctx.fillText(line, w / 2, py + 86 + i * 30);
  });
  return { px, py, pw, ph };
}

function drawTitle(ctx, w, h) {
  ctx.fillStyle = 'rgba(8, 20, 32, 0.45)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 58px system-ui, sans-serif';
  ctx.shadowColor = 'rgba(10, 30, 50, 0.8)';
  ctx.shadowBlur = 18;
  ctx.fillText('MERIDIAN RINGS', w / 2, h * 0.3);
  ctx.shadowBlur = 0;
  ctx.font = '400 19px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillText('A little prop plane, a big island, and rings in the sky.', w / 2, h * 0.3 + 34);
  ctx.fillText('Thread the rings, watch your fuel, and bring her home to runway 07.', w / 2, h * 0.3 + 60);

  // Controls, in a small panel of their own below the title.
  const lines = [
    'ARROWS / WASD — pitch and turn      SHIFT / CTRL — throttle up / down',
    'SPACE — airbrake      MOUSE — hold and drag to steer      P — pause      M — mute',
    'Green rings refuel. Land slow and gentle on the runway to finish.',
  ];
  const pw = Math.min(620, w - 48);
  const ph = 34 + lines.length * 30;
  const px = (w - pw) / 2;
  const py = h * 0.3 + 84;
  ctx.fillStyle = 'rgba(12, 28, 44, 0.78)';
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, 12);
  ctx.fill();
  ctx.fillStyle = 'rgba(234, 246, 255, 0.92)';
  ctx.font = (w < 700 ? '400 13px' : '400 15px') + ' system-ui, sans-serif';
  lines.forEach((line, i) => {
    ctx.fillText(line, w / 2, py + 32 + i * 30);
  });
  ctx.fillStyle = COLOURS.hudAmber;
  ctx.font = '700 20px system-ui, sans-serif';
  ctx.fillText('Press ENTER to fly', w / 2, py + ph + 44);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '400 13px system-ui, sans-serif';
  ctx.fillText('Three sorties: Ring Run · Coast Patrol · Home Run', w / 2, py + ph + 70);
}

function drawEndScreen(ctx, w, h, plane, missions, landed, bonuses) {
  const mission = currentMission(missions);
  const title = landed ? 'WELCOME HOME' : 'DOWN SHE GOES';
  const lines = landed
    ? [
        `All three sorties flown. Rings threaded: ${missions.ringsPassed} (${missions.perfects} perfect).`,
        `Time ${formatClock(missions.elapsed)}  ·  time bonus +${bonuses.timeBonus}  ·  fuel bonus +${bonuses.fuelBonus}`,
        `Final score: ${missions.score}`,
        'Press R to fly again',
      ]
    : [
        plane.crashReason || 'The sortie ended early.',
        `Rings threaded: ${missions.ringsPassed}  ·  Score: ${missions.score}`,
        'Press R to try again',
      ];
  overlayPanel(ctx, w, h, lines, title);
  void mission;
}

function formatClock(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

export function render(ctx, state, time, dt) {
  const { w, h } = state;
  const { plane, missions, terrain, screen } = state;
  ctx.clearRect(0, 0, w, h);
  skyGradient(ctx, w, h, plane.alt);

  // The world, rotated so the plane's heading is up the screen.
  const zoom = zoomFor(plane.alt);
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-Math.PI / 2 - plane.heading);
  ctx.translate(-plane.x * zoom, -plane.y * zoom);
  ctx.drawImage(terrain.map, 0, 0, WORLD.size * zoom, WORLD.size * zoom);
  ctx.restore();

  drawClouds(ctx, plane, terrain, dt);
  drawRings(ctx, plane, missions, time);
  drawPlane(ctx, w / 2, h / 2, plane, time);
  drawTargetArrow(ctx, plane, missions);
  drawVignette(ctx, w, h);

  if (screen === SCREENS.PLAY || screen === SCREENS.PAUSED) {
    // The HUD clock is the mission clock, so flash messages expire on the
    // same clock they were set on (including in staged screenshot scenes).
    drawHud(ctx, w, h, plane, missions, missions.elapsed);
  }
  if (screen === SCREENS.TITLE) drawTitle(ctx, w, h);
  if (screen === SCREENS.PAUSED) {
    overlayPanel(ctx, w, h, ['P — resume', 'R — restart the sortie', 'M — mute'], 'PAUSED');
  }
  if (screen === SCREENS.LANDED) drawEndScreen(ctx, w, h, plane, missions, true, state.bonuses);
  if (screen === SCREENS.CRASHED) drawEndScreen(ctx, w, h, plane, missions, false, state.bonuses);
}
