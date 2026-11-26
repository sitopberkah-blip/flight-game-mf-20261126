// Keyboard and mouse input, kept as one small state object the flight model
// reads each step. Arrow keys / WASD fly the plane, Shift and Ctrl work the
// throttle, Space is the airbrake, P pauses, R restarts, M mutes.

export const KEY = {
  LEFT: 'ArrowLeft',
  RIGHT: 'ArrowRight',
  UP: 'ArrowUp',
  DOWN: 'ArrowDown',
  THROTTLE_UP: 'ShiftLeft',
  THROTTLE_DOWN: 'ControlLeft',
  BRAKE: 'Space',
  PAUSE: 'KeyP',
  RESTART: 'KeyR',
  MUTE: 'KeyM',
  ENTER: 'Enter',
};

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, active: false, down: false };

  function onKeyDown(event) {
    if (event.repeat) return;
    held.add(event.code);
    pressed.add(event.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
  }
  function onKeyUp(event) {
    held.delete(event.code);
  }
  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
    mouse.active = true;
  }
  function onMouseDown(event) {
    mouse.down = true;
    onMouseMove(event);
  }
  function onMouseUp() {
    mouse.down = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('touchstart', (event) => {
    const touch = event.touches[0];
    mouse.x = touch.clientX - canvas.getBoundingClientRect().left;
    mouse.y = touch.clientY - canvas.getBoundingClientRect().top;
    mouse.active = true;
    mouse.down = true;
    event.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchend', () => { mouse.down = false; }, { passive: true });
  canvas.addEventListener('touchmove', (event) => {
    const touch = event.touches[0];
    mouse.x = touch.clientX - canvas.getBoundingClientRect().left;
    mouse.y = touch.clientY - canvas.getBoundingClientRect().top;
    event.preventDefault();
  }, { passive: false });

  return {
    held,
    mouse,
    isDown(code) {
      return held.has(code);
    },
    /** True once for a key pressed since the last frame; cleared each frame. */
    wasPressed(code) {
      return pressed.has(code);
    },
    endFrame() {
      pressed.clear();
    },
    // Steering intent, -1 (full left) to +1 (full right), from keys or mouse.
    steer(planeScreenX, planeScreenY) {
      let steer = 0;
      if (held.has(KEY.LEFT) || held.has('KeyA')) steer -= 1;
      if (held.has(KEY.RIGHT) || held.has('KeyD')) steer += 1;
      if (steer === 0 && mouse.active && mouse.down) {
        const dx = mouse.x - planeScreenX;
        const dy = mouse.y - planeScreenY;
        if (Math.hypot(dx, dy) > 24) steer = Math.max(-1, Math.min(1, dx / 90));
      }
      return steer;
    },
    // Pitch intent, -1 (dive) to +1 (climb).
    pitch() {
      let pitch = 0;
      if (held.has(KEY.UP) || held.has('KeyW')) pitch += 1;
      if (held.has(KEY.DOWN) || held.has('KeyS')) pitch -= 1;
      return pitch;
    },
    throttleDelta(dt) {
      let delta = 0;
      if (held.has(KEY.THROTTLE_UP) || held.has('ShiftRight')) delta += 0.9 * dt;
      if (held.has(KEY.THROTTLE_DOWN) || held.has('ControlRight')) delta -= 0.9 * dt;
      return delta;
    },
    brake() {
      return held.has(KEY.BRAKE);
    },
  };
}
