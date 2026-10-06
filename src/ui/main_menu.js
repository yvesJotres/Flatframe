import { audioManager } from '../core/audio.js';

export class MainMenu {
  constructor() {
    this.visible = true;
    this.options = [
      { label: 'Exterminate', action: 'start-mission', mission: 'exterminate' },
      { label: 'Survival', action: 'start-mission', mission: 'survival' },
      { label: 'Defense', action: 'start-mission', mission: 'defense' },
      { label: 'Simulacrum', action: 'simulacrum' },
    ];
    this.selectedIndex = 0;
    this.lastHoverIndex = -1; // hover blip only fires when this changes
  }

  update(input, canvas) {
    if (!this.visible) {
      this.lastHoverIndex = -1;
      return null;
    }
    if (input.isKeyPressed('arrowup') || input.isKeyPressed('w')) {
      this.selectedIndex = (this.selectedIndex - 1 + this.options.length) % this.options.length;
    }
    if (input.isKeyPressed('arrowdown') || input.isKeyPressed('s')) {
      this.selectedIndex = (this.selectedIndex + 1) % this.options.length;
    }

    const mouse = input.getMousePos ? input.getMousePos() : null;
    if (mouse) {
      const startY = canvas.height / 2 - 40;
      let hovered = -1;
      this.options.forEach((opt, i) => {
        const y = startY + i * 45;
        if (mouse.y > y - 20 && mouse.y < y + 20) {
          hovered = i;
        }
      });
      if (hovered !== -1) {
        this.selectedIndex = hovered;
        // Play only when the pointer moves onto a *different* option —
        // sitting on one item must not machine-gun the blip.
        if (hovered !== this.lastHoverIndex) {
          audioManager.play('ui_hover');
        }
      }
      this.lastHoverIndex = hovered;
      if (input.isMouseClicked()) {
        return this.options[this.selectedIndex];
      }
    }

    if (input.isKeyPressed('enter')) {
      return this.options[this.selectedIndex];
    }
    return null;
  }

  draw(ctx, canvas) {
    if (!this.visible) return;
    ctx.save();
    ctx.fillStyle = '#0a0a0c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('FLATFRAME', canvas.width / 2, canvas.height / 2 - 120);

    this.options.forEach((opt, i) => {
      ctx.fillStyle = i === this.selectedIndex ? '#4ade80' : '#9aa0b4';
      ctx.font = '22px system-ui';
      ctx.fillText(opt.label, canvas.width / 2, canvas.height / 2 - 40 + i * 45);
    });
    ctx.restore();
  }
}
