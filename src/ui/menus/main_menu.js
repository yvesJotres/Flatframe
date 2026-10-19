import { trackFocus } from '../focus_sound.js';
import { drawVisualEffect, EFFECT_NAMES } from '../../engine/visual_effects.js';
import { THEME, drawMenuBackground, drawPanel } from '../theme.js';
import { MENU_SIDE_MARGIN, FONT } from './menu_style.js';
import { drawSquadIcons, drawCurrencyBar, profileHovered, liveSquadRects, liveModeBox } from './top_bar.js';
import { audioManager } from '../../engine/audio.js';
import { openModeList } from '../squad.js';

const TOP_ICONS = ['avatar', 'mode', 'invite'];

export class MainMenu {
  constructor() {
    this.visible = true;
    this.currentView = 'landing';
    this.topFocus = false; // the D-pad is on the profile / matchmaking / invite row at the top
    this.topIndex = 1;
    this.activeTab = 'navigation';
    this.landingOptions = [
          { label: 'Navigation', action: 'navigation' },
          { label: 'Arsenal', action: 'arsenal' },
          { label: 'Profile', action: 'profile' },
          { label: 'Options', action: 'settings' },
        ];
    this.selectedIndex = 0;
    this.lastHoverIndex = -1;
    this.mouseHover = -1; // the option under the mouse, whose description shows
    this.selectProgress = []; // 0..1 per option, eased toward selected like the Arsenal's cards
    this.profileHover = false; // the pointer is over the profile icon (shows the username)
    this.onSquad = null; // set by game.js: opens the squad panel under the matchmaking icon
    this.animTime = 0;
    this.logoAnim = 0;
    this.bgOffset = 0;
  }

  setView(view) {
    this.currentView = view;
    this.selectedIndex = 0;
  }

  update(input, canvas) {
    if (!this.visible) {
      this.lastHoverIndex = -1;
      return null;
    }
    this.animTime += 1/60;
    this.logoAnim += 1/60;
    this.bgOffset += 0.02;

    if (this.currentView === 'landing') {
      return this.updateLanding(input, canvas);
    }
    return null;
  }

  // A on the top row: profile and invite open the squad panel, matchmaking opens its list
  activateTopIcon() {
    const icon = TOP_ICONS[this.topIndex];
    if (icon === 'mode') openModeList();
    else if (this.onSquad) this.onSquad(liveModeBox());
  }

  landingLayout(w, h) {
      const compact = h < 600;
      const titleY = compact ? 40 : h * 0.22 + 85;
      const startY = compact ? titleY + 95 : h / 2 + 20;
      const spacing = Math.max(46, Math.min(55, (h - startY - 40) / this.landingOptions.length));
      return { compact, titleY, startY, spacing };
    }

  updateLanding(input, canvas) {
      // Ease each option toward selected: the same easing as the Arsenal's card expansion (dt * 14)
      while (this.selectProgress.length < this.landingOptions.length) this.selectProgress.push(0);
      const ease = Math.min(1, (1 / 60) * 14);
      this.landingOptions.forEach((_, i) => {
        const target = i === this.selectedIndex ? 1 : 0;
        this.selectProgress[i] += (target - this.selectProgress[i]) * ease;
        if (Math.abs(target - this.selectProgress[i]) < 0.002) this.selectProgress[i] = target;
      });
      const up = input.isKeyPressed('arrowup') || input.isKeyPressed('w');
      const down = input.isKeyPressed('arrowdown') || input.isKeyPressed('s');
      const left = input.isKeyPressed('arrowleft') || input.isKeyPressed('a');
      const right = input.isKeyPressed('arrowright') || input.isKeyPressed('d');
      const enter = input.isKeyPressed('enter');
      if (this.topFocus) {
        // The top row: left/right move between the icons, down returns to the options
        if (left) this.topIndex = Math.max(0, this.topIndex - 1);
        if (right) this.topIndex = Math.min(TOP_ICONS.length - 1, this.topIndex + 1);
        if (down) this.topFocus = false;
      } else {
        if (up && this.selectedIndex === 0) {
          this.topFocus = true;
          this.topIndex = 1;
        } else if (up) {
          this.selectedIndex = (this.selectedIndex - 1 + this.landingOptions.length) % this.landingOptions.length;
        }
        if (down) {
          this.selectedIndex = (this.selectedIndex + 1) % this.landingOptions.length;
        }
      }
      trackFocus(this.topFocus ? 'top' + this.topIndex : 'option' + this.selectedIndex);
      if (enter && this.topFocus) {
        audioManager.play('ui_select');
        this.activateTopIcon();
        return null;
      }

      const mouse = input.getMousePos ? input.getMousePos() : null;
      this.profileHover = profileHovered(mouse, this.profileHover);
      if (mouse) {
        const { startY, spacing } = this.landingLayout(canvas.width, canvas.height);
        // An option counts as hovered only when the pointer is over its row (both across and down)
        const cx = canvas.width / 2;
        let hovered = -1;
        this.landingOptions.forEach((opt, i) => {
          const y = startY + i * spacing;
          if (mouse.x >= MENU_SIDE_MARGIN && mouse.x <= MENU_SIDE_MARGIN + 320 && mouse.y > y - 22 && mouse.y < y + 22) {
            hovered = i;
          }
        });
        if (hovered !== -1) {
          this.selectedIndex = hovered;
          if (hovered !== this.lastHoverIndex) {
          }
        }
        this.lastHoverIndex = hovered;
        this.mouseHover = hovered;
        // The profile and plus icons open the squad panel; they are checked before the options
        const clicked = input.isMouseClicked();
        const squad = liveSquadRects();
        const over = (r) => mouse.x >= r.x && mouse.x <= r.x + r.w && mouse.y >= r.y && mouse.y <= r.y + r.h;
        if (clicked && (over(squad.avatar) || over(squad.invite))) {
          if (this.onSquad) this.onSquad(liveModeBox());
          return null;
        }
        // A click only chooses an option when the pointer is on it
        if (clicked && hovered !== -1) {
          audioManager.play('ui_select');
          return this.landingOptions[hovered];
        }
      }

      if (enter) {
        audioManager.play('ui_select');
        return this.landingOptions[this.selectedIndex];
      }
      if (input.isKeyPressed('escape')) {
        return { action: 'exit' };
      }
      return null;
    }

  draw(ctx, canvas) {
    if (!this.visible) return;
    ctx.save();

    const w = canvas.width;
    const h = canvas.height;

    // Deep space background
    drawMenuBackground(ctx, w, h);

    // Animated nebula clouds (settings in src/engine/visual_effects.js)
    drawVisualEffect(EFFECT_NAMES.NEBULA, ctx, { width: w, height: h, offset: this.bgOffset });

    // Starfield (settings in src/engine/visual_effects.js)
    drawVisualEffect(EFFECT_NAMES.STARFIELD, ctx, { width: w, height: h, time: this.animTime, offset: this.bgOffset });

        if (this.currentView === 'landing') {
          this.drawLanding(ctx, w, h);
        }

        ctx.restore();
      }


      drawLanding(ctx, w, h) {
      const L = this.landingLayout(w, h);
      const logoScale = 1 + Math.sin(this.logoAnim * 0.8) * 0.02;

      // The title sits on the right, aligned to the same 96px margin as the menu on the left
      const tx = w - MENU_SIDE_MARGIN;
      ctx.font = (L.compact ? 'bold 40px' : 'bold 56px') + ' ' + FONT;
      ctx.fillStyle = THEME.text.title;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText('FLATFRAME', tx, L.titleY);

      ctx.font = `14px ${FONT}`;
      ctx.fillStyle = THEME.accent;
      ctx.fillText('ORIGIN SYSTEM', tx, L.titleY + (L.compact ? 30 : 30));

      ctx.font = `12px ${FONT}`;
      ctx.fillStyle = THEME.text2.muted;
      ctx.fillText('v1.6.0  |  WARFRAME-INSPIRED', tx, L.titleY + (L.compact ? 48 : 50));

      const startY = L.startY;
    this.landingOptions.forEach((opt, i) => {
      const y = startY + i * L.spacing;
      const selected = i === this.selectedIndex;
      const p = this.selectProgress[i] ?? 0; // 0 = idle, 1 = selected, animated
      
      // Left-aligned at the 96px margin: each option is an uppercase label in its own box
      const label = opt.label.toUpperCase();
      const size = 20 + 2 * p; // the selected label grows a little, as the Arsenal's cards do
      ctx.font = `${p > 0.5 ? 'bold ' : ''}${size}px ${FONT}`;
      const boxW = ctx.measureText(label).width + 32, boxH = 36 + 6 * p;
      const boxX = MENU_SIDE_MARGIN, boxY = y - boxH / 2;
      // The same box as the Arsenal's panels (drawPanel in theme.js), lit when selected
      drawPanel(ctx, boxX, boxY, boxW, boxH, { selected, faintFill: true });
      ctx.fillStyle = selected ? THEME.text.selected : THEME.text.label;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, boxX + 16, y);
      
      const descs = {
        'Continue': 'Resume last session',
        'Navigation': 'Star Chart · Missions · Progress',
        'Arsenal': 'Loadout · Weapons · Mods · Warframes',
        'Profile': 'Mastery · Stats · Appearance · Syndicates',
        'Options': 'CUSTOMIZE GAME SETTINGS',
        'Simulacrum': 'Test builds · Practice · No stakes',
      };
      if (i === this.mouseHover && descs[opt.label]) {
        ctx.font = `12px ${FONT}`;
        ctx.fillStyle = selected ? THEME.accent : THEME.text.hint;
        ctx.textAlign = 'left';
        ctx.fillText(descs[opt.label], boxX + 16, boxY + boxH + 14);
      }
    });

    ctx.font = `12px ${FONT}`;
    ctx.fillStyle = THEME.text.footer;
    ctx.textAlign = 'center';

    // Squad icons, top left, and the currency bar, top right
    drawSquadIcons(ctx, this.profileHover);
    if (this.topFocus) {
      const r = liveSquadRects()[TOP_ICONS[this.topIndex]];
      ctx.strokeStyle = THEME.text.selected;
      ctx.lineWidth = 2;
      ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
    }
    drawCurrencyBar(ctx, w);

  }


  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}
