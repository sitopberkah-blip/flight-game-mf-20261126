// The island of Meridian as a heightfield the renderer can project and
// the flight model can crash into. One job: answer "how high is the ground
// here, what colour is it, and what is built on it" for any world point.
//
// World axes: x runs east, y runs south, altitude is up. Heading 0 flies
// north (toward smaller y). The island sits in the middle of the chart
// with a wobbled coastline, two peaks with a saddle between them, a
// patchwork of crop fields on the gentle land, a harbour town, a ridge of
// wind turbines, a lighthouse point, and Runway 07 flattened into the
// south shore.

import { createRng, clamp, lerp } from './random.js';

const CENTRE = 7000;
const ISLAND_R = 2950;

// Deterministic 2D value noise: a hashed lattice with smooth blending,
// layered into fbm. No state, so every module samples the same island.
function hash2(ix, iy) {
  let h = (ix * 374761393 + iy * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function noise2(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);
  return lerp(lerp(a, b, sx), lerp(c, d, sx), sy);
}
function fbm(x, y, octaves) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i += 1) {
    sum += amp * noise2(x * freq, y * freq);
    freq *= 2.03;
    amp *= 0.5;
  }
  return sum;
}

const PEAKS = [
  { x: 6150, y: 5050, h: 660, sigma: 760 },
  { x: 8250, y: 6000, h: 575, sigma: 640 },
];

export const RUNWAY = {
  x: 7150, // centre of the strip, in the fields above the south shore
  y: 9750,
  heading: (70 * Math.PI) / 180, // runway 07: fly heading 070 to land
  length: 980,
  width: 46,
  elevation: 14,
  name: '07',
};

const TOWN = { x: 5050, y: 9050, radius: 620, elevation: 20 };

function coastRadius(theta) {
  return ISLAND_R * (1 + 0.15 * Math.sin(3 * theta + 1.7) + 0.09 * Math.sin(5 * theta + 0.4) + 0.05 * Math.sin(8 * theta + 2.9));
}

function distToRunway(x, y) {
  // Distance to the runway rectangle in the strip's own frame.
  const dx = x - RUNWAY.x;
  const dy = y - RUNWAY.y;
  const along = dx * Math.sin(RUNWAY.heading) - dy * Math.cos(RUNWAY.heading);
  const across = dx * Math.cos(RUNWAY.heading) + dy * Math.sin(RUNWAY.heading);
  const ex = Math.max(Math.abs(along) - RUNWAY.length / 2, 0);
  const ey = Math.max(Math.abs(across) - RUNWAY.width / 2, 0);
  return Math.hypot(ex, ey);
}

function rawHeight(x, y) {
  const dx = x - CENTRE;
  const dy = y - CENTRE;
  const dist = Math.hypot(dx, dy);
  const theta = Math.atan2(dy, dx);
  const edge = coastRadius(theta);
  const land = clamp((edge - dist) / 420, 0, 1); // 0 at sea, 1 well inland
  const landSmooth = land * land * (3 - 2 * land);
  let h = -12 + landSmooth * 34; // sea floor up to the beach shelf
  h += landSmooth * fbm(x / 900, y / 900, 3) * 120; // rolling hills
  h += landSmooth * fbm(x / 260, y / 260, 2) * 26; // local roughness
  for (const p of PEAKS) {
    const d2 = (x - p.x) ** 2 + (y - p.y) ** 2;
    h += p.h * Math.exp(-d2 / (2 * p.sigma * p.sigma)) * landSmooth;
  }
  // Flatten the town bowl and the runway strip into the hills.
  const dt = Math.hypot(x - TOWN.x, y - TOWN.y);
  if (dt < TOWN.radius) h = lerp(TOWN.elevation, h, clamp((dt - TOWN.radius * 0.55) / (TOWN.radius * 0.45), 0, 1));
  const dr = distToRunway(x, y);
  if (dr < 190) h = lerp(RUNWAY.elevation, h, clamp(dr / 190, 0, 1));
  return h;
}

const FIELD_PALETTE = ['#79a84b', '#8fae4e', '#a9b356', '#6f9e46', '#c2b268', '#7fae57', '#97b95c'];
const colourCache = new Map();

function groundColour(x, y, h) {
  const key = `${Math.round(x / 40)},${Math.round(y / 40)}`;
  const hit = colourCache.get(key);
  if (hit) return hit;
  let colour;
  if (h < 1.5) {
    colour = h < -6 ? '#1d5f86' : '#2a7ca6'; // deep and shallow sea
  } else if (h < 5) {
    colour = '#d9c084'; // sand
  } else if (h > 600) {
    colour = '#e8ecf0'; // snow caps
  } else if (h > 430) {
    colour = '#8d8578'; // bare rock
  } else {
    // Crop patchwork on the gentle land, forest where the noise says so.
    const cell = hash2(Math.floor(x / 380), Math.floor(y / 380));
    const forest = fbm(x / 620 + 40, y / 620 + 40, 2);
    if (h > 200 || forest > 0.58) colour = '#4e7d3a';
    else colour = FIELD_PALETTE[Math.floor(cell * FIELD_PALETTE.length) % FIELD_PALETTE.length];
    if (distToRunway(x, y) < 4) colour = '#4a4a4f'; // the strip itself
  }
  if (colourCache.size > 60000) colourCache.clear();
  colourCache.set(key, colour);
  return colour;
}

export function createTerrain(seed) {
  const rng = createRng(seed);

  // Harbour town: rows of flat-roofed blocks around the bay.
  const buildings = [];
  for (let i = 0; i < 46; i += 1) {
    const a = rng.range(0, Math.PI * 2);
    const r = Math.sqrt(rng.next()) * TOWN.radius * 0.8;
    const x = TOWN.x + Math.cos(a) * r;
    const y = TOWN.y + Math.sin(a) * r;
    if (distToRunway(x, y) < 130) continue;
    buildings.push({
      x, y,
      w: rng.range(34, 74), d: rng.range(34, 74),
      h: rng.range(16, 64),
      colour: ['#cbb79a', '#b8a58c', '#d6c6a8', '#a89a86', '#c4b294'][rng.int(0, 4)],
      roof: ['#8a5a44', '#74584a', '#96604a'][rng.int(0, 2)],
    });
  }

  // Wind turbines along the north ridge: tall masts with three blades.
  const turbines = [];
  for (let i = 0; i < 6; i += 1) {
    const x = 5200 + i * 330;
    const y = 4480 + Math.sin(i * 1.3) * 120;
    turbines.push({ x, y, mast: 78, rotor: 30, phase: rng.range(0, Math.PI * 2) });
  }

  // Boats anchored off the harbour and one lighthouse on the west point.
  const boats = [];
  for (let i = 0; i < 7; i += 1) {
    boats.push({
      x: TOWN.x + rng.range(-1500, 400),
      y: TOWN.y + rng.range(500, 1500),
      heading: rng.range(0, Math.PI * 2),
      size: rng.range(16, 34),
      colour: ['#d8d3c8', '#b84a3a', '#3a6ea8', '#e0b84a'][rng.int(0, 3)],
    });
  }
  const lighthouse = { x: 4280, y: 7960, h: 34 };

  // Drifting cloud puffs in two decks.
  const clouds = [];
  for (let i = 0; i < 64; i += 1) {
    clouds.push({
      x: rng.range(600, 13400),
      y: rng.range(600, 13400),
      alt: rng.range(520, 980),
      r: rng.range(120, 340),
      drift: rng.range(2, 6),
      shade: rng.range(0.82, 1),
    });
  }

  return {
    groundHeight: rawHeight,
    groundColour,
    runway: RUNWAY,
    town: TOWN,
    buildings,
    turbines,
    boats,
    lighthouse,
    clouds,
    peaks: PEAKS,
  };
}
