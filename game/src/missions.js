// The five sorties of Meridian Rings, and everything that scores in them.
// One job: define each mission — its rings in order, its pickups, its
// balloon hazards, its weather — and run the bookkeeping while you fly:
// ring strikes, combo, pickups, damage, and the landing that finishes a
// sortie once its rings are done.

import { SCORING } from './config.js';
import { clamp } from './random.js';

const ring = (x, y, alt, r = 58) => ({ x, y, alt, r });
const pickup = (x, y, alt, kind) => ({ x, y, alt, kind });
const balloon = (x, y, alt) => ({ x, y, alt, r: 30, popped: false });

export const MISSION_DEFS = [
  {
    name: 'Ring Run',
    brief: 'Five gold rings over the fields. Thread them in order, then land back on Runway 07.',
    weather: 'calm',
    rings: [ring(7050, 9050, 300), ring(6500, 7750, 390), ring(7450, 6600, 430), ring(6550, 5550, 520), ring(7650, 7300, 360)],
    pickups: [pickup(7000, 7000, 400, 'star')],
    balloons: [],
  },
  {
    name: 'Coast Patrol',
    brief: 'Seven rings up the west coast, past the lighthouse and the ridge turbines. Fuel drums float where the patrol runs dry.',
    weather: 'breeze',
    rings: [ring(4750, 9500, 260), ring(4350, 7950, 300), ring(4650, 6350, 350), ring(5450, 4950, 390), ring(6650, 4250, 430), ring(8250, 4750, 410), ring(8850, 6250, 370)],
    pickups: [pickup(5050, 7150, 320, 'fuel'), pickup(7050, 3900, 480, 'star'), pickup(8400, 5500, 390, 'fuel')],
    balloons: [balloon(5900, 5600, 360)],
  },
  {
    name: 'Canyon Dash',
    brief: 'Six rings threaded through the saddle between the twin peaks. The balloons drift where the gap is narrowest.',
    weather: 'breeze',
    rings: [ring(7050, 8250, 470), ring(6900, 7050, 560), ring(7180, 5560, 650), ring(6760, 4560, 530), ring(7420, 3560, 430), ring(8450, 4450, 470)],
    pickups: [pickup(7050, 6300, 600, 'star'), pickup(7900, 4000, 470, 'repair')],
    balloons: [balloon(6520, 6150, 520), balloon(7620, 4980, 590), balloon(7050, 4050, 470)],
  },
  {
    name: 'Storm Run',
    brief: 'A front is coming through: rain, gusts and low cloud. Six rings over a grey sea, and she will take damage if you tangle with the balloons.',
    weather: 'storm',
    rings: [ring(5600, 9850, 300), ring(4550, 8600, 340), ring(5200, 6750, 390), ring(6650, 5950, 470), ring(8250, 6800, 430), ring(8650, 8650, 310)],
    pickups: [pickup(6050, 7800, 370, 'fuel'), pickup(7050, 7450, 430, 'repair'), pickup(7600, 7700, 400, 'star')],
    balloons: [balloon(5750, 7050, 400), balloon(7500, 6400, 450)],
  },
  {
    name: 'Final Approach',
    brief: 'Three rings down the glide path, then the real test: gear down, gentle hands, and put her on Runway 07 like you mean it.',
    weather: 'calm',
    rings: [ring(3955, 10913, 430), ring(4660, 10656, 290), ring(5365, 10399, 180)],
    pickups: [],
    balloons: [],
  },
];

export function createMissions() {
  return {
    defs: MISSION_DEFS,
    completed: new Set(),
    campaignScore: 0,
    active: null,
  };
}

/** Begin a sortie: fresh rings, pickups, score and combo. */
export function startMission(missions, index) {
  const def = missions.defs[index];
  missions.active = {
    index,
    def,
    rings: def.rings.map((r) => ({ ...r, taken: false })),
    pickups: def.pickups.map((p) => ({ ...p, taken: false })),
    balloons: def.balloons.map((b) => ({ ...b })),
    ringIndex: 0,
    score: 0,
    combo: 1,
    comboTimer: 0,
    elapsed: 0,
    events: [],
    finished: false,
  };
  return missions.active;
}

export function currentRing(active) {
  return active && active.ringIndex < active.rings.length ? active.rings[active.ringIndex] : null;
}

export function allRingsTaken(active) {
  return active && active.ringIndex >= active.rings.length;
}

function dist3(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.alt - b.alt) * 1.6);
}

/**
 * Advance the sortie one step: combo decay, ring strikes, pickups and
 * balloon strikes. Returns a crash reason string when the plane hits a
 * building, else null. Effects and sounds ride on active.events.
 */
export function updateMission(active, plane, terrain, dt) {
  active.elapsed += dt;
  if (active.comboTimer > 0) {
    active.comboTimer -= dt;
    if (active.comboTimer <= 0) active.combo = 1;
  }

  const target = currentRing(active);
  if (target && plane.airborne) {
    const d = dist3(plane, target);
    if (d < target.r) {
      target.taken = true;
      active.ringIndex += 1;
      const centre = d < target.r * 0.45;
      const base = centre ? SCORING.ringCentre : SCORING.ringEdge;
      const points = base * active.combo;
      active.score += points;
      active.events.push({ type: 'ring', centre, points, combo: active.combo, x: target.x, y: target.y, alt: target.alt });
      active.combo = clamp(active.combo + 1, 1, SCORING.comboMax);
      active.comboTimer = SCORING.comboWindow;
      if (allRingsTaken(active)) active.events.push({ type: 'ringsDone' });
    }
  }

  for (const p of active.pickups) {
    if (p.taken || !plane.airborne) continue;
    if (dist3(plane, p) < 62) {
      p.taken = true;
      if (p.kind === 'fuel') plane.fuel = clamp(plane.fuel + 30, 0, 100);
      if (p.kind === 'repair') plane.hull = clamp(plane.hull + 35, 0, 100);
      if (p.kind === 'star') active.score += SCORING.star;
      active.events.push({ type: 'pickup', kind: p.kind, x: p.x, y: p.y, alt: p.alt });
    }
  }

  for (const b of active.balloons) {
    if (b.popped || !plane.airborne) continue;
    if (dist3(plane, b) < b.r + 14) {
      b.popped = true;
      plane.hull -= 16;
      active.events.push({ type: 'balloon', x: b.x, y: b.y, alt: b.alt });
      if (plane.hull <= 0) return 'The balloon strike tore her apart — a damaged plane is a falling plane.';
    }
  }

  // Buildings are solid. Thread the town's streets or fly over the roofs.
  if (plane.airborne) {
    for (const b of terrain.buildings) {
      const dx = Math.abs(plane.x - b.x);
      const dy = Math.abs(plane.y - b.y);
      if (dx < b.w / 2 + 6 && dy < b.d / 2 + 6) {
        const roof = terrain.groundHeight(b.x, b.y) + b.h;
        if (plane.alt < roof + 3) return 'You flew into a harbour-front building. Roofs are not sky.';
      }
    }
  }
  return null;
}

/** Score a touchdown that ends the sortie (rings done) or not. */
export function scoreLanding(active, plane) {
  const td = plane.touchdown;
  if (!td) return { total: 0, label: 'No touchdown recorded' };
  if (!allRingsTaken(active)) {
    return { total: 0, label: 'Down safely, but the rings are still out there — the sortie does not count.' };
  }
  let base = SCORING.landingRough;
  let label = 'Rough arrival — but she walks away.';
  if (td.onRunway && td.vspeed > -1.8 && Math.abs(td.offset) < 8 && td.speed > 24 && td.speed < 42) {
    base = SCORING.landingPerfect;
    label = 'Grease job! Soft, centred and on the numbers.';
  } else if (td.onRunway && td.vspeed > -3.2 && Math.abs(td.offset) < 17) {
    base = SCORING.landingGood;
    label = 'A tidy landing on Runway 07.';
  } else if (!td.onRunway) {
    label = 'Off-field landing in the grass. It counts, barely.';
  }
  const fuelBonus = Math.round(plane.fuel) * 2;
  return { total: base + fuelBonus, label, landingBase: base, fuelBonus };
}

/** Mark the active sortie complete and bank its score. */
export function completeMission(missions, landing) {
  const active = missions.active;
  active.score += landing.total;
  active.finished = true;
  missions.completed.add(active.index);
  missions.campaignScore += active.score;
  return active.score;
}
