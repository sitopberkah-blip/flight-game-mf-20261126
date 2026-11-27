// Meridian Rings v2 — the game loop and the screen flow. One job: own
// the state machine (title, briefing, flying, paused, and the three ways
// a sortie ends), feed the flight model its inputs at a fixed step, and
// turn mission events into effects, sounds and score text.
// ?shot=cover|storm|landing|phone stages a frozen screenshot scene, and
// ?seed=N fixes the island.

import { STEP, SCREENS } from './config.js';
import { createInput, KEY } from './input.js';
import { createTerrain } from './terrain.js';
import { createPlane, startPosition } from './plane.js';
import { stepFlight } from './physics.js';
import { createMissions, startMission, updateMission, scoreLanding, completeMission, MISSION_DEFS } from './missions.js';
import { createEffects, stepEffects, stepRain } from './effects.js';
import { createAudio } from './audio.js';
import { render } from './render.js';
import { drawHud } from './hud.js';
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
  time: 0,
  terrain,
  plane: createPlane(),
  missions: createMissions(),
  effects: createEffects(),
  screen: SCREENS.TITLE,
  weather: 'calm',
  landing: null,
  frozen: false,
  touch: input.touch,
  ui: { missions: [], hoverMission: -1 },
  smokeClock: 0,
  stallClock: 0,
};
startPosition(state.plane, terrain.runway);

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

function announce(text) {
  if (status) status.textContent = text;
}

function toTitle() {
  state.screen = SCREENS.TITLE;
  state.weather = 'calm';
  startPosition(state.plane, terrain.runway);
  audio.silence();
}

function briefMission(index) {
  startPosition(state.plane, terrain.runway);
  startMission(state.missions, index);
  state.weather = state.missions.active.def.weather;
  state.landing = null;
  state.screen = SCREENS.BRIEF;
  announce(`Sortie ${index + 1}: ${MISSION_DEFS[index].name}. ${MISSION_DEFS[index].brief}`);
}

function launch() {
  const active = state.missions.active;
  startPosition(state.plane, terrain.runway);
  startMission(state.missions, active ? active.index : 0);
  state.weather = state.missions.active.def.weather;
  state.landing = null;
  state.effects.particles = [];
  state.effects.texts = [];
  state.screen = SCREENS.PLAY;
  audio.unlock();
  audio.click();
  announce(`Flying. Sortie ${state.missions.active.index + 1}: ${state.missions.active.def.name}.`);
}

/** Turbulence the weather adds on top of the stick, by mission weather. */
function turbulence(t) {
  if (state.weather === 'storm') {
    return {
      pitch: Math.sin(t * 1.7) * 0.045 + Math.sin(t * 4.3 + 1) * 0.03,
      roll: Math.sin(t * 1.25 + 2) * 0.085 + Math.sin(t * 3.1) * 0.03,
      lift: Math.sin(t * 2.2 + 1) * 1.7,
    };
  }
  if (state.weather === 'breeze') {
    return { pitch: Math.sin(t * 1.4) * 0.012, roll: Math.sin(t * 0.9 + 2) * 0.02, lift: Math.sin(t * 1.8) * 0.4 };
  }
  return { pitch: 0, roll: 0, lift: 0 };
}

function handleEvents(active) {
  const fx = state.effects;
  for (const ev of active.events) {
    if (ev.type === 'ring') {
      fx.ringBurst(ev.x, ev.y, ev.alt, ev.centre);
      fx.addText(state.w / 2, state.h * 0.3, ev.centre ? `DEAD CENTRE! +${ev.points}` : `RING! +${ev.points}`, '#ffd23e', ev.centre ? 30 : 26);
      if (ev.combo > 1) fx.addText(state.w / 2, state.h * 0.3 + 34, `COMBO ×${ev.combo}`, '#ffb84d', 19);
      audio.ring(ev.centre);
    } else if (ev.type === 'ringsDone') {
      fx.addText(state.w / 2, state.h * 0.42, 'ALL RINGS FLOWN — LAND ON RUNWAY 07', '#59e08a', 24);
      announce('All rings flown. Land on runway 07 to finish the sortie.');
    } else if (ev.type === 'pickup') {
      fx.burst(ev.x, ev.y, ev.alt, ev.kind === 'fuel' ? '90,230,130' : ev.kind === 'repair' ? '240,240,240' : '255,205,64', 16, 22, 5, 0.7);
      const label = ev.kind === 'fuel' ? 'FUEL +30' : ev.kind === 'repair' ? 'HULL PATCHED +35' : 'STAR +250';
      fx.addText(state.w / 2, state.h * 0.3, label, '#aef2c0', 24);
      audio.pickup(ev.kind);
    } else if (ev.type === 'balloon') {
      fx.burst(ev.x, ev.y, ev.alt, '230,90,70', 24, 34, 6, 0.9);
      fx.kick(13);
      fx.addText(state.w / 2, state.h * 0.3, 'BALLOON STRIKE! HULL −16', '#ff8a7a', 24);
      audio.balloon();
    }
  }
  active.events.length = 0;
}

function endCrash(reason) {
  state.plane.crashReason = reason;
  state.effects.explosion(state.plane.x, state.plane.y, state.plane.alt);
  state.screen = SCREENS.CRASHED;
  audio.crash();
  audio.silence();
  announce(`Crashed. ${reason}`);
}

function stepPlay(dt) {
  const plane = state.plane;
  const active = state.missions.active;
  const target = input.throttleTarget();
  const modelInput = {
    roll: input.roll(),
    pitch: input.pitch(),
    throttleDelta: input.throttleDelta(),
    brake: input.brake(),
  };
  if (target !== null) plane.throttle = target; // the touch rail sets it directly
  if (input.gearPressed() && plane.airborne) {
    plane.gearDown = !plane.gearDown;
    audio.click();
    announce(plane.gearDown ? 'Gear down.' : 'Gear up.');
  }
  const result = stepFlight(plane, modelInput, dt, terrain, turbulence(state.time));
  const hazard = result === 'flying' || result === 'ground' ? updateMission(active, plane, terrain, dt) : null;
  handleEvents(active);
  if (hazard) {
    endCrash(hazard);
    return;
  }
  if (plane.hull <= 0 && result !== 'crashed') {
    endCrash('She came apart in the air — the hull gauge is there for a reason.');
    return;
  }
  // Damage smoke streams behind a hurt engine.
  if (plane.airborne && plane.smoke > 0.05) {
    state.smokeClock -= dt;
    if (state.smokeClock <= 0) {
      state.smokeClock = 0.055;
      state.effects.smokePuff(
        plane.x - Math.sin(plane.heading) * 14,
        plane.y + Math.cos(plane.heading) * 14,
        plane.alt + 2,
        plane.smoke > 0.6,
      );
    }
  }
  if (plane.stalled) {
    state.stallClock -= dt;
    if (state.stallClock <= 0) {
      state.stallClock = 0.55;
      state.effects.kick(1.6);
      audio.stall();
    }
  }
  if (state.weather === 'storm') {
    stepRain(state.effects, state.w, state.h, dt, -60);
    if (Math.random() < dt * 0.22) state.effects.flash = Math.max(state.effects.flash, 0.5 + Math.random() * 0.4);
  }
  if (result === 'crashed') {
    endCrash(plane.crashReason || 'The sortie ended against the scenery.');
  } else if (result === 'landed') {
    const landing = scoreLanding(active, plane);
    state.landing = landing;
    if (landing.total > 0) {
      completeMission(state.missions, landing);
      state.screen = SCREENS.COMPLETE;
      audio.land();
      announce(`Sortie complete. ${landing.label} Score ${active.score}.`);
    } else {
      state.screen = SCREENS.LANDED;
      audio.land();
      announce(landing.label);
    }
  }
  audio.engine(plane.throttle, plane.speed, plane.airborne);
}

function step(dt) {
  state.time += dt;
  if (!state.frozen) stepEffects(state.effects, dt);

  if (input.wasPressed(KEY.MUTE)) {
    const muted = audio.toggleMute();
    announce(muted ? 'Sound off.' : 'Sound on.');
  }

  const clicks = input.takeClicks();
  if (state.screen === SCREENS.TITLE) {
    state.ui.hoverMission = -1;
    if (input.mouse.inside) {
      for (const m of state.ui.missions) {
        if (input.mouse.x >= m.x && input.mouse.x <= m.x + m.w && input.mouse.y >= m.y && input.mouse.y <= m.y + m.h) {
          state.ui.hoverMission = m.index;
        }
      }
    }
    for (const c of clicks) {
      audio.unlock();
      for (const m of state.ui.missions) {
        if (c.x >= m.x && c.x <= m.x + m.w && c.y >= m.y && c.y <= m.y + m.h) briefMission(m.index);
      }
    }
    if (input.wasPressed(KEY.ENTER) || input.wasPressed('Space')) {
      audio.unlock();
      const next = MISSION_DEFS.findIndex((_, i) => !state.missions.completed.has(i));
      briefMission(next === -1 ? 0 : next);
    }
    return;
  }

  if (state.screen === SCREENS.BRIEF) {
    if (input.wasPressed(KEY.ENTER) || clicks.length) launch();
    else if (input.wasPressed(KEY.ESCAPE)) toTitle();
    return;
  }

  if (state.screen === SCREENS.PLAY) {
    if (state.frozen) return; // a staged screenshot scene holds its pose
    if (input.wasPressed(KEY.PAUSE) || input.wasPressed(KEY.ESCAPE)) {
      state.screen = SCREENS.PAUSED;
      audio.silence();
      announce('Paused.');
      return;
    }
    let remaining = dt;
    while (remaining > 0) {
      const stepDt = Math.min(STEP, remaining);
      stepPlay(stepDt);
      remaining -= stepDt;
      if (state.screen !== SCREENS.PLAY) break;
    }
    return;
  }

  if (state.screen === SCREENS.PAUSED) {
    if (input.wasPressed(KEY.PAUSE) || input.wasPressed(KEY.ENTER)) {
      state.screen = SCREENS.PLAY;
      announce('Flying.');
    } else if (input.wasPressed(KEY.RESTART)) launch();
    else if (input.wasPressed(KEY.ESCAPE)) toTitle();
    return;
  }

  // End screens: complete, landed short, crashed.
  if (input.wasPressed(KEY.ESCAPE)) { toTitle(); return; }
  if (state.screen === SCREENS.COMPLETE && input.wasPressed(KEY.ENTER)) {
    const next = state.missions.active.index + 1;
    if (next < MISSION_DEFS.length) briefMission(next);
    else toTitle();
    return;
  }
  if (input.wasPressed(KEY.RESTART) || input.wasPressed(KEY.ENTER) || clicks.length) launch();
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  step(dt);
  render(ctx, state);
  drawHud(ctx, state);
  input.endFrame();
  requestAnimationFrame(frame);
}

if (shot) stageShot(shot, state);
requestAnimationFrame(frame);
