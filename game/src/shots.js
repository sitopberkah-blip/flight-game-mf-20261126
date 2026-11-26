// The screenshot scenes behind ?shot=cover|rings|phone. Each one plays the
// real rules forward from a fresh start for a fixed number of steps, steered
// by a simple autopilot (turn toward the next ring, climb to a safe height,
// keep the throttle up), so every frame is what a real game looks like and
// the same seed always gives the same frame.

import { STEP, SCREENS } from './config.js';
import { stepFlight } from './physics.js';
import { checkRing, currentTarget } from './missions.js';

const COVER_SECONDS = 34;
const RINGS_SECONDS = 58;
const SAMPLE = 1 / 30;

/** Steer toward the current target and hold a cruise altitude. */
function autopilot(plane, missions) {
  const target = currentTarget(missions);
  let steer = 0;
  let pitch = 0;
  let throttleDelta = 0;
  if (target) {
    const want = Math.atan2(target.y - plane.y, target.x - plane.x);
    let diff = want - plane.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    steer = Math.max(-1, Math.min(1, diff * 2.2));
  }
  const targetAlt = 950;
  if (plane.alt < targetAlt - 60) pitch = 1;
  else if (plane.alt > targetAlt + 60) pitch = -1;
  if (plane.throttle < 0.72) throttleDelta = 0.9 * SAMPLE;
  return { steer, pitch, throttleDelta, brake: false };
}

function runForward(state, seconds) {
  const steps = Math.floor(seconds / SAMPLE);
  for (let i = 0; i < steps; i += 1) {
    const input = {
      steer: 0,
      pitch: 0,
      throttleDelta: 0,
      brake: false,
    };
    if (state.screen === SCREENS.PLAY) {
      const auto = autopilot(state.plane, state.missions);
      input.steer = auto.steer;
      input.pitch = auto.pitch;
      input.throttleDelta = auto.throttleDelta;
      input.brake = auto.brake;
    }
    // The autopilot's steering is a value, not a function, for the model.
    const modelInput = {
      steer: input.steer,
      pitch: input.pitch,
      throttleDelta: (dt) => input.throttleDelta * (dt / SAMPLE),
      brake: input.brake,
    };
    const result = stepFlight(state.plane, modelInput, SAMPLE, state.terrain);
    state.missions.elapsed += SAMPLE;
    checkRing(state.missions, state.plane, state.missions.elapsed);
    if (result === 'crashed' || result === 'landed') break;
  }
}

/**
 * Set the game to the named scene and return the screen to draw. The cover
 * is mid-flight through the first rings with the island below; the rings
 * scene is deeper into the sortie; the phone scene is the same flight on a
 * tall frame. Any other name is the title screen.
 */
export function stageShot(name, state) {
  state.plane = state.newPlane();
  state.missions = state.newMissions();
  state.screen = SCREENS.TITLE;
  if (name === 'cover') {
    state.screen = SCREENS.PLAY;
    state.missions.startTime = 0;
    runForward(state, COVER_SECONDS);
    return;
  }
  if (name === 'rings') {
    state.screen = SCREENS.PLAY;
    state.missions.startTime = 0;
    runForward(state, RINGS_SECONDS);
    return;
  }
  if (name === 'phone') {
    state.screen = SCREENS.PLAY;
    state.missions.startTime = 0;
    runForward(state, COVER_SECONDS + 14);
  }
}
