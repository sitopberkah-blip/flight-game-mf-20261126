// Juice: particles, floating score text and screen shake. One job: make
// events read on screen — a ring bursts gold, a damaged engine trails
// smoke, a crash fills the frame, and the camera kicks when the plane is
// struck. The renderer owns the 3D projection; this module owns the
// short-lived things that live in the world and on the glass.

import { clamp } from './random.js';

export function createEffects() {
  return {
    particles: [], // world-space: { x, y, alt, vx, vy, vz, life, maxLife, size, colour, gravity, drag }
    texts: [], // screen-space: { x, y, vy, life, text, colour, size }
    shake: 0, // current shake magnitude in pixels
    flash: 0, // lightning / impact flash, 0..1
    rain: [], // screen-space streaks for the storm
    burst(x, y, alt, colour, count, speed, size, life) {
      for (let i = 0; i < count; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const up = Math.random() * 0.9 + 0.1;
        const sp = speed * (0.35 + Math.random() * 0.85);
        this.particles.push({
          x, y, alt,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: up * speed * 0.7,
          life: life * (0.6 + Math.random() * 0.7), maxLife: life,
          size: size * (0.6 + Math.random() * 0.9),
          colour, gravity: -6, drag: 0.92,
        });
      }
    },
    smokePuff(x, y, alt, dark) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 6, y: y + (Math.random() - 0.5) * 6, alt: alt + (Math.random() - 0.5) * 4,
        vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4, vz: 7 + Math.random() * 5,
        life: 1.5, maxLife: 1.5, size: 9 + Math.random() * 8,
        colour: dark ? '70,64,60' : '210,208,202', gravity: 3.5, drag: 0.985,
      });
    },
    explosion(x, y, alt) {
      this.burst(x, y, alt, '255,140,40', 42, 46, 7, 1.1);
      this.burst(x, y, alt, '255,205,80', 26, 30, 5, 0.8);
      this.burst(x, y, alt, '90,84,80', 20, 16, 11, 1.8);
      this.shake = Math.max(this.shake, 22);
      this.flash = Math.max(this.flash, 0.55);
    },
    ringBurst(x, y, alt, centre) {
      this.burst(x, y, alt, '255,205,64', centre ? 30 : 18, 30, 5, 0.85);
      this.burst(x, y, alt, '255,240,190', 10, 18, 3.5, 0.6);
    },
    addText(x, y, text, colour = '#ffd740', size = 26) {
      this.texts.push({ x, y, vy: -44, life: 1.5, maxLife: 1.5, text, colour, size });
    },
    kick(amount) {
      this.shake = Math.max(this.shake, amount);
    },
  };
}

/** Advance particles and texts; drain shake and flash back toward rest. */
export function stepEffects(fx, dt) {
  for (const p of fx.particles) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.alt += p.vz * dt;
    p.vz += p.gravity * dt;
    p.vx *= p.drag;
    p.vy *= p.drag;
  }
  fx.particles = fx.particles.filter((p) => p.life > 0);
  for (const t of fx.texts) {
    t.life -= dt;
    t.y += t.vy * dt;
  }
  fx.texts = fx.texts.filter((t) => t.life > 0);
  fx.shake = Math.max(0, fx.shake - dt * 34);
  fx.flash = Math.max(0, fx.flash - dt * 1.8);
}

/** The offset the camera should be displaced by this frame. */
export function shakeOffset(fx, time) {
  if (fx.shake <= 0.05) return { x: 0, y: 0 };
  const m = fx.shake;
  return {
    x: Math.sin(time * 61.7) * m * 0.6 + Math.sin(time * 38.3) * m * 0.4,
    y: Math.cos(time * 54.9) * m * 0.6 + Math.cos(time * 43.1) * m * 0.4,
  };
}

/** Rain streaks for the storm, recycled in screen space. */
export function stepRain(fx, w, h, dt, wind) {
  while (fx.rain.length < 130) {
    fx.rain.push({ x: Math.random() * (w + 120) - 60, y: Math.random() * -h, speed: 620 + Math.random() * 320, len: 13 + Math.random() * 15 });
  }
  for (const r of fx.rain) {
    r.y += r.speed * dt;
    r.x += wind * dt;
    if (r.y > h + 20) {
      r.y = -20;
      r.x = Math.random() * (w + 120) - 60;
    }
  }
}

export function drawRain(ctx, fx, w, h) {
  ctx.save();
  ctx.strokeStyle = 'rgba(190,215,240,0.4)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (const r of fx.rain) {
    ctx.moveTo(r.x, r.y);
    ctx.lineTo(r.x - 3.5, r.y + r.len);
  }
  ctx.stroke();
  ctx.restore();
}

/** Floating score texts, drawn last so they sit on the glass. */
export function drawTexts(ctx, fx) {
  ctx.save();
  ctx.textAlign = 'center';
  for (const t of fx.texts) {
    const a = clamp(t.life / t.maxLife, 0, 1);
    ctx.font = `800 ${t.size}px 'Segoe UI', system-ui, sans-serif`;
    ctx.globalAlpha = a;
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(10,18,28,0.65)';
    ctx.strokeText(t.text, t.x, t.y);
    ctx.fillStyle = t.colour;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.restore();
}
