// The aeroplane itself: its state, and the little prop plane drawn on the
// canvas — fuselage, wings, tail, spinning propeller and navigation lights.
// The plane always points up on screen; the world rotates beneath it.

import { PLANE } from './config.js';

export function createPlane() {
  return {
    x: 3000, // world position; the runway's north threshold is the start line
    y: 3900,
    heading: Math.PI, // radians; 0 is east, PI/2 is south, PI is west... see note
    speed: 0, // knots
    alt: 0, // feet above sea level
    vspeed: 0, // feet per second, + climbing
    throttle: 0,
    fuel: PLANE.fuelCapacity,
    bank: 0, // -1..1, the visible roll of the wings
    propAngle: 0,
    airborne: false,
    landed: false,
    crashed: false,
    crashReason: '',
  };
}

// Heading convention: 0 = east (+x), PI/2 = south (+y), so a heading of -PI/2
// (or 3PI/2) points north, up the runway toward the island's centre.
export function startPosition(plane) {
  plane.x = 3000;
  plane.y = 4450 + 260; // on the runway, near its south end
  plane.heading = -Math.PI / 2; // facing north, down the strip
  plane.speed = 0;
  plane.alt = 0;
  plane.vspeed = 0;
  plane.throttle = 0;
  plane.fuel = PLANE.fuelCapacity;
  plane.bank = 0;
  plane.airborne = false;
  plane.landed = false;
  plane.crashed = false;
  plane.crashReason = '';
}

/** Draw the plane at screen position (cx, cy), rolled by `bank` radians. */
export function drawPlane(ctx, cx, cy, plane, time) {
  const size = 1; // scale factor; the plane is drawn about 64 units long
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(plane.bank * 0.35);

  // Shadow on the ground below, offset and faded with altitude.
  const shadowLift = Math.min(46, plane.alt * 0.045);
  ctx.save();
  ctx.translate(shadowLift * 0.7, shadowLift);
  ctx.globalAlpha = Math.max(0.05, 0.3 - plane.alt / 4000);
  ctx.fillStyle = '#10202e';
  ctx.beginPath();
  ctx.ellipse(0, 4, 26 * size, 9 * size, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Wings (far wing first, so the fuselage sits on top).
  ctx.fillStyle = '#e8b13c';
  roundRect(ctx, -34, -4, 68, 13, 5);
  ctx.fill();
  ctx.fillStyle = '#c98f1e';
  roundRect(ctx, -34, 4, 68, 4, 2);
  ctx.fill();

  // Tailplane and fin.
  ctx.fillStyle = '#d23b3b';
  roundRect(ctx, -16, 22, 32, 9, 3);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-4, 20);
  ctx.lineTo(4, 20);
  ctx.lineTo(2, 34);
  ctx.lineTo(-2, 34);
  ctx.closePath();
  ctx.fill();

  // Fuselage: a cream body with a red stripe and a glass canopy.
  ctx.fillStyle = '#f4ead2';
  roundRect(ctx, -7, -30, 14, 62, 7);
  ctx.fill();
  ctx.fillStyle = '#d23b3b';
  ctx.fillRect(-7, -6, 14, 5);
  ctx.fillStyle = '#7ec3e8';
  ctx.beginPath();
  ctx.ellipse(0, -14, 5.5, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.beginPath();
  ctx.ellipse(-1.5, -17, 2, 4, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // Spinning propeller at the nose.
  const prop = plane.propAngle;
  ctx.strokeStyle = '#3c3f46';
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-Math.sin(prop) * 17, -30 - Math.cos(prop) * 17);
  ctx.lineTo(Math.sin(prop) * 17, -30 + Math.cos(prop) * 17);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-Math.cos(prop) * 17, -30 + Math.sin(prop) * 17);
  ctx.lineTo(Math.cos(prop) * 17, -30 - Math.sin(prop) * 17);
  ctx.stroke();
  ctx.fillStyle = '#3c3f46';
  ctx.beginPath();
  ctx.arc(0, -30, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // Navigation lights: red on the left wing, green on the right.
  const blink = Math.sin(time * 6) > 0;
  if (blink) {
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath();
    ctx.arc(-35, 2, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#34d17b';
    ctx.beginPath();
    ctx.arc(35, 2, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
