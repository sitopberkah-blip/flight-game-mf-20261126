// The island of Meridian: a procedural heightmap, a pre-rendered map canvas
// the renderer draws each frame, and the height query the flight model uses
// to decide whether the plane is still flying.

import { WORLD, RUNWAY, COLOURS } from './config.js';
import { makeFbm, makeRng } from './random.js';

const MAP_PIXELS = 1400; // the pre-rendered island is this many pixels square
const SCALE = MAP_PIXELS / WORLD.size; // world units per map pixel

// Flatten the ground around the runway so landings are possible there.
function runwayFlatten(x, y) {
  const dx = Math.abs(x - RUNWAY.x);
  const dy = Math.abs(y - RUNWAY.y);
  const margin = 130;
  if (dx > RUNWAY.width / 2 + margin || dy > RUNWAY.length / 2 + margin) return 1;
  const edge = Math.max(dx / (RUNWAY.width / 2 + margin), dy / (RUNWAY.length / 2 + margin));
  return edge * edge * (3 - 2 * edge); // smoothstep 0 at the strip, 1 outside
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
    return Math.max(0, height * runwayFlatten(x, y));
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

  return { map, heightAt, clouds, scale: SCALE };
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
