// Meridian Rings — configuration: world size, flight tuning, colours, missions.
// One place for every number a designer would want to tweak.

export const WORLD = {
  size: 6000, // world units; the island is a square sea chart this wide
  islandCentreX: 3000,
  islandCentreY: 3000,
  islandRadius: 2150,
  seaLevel: 0,
  maxHill: 880, // feet of terrain height at the tallest peak
};

export const PLANE = {
  maxSpeed: 210, // knots at full throttle, level flight
  cruiseSpeed: 150,
  minFlySpeed: 58, // below this the wing stops flying and the plane sinks
  accel: 26, // knots per second toward the throttle target
  turnRate: 0.62, // radians per second at full bank, scaled by speed
  climbRate: 55, // feet per second at full climb and cruise speed
  sinkRate: 55, // feet per second at full dive
  fuelCapacity: 100,
  fuelBurn: 2.4, // fuel units per second at full throttle
  fuelIdle: 0.35, // fuel units per second at idle
  tankWarning: 25,
};

export const RINGS = {
  radius: 90, // world units; the glowing circle you must fly through
  passAltitudeMax: 1500, // feet: you must be below this to count a ring
  ringScore: 100,
  refuelAmount: 45,
  perfectBonus: 25, // extra points for passing near a ring's centre
};

// The three sorties, in order. Each lists its rings in world coordinates and
// the text the pilot sees. The last ring of the last sortie is the runway.
export const MISSIONS = [
  {
    id: 'ring-run',
    name: 'Ring Run',
    brief: 'Thread all five harbour rings, then mind your fuel.',
    rings: [
      { x: 3000, y: 1750, refuel: false },
      { x: 3950, y: 2150, refuel: false },
      { x: 4450, y: 3050, refuel: true },
      { x: 3900, y: 3950, refuel: false },
      { x: 2950, y: 4300, refuel: false },
    ],
  },
  {
    id: 'coast-patrol',
    name: 'Coast Patrol',
    brief: 'Sweep the coast: four rings, then a low pass over the lighthouse.',
    rings: [
      { x: 2050, y: 3900, refuel: false },
      { x: 1500, y: 2950, refuel: true },
      { x: 1750, y: 1900, refuel: false },
      { x: 2500, y: 1450, refuel: false },
    ],
  },
  {
    id: 'home-run',
    name: 'Home Run',
    brief: 'One last ring over the hills, then bring her home to the runway.',
    rings: [
      { x: 3600, y: 2600, refuel: false },
      { x: 3200, y: 3600, refuel: false },
    ],
    landAfter: true,
  },
];

export const RUNWAY = {
  // A flat strip on the south field, pointing north-south.
  x: 3000,
  y: 4450,
  heading: 0, // radians; the strip runs along +y (south) from its centre
  length: 700,
  width: 110,
  // A landing counts when you touch down inside the strip, slow and gentle.
  maxTouchSpeed: 105,
  maxSink: 9, // feet per second of descent at touchdown
};

export const COLOURS = {
  skyTop: '#7ec3e8',
  skyMid: '#a8d8f0',
  skyLow: '#e8f3f8',
  seaDeep: '#1d6f9e',
  seaShallow: '#3f9ec4',
  sand: '#e8d5a0',
  grass: '#7cb35a',
  field: '#a8c46a',
  forest: '#4d8a44',
  hill: '#7d9155',
  rock: '#6e6252',
  runway: '#3c3f46',
  runwayMark: '#f2f2e8',
  ring: '#ffd23e',
  ringRefuel: '#39d98a',
  ringDone: '#9fb4c4',
  hudPanel: 'rgba(12, 24, 36, 0.72)',
  hudText: '#eaf6ff',
  hudAmber: '#ffb347',
  hudRed: '#ff5d5d',
  hudGreen: '#7be495',
};

export const SCREENS = {
  TITLE: 'title',
  PLAY: 'play',
  PAUSED: 'paused',
  LANDED: 'landed',
  CRASHED: 'crashed',
};

export const STEP = 1 / 60;
