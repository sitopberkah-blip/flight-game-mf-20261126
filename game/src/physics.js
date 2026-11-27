// The flight model: one fixed step of arcade flying with real discipline
// in it. Throttle spools, the wing stalls, banking turns the plane at a
// rate the speed has to pay for, pitch trades speed for height, fuel
// burns faster the harder you push, and the ground — runway, grass, rock
// or sea — ends the sortie according to how you meet it.
//
// Units: metres, m/s, radians. Input is { roll, pitch, throttleDelta,
// brake } with each axis in [-1, 1]; weather turbulence arrives as
// { pitch, roll, lift } nudges the storm adds on top of the stick.

import { FLIGHT, WORLD } from './config.js';
import { clamp, wrapAngle } from './random.js';

const ROTATE_SPEED = 29; // m/s: pull here and she leaves the ground
const GROUND_STEER = 0.5; // rad/s of rudder at taxi speed

function runwayFrame(runway, x, y) {
  const dx = x - runway.x;
  const dy = y - runway.y;
  return {
    along: dx * Math.sin(runway.heading) - dy * Math.cos(runway.heading),
    across: dx * Math.cos(runway.heading) + dy * Math.sin(runway.heading),
  };
}

export function overRunway(runway, x, y, margin = 0) {
  const f = runwayFrame(runway, x, y);
  return Math.abs(f.along) <= runway.length / 2 + margin && Math.abs(f.across) <= runway.width / 2 + margin;
}

export function stepFlight(plane, input, dt, terrain, turb = { pitch: 0, roll: 0, lift: 0 }) {
  const runway = terrain.runway;
  const groundH = Math.max(terrain.groundHeight(plane.x, plane.y), 0);
  const onStrip = overRunway(runway, plane.x, plane.y);
  const floorH = onStrip ? runway.elevation : groundH;

  // Throttle and propeller.
  plane.throttle = clamp(plane.throttle + input.throttleDelta * FLIGHT.spoolRate * dt, 0, 1);
  if (plane.fuel <= 0) plane.throttle = 0; // a dry tank is a glider
  plane.propPhase += (1.5 + plane.throttle * 26 + plane.speed * 0.25) * dt * Math.PI;

  // Attitude: the stick commands bank and pitch, the airframe follows.
  const targetBank = input.roll * FLIGHT.maxBank + turb.roll;
  plane.bank += clamp(targetBank - plane.bank, -2.4 * dt, 2.4 * dt);
  let targetPitch = input.pitch * FLIGHT.maxPitch + turb.pitch;
  if (!plane.airborne) targetPitch = plane.speed > ROTATE_SPEED ? targetPitch : Math.min(0, targetPitch);
  plane.pitch += clamp(targetPitch - plane.pitch, -1.9 * dt, 1.9 * dt);

  // Speed: thrust against drag, with pitch trading height for knots.
  const thrust = plane.throttle * FLIGHT.accel;
  const drag = FLIGHT.drag * plane.speed * plane.speed + (input.brake ? 2.6 : 0);
  let accel = thrust - drag - (plane.airborne ? Math.sin(plane.pitch) * 6.4 : 0);
  if (!plane.airborne && !onStrip) accel -= plane.speed * 0.22; // grass drags
  plane.speed = Math.max(0, plane.speed + accel * dt);

  // Heading: a coordinated turn in the air, the rudder on the ground.
  if (plane.airborne) {
    const turn = (9.8 * Math.tan(clamp(plane.bank, -1.2, 1.2))) / Math.max(plane.speed, 20);
    plane.heading = wrapAngle(plane.heading + clamp(turn, -FLIGHT.turnRate, FLIGHT.turnRate) * dt);
  } else {
    plane.heading = wrapAngle(plane.heading + input.roll * GROUND_STEER * clamp(plane.speed / 18, 0, 1) * dt);
  }

  // Vertical: lift grows with speed; below the stall the nose drops away.
  const lift = clamp(plane.speed / FLIGHT.cruiseSpeed, 0, 1.2);
  plane.stalled = plane.airborne && plane.speed < FLIGHT.minSpeed;
  let vspeed = Math.sin(plane.pitch) * plane.speed * 0.82 * Math.min(lift, 1)
    + (plane.throttle - 0.42) * 3.4 * lift
    + turb.lift;
  if (plane.stalled) vspeed -= (FLIGHT.minSpeed - plane.speed) * 0.42 + 2.4;
  if (plane.alt > WORLD.ceiling) vspeed -= (plane.alt - WORLD.ceiling) * 0.01;
  plane.vspeed = plane.airborne ? vspeed : 0;

  // Travel.
  const forward = plane.speed * Math.cos(plane.pitch * 0.55);
  plane.x = clamp(plane.x + Math.sin(plane.heading) * forward * dt, 240, WORLD.size - 240);
  plane.y = clamp(plane.y - Math.cos(plane.heading) * forward * dt, 240, WORLD.size - 240);
  if (plane.airborne) plane.alt += plane.vspeed * dt;

  // Fuel and smoke.
  if (plane.speed > 3 || plane.throttle > 0.05) {
    plane.fuel = Math.max(0, plane.fuel - FLIGHT.fuelBurn * (0.3 + 0.85 * plane.throttle) * dt);
  }
  plane.smoke = plane.hull < 45 ? clamp(1 - plane.hull / 45, 0, 1) : 0;

  // Leaving the ground.
  if (!plane.airborne) {
    plane.alt = floorH + 2;
    if (plane.speed >= ROTATE_SPEED && plane.pitch > 0.1) {
      plane.airborne = true;
      plane.alt += 1;
      return 'flying';
    }
    // Rolling into the sea or a hillside at speed ends the roll.
    if (plane.speed > 24 && !onStrip) {
      if (terrain.groundHeight(plane.x, plane.y) < 0) {
        plane.crashReason = 'You rolled into the sea. The runway was the grey strip — the blue part is water.';
        return 'crashed';
      }
      plane.hull -= 26 * dt * (plane.speed / 30);
      if (plane.hull <= 0) {
        plane.crashReason = 'The rough ground shook her apart. Keep the roll on the strip.';
        return 'crashed';
      }
    }
    return 'ground';
  }

  // Meeting the ground again.
  const newGround = Math.max(terrain.groundHeight(plane.x, plane.y), 0);
  const newStrip = overRunway(runway, plane.x, plane.y);
  const floor = newStrip ? runway.elevation : newGround;
  if (plane.alt <= floor + 2) {
    const frame = runwayFrame(runway, plane.x, plane.y);
    plane.touchdown = {
      vspeed: plane.vspeed,
      speed: plane.speed,
      offset: frame.across,
      onRunway: newStrip,
      surface: newStrip ? 'runway' : (terrain.groundHeight(plane.x, plane.y) < 0 ? 'water' : 'grass'),
      headingError: Math.abs(wrapAngle(plane.heading - runway.heading)),
    };
    if (plane.touchdown.surface === 'water') {
      plane.crashReason = 'Ditched in the sea. Salt water is not a runway.';
      return 'crashed';
    }
    if (!newStrip && (plane.speed > 42 || plane.vspeed < -3.5)) {
      plane.crashReason = 'You flew into the ground at speed. Terrain is not a runway — only the strip, or a very gentle arrival on grass, forgives.';
      return 'crashed';
    }
    if (!plane.gearDown) {
      plane.crashReason = 'Belly landing — the gear was still up. Press G before you descend.';
      return 'crashed';
    }
    if (plane.vspeed < -6.5) {
      plane.crashReason = 'You arrived too hard: the descent broke the gear. Flare gently, under 6 m/s down.';
      return 'crashed';
    }
    if (newStrip && plane.touchdown.headingError > 0.6) {
      plane.crashReason = 'You touched down across the strip, not along it. Line up on heading 070.';
      return 'crashed';
    }
    plane.alt = floor + 2;
    plane.airborne = false;
    plane.speed = Math.min(plane.speed, 30);
    return 'landed';
  }
  return 'flying';
}
