import { trackFocus } from '../focus_sound.js';
import { THEME } from '../theme.js';
// Canvas pause menu shown when the player presses Esc; styled like the main menu.
import { audioManager } from '../../engine/audio.js';
import { FONT, MENU_COLORS, ROW_HALF_WIDTH, ROW_HEIGHT, drawOption } from './menu_style.js';
import { drawSquadIcons, drawCurrencyBar, profileHovered } from './top_bar.js';

export default class PauseMenu {
  constructor() {
    this.visible = false;
    this.options = [
      { label: 'Resume', action: 'resume', description: 'Return to the mission' },
      { label: 'Restart Mission', action: 'restart', description: 'Start this mission over' },
      { label: 'Options', action: 'settings', description: 'CUSTOMIZE GAME SETTINGS' },
      { label: 'Abort Mission', action: 'abort', description: 'Leave without rewards', danger: true },
    ];
    // Shown after Abort Mission is picked: aborting forfeits the loot, so the player must confirm
    this.abortOptions = [
      { label: 'Keep Fighting', action: 'cancel-abort', description: 'Return to the mission' },
      { label: 'Abort Anyway', action: 'abort', description: 'Leave and lose all loot from this mission', danger: true },
    ];
    this.confirmingAbort = false;
    this.missionName = '';
    this.selectedIndex = 0;
    // Cached layout of option bounding boxes, recomputed each draw(), used for mouse hit-testing.
    this.optionBounds = [];
    this.lastHoverIndex = -1; // hover blip only fires when this changes
    this.mouseHover = -1; // the option under the mouse, whose description shows
    this.profileHover = false; // the pointer is over the profile icon (shows the username)
  }

  toggle() {
    this.visible = !this.visible;
    this.confirmingAbort = false;
    if (this.visible) {
      this.selectedIndex = 0;
      this.lastHoverIndex = -1;
    }
  }

  open() {
    this.visible = true;
    this.confirmingAbort = false;
    this.selectedIndex = 0;
    this.lastHoverIndex = -1;
  }

  close() {
    this.visible = false;
    this.confirmingAbort = false;
  }

  // The rows currently shown: the main pause options, or the abort confirmation
  activeOptions() {
    return this.confirmingAbort ? this.abortOptions : this.options;
  }

  /**
   * Updates menu navigation/selection state.
   * Returns the chosen action string ('resume' | 'abort') or null.
   * 'abort' only comes back after the player confirms; the first pick opens the warning.
   */
  update(input, canvas) {
    if (!this.visible) return null;

    const options = this.activeOptions();
    if (input.isKeyPressed('arrowup') || input.isKeyPressed('w')) {
      this.selectedIndex = (this.selectedIndex - 1 + options.length) % options.length;
    }
    if (input.isKeyPressed('arrowdown') || input.isKeyPressed('s')) {
      this.selectedIndex = (this.selectedIndex + 1) % options.length;
    }

    this.profileHover = profileHovered(input.mouse, this.profileHover);

    // Hover highlight based on mouse position.
    const hoverIndex = this.hitTest(input.mouse.x, input.mouse.y);
    if (hoverIndex !== -1) {
      this.selectedIndex = hoverIndex;
    }
    trackFocus(this.selectedIndex);
    this.lastHoverIndex = hoverIndex;
    this.mouseHover = hoverIndex;

    let chosenAction = null;

    if (input.isKeyPressed('enter')) {
      chosenAction = options[this.selectedIndex].action;
    }

    if (input.isMouseClicked() && hoverIndex !== -1) {
      chosenAction = options[hoverIndex].action;
    }

    if (chosenAction === 'abort' && !this.confirmingAbort) {
      // First pick: ask for confirmation, and default to the safe choice
      this.confirmingAbort = true;
      this.selectedIndex = 0;
      this.lastHoverIndex = -1;
      return null;
    }
    if (chosenAction === 'cancel-abort') {
      this.confirmingAbort = false;
      this.selectedIndex = 0;
      this.lastHoverIndex = -1;
      return null;
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
    veil.addColorStop(0, THEME.veil);
    veil.addColorStop(1, 'rgba(2,2,5,0.94)');
    ctx.fillStyle = veil;
    ctx.fillRect(0, 0, w, h);

    // Squad icons top left and the currency bar top right, as on the main menu
    drawSquadIcons(ctx, this.profileHover);
    drawCurrencyBar(ctx, w);

    // Title block
    const titleY = compact ? 48 : h * 0.22 + 40;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${compact ? 36 : 48}px ${FONT}`;
    ctx.fillStyle = MENU_COLORS.title;
    ctx.fillText(this.confirmingAbort ? 'ABORT MISSION?' : 'PAUSED', cx, titleY);
    if (this.confirmingAbort) {
      ctx.font = `bold 14px ${FONT}`;
      ctx.fillStyle = MENU_COLORS.danger;
      ctx.fillText('YOU WILL NOT RECEIVE ANY LOOT FROM THIS MISSION', cx, titleY + (compact ? 30 : 38));
    } else if (this.missionName) {
      ctx.font = `14px ${FONT}`;
      ctx.fillStyle = MENU_COLORS.accent;
      ctx.fillText(this.missionName.toUpperCase(), cx, titleY + (compact ? 30 : 38));
    }

    // Options
    const options = this.activeOptions();
    const startY = compact ? titleY + 90 : h / 2 + 10;
    const spacing = Math.max(50, Math.min(60, (h - startY - 40) / options.length));
    this.optionBounds = [];
    options.forEach((option, i) => {
      const y = startY + i * spacing;
      this.optionBounds.push({ x: cx - ROW_HALF_WIDTH, y: y - ROW_HEIGHT / 2, width: ROW_HALF_WIDTH * 2, height: ROW_HEIGHT });
      drawOption(ctx, cx, y, option.label, option.description, i === this.selectedIndex, option.danger, i === this.mouseHover);
    });

    ctx.font = `12px ${FONT}`;
    ctx.fillStyle = MENU_COLORS.footer;
    ctx.textAlign = 'center';

    ctx.restore();
  }
}
