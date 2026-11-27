// The renderer: a pseudo-3D chase view of Meridian island. One job: turn
// the world the other modules describe into the picture — sky and sun,
// a projected terrain mesh with the coast, fields and peaks, the runway
// and town laid over it, rings and pickups standing in the air, and the
// plane framed low in the picture, banking as she turns.
//
// The camera sits behind and above the plane and rolls part-way with her,
// so the world leans in a turn the way it does from a real cockpit rail.

import { WORLD } from './config.js';
import { clamp, lerp } from './random.js';
import { drawPlane } from './plane.js';
import { currentRing } from './missions.js';
import { drawRain } from './effects.js';

export const WEATHERS = {
  calm: { skyTop: '#5f9fd8', skyMid: '#9cc8ec', skyLow: '#dceefb', fog: '#cfe4f4', sun: '#fff3c4', sunAz: 4.05, sunEl: 0.62, ambient: 1 },
  breeze: { skyTop: '#4f93d4', skyMid: '#8ab9e6', skyLow: '#d3e7f7', fog: '#c2d9ee', sun: '#fff0bc', sunAz: 4.05, sunEl: 0.55, ambient: 0.97 },
  storm: { skyTop: '#39434f', skyMid: '#5b6874', skyLow: '#8b98a2', fog: '#7e8b94', sun: '#cfd6da', sunAz: 4.4, sunEl: 0.3, ambient: 0.72 },
};

function hexRgb(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}
function mixHex(a, b, t) {
  const ca = hexRgb(a);
  const cb = hexRgb(b);
  return `rgb(${Math.round(lerp(ca[0], cb[0], t))},${Math.round(lerp(ca[1], cb[1], t))},${Math.round(lerp(ca[2], cb[2], t))})`;
}

/**
 * Build the camera for this frame. In flight it chases the plane; on the
 * title screen it orbits the parked plane on Runway 07.
 */
export function makeView(state) {
  const { plane, screen, time } = state;
  const focal = state.h * 0.92;
  if (screen === 'title' || screen === 'brief') {
    const runway = state.terrain.runway;
    const a = time * 0.07;
    const cx = runway.x + Math.cos(a) * 620;
    const cy = runway.y + Math.sin(a) * 620;
    return {
      x: cx, y: cy, alt: 150,
      heading: Math.atan2(runway.x - cx, -(runway.y - cy)),
      pitch: -0.06, roll: 0, focal, cx: state.w / 2, cy: state.h / 2,
    };
  }
  const back = 58;
  const up = 17;
  return {
    x: plane.x - Math.sin(plane.heading) * back,
    y: plane.y + Math.cos(plane.heading) * back,
    alt: plane.alt + up,
    heading: plane.heading,
    pitch: plane.pitch * 0.55 - 0.045,
    roll: plane.bank * 0.52,
    focal, cx: state.w / 2, cy: state.h * 0.46,
  };
}

/** Project a world point; returns null when it falls behind the camera. */
export function project(view, wx, wy, wz) {
  const dx = wx - view.x;
  const dy = wy - view.y;
  const dz = wz - view.alt;
  const sinH = Math.sin(view.heading);
  const cosH = Math.cos(view.heading);
  // Camera axes: forward (sinH, -cosH), right (cosH, sinH), up is alt.
  let right = dx * cosH + dy * sinH;
  let fwd = dx * sinH - dy * cosH;
  let up = dz;
  // Pitch the view (positive pitch looks up).
  const cp = Math.cos(view.pitch);
  const sp = Math.sin(view.pitch);
  const fwd2 = fwd * cp + up * sp;
  const up2 = up * cp - fwd * sp;
  fwd = fwd2;
  up = up2;
  // Roll the view around the forward axis.
  if (view.roll) {
    const cr = Math.cos(view.roll);
    const sr = Math.sin(view.roll);
    const r2 = right * cr - up * sr;
    const u2 = right * sr + up * cr;
    right = r2;
    up = u2;
  }
  if (fwd < 5) return null;
  const scale = view.focal / fwd;
  return { x: view.cx + right * scale, y: view.cy - up * scale, depth: fwd, scale };
}

function drawSky(ctx, state, view, wx) {
  const g = ctx.createLinearGradient(0, 0, 0, state.h);
  g.addColorStop(0, wx.skyTop);
  g.addColorStop(0.45, wx.skyMid);
  g.addColorStop(0.72, wx.skyLow);
  g.addColorStop(1, wx.fog);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, state.w, state.h);

  // The sun: a disc and glow where the world's sun actually sits.
  const sunDir = { x: Math.sin(wx.sunAz), y: -Math.cos(wx.sunAz) };
  const sunWorld = { x: view.x + sunDir.x * 9000, y: view.y + sunDir.y * 9000 };
  const horizonAlt = view.alt + Math.tan(wx.sunEl) * 9000 * 0.16;
  const sun = project(view, sunWorld.x, sunWorld.y, horizonAlt + 1400);
  if (sun) {
    const r = state.h * (state.weather === 'storm' ? 0.05 : 0.075);
    const glow = ctx.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, r * 4.2);
    glow.addColorStop(0, 'rgba(255,244,200,0.85)');
    glow.addColorStop(0.25, 'rgba(255,240,190,0.35)');
    glow.addColorStop(1, 'rgba(255,240,190,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sun.x - r * 4.2, sun.y - r * 4.2, r * 8.4, r * 8.4);
    ctx.fillStyle = wx.sun;
    ctx.beginPath();
    ctx.arc(sun.x, sun.y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Far ridge silhouettes on the horizon, two parallax layers.
  for (const layer of [0, 1]) {
    const baseY = view.cy + state.h * (layer ? 0.045 : 0.02);
    const amp = state.h * (layer ? 0.035 : 0.06);
    ctx.fillStyle = layer ? 'rgba(96,120,140,0.5)' : 'rgba(120,142,160,0.38)';
    ctx.beginPath();
    ctx.moveTo(0, state.h);
    for (let sx = 0; sx <= state.w; sx += 16) {
      const bearing = view.heading + (sx - view.cx) / view.focal + layer * 2.4;
      const n = Math.sin(bearing * 5.1 + layer * 9) * 0.5 + Math.sin(bearing * 11.7 + layer * 4) * 0.3 + Math.sin(bearing * 23.3) * 0.2;
      ctx.lineTo(sx, baseY - Math.abs(n) * amp - layer * 6);
    }
    ctx.lineTo(state.w, state.h);
    ctx.closePath();
    ctx.fill();
  }
}

const ROWS = [10, 17, 28, 45, 70, 105, 155, 225, 320, 450, 620, 850, 1150, 1550, 2080, 2780, 3680, 4600];

function drawTerrain(ctx, state, view, wx) {
  const terrain = state.terrain;
  const cols = 22;
  // Sample the mesh in camera space: rows of growing depth, columns that
  // spread with distance, so detail is dense at the wheels and cheap far off.
  const grid = ROWS.map((depth) => {
    const row = [];
    for (let c = 0; c <= cols; c += 1) {
      const lat = (c / cols - 0.5) * 2 * depth * 1.25;
      const wx2 = view.x + Math.sin(view.heading) * depth + Math.cos(view.heading) * lat;
      const wy2 = view.y - Math.cos(view.heading) * depth + Math.sin(view.heading) * lat;
      const h = terrain.groundHeight(wx2, wy2);
      row.push({ wx: wx2, wy: wy2, h, p: project(view, wx2, wy2, Math.max(h, 0)) });
    }
    return row;
  });
  for (let r = ROWS.length - 2; r >= 0; r -= 1) {
    for (let c = 0; c < cols; c += 1) {
      const a = grid[r][c];
      const b = grid[r][c + 1];
      const a2 = grid[r + 1][c];
      const b2 = grid[r + 1][c + 1];
      if (!a.p || !b.p || !a2.p || !b2.p) continue;
      const hMid = (a.h + b.h + a2.h + b2.h) / 4;
      const fogT = clamp(a.p.depth / WORLD.viewDistance, 0, 1);
      let colour = terrain.groundColour(a.wx, a.wy, hMid);
      // Gentle hill shading: higher ground catches the light.
      const shade = clamp(0.82 + hMid / 900, 0.82, 1.13);
      ctx.fillStyle = mixHex(colour, wx.fog, fogT * 0.85);
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.moveTo(a2.p.x, a2.p.y);
      ctx.lineTo(b2.p.x, b2.p.y);
      ctx.lineTo(b.p.x, b.p.y);
      ctx.lineTo(a.p.x, a.p.y);
      ctx.closePath();
      ctx.fill();
      if (shade !== 1 && hMid > 2) {
        ctx.fillStyle = shade > 1 ? `rgba(255,250,230,${(shade - 1) * 0.55})` : `rgba(20,30,50,${(1 - shade) * 0.4})`;
        ctx.fill();
      }
    }
  }
  ctx.globalAlpha = 1;
}

function groundQuad(ctx, view, corners, fill) {
  const pts = corners.map(([x, y, z]) => project(view, x, y, z));
  if (pts.some((p) => !p)) return false;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fill();
  return true;
}

function drawRunway(ctx, state, view) {
  const rw = state.terrain.runway;
  const sin = Math.sin(rw.heading);
  const cos = Math.cos(rw.heading);
  const corner = (along, across) => [
    rw.x + sin * along + cos * across,
    rw.y - cos * along + sin * across,
    rw.elevation + 0.4,
  ];
  const L = rw.length / 2;
  const W = rw.width / 2;
  groundQuad(ctx, view, [corner(-L, -W), corner(-L, W), corner(L, W), corner(L, -W)], '#43434a');
  groundQuad(ctx, view, [corner(-L, -W - 9), corner(-L, -W), corner(L, -W), corner(L, -W - 9)], '#7d8f57');
  groundQuad(ctx, view, [corner(-L, W), corner(-L, W + 9), corner(L, W + 9), corner(L, W)], '#7d8f57');
  // Threshold bars and centreline dashes.
  for (let i = 0; i < 4; i += 1) {
    const off = -W + 6 + i * ((W * 2 - 12) / 3);
    groundQuad(ctx, view, [corner(-L + 12, off - 2.4), corner(-L + 12, off + 2.4), corner(-L + 64, off + 2.4), corner(-L + 64, off - 2.4)], '#e8e8e4');
  }
  for (let d = -L + 110; d < L - 40; d += 78) {
    groundQuad(ctx, view, [corner(d, -1.6), corner(d, 1.6), corner(d + 34, 1.6), corner(d + 34, -1.6)], 'rgba(240,240,235,0.85)');
  }
  // Approach lights: a row of bright dots running out from the threshold.
  for (let i = 1; i <= 7; i += 1) {
    const p = project(view, rw.x - sin * (L + i * 90), rw.y + cos * (L + i * 90), rw.elevation + 2);
    if (!p) continue;
    const r = clamp(p.scale * 3.4, 1, 5);
    ctx.fillStyle = i % 2 ? '#ffd76a' : '#ffffff';
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTown(ctx, state, view, wx) {
  const items = [];
  for (const b of state.terrain.buildings) {
    const base = state.terrain.groundHeight(b.x, b.y);
    const p = project(view, b.x, b.y, base);
    if (p && p.depth < 2600) items.push({ b, base, depth: p.depth });
  }
  items.sort((a, b) => b.depth - a.depth);
  for (const { b, base } of items) {
    const hw = b.w / 2;
    const hd = b.d / 2;
    const top = base + b.h;
    // Two visible faces and the roof, shaded apart so the blocks read solid.
    groundQuad(ctx, view, [[b.x - hw, b.y + hd, base], [b.x + hw, b.y + hd, base], [b.x + hw, b.y + hd, top], [b.x - hw, b.y + hd, top]], mixHex(b.colour, '#000000', 0.18));
    groundQuad(ctx, view, [[b.x + hw, b.y - hd, base], [b.x + hw, b.y + hd, base], [b.x + hw, b.y + hd, top], [b.x + hw, b.y - hd, top]], mixHex(b.colour, '#000000', 0.3));
    groundQuad(ctx, view, [[b.x - hw, b.y - hd, top], [b.x + hw, b.y - hd, top], [b.x + hw, b.y + hd, top], [b.x - hw, b.y + hd, top]], b.roof);
  }
  // Lighthouse: white and red bands with a lamp that shows in the murk.
  const lh = state.terrain.lighthouse;
  const lhBase = Math.max(state.terrain.groundHeight(lh.x, lh.y), 0);
  for (let i = 0; i < 4; i += 1) {
    const z0 = lhBase + (lh.h / 4) * i;
    const z1 = lhBase + (lh.h / 4) * (i + 1);
    const r = 7 - i * 0.9;
    groundQuad(ctx, view, [[lh.x - r, lh.y, z0], [lh.x + r, lh.y, z0], [lh.x + r, lh.y, z1], [lh.x - r, lh.y, z1]], i % 2 ? '#c8433a' : '#e9e4da');
  }
  const lamp = project(view, lh.x, lh.y, lhBase + lh.h + 3);
  if (lamp && state.weather === 'storm') {
    ctx.fillStyle = 'rgba(255,230,150,0.9)';
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, clamp(lamp.scale * 5, 1.5, 6), 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTurbinesAndBoats(ctx, state, view, time) {
  for (const t of state.terrain.turbines) {
    const base = state.terrain.groundHeight(t.x, t.y);
    const hub = project(view, t.x, t.y, base + t.mast);
    const foot = project(view, t.x, t.y, base);
    if (!hub || !foot || hub.depth > 2400) continue;
    ctx.strokeStyle = 'rgba(235,238,240,0.92)';
    ctx.lineWidth = clamp(hub.scale * 2.4, 1, 4);
    ctx.beginPath();
    ctx.moveTo(foot.x, foot.y);
    ctx.lineTo(hub.x, hub.y);
    ctx.stroke();
    const blade = t.rotor * hub.scale;
    ctx.lineWidth = clamp(hub.scale * 1.7, 1, 3);
    for (let i = 0; i < 3; i += 1) {
      const a = t.phase + time * 0.9 + (i * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.moveTo(hub.x, hub.y);
      ctx.lineTo(hub.x + Math.cos(a) * blade, hub.y + Math.sin(a) * blade * 0.92);
      ctx.stroke();
    }
  }
  for (const boat of state.terrain.boats) {
    const p = project(view, boat.x, boat.y, 1);
    if (!p || p.depth > 2600) continue;
    const s = boat.size * p.scale;
    if (s < 2) continue;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.sin(boat.heading) * 0.4);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, s * 0.32, s * 1.5, s * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = boat.colour;
    ctx.beginPath();
    ctx.moveTo(-s, 0);
    ctx.lineTo(s, 0);
    ctx.lineTo(s * 0.6, -s * 0.42);
    ctx.lineTo(-s * 0.6, -s * 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f0ead9';
    ctx.fillRect(-s * 0.2, -s * 0.85, s * 0.4, s * 0.45);
    ctx.restore();
  }
}

function drawClouds(ctx, state, view, layer) {
  const items = [];
  for (const c of state.terrain.clouds) {
    const p = project(view, c.x, c.y, c.alt);
    if (p && p.depth < 5200) items.push({ c, p });
  }
  items.sort((a, b) => b.p.depth - a.p.depth);
  for (const { c, p } of items) {
    const above = c.alt > view.alt + 30;
    if ((layer === 'above') !== above) continue;
    const r = c.r * p.scale;
    if (r < 6 || p.x < -r * 2 || p.x > state.w + r * 2) continue;
    const shade = state.weather === 'storm' ? 0.52 : c.shade;
    ctx.fillStyle = `rgba(${Math.round(250 * shade)},${Math.round(252 * shade)},${Math.round(255 * shade)},0.82)`;
    for (const [ox, oy, orr] of [[0, 0, 1], [-0.55, 0.1, 0.66], [0.55, 0.08, 0.7], [-0.2, -0.16, 0.6], [0.28, -0.13, 0.55]]) {
      ctx.beginPath();
      ctx.ellipse(p.x + ox * r, p.y + oy * r * 0.5, orr * r, orr * r * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (state.weather === 'storm') {
      ctx.fillStyle = 'rgba(40,46,54,0.35)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + r * 0.2, r * 0.95, r * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function ringFrame(active, index) {
  // A ring stands across the line of the course: from the previous
  // waypoint (or the runway) through this ring to the next.
  const rings = active.rings;
  const cur = rings[index];
  const prev = index > 0 ? rings[index - 1] : { x: 6746, y: 9897, alt: 60 }; // the takeoff start
  const dx = cur.x - prev.x;
  const dy = cur.y - prev.y;
  const len = Math.hypot(dx, dy) || 1;
  return { nx: dx / len, ny: dy / len }; // course direction in plan view
}

function drawRings(ctx, state, view, time) {
  const active = state.missions.active;
  if (!active) return;
  const target = currentRing(active);
  active.rings.forEach((r, i) => {
    if (r.taken) return;
    const isTarget = r === target;
    const { nx, ny } = ringFrame(active, i);
    // The ring plane is spanned by world-up and the plan-right of course.
    const rx = -ny;
    const ry = nx;
    const pts = [];
    for (let k = 0; k <= 20; k += 1) {
      const a = (k / 20) * Math.PI * 2;
      const px = r.x + rx * Math.cos(a) * r.r;
      const py = r.y + ry * Math.cos(a) * r.r;
      const pz = r.alt + Math.sin(a) * r.r;
      pts.push(project(view, px, py, pz));
    }
    if (pts.some((p) => !p)) return;
    const centre = project(view, r.x, r.y, r.alt);
    if (!centre || centre.depth > 4300) return;
    // Beacon of light on the next ring, so it can be found across the island.
    if (isTarget) {
      const top = project(view, r.x, r.y, r.alt + 900);
      const bot = project(view, r.x, r.y, 0);
      if (top && bot) {
        const grad = ctx.createLinearGradient(0, top.y, 0, bot.y);
        grad.addColorStop(0, 'rgba(255,205,64,0)');
        grad.addColorStop(1, 'rgba(255,205,64,0.20)');
        ctx.fillStyle = grad;
        const wBeam = clamp(centre.scale * r.r * 0.5, 2, 26);
        ctx.fillRect(centre.x - wBeam / 2, top.y, wBeam, bot.y - top.y);
      }
    }
    const pulse = isTarget ? 1 + Math.sin(time * 4.2) * 0.05 : 1;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.shadowColor = isTarget ? 'rgba(255,190,40,0.9)' : 'rgba(140,220,255,0.55)';
    ctx.shadowBlur = isTarget ? 16 : 7;
    ctx.strokeStyle = isTarget ? '#ffd23e' : 'rgba(170,225,255,0.75)';
    ctx.lineWidth = clamp(centre.scale * 7 * pulse, 2, 9);
    ctx.beginPath();
    pts.forEach((p, k) => (k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = isTarget ? 'rgba(255,210,62,0.14)' : 'rgba(170,225,255,0.07)';
    ctx.fill();
    // The ring's number, readable as you line up on it.
    ctx.font = `800 ${clamp(centre.scale * r.r * 0.9, 10, 44)}px 'Segoe UI', system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(20,26,34,0.55)';
    const label = String(i + 1);
    ctx.strokeText(label, centre.x, centre.y);
    ctx.fillStyle = isTarget ? '#ffe98a' : 'rgba(220,240,255,0.85)';
    ctx.fillText(label, centre.x, centre.y);
    ctx.restore();
  });
}

const PICKUP_STYLE = {
  fuel: { body: '#3f9e4d', cap: '#2c7038', label: 'FUEL', text: '#eaffea' },
  repair: { body: '#e8e6df', cap: '#c8433a', label: '+', text: '#c8433a' },
  star: { body: '#f2b63c', cap: '#d99a26', label: '★', text: '#fff6da' },
};

function drawPickupsAndBalloons(ctx, state, view, time) {
  const active = state.missions.active;
  if (!active) return;
  const items = [];
  for (const p of active.pickups) if (!p.taken) items.push({ kind: 'pickup', o: p });
  for (const b of active.balloons) if (!b.popped) items.push({ kind: 'balloon', o: b });
  const drawn = items.map((it) => ({ ...it, p: project(view, it.o.x, it.o.y, it.o.alt + (it.kind === 'pickup' ? Math.sin(time * 1.7 + it.o.x) * 7 : Math.sin(time * 0.9 + it.o.y) * 10)) }));
  drawn.sort((a, b) => (b.p ? b.p.depth : 0) - (a.p ? a.p.depth : 0));
  for (const { kind, o, p } of drawn) {
    if (!p || p.depth > 3600) continue;
    if (kind === 'balloon') {
      const r = o.r * p.scale;
      if (r < 3) continue;
      const grad = ctx.createLinearGradient(p.x - r, p.y - r, p.x + r, p.y + r);
      grad.addColorStop(0, '#e86a4e');
      grad.addColorStop(0.5, '#d94f43');
      grad.addColorStop(1, '#b03a30');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y - r * 0.4, r * 0.82, r, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,235,210,0.85)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y - r * 0.4, r * 0.3, r * 0.96, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(60,40,30,0.8)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(p.x - r * 0.3, p.y + r * 0.5);
      ctx.lineTo(p.x - r * 0.16, p.y + r * 0.95);
      ctx.moveTo(p.x + r * 0.3, p.y + r * 0.5);
      ctx.lineTo(p.x + r * 0.16, p.y + r * 0.95);
      ctx.stroke();
      ctx.fillStyle = '#7a5230';
      ctx.fillRect(p.x - r * 0.18, p.y + r * 0.95, r * 0.36, r * 0.3);
    } else {
      const st = PICKUP_STYLE[o.kind];
      const s = clamp(30 * p.scale, 4, 44);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 6;
      if (o.kind === 'star') {
        ctx.fillStyle = st.body;
        ctx.beginPath();
        for (let i = 0; i < 10; i += 1) {
          const a = -Math.PI / 2 + (i * Math.PI) / 5 + time * 0.8;
          const rr = i % 2 ? s * 0.48 : s;
          ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr);
        }
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = st.body;
        ctx.beginPath();
        ctx.roundRect(-s * 0.62, -s * 0.72, s * 1.24, s * 1.44, s * 0.18);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = st.cap;
        ctx.fillRect(-s * 0.62, -s * 0.72, s * 1.24, s * 0.3);
        ctx.font = `800 ${o.kind === 'repair' ? s * 0.95 : s * 0.42}px 'Segoe UI', system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = st.text;
        ctx.fillText(st.label, 0, s * 0.12);
      }
      ctx.restore();
    }
  }
}

function drawParticles(ctx, state, view) {
  for (const p of state.effects.particles) {
    const pr = project(view, p.x, p.y, p.alt);
    if (!pr) continue;
    const lifeT = clamp(p.life / p.maxLife, 0, 1);
    const r = clamp(p.size * pr.scale * (1.6 - lifeT * 0.6), 0.8, 26);
    ctx.fillStyle = `rgba(${p.colour},${(lifeT * 0.75).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(pr.x, pr.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlaneShadow(ctx, state, view) {
  const plane = state.plane;
  const g = Math.max(state.terrain.groundHeight(plane.x, plane.y), 0);
  const p = project(view, plane.x, plane.y, g + 1);
  if (!p) return;
  const heightAbove = plane.alt - g;
  const s = clamp(46 * p.scale, 3, 60) * clamp(1.25 - heightAbove / 900, 0.35, 1.2);
  ctx.fillStyle = `rgba(15,25,20,${clamp(0.42 - heightAbove / 1600, 0.06, 0.42)})`;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, s, s * 0.34, -plane.bank * 0.3, 0, Math.PI * 2);
  ctx.fill();
}

/** Draw the whole world for this frame. The HUD rides on top, in hud.js. */
export function render(ctx, state) {
  const wx = WEATHERS[state.weather] || WEATHERS.calm;
  const view = makeView(state);
  const time = state.time;
  ctx.save();
  drawSky(ctx, state, view, wx);
  drawClouds(ctx, state, view, 'above'); // the deck above the camera
  drawTerrain(ctx, state, view, wx);
  drawRunway(ctx, state, view);
  drawTown(ctx, state, view, wx);
  drawTurbinesAndBoats(ctx, state, view, time);
  drawPlaneShadow(ctx, state, view);
  drawRings(ctx, state, view, time);
  drawPickupsAndBalloons(ctx, state, view, time);
  drawParticles(ctx, state, view);
  drawClouds(ctx, state, view, 'below'); // clouds below the camera drift past the wings

  // The plane herself. In flight she sits in the chase frame; on the menu
  // screens she is drawn where she stands in the world, parked on the
  // strip while the camera orbits her.
  if (state.screen === 'title' || state.screen === 'brief') {
    const p = project(view, state.plane.x, state.plane.y, state.plane.alt + 4);
    if (p) drawPlane(ctx, state.plane, p.x, p.y, clamp(95 * p.scale, 18, 120), time);
  } else {
    const px = state.w / 2 + Math.sin(state.plane.bank) * state.w * 0.03;
    const py = state.h * 0.66 + Math.sin(time * 2.1) * (state.plane.airborne ? 2.2 : 0);
    const size = Math.min(state.w, state.h) * 0.36;
    drawPlane(ctx, state.plane, px, py, size, time);
    // Speed streaks at the frame edges when she is really moving.
    if (state.plane.speed > 62) {
      ctx.strokeStyle = 'rgba(255,255,255,0.20)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 7; i += 1) {
        const y = ((i * 197 + Math.floor(time * 900)) % 100) / 100 * state.h;
        const x = i % 2 ? state.w - ((time * 1400 + i * 260) % 300) : (time * 1400 + i * 260) % 300;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (i % 2 ? 46 : -46), y);
        ctx.stroke();
      }
    }
  }
  ctx.restore();

  if (state.weather === 'storm') {
    drawRain(ctx, state.effects, state.w, state.h);
    if (state.effects.flash > 0.02) {
      ctx.fillStyle = `rgba(235,240,255,${(state.effects.flash * 0.5).toFixed(3)})`;
      ctx.fillRect(0, 0, state.w, state.h);
    }
  }
  // A soft vignette seats the picture.
  const vg = ctx.createRadialGradient(state.w / 2, state.h / 2, Math.min(state.w, state.h) * 0.42, state.w / 2, state.h / 2, Math.max(state.w, state.h) * 0.78);
  vg.addColorStop(0, 'rgba(8,14,22,0)');
  vg.addColorStop(1, 'rgba(8,14,22,0.28)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, state.w, state.h);
}
