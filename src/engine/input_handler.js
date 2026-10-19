// Keys whose OS auto-repeat must not count as a new press (abilities 1-4, Shift jump, E melee, R reload)
const NO_REPEAT_PRESS = new Set(["1", "2", "3", "4", "shift", "e", "r"]);

export class InputHandler {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = {};
    this.pressedKeys = {};
    this.mouse = { x: 0, y: 0, down: false, rightDown: false, middleDown: false };
    this.mouseClicked = false;
    this.mouseInside = false; // false until the pointer moves over the window
    this.gamepadMove = { x: 0, y: 0 }; // left stick (-1..1), set by gamepad.js while a pad is connected
    this.gamepadRight = { x: 0, y: 0 };
    this.padHeld = new Set(); // controller buttons held down this frame // right stick in menus (-1..1), e.g. to scroll the mod inventory

    // iOS only turns taps into mouse events on elements it considers clickable (one with its own click
    // handler); the window-level listeners below don't count, so without this the canvas ignores taps on iPad
    canvas.addEventListener('click', () => {});

    window.addEventListener('keydown', this.handleKeyDown.bind(this));
    window.addEventListener('keyup', this.handleKeyUp.bind(this));
    // Focus lost (alt-tab, another window): key-up events never arrive, so drop every held key and button
    window.addEventListener('blur', () => this.releaseAll());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.releaseAll(); });
    window.addEventListener('mousemove', (e) => { this.mouseInside = true; this.updateMousePos(e); });
    // The pointer has left the window: its last position is no longer where the mouse is
    window.addEventListener('mouseout', (e) => { if (!e.relatedTarget) this.mouseInside = false; });

    window.addEventListener('mousedown', (e) => {
      // Taps and some clicks arrive without a preceding mousemove
      if (e.target === this.canvas) this.updateMousePos(e);
      if (e.button === 0) {
        this.mouse.down = true;
        this.mouseClicked = true;
      }
      if (e.button === 1) {
        this.mouse.middleDown = true;
        e.preventDefault(); // stops the browser's middle-click autoscroll, which takes over the mouse and freezes play
      }
      if (e.button === 2) this.mouse.rightDown = true;
      // The side (thumb) button acts as Back when the option is on
      if (e.button === 3 && this.thumbBack) {
        if (!this.keys.escape) this.pressedKeys.escape = true;
        this.keys.escape = true;
        setTimeout(() => { this.keys.escape = false; }, 50);
      }
    });

    // The middle button's own click event (auxclick) also starts autoscroll on some systems
    window.addEventListener('auxclick', (e) => { if (e.button === 1) e.preventDefault(); });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.down = false;
      if (e.button === 1) this.mouse.middleDown = false;
      if (e.button === 2) this.mouse.rightDown = false;
    });

    // Prevent right click context menu on game canvas
    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  updateMousePos(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
    this.mouse.y = (e.clientY - rect.top) * (this.canvas.height / rect.height);
  }

  isMouseClicked() {
    const clicked = this.mouseClicked;
    this.mouseClicked = false;
    return clicked;
  }

  getMousePos() {
    return this.mouse;
  }

  getWorldMousePos(camera = { x: 0, y: 0 }) {
    return {
      x: this.mouse.x + camera.x,
      y: this.mouse.y + camera.y,
      down: this.mouse.down,
      rightDown: this.mouse.rightDown,
      middleDown: this.mouse.middleDown
    };
  }
  // Once per frame: controller presses made since the last frame become this frame's presses, so no press leaks into a later frame
  beginFrame() {
    this.padNow = new Set();
    for (const key of Object.keys(this.pressedKeys)) {
      if (key.startsWith('pad') && this.pressedKeys[key]) {
        this.padNow.add(key);
        this.pressedKeys[key] = false;
      }
    }
  }

  isKeyDown(key) {
    return !!this.keys[key.toLowerCase()];
  }

  isKeyPressed(key) {
      const normalizedKey = key.toLowerCase();
      if (normalizedKey.startsWith('pad')) return !!this.padNow?.has(normalizedKey);
      const pressed = !!this.pressedKeys[normalizedKey];
      this.pressedKeys[normalizedKey] = false;
      return pressed;
    }

    // Alias for backward compatibility with UI modules
    isPressed(key) {
      return this.isKeyPressed(key);
    }

  handleKeyDown(event) {
    const key = event.key.toLowerCase();
    this.keys[key] = true;
    // The OS repeats a held key; for these keys a repeat is not a new press (no re-cast, re-switch or re-fire)
    if (event.repeat && NO_REPEAT_PRESS.has(key)) return;
    this.pressedKeys[key] = true;
  }

  releaseAll() {
    this.keys = {};
    this.mouse.down = false;
    this.mouse.rightDown = false;
    this.mouse.middleDown = false;
  }

  handleKeyUp(event) {
    const key = event.key.toLowerCase();
    this.keys[key] = false;
  }
}
