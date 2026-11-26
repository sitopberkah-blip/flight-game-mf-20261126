// Meridian Rings — the game loop and the screens. The plane waits on the
// runway on the title screen; Enter starts the sortie; P pauses; R restarts
// after a landing or a crash. ?shot=cover|rings|phone stages a screenshot
// scene instead of the title screen, and ?seed=N fixes the island.

import { STEP, SCREENS } from './config.js';
import { createInput, KEY } from './input.js';
import { createTerrain } from './terrain.js';
import { createPlane, startPosition } from './plane.js';
import { stepFlight } from './physics.js';
import { createMissions, startMissions, checkRing, onLanded } from './missions.js';
import { createAudio } from './audio.js';
import { render } from './render.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');

const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed') || '20261126') || 20261126;
const shot = params.get('shot');

const input = createInput(canvas);
const audio = createAudio();
const terrain = createTerrain(seed);

const state = {
  w: 0,
  h: 0,
  terrain,
  plane: createPlane(),
  missions: createMissions(),
  screen: SCREENS.TITLE,
  bonuses: { timeBonus: 0, fuelBonus: 0 },
  time: 0,
  newPlane() {
    const plane = createPlane();
    startPosition(plane);
    return plane;
  },
  newMissions() {
    return createMissions();
  },
};

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  state.w = window.innerWidth;
  state.h = window.innerHeight;
  canvas.width = Math.round(state.w * dpr);
  canvas.height = Math.round(state.h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

function reset() {
  state.plane = state.newPlane();
  state.missions = state.newMissions();
  state.bonuses = { timeBonus: 0, fuelBonus: 0 };
  state.screen = SCREENS.TITLE;
}

function startGame() {
  state.plane = state.newPlane();
  state.missions = state.newMissions();
  startMissions(state.missions, 0);
  state.bonuses = { timeBonus: 0, fuelBonus: 0 };
  state.screen = SCREENS.PLAY;
  audio.unlock();
  audio.click();
  announce('Flying. Mission 1: Ring Run.');
}

function announce(text) {
  if (status) status.textContent = text;
}

function step(dt) {
  state.time += dt;

  if (input.wasPressed(KEY.MUTE)) {
    const muted = audio.toggleMute();
    announce(muted ? 'Sound off.' : 'Sound on.');
  }

  if (state.screen === SCREENS.TITLE) {
    if (input.wasPressed(KEY.ENTER) || input.wasPressed('Space')) startGame();
    return;
  }

  if (state.screen === SCREENS.PLAY) {
    if (input.wasPressed(KEY.PAUSE) || input.wasPressed('Escape')) {
      state.screen = SCREENS.PAUSED;
      announce('Paused.');
      return;
    }
    const modelInput = {
      steer: input.steer(state.w / 2, state.h / 2),
      pitch: input.pitch(),
      throttleDelta: (stepDt) => input.throttleDelta(stepDt),
      brake: input.brake(),
    };
    const result = stepFlight(state.plane, modelInput, dt, terrain);
    state.missions.elapsed += dt;
    if (result === 'flying') {
      checkRing(state.missions, state.plane, state.time);
    } else if (result === 'landed') {
      state.bonuses = onLanded(state.missions, state.plane, state.time);
      state.screen = SCREENS.LANDED;
      audio.land();
      announce('Landed safely on runway 07. Score ' + state.missions.score + '.');
    } else if (result === 'crashed') {
      state.screen = SCREENS.CRASHED;
      audio.crash();
      announce('Crashed. ' + state.plane.crashReason);
    }
    audio.engine(state.plane.throttle, state.plane.speed, state.plane.airborne);
    return;
  }

  if (state.screen === SCREENS.PAUSED) {
    if (input.wasPressed(KEY.PAUSE) || input.wasPressed('Escape') || input.wasPressed(KEY.ENTER)) {
      state.screen = SCREENS.PLAY;
      announce('Flying.');
    } else if (input.wasPressed(KEY.RESTART)) {
      startGame();
    }
    return;
  }

  // Landed or crashed: R (or Enter) flies again.
  if (input.wasPressed(KEY.RESTART) || input.wasPressed(KEY.ENTER)) startGame();
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  // Fixed-step flight model, so the game plays the same at any frame rate.
  let remaining = dt;
  while (remaining > 0) {
    const stepDt = Math.min(STEP, remaining);
    step(stepDt);
    remaining -= stepDt;
    if (state.screen !== SCREENS.PLAY) break;
  }
  render(ctx, state, state.time, dt);
  input.endFrame();
  requestAnimationFrame(frame);
}

// A screenshot scene stages the game before the first frame; otherwise the
// title screen waits on the runway with the island turning slowly below.
if (shot) {
  stageShot(shot, state);
  state.time = 0;
} else {
  startPosition(state.plane);
}
requestAnimationFrame(frame);
