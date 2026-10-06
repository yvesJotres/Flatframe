// Simple canvas-based pause menu shown when the player presses Esc.
import { audioManager } from '../core/audio.js';

export default class PauseMenu {
  constructor() {
    this.visible = false;
    this.options = [
      { label: 'Resume', action: 'resume' },
      { label: 'Abort Mission', action: 'abort' },
    ];
    this.selectedIndex = 0;
    // Cached layout of option bounding boxes, recomputed each draw(), used for mouse hit-testing.
    this.optionBounds = [];
    this.lastHoverIndex = -1; // hover blip only fires when this changes
  }

  toggle() {
    this.visible = !this.visible;
    if (this.visible) {
      this.selectedIndex = 0;
      this.lastHoverIndex = -1;
    }
  }

  open() {
    this.visible = true;
    this.selectedIndex = 0;
    this.lastHoverIndex = -1;
  }

  close() {
    this.visible = false;
  }

  /**
   * Updates menu navigation/selection state.
   * Returns the chosen action string ('resume' | 'abort') or null.
   */
  update(input, canvas) {
    if (!this.visible) return null;

    if (input.isKeyPressed('arrowup') || input.isKeyPressed('w')) {
      this.selectedIndex = (this.selectedIndex - 1 + this.options.length) % this.options.length;
    }
    if (input.isKeyPressed('arrowdown') || input.isKeyPressed('s')) {
      this.selectedIndex = (this.selectedIndex + 1) % this.options.length;
    }

    // Hover highlight based on mouse position.
    const hoverIndex = this.hitTest(input.mouse.x, input.mouse.y);
    if (hoverIndex !== -1) {
      this.selectedIndex = hoverIndex;
      // Play only when the pointer moves onto a *different* option —
      // sitting on one item must not machine-gun the blip.
      if (hoverIndex !== this.lastHoverIndex) {
        audioManager.play('ui_hover');
      }
    }
    this.lastHoverIndex = hoverIndex;

    let chosenAction = null;

    if (input.isKeyPressed('enter')) {
      chosenAction = this.options[this.selectedIndex].action;
    }

    if (input.isMouseClicked() && hoverIndex !== -1) {
      chosenAction = this.options[hoverIndex].action;
    }

    return chosenAction;
  }

  hitTest(x, y) {
    for (let i = 0; i < this.optionBounds.length; i++) {
      const b = this.optionBounds[i];
      if (x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) {
        return i;
      }
    }
    return -1;
  }

  draw(ctx, canvas) {
    if (!this.visible) return;

    const width = canvas.width;
    const height = canvas.height;

    // Dim overlay
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Paused', width / 2, height / 2 - 120);

    // Options
    const optionWidth = 240;
    const optionHeight = 48;
    const spacing = 16;
    const startY = height / 2 - ((this.options.length * optionHeight + (this.options.length - 1) * spacing) / 2);

    this.optionBounds = [];

    this.options.forEach((option, index) => {
      const x = width / 2 - optionWidth / 2;
      const y = startY + index * (optionHeight + spacing);

      this.optionBounds.push({ x, y, width: optionWidth, height: optionHeight });

      const isSelected = index === this.selectedIndex;
      ctx.fillStyle = isSelected ? (option.action === 'abort' ? '#ef4444' : '#2e86ff') : '#1c1f2b';
      ctx.strokeStyle = isSelected ? '#ffffff' : '#3a3f55';
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x, y, optionWidth, optionHeight, 8);
      } else {
        ctx.rect(x, y, optionWidth, optionHeight);
      }
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = '20px system-ui, sans-serif';
      ctx.fillText(option.label, width / 2, y + optionHeight / 2);
    });

    ctx.font = '14px system-ui, sans-serif';
    ctx.fillStyle = '#9aa0b4';
    ctx.fillText('Esc to resume · →/↓ or mouse to navigate · Enter/Click to select', width / 2, startY + this.options.length * (optionHeight + spacing) + 20);

    ctx.restore();
  }
}