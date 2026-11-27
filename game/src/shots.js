// The screenshot scenes behind ?shot=cover|storm|landing|phone. One job:
// pose the real game — real mission state, real plane state, real
// particles — at a composed moment of flight, frozen, so the maker's
// screenshots are honest renders of the game as it plays, each one
// showing a different sortie, weather and phase of flight.

import { SCREENS } from './config.js';
import { startMission } from './missions.js';

function pose(state, missionIndex, setup) {
  const { plane } = state;
  startMission(state.missions, missionIndex);
  const active = state.missions.active;
  Object.assign(plane, {
    pitch: 0, bank: 0, speed: 50, vspeed: 0, throttle: 0.65,
    fuel: 85, hull: 100, gearDown: false, airborne: true,
    stalled: false, smoke: 0, crashReason: '', touchdown: null,
  });
  setup(plane, active, state);
  state.weather = active.def.weather;
  state.screen = SCREENS.PLAY;
  state.frozen = true;
  return active;
}

/** Cover: Ring Run, banking left onto the second ring with a combo alive. */
function cover(state) {
  pose(state, 0, (plane, active, st) => {
    active.rings[0].taken = true;
    active.ringIndex = 1;
    active.score = 150;
    active.combo = 2;
    active.comboTimer = 5.5;
    active.elapsed = 41;
    plane.x = 6950;
    plane.y = 8428;
    plane.alt = 370;
    plane.heading = -0.34;
    plane.bank = -0.3;
    plane.pitch = 0.05;
    plane.speed = 54;
    plane.vspeed = 2.2;
    plane.throttle = 0.7;
    plane.fuel = 84;
    plane.propPhase = 2.2;
    // The first ring has just burst behind her; the next one glows ahead.
    st.effects.ringBurst(7050, 9050, 300, false);
    st.effects.addText(st.w / 2, st.h * 0.3, 'RING! +300', '#ffd23e', 30);
  });
}

/** Storm: Storm Run in the murk — damaged, smoking, low on fuel. */
function storm(state) {
  pose(state, 3, (plane, active, st) => {
    active.rings[0].taken = true;
    active.rings[1].taken = true;
    active.rings[2].taken = true;
    active.ringIndex = 3;
    active.score = 900;
    active.combo = 2;
    active.comboTimer = 3.4;
    active.elapsed = 161;
    plane.x = 5900;
    plane.y = 7260;
    plane.alt = 402;
    plane.heading = 0.35;
    plane.bank = 0.28;
    plane.pitch = -0.03;
    plane.speed = 61;
    plane.vspeed = -1.2;
    plane.throttle = 0.8;
    plane.fuel = 22;
    plane.hull = 54;
    plane.smoke = 0.9;
    plane.propPhase = 4.4;
    // A dense trail of dark smoke puffs laid back along her flight path.
    const fx = Math.sin(plane.heading);
    const fy = -Math.cos(plane.heading);
    for (let i = 1; i <= 14; i += 1) {
      for (let j = 0; j < 3; j += 1) {
        st.effects.smokePuff(plane.x - fx * i * 19, plane.y - fy * i * 19, plane.alt - i * 1.1, true);
      }
    }
    // Rain, seeded across the frame (the live game recycles it in flight).
    let rs = 1234567;
    const rnd = () => { rs = (rs * 1103515245 + 12345) & 0x7fffffff; return rs / 0x7fffffff; };
    for (let i = 0; i < 130; i += 1) {
      st.effects.rain.push({ x: rnd() * (st.w + 120) - 60, y: rnd() * st.h, speed: 620 + rnd() * 320, len: 13 + rnd() * 15 });
    }
    st.effects.flash = 0.35;
  });
}

/** Landing: Final Approach with the rings done, on the glide slope. */
function landing(state) {
  pose(state, 4, (plane, active) => {
    active.rings.forEach((r) => { r.taken = true; });
    active.ringIndex = active.rings.length;
    active.score = 780;
    active.elapsed = 203;
    const rw = state.terrain.runway;
    const along = -(rw.length / 2 + 430);
    // Slightly right of the centreline, crabbed a touch into the wind, so
    // the strip stands clear of the nose in the chase frame.
    plane.x = rw.x + Math.sin(rw.heading) * along + Math.cos(rw.heading) * 55;
    plane.y = rw.y - Math.cos(rw.heading) * along + Math.sin(rw.heading) * 55;
    plane.alt = rw.elevation + 95;
    plane.heading = rw.heading - 0.05;
    plane.bank = 0.03;
    plane.pitch = -0.04;
    plane.speed = 33;
    plane.vspeed = -2.4;
    plane.throttle = 0.3;
    plane.fuel = 41;
    plane.gearDown = true;
    plane.propPhase = 1.1;
  });
}

/** Phone: Coast Patrol over the harbour on a tall frame, thumbs on. */
function phone(state) {
  pose(state, 1, (plane, active) => {
    active.rings[0].taken = true;
    active.ringIndex = 1;
    active.score = 210;
    active.elapsed = 48;
    plane.x = 4870;
    plane.y = 8780;
    plane.alt = 296;
    plane.heading = -0.16;
    plane.bank = 0.14;
    plane.pitch = 0.04;
    plane.speed = 50;
    plane.vspeed = 1.4;
    plane.throttle = 0.62;
    plane.fuel = 88;
    plane.propPhase = 3.3;
  });
  state.touch.active = true;
  state.touch.stick.cx = 92;
  state.touch.stick.cy = state.h * 0.62;
  state.touch.stick.dx = 0.35;
  state.touch.stick.dy = -0.2;
}

const SCENES = { cover, storm, landing, phone };

/** Stage the named scene; unknown names leave the title screen alone. */
export function stageShot(name, state) {
  const scene = SCENES[name];
  if (scene) scene(state);
}
