/**
 * Arsenal - Warframe-style loadout screen.
 * Left: loadout slots (Warframe, Primary, Secondary, Melee).
 * Middle: weapons available for the selected slot.
 * Right: stats for the highlighted weapon, with an Equip button.
 * Keyboard: A/D or Left/Right switch slot, W/S or Up/Down pick a weapon, Enter equips, Esc goes back.
 * Mouse/touch: click a slot or weapon to highlight it, click it again or press EQUIP to equip.
 */
import { PRIMARY_WEAPONS, DEFAULT_PRIMARY } from '../../weapons/primary_weapon.js';
import { SECONDARY_WEAPONS, DEFAULT_SECONDARY } from '../../weapons/secondary_weapon.js';
import { MELEE_WEAPONS, DEFAULT_MELEE } from '../../weapons/melee_weapon.js';
import { audioManager } from '../../engine/audio.js';
import { drawTopTabs, getTabHitRects, TAB_STYLE } from './top_tabs.js';
import { FONT, MENU_COLORS, SCREEN_EDGE, roundRectPath, drawCornerAccents } from './menu_style.js';

const SLOTS = [
  { id: 'primary', label: 'PRIMARY', weapons: () => PRIMARY_WEAPONS, fallback: DEFAULT_PRIMARY },
  { id: 'secondary', label: 'SECONDARY', weapons: () => SECONDARY_WEAPONS, fallback: DEFAULT_SECONDARY },
  { id: 'melee', label: 'MELEE', weapons: () => MELEE_WEAPONS, fallback: DEFAULT_MELEE },
];

const WARFRAME = { name: 'EXCALIBUR', detail: 'Health 370 · Shield 370 · Armor 240 · Energy 150' };

const DAMAGE_COLORS = {
  impact: '#8fb3c9', puncture: '#e0c870', slash: '#d0584a',
  heat: '#ff7a2e', cold: '#7fd3ff', electricity: '#b48cff', toxin: '#7ad14a',
};

const PANEL_BG = 'rgba(16,16,28,0.92)';
const PANEL_STROKE = 'rgba(255,255,255,0.08)';

const pct = (v) => `${Math.round((v ?? 0) * 1000) / 10}%`;
const num = (v, d = 2) => (v == null ? '—' : `${+Number(v).toFixed(d)}`);

export default class Arsenal {
  constructor(loadout = {}) {
    this.visible = false;
    this.activeTab = 'arsenal';
    this.onTabSwitch = null;
    this.returnScreen = 'main-menu';
    this.loadout = { primary: DEFAULT_PRIMARY, secondary: DEFAULT_SECONDARY, melee: DEFAULT_MELEE };
    this.setLoadout(loadout);
    this.slotIndex = 0;
    this.weaponIndex = 0;
    this.layout = null;
    this.lastHover = '';
  }

  setLoadout(loadout = {}) {
    // Ignore empty slots (no player yet before the first mission) so defaults stay
    for (const [slot, name] of Object.entries(loadout)) if (name) this.loadout[slot] = name;
  }

  open(currentLoadout = {}, returnScreen = 'main-menu') {
    this.visible = true;
    this.activeTab = 'arsenal';
    this.setLoadout(currentLoadout);
    this.returnScreen = returnScreen;
    this.slotIndex = 0;
    this.weaponIndex = this.equippedIndex();
  }

  close() {
    this.visible = false;
  }

  get currentLoadout() {
    return { ...this.loadout };
  }

  get slot() {
    return SLOTS[this.slotIndex];
  }

  // Read live: the weapon tables are filled after this module loads
  weaponList(slot = this.slot) {
    return Object.values(slot.weapons()).sort((a, b) => a.name.localeCompare(b.name));
  }

  equippedIndex(slot = this.slot) {
    return Math.max(0, this.weaponList(slot).findIndex(w => w.name === this.loadout[slot.id]));
  }

  selectSlot(i) {
    if (i === this.slotIndex) return;
    this.slotIndex = i;
    this.weaponIndex = this.equippedIndex();
    audioManager.play('ui_hover');
  }

  equip() {
    const weapon = this.weaponList()[this.weaponIndex];
    if (!weapon || this.loadout[this.slot.id] === weapon.name) return;
    this.loadout[this.slot.id] = weapon.name;
    audioManager.play(this.slot.id === 'melee' ? 'melee_equip1' : 'ranged_equip1', 0.6);
  }

  update(input, canvas) {
    if (!this.visible) return null;
    const list = this.weaponList();

    if (input.isKeyPressed('arrowleft') || input.isKeyPressed('a')) this.selectSlot((this.slotIndex + SLOTS.length - 1) % SLOTS.length);
    if (input.isKeyPressed('arrowright') || input.isKeyPressed('d')) this.selectSlot((this.slotIndex + 1) % SLOTS.length);
    if (list.length) {
      if (input.isKeyPressed('arrowup') || input.isKeyPressed('w')) { this.weaponIndex = (this.weaponIndex + list.length - 1) % list.length; audioManager.play('ui_hover'); }
      if (input.isKeyPressed('arrowdown') || input.isKeyPressed('s')) { this.weaponIndex = (this.weaponIndex + 1) % list.length; audioManager.play('ui_hover'); }
    }
    if (input.isKeyPressed('enter') || input.isKeyPressed(' ')) this.equip();

    if (input.isKeyPressed('escape')) {
      this.close();
      return { action: 'close', loadout: this.currentLoadout, returnScreen: this.returnScreen };
    }

    const mouse = input.getMousePos();
    const hit = this.hitTest(mouse.x, mouse.y, canvas);
    const hoverKey = hit ? `${hit.type}:${hit.index ?? ''}` : '';
    if (hoverKey && hoverKey !== this.lastHover && hit.type !== 'tab') audioManager.play('ui_hover');
    this.lastHover = hoverKey;

    if (input.isMouseClicked() && hit) {
      if (hit.type === 'tab') {
        if (hit.id !== 'arsenal' && this.onTabSwitch) this.onTabSwitch(hit.id);
      } else if (hit.type === 'slot') {
        this.selectSlot(hit.index);
      } else if (hit.type === 'weapon') {
        if (hit.index === this.weaponIndex) this.equip();
        else this.weaponIndex = hit.index;
      } else if (hit.type === 'equip') {
        this.equip();
      }
    }
    return null;
  }

  // Clicks are handled in update(); kept so the game loop's call stays harmless
  handleClick() {
    return false;
  }

  // ---------------------------------------------------------------- layout

  computeLayout(w, h) {
    const compact = w < 900 || h < 560;
    const pad = SCREEN_EDGE; // content lines up with the corner brackets
    const top = TAB_STYLE.y + TAB_STYLE.height + (compact ? 14 : 28);
    const bottom = h - SCREEN_EDGE - 52; // room for the shared back button above the bottom margin
    const gap = compact ? 10 : 20;
    const usable = w - pad * 2;
    const left = pad;
    const slotW = Math.round(usable * 0.27);
    const listW = Math.round(usable * 0.3);
    const statsW = usable - slotW - listW - gap * 2;
    const slotH = Math.min(compact ? 58 : 84, (bottom - top - gap * 3) / 4);
    return {
      compact, top, bottom,
      slots: { x: left, w: slotW, h: slotH, gap: compact ? 6 : 10 },
      list: { x: left + slotW + gap, w: listW, rowH: compact ? 40 : 52 },
      stats: { x: left + slotW + listW + gap * 2, w: statsW },
    };
  }

  slotRect(L, i) {
    // i: 0 = Warframe card, 1..3 = weapon slots
    return { x: L.slots.x, y: L.top + i * (L.slots.h + L.slots.gap), w: L.slots.w, h: L.slots.h };
  }

  equipRect(L) {
    const h = L.compact ? 34 : 44;
    return { x: L.stats.x + 16, y: L.bottom - h - 16, w: L.stats.w - 32, h };
  }

  hitTest(x, y, canvas) {
    const L = this.computeLayout(canvas.width, canvas.height);
    const inside = (r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    for (const t of getTabHitRects(canvas.width)) {
      if (x >= t.x && x <= t.x + t.width && y >= t.y && y <= t.y + t.height) return { type: 'tab', id: t.id };
    }
    for (let i = 0; i < SLOTS.length; i++) if (inside(this.slotRect(L, i + 1))) return { type: 'slot', index: i };
    const list = this.weaponList();
    for (let i = 0; i < list.length; i++) {
      if (inside({ x: L.list.x, y: L.top + 34 + i * L.list.rowH, w: L.list.w, h: L.list.rowH - 6 })) return { type: 'weapon', index: i };
    }
    if (inside(this.equipRect(L))) return { type: 'equip' };
    return null;
  }

  // ---------------------------------------------------------------- drawing

  draw(ctx, canvas) {
    if (!this.visible) return;
    const w = canvas.width, h = canvas.height;
    const L = this.computeLayout(w, h);

    ctx.save();
    const bg = ctx.createRadialGradient(w * 0.3, h * 0.2, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.8);
    bg.addColorStop(0, '#0d0d1a');
    bg.addColorStop(0.4, '#06060e');
    bg.addColorStop(1, '#020205');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    drawTopTabs(ctx, w, 'arsenal');
    this.drawSlots(ctx, L);
    this.drawWeaponList(ctx, L);
    this.drawStats(ctx, L);
    this.drawFooter(ctx, L, w, h);
    drawCornerAccents(ctx, w, h);
    ctx.restore();
  }

  panel(ctx, x, y, w, h, active = false) {
    roundRectPath(ctx, x, y, w, h, 6);
    ctx.fillStyle = active ? 'rgba(255,107,53,0.10)' : PANEL_BG;
    ctx.fill();
    ctx.strokeStyle = active ? MENU_COLORS.accent : PANEL_STROKE;
    ctx.lineWidth = active ? 1.5 : 1;
    ctx.stroke();
  }

  drawSlots(ctx, L) {
    const cards = [
      { label: 'WARFRAME', name: WARFRAME.name, sub: L.compact ? 'Only frame available' : WARFRAME.detail, locked: true },
      ...SLOTS.map(s => {
        const weapon = s.weapons()[this.loadout[s.id]];
        return { label: s.label, name: (this.loadout[s.id] || s.fallback).toUpperCase(), sub: weapon?.class ?? '' };
      }),
    ];
    cards.forEach((card, i) => {
      const r = this.slotRect(L, i);
      const active = i === this.slotIndex + 1;
      this.panel(ctx, r.x, r.y, r.w, r.h, active);
      if (active) {
        ctx.fillStyle = MENU_COLORS.accent;
        ctx.fillRect(r.x, r.y + 8, 3, r.h - 16);
      }
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      const tx = r.x + 16;
      ctx.font = `600 ${L.compact ? 10 : 11}px ${FONT}`;
      ctx.fillStyle = card.locked ? MENU_COLORS.hint : MENU_COLORS.accent;
      ctx.fillText(card.label, tx, r.y + (L.compact ? 16 : 22));
      ctx.font = `bold ${L.compact ? 15 : 20}px ${FONT}`;
      ctx.fillStyle = active ? MENU_COLORS.selected : MENU_COLORS.title;
      ctx.fillText(card.name, tx, r.y + (L.compact ? 35 : 50));
      if (card.sub) {
        ctx.font = `${L.compact ? 10 : 12}px ${FONT}`;
        ctx.fillStyle = MENU_COLORS.hint;
        ctx.fillText(card.sub, tx, r.y + (L.compact ? 50 : 70), r.w - 28);
      }
    });
  }

  drawWeaponList(ctx, L) {
    const list = this.weaponList();
    const x = L.list.x, w = L.list.w;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `600 12px ${FONT}`;
    ctx.fillStyle = MENU_COLORS.hint;
    ctx.fillText(`${this.slot.label} WEAPONS  ·  ${list.length}`, x + 4, L.top + 16);

    list.forEach((weapon, i) => {
      const y = L.top + 34 + i * L.list.rowH;
      const rh = L.list.rowH - 6;
      const highlighted = i === this.weaponIndex;
      const equipped = this.loadout[this.slot.id] === weapon.name;
      this.panel(ctx, x, y, w, rh, highlighted);
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.font = `${highlighted ? 'bold ' : ''}${L.compact ? 14 : 16}px ${FONT}`;
      ctx.fillStyle = highlighted ? MENU_COLORS.selected : MENU_COLORS.label;
      ctx.fillText(weapon.name, x + 14, y + rh / 2 - (L.compact ? 0 : 7));
      if (!L.compact) {
        ctx.font = `11px ${FONT}`;
        ctx.fillStyle = MENU_COLORS.hint;
        ctx.fillText(`${weapon.class ?? ''}${weapon.masteryReq ? `  ·  MR ${weapon.masteryReq}` : ''}`, x + 14, y + rh / 2 + 10);
      }
      if (equipped) {
        ctx.font = `bold 10px ${FONT}`;
        const label = 'EQUIPPED';
        const tw = ctx.measureText(label).width + 12;
        const cx = x + w - tw - 10, cy = y + rh / 2 - 9;
        roundRectPath(ctx, cx, cy, tw, 18, 3);
        ctx.fillStyle = 'rgba(255,107,53,0.18)';
        ctx.fill();
        ctx.fillStyle = MENU_COLORS.accent;
        ctx.textAlign = 'center';
        ctx.fillText(label, cx + tw / 2, cy + 9.5);
      }
    });
    ctx.textBaseline = 'alphabetic';
  }

  drawStats(ctx, L) {
    const weapon = this.weaponList()[this.weaponIndex];
    const x = L.stats.x, w = L.stats.w, top = L.top, height = L.bottom - L.top;
    this.panel(ctx, x, top, w, height);
    if (!weapon) return;

    const a = weapon.attack ?? {};
    const isMelee = this.slot.id === 'melee';
    const p = L.compact ? 12 : 20;
    let y = top + (L.compact ? 26 : 38);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `bold ${L.compact ? 18 : 26}px ${FONT}`;
    ctx.fillStyle = MENU_COLORS.title;
    ctx.fillText(weapon.name.toUpperCase(), x + p, y);
    y += L.compact ? 16 : 22;
    ctx.font = `12px ${FONT}`;
    ctx.fillStyle = MENU_COLORS.accent;
    ctx.fillText(`${weapon.class ?? ''}  ·  Mastery Rank ${weapon.masteryReq ?? 0}`, x + p, y);

    const desc = weapon.stats?.description;
    if (desc && !L.compact) {
      y += 22;
      ctx.font = `13px ${FONT}`;
      ctx.fillStyle = MENU_COLORS.hint;
      ctx.fillText(desc, x + p, y, w - p * 2);
    }

    // Damage: total + stacked bar by type
    const dmg = Object.entries(a.damage ?? {}).filter(([, v]) => v > 0);
    const total = dmg.reduce((s, [, v]) => s + v, 0);
    y += L.compact ? 22 : 34;
    ctx.font = `600 11px ${FONT}`;
    ctx.fillStyle = MENU_COLORS.hint;
    ctx.fillText('DAMAGE', x + p, y);
    ctx.textAlign = 'right';
    ctx.font = `bold ${L.compact ? 16 : 20}px ${FONT}`;
    ctx.fillStyle = MENU_COLORS.title;
    ctx.fillText(num(total, 1), x + w - p, y + 2);
    ctx.textAlign = 'left';
    y += 10;
    let bx = x + p;
    const bw = w - p * 2;
    for (const [type, v] of dmg) {
      const seg = (v / total) * bw;
      ctx.fillStyle = DAMAGE_COLORS[type] ?? '#aaaaaa';
      ctx.fillRect(bx, y, Math.max(1, seg - 2), 6);
      bx += seg;
    }
    y += L.compact ? 18 : 24;
    ctx.font = `12px ${FONT}`;
    let lx = x + p;
    for (const [type, v] of dmg) {
      ctx.fillStyle = DAMAGE_COLORS[type] ?? '#aaaaaa';
      const text = `${type[0].toUpperCase()}${type.slice(1)} ${num(v, 1)}`;
      ctx.fillText(text, lx, y);
      lx += ctx.measureText(text).width + 14;
    }

    // Stat rows
    const rows = [
      ['Critical Chance', pct(a.critChance)],
      ['Critical Multiplier', `${num(a.critMultiplier, 1)}x`],
      ['Status Chance', pct(a.statusChance)],
      [isMelee ? 'Attack Speed' : 'Fire Rate', num(a.fireRate, 2)],
      ...(isMelee
        ? [['Range', `${num(weapon.range, 1)} m`], ['Heavy Attack', a.heavyAttackData ? `${num(a.heavyAttackData.damage_multiplier ?? 2, 1)}x damage` : '—']]
        : [['Magazine', `${weapon.magazine ?? '—'}`], ['Reload', `${num(weapon.reload, 1)} s`], ['Ammo Max', `${weapon.ammoMax ?? '—'}`], ['Trigger', a.shotType === 'hit-scan' ? 'Hit-Scan' : (a.shotType ?? '—')]]),
    ];
    y += L.compact ? 10 : 18;
    const rowH = L.compact ? 20 : 28;
    const maxRows = Math.max(0, Math.floor((this.equipRect(L).y - 10 - y) / rowH));
    rows.slice(0, maxRows).forEach(([label, value], i) => {
      const ry = y + i * rowH;
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.025)';
        ctx.fillRect(x + p - 6, ry - 4, w - p * 2 + 12, rowH);
      }
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.font = `${L.compact ? 12 : 14}px ${FONT}`;
      ctx.fillStyle = MENU_COLORS.label;
      ctx.fillText(label, x + p, ry + rowH / 2 - 4);
      ctx.textAlign = 'right';
      ctx.font = `600 ${L.compact ? 12 : 14}px ${FONT}`;
      ctx.fillStyle = MENU_COLORS.title;
      ctx.fillText(value, x + w - p, ry + rowH / 2 - 4);
    });
    ctx.textBaseline = 'alphabetic';

    // Equip button
    const r = this.equipRect(L);
    const equipped = this.loadout[this.slot.id] === weapon.name;
    roundRectPath(ctx, r.x, r.y, r.w, r.h, 4);
    if (equipped) {
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fill();
      ctx.strokeStyle = PANEL_STROKE;
      ctx.stroke();
    } else {
      const g = ctx.createLinearGradient(r.x, 0, r.x + r.w, 0);
      g.addColorStop(0, '#ff6b35');
      g.addColorStop(1, '#e85d2a');
      ctx.fillStyle = g;
      ctx.fill();
    }
    ctx.font = `bold ${L.compact ? 13 : 15}px ${FONT}`;
    ctx.fillStyle = equipped ? MENU_COLORS.hint : '#050508';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(equipped ? 'EQUIPPED' : `EQUIP ${weapon.name.toUpperCase()}`, r.x + r.w / 2, r.y + r.h / 2);
    ctx.textBaseline = 'alphabetic';
  }

  drawFooter(ctx, L, w, h) {
    // Back is the shared menu back button (back_button.js); only the key hints are drawn here
    if (L.compact) return;
    ctx.font = `12px ${FONT}`;
    ctx.fillStyle = MENU_COLORS.footer;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('[A/D] Slot   [W/S] Weapon   [Enter] Equip   [Esc] Back', w / 2, h - 30);
    ctx.textBaseline = 'alphabetic';
  }

}
