// The aeroplane: its state, and the chase-view drawing of it — a high-wing
// prop plane seen from behind and above, the way a chase camera frames it.
// One job: own what the plane is and how it looks; the flight model in
// physics.js decides where it goes.

import { FLIGHT } from './config.js';

export function createPlane() {
  return {
    x: 7050, // metres east of the chart's west edge
    y: 11200, // metres south of the chart's north edge
    alt: 16, // metres above sea level (sitting on Runway 07)
    heading: (70 * Math.PI) / 180, // aligned with the strip
    pitch: 0, // radians, nose up positive
    bank: 0, // radians, right wing down positive
    speed: 0, // m/s forward
    vspeed: 0, // m/s climb, positive up
    throttle: 0,
    fuel: FLIGHT.fuelCapacity,
    hull: FLIGHT.hullMax,
    gearDown: true,
    airborne: false,
    stalled: false,
    propPhase: 0,
    smoke: 0, // 0..1, how badly she is smoking from damage
    crashReason: '',
    touchdown: null, // filled by the flight model on landing
  };
}

/** Put the plane on Runway 07, ready for a takeoff roll. */
export function startPosition(plane, runway) {
  const back = runway.length / 2 - 60;
  plane.x = runway.x - Math.sin(runway.heading) * back;
  plane.y = runway.y + Math.cos(runway.heading) * back;
  plane.alt = runway.elevation + 2;
  plane.heading = runway.heading;
  plane.pitch = 0;
  plane.bank = 0;
  plane.speed = 0;
  plane.vspeed = 0;
  plane.throttle = 0;
  plane.fuel = FLIGHT.fuelCapacity;
  plane.hull = FLIGHT.hullMax;
  plane.gearDown = true;
  plane.airborne = false;
  plane.stalled = false;
  plane.smoke = 0;
  plane.crashReason = '';
  plane.touchdown = null;
}

/**
 * Draw the plane from the chase view at screen point (cx, cy), scaled so
 * `size` is roughly the wingspan in pixels. The drawing banks and pitches
 * with the flight model, the propeller is a blurred disc with two blade
 * glints, and the navigation lights burn red, green and white.
 */
export function drawPlane(ctx, plane, cx, cy, size, time) {
  const s = size / 100; // the drawing is authored on a 100-unit wingspan
  ctx.save();
  ctx.translate(cx, cy);
  ctx.transform(1, 0, Math.sin(plane.bank) * 0.42, 1, 0, 0); // lean with the bank
  ctx.rotate(plane.bank * 0.22);
  ctx.translate(0, plane.pitch * size * 0.55);

  // Soft shadow blob is drawn by the renderer on the ground; here the plane.
  // Tailplane: at the TAIL (bottom of the frame, nearest the camera) — a
  // red bar spanning wider than the tail cone it is bolted to.
  ctx.fillStyle = '#a93228';
  ctx.fillRect(-26 * s, 22 * s, 52 * s, 7 * s);
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(-26 * s, 27.5 * s, 52 * s, 1.6 * s);

  // Main wing: a long tapered plank with aileron shading and tip tanks.
  const wingGrad = ctx.createLinearGradient(-50 * s, 0, 50 * s, 0);
  wingGrad.addColorStop(0, '#d94f43');
  wingGrad.addColorStop(0.5, '#e8604f');
  wingGrad.addColorStop(1, '#d94f43');
  ctx.fillStyle = wingGrad;
  ctx.beginPath();
  ctx.moveTo(-50 * s, -2 * s);
  ctx.lineTo(-38 * s, -13 * s);
  ctx.lineTo(38 * s, -13 * s);
  ctx.lineTo(50 * s, -2 * s);
  ctx.lineTo(46 * s, 4 * s);
  ctx.lineTo(-46 * s, 4 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.fillRect(-50 * s, 1.5 * s, 100 * s, 2.4 * s); // aileron hinge line

  // Fuselage: rounded body from spinner to tail, sunlit on top.
  const bodyGrad = ctx.createLinearGradient(0, -46 * s, 0, 30 * s);
  bodyGrad.addColorStop(0, '#f3ede0');
  bodyGrad.addColorStop(0.55, '#e8e0cd');
  bodyGrad.addColorStop(1, '#cfc4ab');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.moveTo(0, -47 * s);
  ctx.bezierCurveTo(9 * s, -40 * s, 10 * s, -18 * s, 8 * s, 4 * s);
  ctx.bezierCurveTo(7 * s, 20 * s, 5 * s, 28 * s, 0, 30 * s);
  ctx.bezierCurveTo(-5 * s, 28 * s, -7 * s, 20 * s, -8 * s, 4 * s);
  ctx.bezierCurveTo(-10 * s, -18 * s, -9 * s, -40 * s, 0, -47 * s);
  ctx.fill();
  ctx.fillStyle = '#c8433a';
  ctx.fillRect(-8 * s, 6 * s, 16 * s, 5 * s); // cheatline stripe

  // Fin and rudder: a red plate along the centreline of the tail cone,
  // seen edge-on from behind and above.
  ctx.fillStyle = '#c8433a';
  ctx.beginPath();
  ctx.moveTo(0, -4 * s);
  ctx.lineTo(3.4 * s, 12 * s);
  ctx.lineTo(2.6 * s, 28 * s);
  ctx.lineTo(-2.6 * s, 28 * s);
  ctx.lineTo(-3.4 * s, 12 * s);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(90,20,10,0.4)';
  ctx.lineWidth = 1 * s;
  ctx.stroke();

  // Canopy: a dark glasshouse with a sky glint.
  const glassGrad = ctx.createLinearGradient(0, -34 * s, 0, -12 * s);
  glassGrad.addColorStop(0, '#3d5a74');
  glassGrad.addColorStop(0.5, '#22384e');
  glassGrad.addColorStop(1, '#16283a');
  ctx.fillStyle = glassGrad;
  ctx.beginPath();
  ctx.moveTo(0, -35 * s);
  ctx.bezierCurveTo(6 * s, -32 * s, 6.5 * s, -18 * s, 5 * s, -12 * s);
  ctx.lineTo(-5 * s, -12 * s);
  ctx.bezierCurveTo(-6.5 * s, -18 * s, -6 * s, -32 * s, 0, -35 * s);
  ctx.fill();
  ctx.fillStyle = 'rgba(190,225,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(-2 * s, -27 * s, 2.2 * s, 6 * s, 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Propeller: blurred disc, two blade glints sweeping with the phase.
  const rpm = 0.25 + plane.throttle * 0.75 + (plane.speed > 2 ? 0.2 : 0);
  const blur = Math.min(0.34, 0.08 + rpm * 0.3);
  ctx.fillStyle = `rgba(40,40,46,${blur})`;
  ctx.beginPath();
  ctx.ellipse(0, -46 * s, 21 * s, 5.5 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(25,25,30,0.75)';
  ctx.lineWidth = 2.4 * s;
  const a = plane.propPhase;
  ctx.beginPath();
  ctx.moveTo(Math.cos(a) * -20 * s, -46 * s + Math.sin(a) * 4.6 * s);
  ctx.lineTo(Math.cos(a) * 20 * s, -46 * s - Math.sin(a) * 4.6 * s);
  ctx.stroke();
  ctx.fillStyle = '#d8b13c';
  ctx.beginPath();
  ctx.arc(0, -46 * s, 3.4 * s, 0, Math.PI * 2); // spinner
  ctx.fill();

  // Landing gear: struts and wheels when the gear is down.
  if (plane.gearDown) {
    ctx.strokeStyle = '#5a5a60';
    ctx.lineWidth = 2.2 * s;
    ctx.beginPath();
    ctx.moveTo(-7 * s, 8 * s);
    ctx.lineTo(-13 * s, 22 * s);
    ctx.moveTo(7 * s, 8 * s);
    ctx.lineTo(13 * s, 22 * s);
    ctx.stroke();
    ctx.fillStyle = '#26262b';
    for (const wx of [-14, 14]) {
      ctx.beginPath();
      ctx.ellipse(wx * s, 24 * s, 3.6 * s, 5 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Navigation lights: port red, starboard green, tail white strobe.
  const strobe = time % 1.1 < 0.07;
  ctx.fillStyle = '#ff4b3e';
  ctx.beginPath();
  ctx.arc(-49 * s, 0, 2.2 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3eff7a';
  ctx.beginPath();
  ctx.arc(49 * s, 0, 2.2 * s, 0, Math.PI * 2);
  ctx.fill();
  if (strobe) {
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.arc(0, -36 * s, 2.6 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
