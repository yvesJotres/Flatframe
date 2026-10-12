import { drawSelectedRow } from './menu_style.js';
import { drawSquadIcons, drawCurrencyBar, profileHovered, liveSquadRects, liveModeBox } from './top_bar.js';
import { audioManager } from '../../engine/audio.js';
import { TOP_TABS, TAB_STYLE, drawTopTabs, getTabHitRects } from './top_tabs.js';

export class MainMenu {
  constructor() {
    this.visible = true;
    this.currentView = 'landing';
    this.activeTab = 'navigation';
    this.landingOptions = [
          { label: 'Navigation', action: 'navigation' },
          { label: 'Arsenal', action: 'arsenal' },
          { label: 'Profile', action: 'profile' },
          { label: 'Settings', action: 'settings' },
        ];
    this.selectedIndex = 0;
    this.lastHoverIndex = -1;
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

  landingLayout(w, h) {
      const compact = h < 600;
      const titleY = compact ? 40 : h * 0.22 + 85;
      const startY = compact ? titleY + 95 : h / 2 + 20;
      const spacing = Math.max(46, Math.min(55, (h - startY - 40) / this.landingOptions.length));
      return { compact, titleY, startY, spacing };
    }

  updateLanding(input, canvas) {
      if (input.isKeyPressed('arrowup') || input.isKeyPressed('w')) {
        this.selectedIndex = (this.selectedIndex - 1 + this.landingOptions.length) % this.landingOptions.length;
        audioManager.play('ui_hover');
      }
      if (input.isKeyPressed('arrowdown') || input.isKeyPressed('s')) {
        this.selectedIndex = (this.selectedIndex + 1) % this.landingOptions.length;
        audioManager.play('ui_hover');
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
          if (Math.abs(mouse.x - cx) < 200 && mouse.y > y - 22 && mouse.y < y + 22) {
            hovered = i;
          }
        });
        if (hovered !== -1) {
          this.selectedIndex = hovered;
          if (hovered !== this.lastHoverIndex) {
            audioManager.play('ui_hover');
          }
        }
        this.lastHoverIndex = hovered;
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
          return this.landingOptions[hovered];
        }
      }

      if (input.isKeyPressed('enter')) {
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
    const bgGrad = ctx.createRadialGradient(w * 0.3, h * 0.2, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.8);
    bgGrad.addColorStop(0, '#0d0d1a');
    bgGrad.addColorStop(0.3, '#06060e');
    bgGrad.addColorStop(1, '#020205');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Animated nebula clouds
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const phase = this.bgOffset + i * 2.1;
      const x = w * (0.2 + 0.3 * Math.sin(phase * 0.3));
      const y = h * (0.3 + 0.4 * Math.cos(phase * 0.2));
      const r = Math.max(w, h) * 0.35;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      const colors = ['rgba(255,107,53,0.04)', 'rgba(58,143,206,0.03)', 'rgba(122,184,0,0.03)'];
      grad.addColorStop(0, colors[i]);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();

    // Starfield
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 120; i++) {
      const sx = (i * 937 + this.bgOffset * 10) % w;
      const sy = (i * 1297) % h;
      const size = (i % 3) * 0.5 + 0.5;
      const alpha = 0.3 + 0.7 * Math.sin(this.animTime * 2 + i) * 0.5;
      ctx.globalAlpha = alpha;
      ctx.fillRect(sx, sy, size, size);
    }
    ctx.globalAlpha = 1;

        if (this.currentView === 'landing') {
          this.drawLanding(ctx, w, h);
        } else {
          this.drawTopTabs(ctx, w);
        }

        ctx.restore();
      }

      drawTopTabs(ctx, w) {
        drawTopTabs(ctx, w, this.currentView);
      }

      drawLanding(ctx, w, h) {
      const L = this.landingLayout(w, h);
      const logoScale = 1 + Math.sin(this.logoAnim * 0.8) * 0.02;

      ctx.font = (L.compact ? 'bold 40px' : 'bold 56px') + ' "Segoe UI", Roboto, system-ui, sans-serif';
      ctx.fillStyle = '#f0e8e0';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('FLATFRAME', w/2, L.titleY);

      ctx.font = '14px "Segoe UI", Roboto, system-ui, sans-serif';
      ctx.fillStyle = '#ff6b35';
      ctx.fillText('ORIGIN SYSTEM', w/2, L.titleY + (L.compact ? 30 : 30));

      ctx.font = '12px "Segoe UI", Roboto, system-ui, sans-serif';
      ctx.fillStyle = '#8080a0';
      ctx.fillText('v1.6.0  |  WARFRAME-INSPIRED', w/2, L.titleY + (L.compact ? 48 : 50));

      const startY = L.startY;
    this.landingOptions.forEach((opt, i) => {
      const y = startY + i * L.spacing;
      const selected = i === this.selectedIndex;
      
      if (selected) drawSelectedRow(ctx, w/2, y);

      ctx.font = selected ? 'bold 22px "Segoe UI", Roboto, system-ui, sans-serif' : '20px "Segoe UI", Roboto, system-ui, sans-serif';
      ctx.fillStyle = selected ? '#ffd78a' : '#c8b8a8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(opt.label, w/2, y);
      
      const descs = {
        'Continue': 'Resume last session',
        'Navigation': 'Star Chart · Missions · Progress',
        'Arsenal': 'Loadout · Weapons · Mods · Warframes',
        'Profile': 'Mastery · Stats · Appearance · Syndicates',
        'Settings': 'Graphics · Audio · Controls · Gameplay',
        'Simulacrum': 'Test builds · Practice · No stakes',
      };
      if (descs[opt.label]) {
        ctx.font = '12px "Segoe UI", Roboto, system-ui, sans-serif';
        ctx.fillStyle = selected ? '#ff6b35' : '#9090b0';
        ctx.fillText(descs[opt.label], w/2, y + 20);
      }
    });

    ctx.font = '12px "Segoe UI", Roboto, system-ui, sans-serif';
    ctx.fillStyle = '#7a7a9a';
    ctx.textAlign = 'center';
    ctx.fillText('[W/S] Navigate  [Enter] Select  [Esc] Exit', w/2, h - 16);

    // Squad icons, top left, and the currency bar, top right
    drawSquadIcons(ctx, this.profileHover);
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
