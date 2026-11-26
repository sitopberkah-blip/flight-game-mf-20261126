// The flight model: one step of arcade flying. Throttle sets a target speed,
// pitch trades speed for altitude, banking turns the plane, and the ground
// (or the sea, or a hard runway) ends the flight when you meet it badly.
//
// Units: speed in knots, distances in world units, altitude in feet.
// 1 knot moves about 1.15 world units per second at this chart's scale.

import { PLANE, RUNWAY, WORLD } from './config.js';
import { onRunway } from './terrain.js';

const KNOT_TO_UNITS = 1.15;
const GROUND_FRICTION = 0.92; // rolling on the runway bleeds speed fast

export function stepFlight(plane, input, dt, terrain) {
  if (plane.crashed || plane.landed) return 'done';

  // Throttle: Shift raises it, Ctrl lowers it, the airbrake drags it down.
  plane.throttle = clamp(plane.throttle + input.throttleDelta(dt), 0, 1);
  let throttle = plane.throttle;
  if (input.brake) throttle = Math.max(0, throttle - 0.5);

  // Airspeed chases the throttle's target, faster on the ground roll.
  const targetSpeed = throttle * PLANE.maxSpeed;
  const accel = plane.airborne ? PLANE.accel : PLANE.accel * 1.6;
  plane.speed += clamp(targetSpeed - plane.speed, -accel * dt, accel * dt);
  if (input.brake && !plane.airborne) plane.speed *= Math.pow(GROUND_FRICTION, dt * 60);

  // Banking turns: the turn rate is best at cruise speed and weak when slow.
  const speedFactor = clamp(plane.speed / PLANE.cruiseSpeed, 0.25, 1.1);
  const turn = input.steer * PLANE.turnRate * speedFactor;
  plane.heading += turn * dt;
  plane.bank += (clamp(input.steer, -1, 1) - plane.bank) * Math.min(1, dt * 6);

  // Pitch: climb trades speed for height, a dive trades height for speed.
  const pitch = input.pitch;
  const flying = plane.airborne || plane.speed >= PLANE.minFlySpeed;
  if (flying) {
    plane.vspeed = pitch * PLANE.climbRate * speedFactor;
    if (pitch > 0) plane.speed -= pitch * 9 * dt; // climbing costs speed
    if (pitch < 0) plane.speed += -pitch * 7 * dt; // diving gains it
  } else {
    plane.vspeed = 0;
  }

  // Stall: below flying speed with no ground under you, you sink.
  if (plane.airborne && plane.speed < PLANE.minFlySpeed) {
    plane.vspeed -= (PLANE.minFlySpeed - plane.speed) * 0.55;
  }

  // Fuel burns with the throttle; empty tanks mean a silent glide.
  const burn = PLANE.fuelIdle + (PLANE.fuelBurn - PLANE.fuelIdle) * throttle;
  plane.fuel = Math.max(0, plane.fuel - burn * dt);
  if (plane.fuel <= 0 && plane.throttle > 0) {
    plane.throttle = 0;
  }

  // Move.
  const step = plane.speed * KNOT_TO_UNITS * dt;
  plane.x += Math.cos(plane.heading) * step;
  plane.y += Math.sin(plane.heading) * step;
  plane.alt = Math.max(0, plane.alt + plane.vspeed * dt);
  plane.propAngle += (2 + plane.throttle * 26) * dt;

  // Leaving the chart is leaving the sortie: turn the pilot back gently.
  if (plane.x < 60 || plane.x > WORLD.size - 60 || plane.y < 60 || plane.y > WORLD.size - 60) {
    const cx = WORLD.islandCentreX - plane.x;
    const cy = WORLD.islandCentreY - plane.y;
    const home = Math.atan2(cy, cx);
    plane.heading = turnToward(plane.heading, home, 0.5 * dt);
  }

  // Takeoff: fast enough on the runway and you are flying.
  if (!plane.airborne && plane.speed >= PLANE.minFlySpeed) {
    plane.airborne = true;
    plane.alt = Math.max(plane.alt, 4);
  }

  // Ground contact.
  if (plane.alt <= 0) {
    const ground = terrain.heightAt(plane.x, plane.y);
    const overRunway = onRunway(plane.x, plane.y);
    if (plane.airborne || plane.speed >= PLANE.minFlySpeed) {
      if (overRunway && ground <= 2) {
        if (plane.speed <= RUNWAY.maxTouchSpeed && plane.vspeed >= -RUNWAY.maxSink) {
          plane.landed = true;
          plane.alt = 0;
          plane.vspeed = 0;
          return 'landed';
        }
        return crash(plane, plane.speed > RUNWAY.maxTouchSpeed ? 'Too fast for the runway — the landing gear folded.' : 'You slammed into the runway. Ease the descent next time.');
      }
      if (ground > 2) return crash(plane, 'You flew into the hillside.');
      return crash(plane, 'You ditched in the sea.');
    }
    // Rolling on the ground: only the runway is smooth enough to keep going.
    if (!overRunway && plane.speed > 8) {
      return crash(plane, ground > 2 ? 'You ran off the runway into rough ground.' : 'You taxied off the runway into the sea.');
    }
    plane.alt = 0;
    plane.vspeed = 0;
  } else if (plane.airborne && plane.alt <= terrain.heightAt(plane.x, plane.y)) {
    return crash(plane, 'You clipped the terrain.');
  }

  // Out of fuel over the sea or hills with no runway under you: a forced landing.
  if (plane.fuel <= 0 && plane.alt <= 0 && !onRunway(plane.x, plane.y)) {
    return crash(plane, 'Out of fuel — you put her down in the rough.');
  }
  return 'flying';
}

function crash(plane, reason) {
  plane.crashed = true;
  plane.crashReason = reason;
  plane.speed = 0;
  plane.vspeed = 0;
  return 'crashed';
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function turnToward(angle, target, maxStep) {
  let diff = target - angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return angle + clamp(diff, -maxStep, maxStep);
}
