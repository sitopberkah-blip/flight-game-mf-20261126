// Input: keyboard, mouse and touch, kept as one small state the flight
// model reads each step. One job: turn whatever the player is doing —
// arrow keys, a mouse held off-centre, or two thumbs — into stick axes,
// a throttle rate and a set of edge-triggered buttons.

import { clamp } from './random.js';

export const KEY = {
  ENTER: 'Enter',
  PAUSE: 'KeyP',
  RESTART: 'KeyR',
  GEAR: 'KeyG',
  BRAKE: 'KeyB',
  MUTE: 'KeyM',
  ESCAPE: 'Escape',
};

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, down: false, inside: false };
  const clicks = [];
  const touch = {
    active: false,
    stick: { id: null, cx: 110, cy: 0, dx: 0, dy: 0 },
    throttleTouch: { id: null },
    gearTap: false,
  };

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!held.has(e.code)) pressed.add(e.code);
    held.add(e.code);
  });
  window.addEventListener('keyup', (e) => held.delete(e.code));
  window.addEventListener('blur', () => held.clear());

  canvas.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.inside = true;
  });
  canvas.addEventListener('mousedown', (e) => {
    mouse.down = true;
    clicks.push({ x: e.clientX, y: e.clientY });
  });
  window.addEventListener('mouseup', () => { mouse.down = false; });
  canvas.addEventListener('mouseleave', () => { mouse.inside = false; });

  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    touch.active = true;
    for (const t of e.changedTouches) {
      if (t.clientX < window.innerWidth * 0.45 && touch.stick.id === null) {
        touch.stick.id = t.identifier;
        touch.stick.cx = t.clientX;
        touch.stick.cy = t.clientY;
        touch.stick.dx = 0;
        touch.stick.dy = 0;
      } else if (t.clientX > window.innerWidth - 90 && t.clientY < window.innerHeight * 0.3) {
        touch.gearTap = true;
      } else if (touch.throttleTouch.id === null) {
        touch.throttleTouch.id = t.identifier;
        touch.throttleTouch.y = t.clientY;
      }
      clicks.push({ x: t.clientX, y: t.clientY });
    }
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === touch.stick.id) {
        touch.stick.dx = clamp((t.clientX - touch.stick.cx) / 52, -1, 1);
        touch.stick.dy = clamp((t.clientY - touch.stick.cy) / 52, -1, 1);
      }
      if (t.identifier === touch.throttleTouch.id) touch.throttleTouch.y = t.clientY;
    }
  }, { passive: false });
  const endTouch = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === touch.stick.id) {
        touch.stick.id = null;
        touch.stick.dx = 0;
        touch.stick.dy = 0;
      }
      if (t.identifier === touch.throttleTouch.id) touch.throttleTouch.id = null;
    }
  };
  canvas.addEventListener('touchend', endTouch);
  canvas.addEventListener('touchcancel', endTouch);

  const axis = (neg, pos) => (held.has(pos) ? 1 : 0) - (held.has(neg) ? 1 : 0);

  return {
    mouse,
    touch,
    clicks,
    wasPressed: (code) => pressed.has(code),
    /** Roll axis in [-1, 1]: keys, mouse offset from centre, or the stick. */
    roll() {
      const key = axis('ArrowLeft', 'ArrowRight') + axis('KeyA', 'KeyD');
      if (key) return clamp(key, -1, 1);
      if (touch.stick.id !== null) return touch.stick.dx;
      if (mouse.inside && !touch.active) {
        return clamp((mouse.x - window.innerWidth / 2) / (window.innerWidth * 0.22), -1, 1);
      }
      return 0;
    },
    /** Pitch axis in [-1, 1]: stick up climbs (arcade convention). */
    pitch() {
      const arrows = (held.has('ArrowUp') ? 1 : 0) - (held.has('ArrowDown') ? 1 : 0);
      if (arrows) return arrows;
      if (touch.stick.id !== null) return -touch.stick.dy;
      if (mouse.inside && !touch.active) {
        return clamp((window.innerHeight * 0.44 - mouse.y) / (window.innerHeight * 0.2), -1, 1);
      }
      return 0;
    },
    /** Throttle rate per second from the W/S keys, in [-1.4, 1.4]. */
    throttleDelta() {
      let d = 0;
      if (held.has('KeyW')) d += 1;
      if (held.has('KeyS')) d -= 1;
      return d * 1.4;
    },
    /** Absolute throttle the touch rail is asking for, or null. */
    throttleTarget() {
      if (touch.throttleTouch.id === null || touch.throttleTouch.y == null) return null;
      const railTop = window.innerHeight * 0.3;
      const railH = window.innerHeight * 0.38;
      return clamp(1 - (touch.throttleTouch.y - railTop) / railH, 0, 1);
    },
    brake: () => held.has('KeyB') || held.has('Space'),
    gearPressed() {
      const g = pressed.has(KEY.GEAR) || touch.gearTap;
      touch.gearTap = false;
      return g;
    },
    takeClicks() {
      const out = clicks.slice();
      clicks.length = 0;
      return out;
    },
    endFrame() {
      pressed.clear();
    },
  };
}
