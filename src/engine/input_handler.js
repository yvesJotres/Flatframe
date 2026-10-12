export class InputHandler {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = {};
    this.pressedKeys = {};
    this.mouse = { x: 0, y: 0, down: false, rightDown: false, middleDown: false };
    this.mouseClicked = false;
    this.mouseInside = false; // false until the pointer moves over the window

    // iOS only turns taps into mouse events on elements it considers clickable (one with its own click
    // handler); the window-level listeners below don't count, so without this the canvas ignores taps on iPad
    canvas.addEventListener('click', () => {});

    window.addEventListener('keydown', this.handleKeyDown.bind(this));
    window.addEventListener('keyup', this.handleKeyUp.bind(this));
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
      if (e.button === 1) this.mouse.middleDown = true;
      if (e.button === 2) this.mouse.rightDown = true;
    });

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
  isKeyDown(key) {
    return !!this.keys[key.toLowerCase()];
  }

  isKeyPressed(key) {
      const normalizedKey = key.toLowerCase();
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
    this.pressedKeys[key] = true;
    this.keys[key] = true;
  }

  handleKeyUp(event) {
    const key = event.key.toLowerCase();
    this.keys[key] = false;
  }
}
