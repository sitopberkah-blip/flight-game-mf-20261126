// The island of Meridian: a procedural heightmap, a pre-rendered map canvas
// the renderer draws each frame, and the height query the flight model uses
// to decide whether the plane is still flying.

import { WORLD, RUNWAY, COLOURS } from './config.js';
import { makeFbm, makeRng } from './random.js';

const MAP_PIXELS = 1400; // the pre-rendered island is this many pixels square
const SCALE = MAP_PIXELS / WORLD.size; // world units per map pixel

// Flatten the ground on the runway strip itself, ramping back up smoothly
// over 160 world units outside it, so landings are possible there.
function runwayFlatten(x, y) {
  const dx = Math.max(0, Math.abs(x - RUNWAY.x) - RUNWAY.width / 2);
  const dy = Math.max(0, Math.abs(y - RUNWAY.y) - RUNWAY.length / 2);
  const d = Math.hypot(dx, dy);
  if (d >= 260) return 1;
  const t = d / 260;
  return t * t * (3 - 2 * t);
}

export function createTerrain(seed = 20261126) {
  const fbm = makeFbm(seed, 4);
  const fieldNoise = makeFbm(seed + 77, 3);
  const forestNoise = makeFbm(seed + 131, 3);

  /** Terrain height in feet at a world point; 0 is sea level. */
  function heightAt(x, y) {
    const dx = x - WORLD.islandCentreX;
    const dy = y - WORLD.islandCentreY;
    const dist = Math.hypot(dx, dy) / WORLD.islandRadius;
    if (dist >= 1) return 0;
    const coast = Math.pow(1 - dist * dist, 0.7);
    const bumps = fbm(x / 900 + 3.1, y / 900 + 7.7);
    let height = coast * (0.25 + 0.75 * bumps) * WORLD.maxHill;
    // A ridge of hills across the middle of the island.
    const ridge = Math.exp(-Math.pow((y - 2900) / 420, 2)) * Math.exp(-Math.pow((x - 3300) / 900, 2));
    height += ridge * 260 * (0.5 + bumps);
    // A flat southern plain for the airfield, and a valley up the middle so
    // the takeoff path climbs gently instead of into a hillside.
    const south = smoothstep(3600, 4700, y);
    height *= 1 - 0.85 * south;
    const valleyShape = smoothstep(1400, 2000, y) * (1 - smoothstep(4300, 4800, y));
    const valley = Math.exp(-Math.pow((x - 3000) / 380, 2)) * valleyShape;
    height *= 1 - 0.8 * valley;
    // The runway strip itself stays at sea level (height 0) so the plane can
    // roll and land on it, but the apron around it never drops to sea level:
    // flattened land that read as water painted a blue halo around the strip.
    // The floor ramps with the flatten factor, so there is no wall of earth
    // at the strip's edge for a low-flying plane to clip.
    const flat = runwayFlatten(x, y);
    let ground = height * flat;
    if (dist < 0.98 && flat > 0) ground = Math.max(ground, 10 * flat);
    return Math.max(0, ground);
  }

  /** True when a world point is open sea (outside the island). */
  function isSea(x, y) {
    const dx = x - WORLD.islandCentreX;
    const dy = y - WORLD.islandCentreY;
    return Math.hypot(dx, dy) >= WORLD.islandRadius;
  }

  function smoothstep(a, b, v) {
    const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }

  function colourAt(x, y, height) {
    if (height <= 2) return COLOURS.seaDeep;
    if (height <= 26) return COLOURS.sand;
    if (height <= 90) return fieldNoise(x / 500, y / 500) > 0.62 ? COLOURS.field : COLOURS.grass;
    if (height <= 300) return forestNoise(x / 420, y / 420) > 0.55 ? COLOURS.forest : COLOURS.grass;
    if (height <= 560) return COLOURS.hill;
    return COLOURS.rock;
  }

  // Pre-render the whole island once: sea, beaches, fields, forests, hills,
  // the runway strip and its markings, a lighthouse and a little harbour town.
  const map = document.createElement('canvas');
  map.width = MAP_PIXELS;
  map.height = MAP_PIXELS;
  const ctx = map.getContext('2d');
  const image = ctx.createImageData(MAP_PIXELS, MAP_PIXELS);
  const data = image.data;
  for (let py = 0; py < MAP_PIXELS; py += 1) {
    for (let px = 0; px < MAP_PIXELS; px += 1) {
      const wx = (px + 0.5) / SCALE;
      const wy = (py + 0.5) / SCALE;
      const h = heightAt(wx, wy);
      // Shallow water near the shore.
      let colour = colourAt(wx, wy, h);
      if (h <= 2) {
        const dx = wx - WORLD.islandCentreX;
        const dy = wy - WORLD.islandCentreY;
        const dist = Math.hypot(dx, dy) / WORLD.islandRadius;
        colour = dist > 0.86 ? COLOURS.seaShallow : COLOURS.seaDeep;
      }
      const i = (py * MAP_PIXELS + px) * 4;
      data[i] = parseInt(colour.slice(1, 3), 16);
      data[i + 1] = parseInt(colour.slice(3, 5), 16);
      data[i + 2] = parseInt(colour.slice(5, 7), 16);
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);

  // Soft coastline: lighten the sand edge where land meets sea.
  ctx.strokeStyle = 'rgba(255, 250, 230, 0.55)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  const rng = makeRng(seed + 9);
  for (let a = 0; a < Math.PI * 2; a += 0.05) {
    const r = WORLD.islandRadius * (0.97 + (fbm(Math.cos(a) * 2 + 5, Math.sin(a) * 2 + 5) - 0.5) * 0.1);
    const px = (WORLD.islandCentreX + Math.cos(a) * r) * SCALE;
    const py = (WORLD.islandCentreY + Math.sin(a) * r) * SCALE;
    if (a === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();

  drawRunway(ctx);
  drawTown(ctx, rng);

  // Clouds drift above the map; each has a world position and a parallax
  // factor below 1, so they slide slower than the ground.
  const clouds = [];
  const cloudRng = makeRng(seed + 41);
  for (let i = 0; i < 26; i += 1) {
    clouds.push({
      x: cloudRng() * WORLD.size,
      y: cloudRng() * WORLD.size,
      r: 90 + cloudRng() * 170,
      speed: 6 + cloudRng() * 10,
      shade: 0.82 + cloudRng() * 0.18,
    });
  }

  return { map, heightAt, isSea, clouds, scale: SCALE };
}

function drawRunway(ctx) {
  const s = MAP_PIXELS / WORLD.size;
  const cx = RUNWAY.x * s;
  const cy = RUNWAY.y * s;
  const w = RUNWAY.width * s;
  const len = RUNWAY.length * s;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = COLOURS.runway;
  ctx.fillRect(-w / 2, -len / 2, w, len);
  ctx.fillStyle = COLOURS.runwayMark;
  // Centre dashed line.
  for (let y = -len / 2 + 8; y < len / 2 - 8; y += 22) {
    ctx.fillRect(-1.5, y, 3, 12);
  }
  // Threshold bars at both ends.
  ctx.fillRect(-w / 2 + 3, -len / 2 + 6, w - 6, 4);
  ctx.fillRect(-w / 2 + 3, len / 2 - 10, w - 6, 4);
  // The big "07" painted at the north end.
  ctx.font = `bold ${Math.round(w * 0.55)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('07', 0, -len / 2 + 42);
  ctx.restore();
}

function drawTown(ctx, rng) {
  const s = MAP_PIXELS / WORLD.size;
  // Harbour town on the west bay: a cluster of small roofs and a lighthouse.
  const tx = 1560 * s;
  const ty = 2980 * s;
  ctx.fillStyle = '#b8c4cc';
  ctx.beginPath();
  ctx.arc(tx, ty, 46 * s, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 26; i += 1) {
    const x = tx + (rng() - 0.5) * 78 * s;
    const y = ty + (rng() - 0.5) * 78 * s;
    ctx.fillStyle = ['#c96f4a', '#d9a05b', '#8a9ba8', '#b5524f'][i % 4];
    ctx.fillRect(x, y, 7 * s, 5 * s);
  }
  // The lighthouse, south of the town on its own rock.
  const lx = 1380 * s;
  const ly = 3480 * s;
  ctx.fillStyle = '#e8e8e8';
  ctx.fillRect(lx - 3 * s, ly - 14 * s, 6 * s, 14 * s);
  ctx.fillStyle = '#d23b3b';
  ctx.fillRect(lx - 3 * s, ly - 14 * s, 6 * s, 4 * s);
  ctx.fillStyle = '#ffd23e';
  ctx.beginPath();
  ctx.arc(lx, ly - 15 * s, 2.5 * s, 0, Math.PI * 2);
  ctx.fill();
}

/** True when a world point lies inside the runway strip. */
export function onRunway(x, y) {
  return Math.abs(x - RUNWAY.x) <= RUNWAY.width / 2 && Math.abs(y - RUNWAY.y) <= RUNWAY.length / 2;
}

/** Distance from a world point to the runway centre line, for landing hints. */
export function runwayOffset(x, y) {
  return Math.hypot(x - RUNWAY.x, y - RUNWAY.y);
}
