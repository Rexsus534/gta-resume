/**
 * Keyboard, pointer-lock mouse look and wheel zoom.
 * Mouse deltas accumulate between frames and are drained by the camera rig.
 */
export function createInput(canvas) {
  const down = new Set();
  const edge = new Set(); // keys pressed since the last drain
  const overlay = document.getElementById('click-to-play');

  const mouse = { dx: 0, dy: 0, idle: 0 };
  let wheel = 0;
  let locked = false;

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    down.add(e.code);
    edge.add(e.code);
    // Stop the page scrolling out from under the game.
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
  });

  window.addEventListener('keyup', (e) => down.delete(e.code));

  // Held keys would otherwise stick when the tab loses focus.
  window.addEventListener('blur', () => down.clear());

  canvas.addEventListener('click', () => {
    if (!locked) canvas.requestPointerLock();
  });
  overlay.addEventListener('click', () => canvas.requestPointerLock());

  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
    overlay.classList.toggle('hidden', locked);
    if (!locked) down.clear();
  });

  window.addEventListener('mousemove', (e) => {
    if (!locked) return;
    mouse.dx += e.movementX;
    mouse.dy += e.movementY;
  });

  window.addEventListener(
    'wheel',
    (e) => {
      wheel += e.deltaY;
      if (locked) e.preventDefault();
    },
    { passive: false },
  );

  return {
    isDown: (code) => down.has(code),
    /** True once per physical press. */
    consumePress(code) {
      if (!edge.has(code)) return false;
      edge.delete(code);
      return true;
    },
    get locked() {
      return locked;
    },
    showOverlay(show) {
      overlay.classList.toggle('hidden', !show || locked);
    },
    /** Returns accumulated mouse motion and resets it. */
    drainMouse(dt) {
      const out = { dx: mouse.dx, dy: mouse.dy };
      if (out.dx !== 0 || out.dy !== 0) mouse.idle = 0;
      else mouse.idle += dt;
      mouse.dx = 0;
      mouse.dy = 0;
      return out;
    },
    /** Seconds since the mouse last moved — used to hand yaw back to the car. */
    get mouseIdle() {
      return mouse.idle;
    },
    drainWheel() {
      const out = wheel;
      wheel = 0;
      return out;
    },
    endFrame() {
      edge.clear();
    },
  };
}
