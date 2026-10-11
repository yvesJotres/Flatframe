// Canvas pause menu shown when the player presses Esc; styled like the main menu.
import { audioManager } from '../../engine/audio.js';
import { FONT, MENU_COLORS, ROW_HALF_WIDTH, ROW_HEIGHT, drawOption, drawCornerAccents } from './menu_style.js';

export default class PauseMenu {
  constructor() {
    this.visible = false;
    this.options = [
      { label: 'Resume', action: 'resume', description: 'Return to the mission' },
      { label: 'Restart Mission', action: 'restart', description: 'Start this mission over' },
      { label: 'Abort Mission', action: 'abort', description: 'Leave without rewards', danger: true },
    ];
    this.missionName = '';
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

    const w = canvas.width;
    const h = canvas.height;
    const compact = h < 600;
    const cx = w / 2;

    ctx.save();

    // Dim the paused game behind a dark vignette, like the main menu's deep-space backdrop
    const veil = ctx.createRadialGradient(cx, h / 2, 0, cx, h / 2, Math.max(w, h) * 0.7);
    veil.addColorStop(0, 'rgba(6,6,14,0.78)');
    veil.addColorStop(1, 'rgba(2,2,5,0.94)');
    ctx.fillStyle = veil;
    ctx.fillRect(0, 0, w, h);

    // Title block
    const titleY = compact ? 48 : h * 0.22 + 40;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${compact ? 36 : 48}px ${FONT}`;
    ctx.fillStyle = MENU_COLORS.title;
    ctx.fillText('PAUSED', cx, titleY);
    if (this.missionName) {
      ctx.font = `14px ${FONT}`;
      ctx.fillStyle = MENU_COLORS.accent;
      ctx.fillText(this.missionName.toUpperCase(), cx, titleY + (compact ? 30 : 38));
    }

    // Options
    const startY = compact ? titleY + 90 : h / 2 + 10;
    const spacing = Math.max(50, Math.min(60, (h - startY - 40) / this.options.length));
    this.optionBounds = [];
    this.options.forEach((option, i) => {
      const y = startY + i * spacing;
      this.optionBounds.push({ x: cx - ROW_HALF_WIDTH, y: y - ROW_HEIGHT / 2, width: ROW_HALF_WIDTH * 2, height: ROW_HEIGHT });
      drawOption(ctx, cx, y, option.label, option.description, i === this.selectedIndex, option.danger);
    });

    ctx.font = `12px ${FONT}`;
    ctx.fillStyle = MENU_COLORS.footer;
    ctx.textAlign = 'center';
    ctx.fillText('[W/S] Navigate  [Enter] Select  [Esc] Resume', cx, h - 16);

    drawCornerAccents(ctx, w, h);
    ctx.restore();
  }
}
