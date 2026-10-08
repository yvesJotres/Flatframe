export class InputHandler {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = {};
    this.pressedKeys = {};
    this.mouse = { x: 0, y: 0, down: false, rightDown: false, middleDown: false };
    this.mouseClicked = false;

    window.addEventListener('keydown', this.handleKeyDown.bind(this));
    window.addEventListener('keyup', this.handleKeyUp.bind(this));
    window.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
      this.mouse.y = (e.clientY - rect.top) * (this.canvas.height / rect.height);
    });

    window.addEventListener('mousedown', (e) => {
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
