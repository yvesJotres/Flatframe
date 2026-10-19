import { itemRankOf } from '../../progression/progression.js';
import { DEFAULT_WARFRAME } from '../../warframe/warframes.js';
import { DEFAULT_PRIMARY } from '../../weapons/primary_weapon.js';
import { DEFAULT_SECONDARY } from '../../weapons/secondary_weapon.js';
import { DEFAULT_MELEE } from '../../weapons/melee_weapon.js';
import { trackFocus, resetFocusSound } from '../focus_sound.js';
import { THEME, drawPanel, drawMenuBackground } from '../theme.js';
import { FONT, MENU_COLORS, MENU_SIDE_MARGIN, MENU_TOP_MARGIN, roundRectPath, drawReturnButton, drawCornerAccents } from './menu_style.js';
import { drawSquadIcons, drawCurrencyBar } from './top_bar.js';
import { user } from '../../user/user_data.js';

// Shared panel look (same as the Arsenal, navigation, settings and squad panels)
const TOP_BAR_H = THEME.topBarHeight;
const TAB_Y = MENU_TOP_MARGIN + TOP_BAR_H + THEME.topBarGap;   // tab row, below the top bar
const TAB_H = THEME.tabHeight, TAB_W = THEME.tabWidth;
const PANEL_Y = TAB_Y + TAB_H + 14;               // content panels start below the tabs
const PANEL_BOTTOM = 100;                          // room for the BACK button
const BACK_W = THEME.backButton.w, BACK_H = THEME.backButton.h;
const TABS = ['overview', 'stats', 'loadout', 'appearance'];
const TAB_LABELS = { overview: 'OVERVIEW', stats: 'STATS', loadout: 'LOADOUT', appearance: 'APPEARANCE' };

export default class ProfileScreen {
  constructor(onClose) {
    this.onClose = onClose;
    this.open = false;
    this.activeTab = 'profile';
    this.tab = 'overview';
    this.animTime = 0;
    this.panelAlpha = 0;
  }

  openScreen() {
    resetFocusSound();
    this.open = true;
    this.panelAlpha = 0;
    this.tab = 'overview';
  }

  closeScreen() {
    this.open = false;
  }

  update(dt, input) {
    if (!this.open) return;
    // Hovering a tab focuses it, and the shared focus tracker plays the hover sound
    const mouse = input.getMousePos ? input.getMousePos() : null;
    let hovered = -1;
    if (mouse) {
      TABS.forEach((t, i) => {
        const tx = MENU_SIDE_MARGIN + i * TAB_W;
        if (mouse.x >= tx && mouse.x <= tx + TAB_W && mouse.y >= TAB_Y && mouse.y <= TAB_Y + TAB_H) { hovered = i; this.tab = t; }
      });
    }
    const bk = mouse ? this.backRect(this.canvasW ?? 1920, this.canvasH ?? 1080) : null;
    this.backHover = !!bk && mouse.x >= bk.x && mouse.x <= bk.x + bk.w && mouse.y >= bk.y && mouse.y <= bk.y + bk.h;
    trackFocus(`${this.tab}|${hovered}|${this.backHover}`);
    this.animTime += dt;
    this.panelAlpha = Math.min(1, this.panelAlpha + dt * 5);
    
    if (input.isPressed('Escape')) {
      this.closeScreen();
      if (this.onClose) this.onClose();
    }
    
    // Tab switching with number keys
    if (input.isPressed('1')) this.tab = 'overview';
    if (input.isPressed('2')) this.tab = 'stats';
    if (input.isPressed('3')) this.tab = 'loadout';
    if (input.isPressed('4')) this.tab = 'appearance';
    // Gamepad D-pad / left stick (and A/D) step through the tabs
    const tabs = ['overview', 'stats', 'loadout', 'appearance'];
    const step = (input.isPressed('arrowright') || input.isPressed('d') ? 1 : 0) - (input.isPressed('arrowleft') || input.isPressed('a') ? 1 : 0);
    if (step) {
      const i = tabs.indexOf(this.tab);
      this.tab = tabs[(i + step + tabs.length) % tabs.length];
    }
  }

  handleClick(x, y) {
    if (!this.open) return false;
    
    const canvas = document.getElementById('gameCanvas');
    const w = canvas?.width ?? 1920;
    const h = canvas?.height ?? 1080;

    // BACK button closes the screen
    const b = this.backRect(w, h);
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
      this.closeScreen();
      if (this.onClose) this.onClose();
      return true;
    }

    // Tabs
    TABS.forEach((t, i) => {
      const tx = MENU_SIDE_MARGIN + i * TAB_W;
      if (x >= tx && x <= tx + TAB_W && y >= TAB_Y && y <= TAB_Y + TAB_H) this.tab = t;
    });

    return true;
  }

  draw(ctx) {
    if (!this.open) return;
    this.canvasW = ctx.canvas.width;
    this.canvasH = ctx.canvas.height;
    
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    
    // Same background as the Arsenal, with the shared top bar, tabs, corner accents and BACK button
    drawMenuBackground(ctx, w, h);
    drawSquadIcons(ctx);
    drawCurrencyBar(ctx, w);
    drawCornerAccents(ctx, w, h);
    this.drawTabs(ctx);
    drawReturnButton(ctx, this.backRect(w, h), !!this.backHover);

    // Profile content
    ctx.save();
    ctx.globalAlpha = this.panelAlpha;

    switch (this.tab) {
      case 'overview':
        this.drawOverview(ctx, w, h);
        break;
      case 'stats':
        this.drawStats(ctx, w, h);
        break;
      case 'loadout':
        this.drawLoadout(ctx, w, h);
        break;
      case 'appearance':
        this.drawAppearance(ctx, w, h);
        break;
    }
    
    ctx.restore();
  }

  // The four section tabs, as panels; the open one is outlined in gold
  drawTabs(ctx) {
    TABS.forEach((t, i) => {
      const x = MENU_SIDE_MARGIN + i * TAB_W;
      const active = this.tab === t;
      drawPanel(ctx, x + 2, TAB_Y, TAB_W - 4, TAB_H, { radius: 4, selected: active });
      ctx.font = `bold 13px ${FONT}`;
      ctx.fillStyle = active ? MENU_COLORS.selected : MENU_COLORS.label;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(TAB_LABELS[t], x + TAB_W / 2, TAB_Y + TAB_H / 2);
    });
  }

  // Bottom-right BACK button box for a canvas of this size
  backRect(w, h) {
    return { x: w - MENU_SIDE_MARGIN - BACK_W, y: h - MENU_TOP_MARGIN - BACK_H, w: BACK_W, h: BACK_H };
  }

  drawOverview(ctx, w, h) {
    const panelW = 500;
    const panelX = (w - panelW) / 2;
    const panelY = PANEL_Y;
    const panelH = h - PANEL_Y - PANEL_BOTTOM;

    // Main panel
    drawPanel(ctx, panelX, panelY, panelW, panelH, { radius: 8, roundRect: (c, x, y, w, h, r) => this.roundRect(c, x, y, w, h, r) });

    // Player avatar/frame area
    const avatarX = panelX + 40;
    const avatarY = panelY + 40;
    const avatarSize = 180;
    
    // Frame silhouette
    ctx.fillStyle = THEME.profile.frameFill;
    this.roundRect(ctx, avatarX, avatarY, avatarSize, avatarSize, 8);
    ctx.fill();
    ctx.strokeStyle = THEME.accent;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Warframe icon
    ctx.font = '100px Arial';
    ctx.fillStyle = THEME.accent;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚔', avatarX + avatarSize/2, avatarY + avatarSize/2 + 5);

    // Info panel
    const infoX = avatarX + avatarSize + 30;
    const infoY = avatarY;
    
    ctx.font = 'bold 28px "Segoe UI", Roboto, system-ui, sans-serif';
    ctx.fillStyle = THEME.text.title;
    ctx.textAlign = 'left';
    ctx.fillText(user.get('displayName').toUpperCase(), infoX, infoY + 30);
    
    ctx.font = '14px "Segoe UI", Roboto, system-ui, sans-serif';
    ctx.fillStyle = THEME.profile.warmGrey;
    ctx.fillText('Mastery Rank', infoX, infoY + 70);
    
    // MR display
    const mr = user.get('masteryRank');
    const mrX = infoX;
    const mrY = infoY + 90;
    ctx.font = 'bold 48px "Segoe UI", Roboto, system-ui, sans-serif';
    ctx.fillStyle = THEME.accent;
    ctx.textAlign = 'center';
    ctx.fillText(mr, mrX + 60, mrY + 50);
    
    // MR ring
    ctx.strokeStyle = THEME.accent;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(mrX + 60, mrY + 30, 50, -Math.PI/2, -Math.PI/2 + (mr/30) * Math.PI * 2);
    ctx.stroke();
    
    ctx.strokeStyle = THEME.profile.border;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(mrX + 60, mrY + 30, 50, -Math.PI/2 + (mr/30) * Math.PI * 2, -Math.PI/2 + Math.PI * 2);
    ctx.stroke();

    // Glyph
    ctx.fillStyle = THEME.accent;
    ctx.font = '40px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('◆', mrX + 180, mrY + 50);

    // Stats summary
    const statY = panelY + panelH - 160;
    const stats = [
      { label: 'MISSIONS COMPLETED', value: '847', icon: '✦' },
      { label: 'ENEMIES ELIMINATED', value: '12,843', icon: '☠' },
      { label: 'PLAYTIME', value: '342h', icon: '⏱' },
      { label: 'CREDITS EARNED', value: '4.2M', icon: '₡' }
    ];

    stats.forEach((s, i) => {
      const sx = panelX + 40 + i * 115;
      ctx.font = 'bold 12px "Segoe UI", Roboto, system-ui, sans-serif';
      ctx.fillStyle = THEME.profile.warmGrey;
      ctx.textAlign = 'center';
      ctx.fillText(s.label, sx, statY);
      
      ctx.font = '20px "Segoe UI", Roboto, system-ui, sans-serif';
      ctx.fillStyle = THEME.accent;
      ctx.fillText(s.value, sx, statY + 28);
      
      ctx.font = '16px Arial';
      ctx.fillStyle = THEME.accent;
      ctx.fillText(s.icon, sx, statY + 55);
    });
  }

  drawStats(ctx, w, h) {
    const panelW = 700;
    const panelX = (w - panelW) / 2;
    const panelY = PANEL_Y;
    const panelH = h - PANEL_Y - PANEL_BOTTOM;

    drawPanel(ctx, panelX, panelY, panelW, panelH, { radius: 8, roundRect: (c, x, y, w, h, r) => this.roundRect(c, x, y, w, h, r) });

    ctx.font = 'bold 20px "Segoe UI", Roboto, system-ui, sans-serif';
    ctx.fillStyle = THEME.profile.defense;
    ctx.textAlign = 'left';
    ctx.fillText('COMBAT STATISTICS', panelX + 30, panelY + 40);

    const categories = [
      { name: 'OFFENSE', color: THEME.accent, stats: [
        { k: 'Total Damage Dealt', v: '2.4B' },
        { k: 'Headshots', v: '12,843' },
        { k: 'Critical Hits', v: '89,234' },
        { k: 'Status Procs', v: '156,789' },
        { k: 'Melee Kills', v: '34,567' }
      ]},
      { name: 'DEFENSE', color: THEME.profile.defense, stats: [
        { k: 'Damage Taken', v: '45.2M' },
        { k: 'Times Downed', v: '234' },
        { k: 'Revives', v: '89' },
        { k: 'Shield Gated', v: '1,234' },
        { k: 'Health Restored', v: '8.9M' }
      ]},
      { name: 'UTILITY', color: THEME.profile.utility, stats: [
        { k: 'Abilities Cast', v: '234,567' },
        { k: 'Energy Used', v: '45.6M' },
        { k: 'Hacks Completed', v: '1,234' },
        { k: 'Distance Traveled', v: '4,231km' },
        { k: 'Resources Collected', v: '2.1M' }
      ]}
    ];

    categories.forEach((cat, ci) => {
      const cx = panelX + 30 + ci * 220;
      const cy = panelY + 90;
      
      ctx.font = 'bold 12px "Segoe UI", Roboto, system-ui, sans-serif';
      ctx.fillStyle = cat.color;
      ctx.textAlign = 'center';
      ctx.fillText(cat.name, cx + 100, cy);
      
      ctx.strokeStyle = cat.color + '44';
      ctx.lineWidth = 1;
      this.roundRect(ctx, cx, cy + 10, 200, 380, 6);
      ctx.stroke();
      
      cat.stats.forEach((s, si) => {
        const sy = cy + 30 + si * 70;
        ctx.font = '12px "Segoe UI", Roboto, system-ui, sans-serif';
        ctx.fillStyle = THEME.profile.warmGrey;
        ctx.textAlign = 'left';
        ctx.fillText(s.k, cx + 20, sy);
        
        ctx.font = 'bold 18px "Segoe UI", Roboto, system-ui, sans-serif';
        ctx.fillStyle = THEME.text.title;
        ctx.fillText(s.v, cx + 20, sy + 28);
      });
    });
  }

  drawLoadout(ctx, w, h) {
    const panelW = 800;
    const panelX = (w - panelW) / 2;
    const panelY = PANEL_Y;
    const panelH = h - PANEL_Y - PANEL_BOTTOM;

    drawPanel(ctx, panelX, panelY, panelW, panelH, { radius: 8, roundRect: (c, x, y, w, h, r) => this.roundRect(c, x, y, w, h, r) });

    ctx.font = 'bold 20px "Segoe UI", Roboto, system-ui, sans-serif';
    ctx.fillStyle = THEME.profile.utility;
    ctx.textAlign = 'left';
    ctx.fillText('CURRENT LOADOUT', panelX + 30, panelY + 40);

    // The equipped items from the loadout, each with the rank from its affinity (never a fixed number)
    const loadout = user.get('loadout') ?? {};
    const equipped = (slot, fallback, kind) => {
      const name = loadout[slot] ?? fallback;
      return { name, rank: itemRankOf(name, kind) };
    };
    const frame = equipped('warframe', DEFAULT_WARFRAME, 'frame');
    const primary = equipped('primary', DEFAULT_PRIMARY, 'weapon');
    const secondary = equipped('secondary', DEFAULT_SECONDARY, 'weapon');
    const melee = equipped('melee', DEFAULT_MELEE, 'weapon');
    const slots = [
      { label: 'WARFRAME', name: frame.name, rank: frame.rank, polarity: ['■','▲','●','◆'], aura: '◆', exilus: '●', icon: '⚔' },
      { label: 'PRIMARY', name: primary.name, rank: primary.rank, polarity: ['■','▲','●','◆','■','▲','●','◆'], icon: '🔫' },
      { label: 'SECONDARY', name: secondary.name, rank: secondary.rank, polarity: ['■','▲','●','◆','■'], icon: '🔫' },
      { label: 'MELEE', name: melee.name, rank: melee.rank, polarity: ['■','▲','●','◆','■','▲','●','◆'], icon: '⚔' },
    ];

    slots.forEach((slot, i) => {
      const sy = panelY + 90 + i * 95;
      
      // Slot bg
      this.roundRect(ctx, panelX + 30, sy, panelW - 60, 80, 6);
      ctx.fillStyle = THEME.profile.cardFill;
      ctx.strokeStyle = THEME.profile.border;
      ctx.lineWidth = 1;
      ctx.fill();
      ctx.stroke();

      // Icon
      ctx.font = '32px Arial';
      ctx.textAlign = 'center';
      ctx.fillStyle = THEME.text.title;
      ctx.fillText(slot.icon, panelX + 60, sy + 50);

      // Label
      ctx.font = 'bold 12px "Segoe UI", Roboto, system-ui, sans-serif';
      ctx.fillStyle = THEME.profile.warmGrey;
      ctx.textAlign = 'left';
      ctx.fillText(slot.label, panelX + 100, sy + 25);

      // Name & rank
      ctx.font = 'bold 16px "Segoe UI", Roboto, system-ui, sans-serif';
      ctx.fillStyle = THEME.text.title;
      ctx.fillText(slot.name, panelX + 100, sy + 50);

      ctx.font = '12px "Segoe UI", Roboto, system-ui, sans-serif';
      ctx.fillStyle = THEME.accent;
      ctx.fillText(`RANK ${slot.rank}`, panelX + 100, sy + 70);

      // Polarities
      const px = panelW - 200;
      slot.polarity.forEach((p, pi) => {
        ctx.font = '18px Arial';
        ctx.fillStyle = THEME.accent;
        ctx.textAlign = 'center';
        ctx.fillText(p, panelX + px + pi * 28, sy + 50);
      });
      
      if (slot.aura) {
        ctx.fillStyle = THEME.profile.utility;
        ctx.fillText('⬇ ' + slot.aura, panelX + px + slot.polarity.length * 28, sy + 30);
      }
      if (slot.exilus) {
        ctx.fillStyle = THEME.profile.gold;
        ctx.fillText('◇ ' + slot.exilus, panelX + px + slot.polarity.length * 28, sy + 70);
      }
    });
  }

  drawAppearance(ctx, w, h) {
    const panelW = 600;
    const panelX = (w - panelW) / 2;
    const panelY = PANEL_Y;
    const panelH = h - PANEL_Y - PANEL_BOTTOM;

    drawPanel(ctx, panelX, panelY, panelW, panelH, { radius: 8, roundRect: (c, x, y, w, h, r) => this.roundRect(c, x, y, w, h, r) });

    ctx.font = 'bold 20px "Segoe UI", Roboto, system-ui, sans-serif';
    ctx.fillStyle = THEME.profile.gold;
    ctx.textAlign = 'left';
    ctx.fillText('APPEARANCE CUSTOMIZATION', panelX + 30, panelY + 40);

    const sections = [
      { title: 'WARFRAME COLORS', items: ['Primary', 'Secondary', 'Tertiary', 'Accent', 'Energy', 'Emissive'] },
      { title: 'ATTACHMENTS', items: ['Helmet', 'Chest', 'Shoulders', 'Legs', 'Armour', 'Syandana'] },
      { title: 'OPERATOR', items: ['Face', 'Hair', 'Accessories', 'Clothing', 'Armor', 'Amp'] },
      { title: 'UI THEME', items: ['Classic', 'Dark Sector', 'TennoGen', 'Prime', 'Corpus', 'Grineer', 'Infested'] }
    ];

    sections.forEach((sec, si) => {
      const sy = panelY + 90 + si * 70;
      
      ctx.font = 'bold 12px "Segoe UI", Roboto, system-ui, sans-serif';
      ctx.fillStyle = THEME.profile.gold;
      ctx.textAlign = 'left';
      ctx.fillText(sec.title, panelX + 30, sy);
      
      sec.items.forEach((item, ii) => {
        const ix = panelX + 30 + ii * 90;
        const iy = sy + 25;
        
        ctx.fillStyle = ii === 0 ? THEME.accent : THEME.profile.border;
        ctx.strokeStyle = THEME.profile.gold;
        ctx.lineWidth = ii === 0 ? 2 : 1;
        this.roundRect(ctx, ix, iy, 80, 30, 4);
        ctx.fill();
        ctx.stroke();
        
        ctx.font = '12px "Segoe UI", Roboto, system-ui, sans-serif';
        ctx.fillStyle = ii === 0 ? THEME.inkDark : THEME.text.title;
        ctx.textAlign = 'center';
        ctx.fillText(item, ix + 40, iy + 20);
      });
    });

    // Color palette preview
    const paletteY = panelY + panelH - 120;
    ctx.font = 'bold 12px "Segoe UI", Roboto, system-ui, sans-serif';
    ctx.fillStyle = THEME.profile.warmGrey;
    ctx.textAlign = 'left';
    ctx.fillText('RECENT COLORS', panelX + 30, paletteY - 10);
    
    const colors = THEME.profile.palette;
    colors.forEach((c, i) => {
      const cx = panelX + 30 + i * 70;
      ctx.fillStyle = c;
      this.roundRect(ctx, cx, paletteY, 50, 50, 4);
      ctx.fill();
      ctx.strokeStyle = THEME.profile.border;
      ctx.lineWidth = 1;
      ctx.stroke();
    });
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