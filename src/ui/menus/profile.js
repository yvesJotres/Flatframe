import { TOP_TABS, TAB_STYLE, drawTopTabs, getTabHitRects } from './top_tabs.js';

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
    this.open = true;
    this.panelAlpha = 0;
    this.tab = 'overview';
  }

  closeScreen() {
    this.open = false;
  }

  update(dt, input) {
    if (!this.open) return;
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
  }

  handleClick(x, y) {
    if (!this.open) return false;
    
    const w = document.getElementById('gameCanvas')?.width ?? 1920;
    
    // Top tabs click handling - use universal module
    const hitRects = getTabHitRects(w);
    for (const rect of hitRects) {
      if (x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height) {
        this.activeTab = rect.id;
        if (this.onTabSwitch) this.onTabSwitch(this.activeTab);
        return true;
      }
    }

    // Sub-tabs
    const tabs = ['overview', 'stats', 'loadout', 'appearance'];
    const subTabW = 160;
    const subStartX = 100;
    const yTab = 80;
    
    tabs.forEach((t, i) => {
      const tx = subStartX + i * subTabW;
      if (x >= tx && x <= tx + subTabW && y >= yTab && y <= yTab + 40) {
        this.tab = t;
      }
    });
    
    return true;
  }

  draw(ctx) {
    if (!this.open) return;
    
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    
    // Background
    const g = ctx.createRadialGradient(w * 0.2, h * 0.3, 0, w * 0.5, h * 0.5, Math.max(w, h));
    g.addColorStop(0, '#0a0a14');
    g.addColorStop(0.4, '#06060a');
    g.addColorStop(1, '#030305');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Nebula glow
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const n1 = ctx.createRadialGradient(w * 0.15, h * 0.25, 0, w * 0.15, h * 0.25, w * 0.5);
    n1.addColorStop(0, 'rgba(255,107,53,0.03)'); n1.addColorStop(1, 'transparent');
    ctx.fillStyle = n1; ctx.fillRect(0, 0, w, h);
    ctx.restore();

    // Top tabs (match navigation)
    this.drawTopTabs(ctx, w);
    
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

  drawTopTabs(ctx, w) {
    drawTopTabs(ctx, w, 'profile');
  }

  drawOverview(ctx, w, h) {
    const panelW = 500;
    const panelX = (w - panelW) / 2;
    const panelY = 100;
    const panelH = h - 140;

    // Main panel
    this.roundRect(ctx, panelX, panelY, panelW, panelH, 8);
    ctx.fillStyle = 'rgba(18,18,30,0.98)';
    ctx.strokeStyle = '#ff6b35';
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();

    // Player avatar/frame area
    const avatarX = panelX + 40;
    const avatarY = panelY + 40;
    const avatarSize = 180;
    
    // Frame silhouette
    ctx.fillStyle = '#1a1a2e';
    this.roundRect(ctx, avatarX, avatarY, avatarSize, avatarSize, 8);
    ctx.fill();
    ctx.strokeStyle = '#ff6b35';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Warframe icon
    ctx.font = '100px Arial';
    ctx.fillStyle = '#ff6b35';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚔', avatarX + avatarSize/2, avatarY + avatarSize/2 + 5);

    // Info panel
    const infoX = avatarX + avatarSize + 30;
    const infoY = avatarY;
    
    ctx.font = 'bold 28px "Segoe UI", Roboto, system-ui, sans-serif';
    ctx.fillStyle = '#f0e8e0';
    ctx.textAlign = 'left';
    ctx.fillText('TENNO OPERATIVE', infoX, infoY + 30);
    
    ctx.font = '14px "Segoe UI", Roboto, system-ui, sans-serif';
    ctx.fillStyle = '#9a8a7a';
    ctx.fillText('Mastery Rank', infoX, infoY + 70);
    
    // MR display
    const mr = 12;
    const mrX = infoX;
    const mrY = infoY + 90;
    ctx.font = 'bold 48px "Segoe UI", Roboto, system-ui, sans-serif';
    ctx.fillStyle = '#ff6b35';
    ctx.textAlign = 'center';
    ctx.fillText(mr, mrX + 60, mrY + 50);
    
    // MR ring
    ctx.strokeStyle = '#ff6b35';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(mrX + 60, mrY + 30, 50, -Math.PI/2, -Math.PI/2 + (mr/30) * Math.PI * 2);
    ctx.stroke();
    
    ctx.strokeStyle = '#333355';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(mrX + 60, mrY + 30, 50, -Math.PI/2 + (mr/30) * Math.PI * 2, -Math.PI/2 + Math.PI * 2);
    ctx.stroke();

    // Glyph
    ctx.fillStyle = '#ff6b35';
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
      ctx.fillStyle = '#9a8a7a';
      ctx.textAlign = 'center';
      ctx.fillText(s.label, sx, statY);
      
      ctx.font = '20px "Segoe UI", Roboto, system-ui, sans-serif';
      ctx.fillStyle = '#ff6b35';
      ctx.fillText(s.value, sx, statY + 28);
      
      ctx.font = '16px Arial';
      ctx.fillStyle = '#ff6b35';
      ctx.fillText(s.icon, sx, statY + 55);
    });
  }

  drawStats(ctx, w, h) {
    const panelW = 700;
    const panelX = (w - panelW) / 2;
    const panelY = 100;
    const panelH = h - 140;

    this.roundRect(ctx, panelX, panelY, panelW, panelH, 8);
    ctx.fillStyle = 'rgba(18,18,30,0.98)';
    ctx.strokeStyle = '#3a8fce';
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();

    ctx.font = 'bold 20px "Segoe UI", Roboto, system-ui, sans-serif';
    ctx.fillStyle = '#3a8fce';
    ctx.textAlign = 'left';
    ctx.fillText('COMBAT STATISTICS', panelX + 30, panelY + 40);

    const categories = [
      { name: 'OFFENSE', color: '#ff6b35', stats: [
        { k: 'Total Damage Dealt', v: '2.4B' },
        { k: 'Headshots', v: '12,843' },
        { k: 'Critical Hits', v: '89,234' },
        { k: 'Status Procs', v: '156,789' },
        { k: 'Melee Kills', v: '34,567' }
      ]},
      { name: 'DEFENSE', color: '#3a8fce', stats: [
        { k: 'Damage Taken', v: '45.2M' },
        { k: 'Times Downed', v: '234' },
        { k: 'Revives', v: '89' },
        { k: 'Shield Gated', v: '1,234' },
        { k: 'Health Restored', v: '8.9M' }
      ]},
      { name: 'UTILITY', color: '#7ab800', stats: [
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
        ctx.fillStyle = '#9a8a7a';
        ctx.textAlign = 'left';
        ctx.fillText(s.k, cx + 20, sy);
        
        ctx.font = 'bold 18px "Segoe UI", Roboto, system-ui, sans-serif';
        ctx.fillStyle = '#f0e8e0';
        ctx.fillText(s.v, cx + 20, sy + 28);
      });
    });
  }

  drawLoadout(ctx, w, h) {
    const panelW = 800;
    const panelX = (w - panelW) / 2;
    const panelY = 100;
    const panelH = h - 140;

    this.roundRect(ctx, panelX, panelY, panelW, panelH, 8);
    ctx.fillStyle = 'rgba(18,18,30,0.98)';
    ctx.strokeStyle = '#7ab800';
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();

    ctx.font = 'bold 20px "Segoe UI", Roboto, system-ui, sans-serif';
    ctx.fillStyle = '#7ab800';
    ctx.textAlign = 'left';
    ctx.fillText('CURRENT LOADOUT', panelX + 30, panelY + 40);

    const slots = [
      { label: 'WARFRAME', name: 'Excalibur Prime', rank: 30, polarity: ['■','▲','●','◆'], aura: '◆', exilus: '●', icon: '⚔' },
      { label: 'PRIMARY', name: 'Braton Prime', rank: 30, polarity: ['■','▲','●','◆','■','▲','●','◆'], icon: '🔫' },
      { label: 'SECONDARY', name: 'Lato Prime', rank: 30, polarity: ['■','▲','●','◆','■'], icon: '🔫' },
      { label: 'MELEE', name: 'Skana Prime', rank: 30, polarity: ['■','▲','●','◆','■','▲','●','◆'], icon: '⚔' },
      { label: 'COMPANION', name: 'Smeeta Kavat', rank: 30, polarity: ['■','▲'], icon: '🐱' }
    ];

    slots.forEach((slot, i) => {
      const sy = panelY + 90 + i * 95;
      
      // Slot bg
      this.roundRect(ctx, panelX + 30, sy, panelW - 60, 80, 6);
      ctx.fillStyle = 'rgba(10,10,20,0.6)';
      ctx.strokeStyle = '#333355';
      ctx.lineWidth = 1;
      ctx.fill();
      ctx.stroke();

      // Icon
      ctx.font = '32px Arial';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#f0e8e0';
      ctx.fillText(slot.icon, panelX + 60, sy + 50);

      // Label
      ctx.font = 'bold 12px "Segoe UI", Roboto, system-ui, sans-serif';
      ctx.fillStyle = '#9a8a7a';
      ctx.textAlign = 'left';
      ctx.fillText(slot.label, panelX + 100, sy + 25);

      // Name & rank
      ctx.font = 'bold 16px "Segoe UI", Roboto, system-ui, sans-serif';
      ctx.fillStyle = '#f0e8e0';
      ctx.fillText(slot.name, panelX + 100, sy + 50);

      ctx.font = '12px "Segoe UI", Roboto, system-ui, sans-serif';
      ctx.fillStyle = '#ff6b35';
      ctx.fillText(`RANK ${slot.rank}`, panelX + 100, sy + 70);

      // Polarities
      const px = panelW - 200;
      slot.polarity.forEach((p, pi) => {
        ctx.font = '18px Arial';
        ctx.fillStyle = '#ff6b35';
        ctx.textAlign = 'center';
        ctx.fillText(p, panelX + px + pi * 28, sy + 50);
      });
      
      if (slot.aura) {
        ctx.fillStyle = '#7ab800';
        ctx.fillText('⬇ ' + slot.aura, panelX + px + slot.polarity.length * 28, sy + 30);
      }
      if (slot.exilus) {
        ctx.fillStyle = '#ffd700';
        ctx.fillText('◇ ' + slot.exilus, panelX + px + slot.polarity.length * 28, sy + 70);
      }
    });
  }

  drawAppearance(ctx, w, h) {
    const panelW = 600;
    const panelX = (w - panelW) / 2;
    const panelY = 100;
    const panelH = h - 140;

    this.roundRect(ctx, panelX, panelY, panelW, panelH, 8);
    ctx.fillStyle = 'rgba(18,18,30,0.98)';
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();

    ctx.font = 'bold 20px "Segoe UI", Roboto, system-ui, sans-serif';
    ctx.fillStyle = '#ffd700';
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
      ctx.fillStyle = '#ffd700';
      ctx.textAlign = 'left';
      ctx.fillText(sec.title, panelX + 30, sy);
      
      sec.items.forEach((item, ii) => {
        const ix = panelX + 30 + ii * 90;
        const iy = sy + 25;
        
        ctx.fillStyle = ii === 0 ? '#ff6b35' : '#333355';
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = ii === 0 ? 2 : 1;
        this.roundRect(ctx, ix, iy, 80, 30, 4);
        ctx.fill();
        ctx.stroke();
        
        ctx.font = '12px "Segoe UI", Roboto, system-ui, sans-serif';
        ctx.fillStyle = ii === 0 ? '#050508' : '#f0e8e0';
        ctx.textAlign = 'center';
        ctx.fillText(item, ix + 40, iy + 20);
      });
    });

    // Color palette preview
    const paletteY = panelY + panelH - 120;
    ctx.font = 'bold 12px "Segoe UI", Roboto, system-ui, sans-serif';
    ctx.fillStyle = '#9a8a7a';
    ctx.textAlign = 'left';
    ctx.fillText('RECENT COLORS', panelX + 30, paletteY - 10);
    
    const colors = ['#ff6b35', '#3a8fce', '#7ab800', '#ffd700', '#ff2a8a', '#e8e8f0', '#000000', '#ffffff'];
    colors.forEach((c, i) => {
      const cx = panelX + 30 + i * 70;
      ctx.fillStyle = c;
      this.roundRect(ctx, cx, paletteY, 50, 50, 4);
      ctx.fill();
      ctx.strokeStyle = '#333355';
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