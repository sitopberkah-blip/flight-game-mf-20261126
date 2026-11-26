// Missions: the three sorties in order, the rings you must thread, the score,
// and the call to land when the last sortie is done.

import { MISSIONS, RINGS, RUNWAY } from './config.js';
import { onRunway } from './terrain.js';

export function createMissions() {
  return {
    index: 0,
    ringIndex: 0,
    score: 0,
    ringsPassed: 0,
    perfects: 0,
    startTime: 0,
    elapsed: 0,
    message: '',
    messageUntil: 0,
    finished: false,
    // The current target: a ring, or the runway once the rings are done.
    targetKind: 'ring',
    landed: false,
  };
}

export function currentMission(missions) {
  return MISSIONS[missions.index];
}

export function currentRing(missions) {
  const mission = currentMission(missions);
  if (!mission) return null;
  if (missions.ringIndex >= mission.rings.length) return null;
  return mission.rings[missions.ringIndex];
}

/** The world point the pilot should fly toward right now. */
export function currentTarget(missions) {
  const ring = currentRing(missions);
  if (ring) return { x: ring.x, y: ring.y, kind: 'ring', refuel: ring.refuel };
  if (currentMission(missions) && currentMission(missions).landAfter) {
    return { x: RUNWAY.x, y: RUNWAY.y, kind: 'runway', refuel: false };
  }
  return null;
}

export function startMissions(missions, now) {
  missions.index = 0;
  missions.ringIndex = 0;
  missions.score = 0;
  missions.ringsPassed = 0;
  missions.perfects = 0;
  missions.startTime = now;
  missions.elapsed = 0;
  missions.finished = false;
  missions.landed = false;
  showMessage(missions, 'Mission 1 — Ring Run: thread the glowing rings!', now, 5);
}

export function showMessage(missions, text, now, seconds = 3) {
  missions.message = text;
  missions.messageUntil = now + seconds;
}

/**
 * Check whether the plane just passed the current ring. Returns the points
 * earned (0 when nothing happened). A ring counts when the plane crosses its
 * circle low enough; a near-centre pass pays a perfect bonus.
 */
export function checkRing(missions, plane, now) {
  const ring = currentRing(missions);
  if (!ring) return 0;
  const dx = plane.x - ring.x;
  const dy = plane.y - ring.y;
  const dist = Math.hypot(dx, dy);
  if (dist > RINGS.radius || plane.alt > RINGS.passAltitudeMax) return 0;

  let points = RINGS.ringScore;
  if (dist < RINGS.radius * 0.45) {
    points += RINGS.perfectBonus;
    missions.perfects += 1;
    showMessage(missions, 'PERFECT — dead centre through the ring! +' + points, now, 2.5);
  } else {
    showMessage(missions, 'Ring! +' + points, now, 2);
  }
  missions.score += points;
  missions.ringsPassed += 1;
  if (ring.refuel) {
    plane.fuel = Math.min(100, plane.fuel + RINGS.refuelAmount);
    showMessage(missions, 'Ring! +' + points + ' — fuel topped up +' + RINGS.refuelAmount, now, 2.5);
  }
  missions.ringIndex += 1;

  const mission = currentMission(missions);
  if (missions.ringIndex >= mission.rings.length) {
    if (mission.landAfter) {
      showMessage(missions, 'All rings down — bring her home to runway 07!', now, 5);
    } else {
      missions.index += 1;
      missions.ringIndex = 0;
      const next = currentMission(missions);
      showMessage(missions, 'Mission complete! Next: ' + next.name + ' — ' + next.brief, now, 5);
    }
  }
  return points;
}

/** Called when the plane touches down on the runway after the last ring. */
export function onLanded(missions, plane, now) {
  missions.landed = true;
  missions.finished = true;
  const timeBonus = Math.max(0, Math.round(600 - missions.elapsed));
  const fuelBonus = Math.round(plane.fuel);
  missions.score += timeBonus + fuelBonus;
  return { timeBonus, fuelBonus };
}

/** Is the pilot on the final approach the HUD should point at? */
export function isFinalApproach(missions) {
  const mission = currentMission(missions);
  return !!mission && mission.landAfter && missions.ringIndex >= mission.rings.length;
}

/** True when the plane is over the runway strip, for the landing hint. */
export function overRunwayNow(plane) {
  return onRunway(plane.x, plane.y);
}
