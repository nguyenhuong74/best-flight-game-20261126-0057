// Keyboard and mouse state. The game reads keys by name, so the flight
// model never touches DOM events directly. Mouse position is kept in
// canvas pixels for menus, buttons and the throttle lever.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.mouseClicked = false;
    this.clickX = 0;
    this.clickY = 0;
    this.wheel = 0;

    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
      if (!e.repeat) this.pressed.add(e.key.length === 1 ? e.key.toLowerCase() : e.key);
      this.keys.add(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouseDown = false;
    });

    const toCanvas = (e) => {
      const r = canvas.getBoundingClientRect();
      const sx = canvas.width / r.width;
      const sy = canvas.height / r.height;
      return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
    };
    canvas.addEventListener('pointermove', (e) => {
      const p = toCanvas(e);
      this.mouseX = p.x;
      this.mouseY = p.y;
    });
    canvas.addEventListener('pointerdown', (e) => {
      const p = toCanvas(e);
      this.mouseX = p.x;
      this.mouseY = p.y;
      this.clickX = p.x;
      this.clickY = p.y;
      this.mouseDown = true;
      this.mouseClicked = true;
    });
    window.addEventListener('pointerup', () => {
      this.mouseDown = false;
    });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.wheel += e.deltaY;
    }, { passive: false });
  }

  down(name) {
    return this.keys.has(name);
  }

  /** True only on the frame the key went down. */
  hit(name) {
    return this.pressed.has(name);
  }

  /** True only on the frame the canvas was clicked; also gives the point. */
  click() {
    if (!this.mouseClicked) return null;
    return { x: this.clickX, y: this.clickY };
  }

  /** Clear the per-frame edges after the game has read them. */
  endFrame() {
    this.pressed.clear();
    this.mouseClicked = false;
    this.wheel = 0;
  }

  /** Pitch input: +1 nose up, -1 nose down, from keys.
   *  Arrows Up/Down pitch, and so do A/D; W/S work the throttle. */
  pitchAxis() {
    let v = 0;
    if (this.down('ArrowUp') || this.down('a')) v += 1;
    if (this.down('ArrowDown') || this.down('d')) v -= 1;
    return v;
  }

  /** Throttle input: +1 / -1 held, from keys.
   *  W/S work the throttle, and so do the Left/Right arrows. */
  throttleAxis() {
    let v = 0;
    if (this.down('w') || this.down('ArrowRight')) v += 1;
    if (this.down('s') || this.down('ArrowLeft')) v -= 1;
    return v;
  }
}
