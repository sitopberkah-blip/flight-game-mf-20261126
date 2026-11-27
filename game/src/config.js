// Meridian Rings v2 — shared tuning for the chase-view flight game.
// One job: every constant the other modules agree on lives here, so the
// flight model, the renderer and the HUD never drift apart.

export const STEP = 1 / 120; // fixed flight-model step, seconds

export const SCREENS = {
  TITLE: 'title',
  BRIEF: 'brief',
  PLAY: 'play',
  PAUSED: 'paused',
  COMPLETE: 'complete',
  CRASHED: 'crashed',
  LANDED: 'landed',
};

// World and flight units: metres, metres/second, radians. The HUD converts
// to feet and knots for display, the way a real panel does.
export const WORLD = {
  size: 14000, // the island sea chart is a square this wide, metres
  seaLevel: 0,
  viewDistance: 4200, // how far the renderer draws terrain, metres
  ceiling: 2600, // soft altitude ceiling for the flight model
};

export const FLIGHT = {
  minSpeed: 24, // below this the wing stalls, m/s
  cruiseSpeed: 52,
  maxSpeed: 88,
  idleThrottle: 0.08,
  spoolRate: 0.55, // throttle travel per second at full key press
  accel: 16, // m/s^2 at full throttle before drag
  drag: 0.0038, // quadratic drag coefficient
  climbPower: 15, // m/s of climb the pitch can command at cruise
  turnRate: 0.62, // rad/s at full bank and cruise speed
  maxBank: 1.05, // radians of bank at full roll input
  maxPitch: 0.42, // radians of nose up/down the stick can hold
  fuelCapacity: 100,
  fuelBurn: 1.15, // units per second at full throttle
  hullMax: 100,
};

export const SCORING = {
  ringCentre: 150, // points for threading a ring dead centre
  ringEdge: 60, // points for clipping through off-centre
  comboWindow: 7, // seconds to keep the combo alive
  comboMax: 5,
  star: 250,
  landingPerfect: 500,
  landingGood: 300,
  landingRough: 120,
};

// Display conversions for the panel.
export const toFeet = (m) => m * 3.28084;
export const toKnots = (ms) => ms * 1.94384;
export const toFpm = (ms) => ms * 196.85;
