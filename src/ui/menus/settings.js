/**
 * Settings screen. Every option comes from engine/settings.js and is applied live
 * (and saved) the moment it changes.
 * Mouse/touch: tap a section, drag a slider, tap a toggle or choice.
 * Keyboard: Q/E or 1-3 switch section, W/S pick a row, A/D adjust, Enter toggles, Esc back.
 */
import { drawCornerAccents, FONT, MENU_COLORS, SCREEN_EDGE, roundRectPath } from './menu_style.js';
import { drawTopTabs, getTabHitRects, TAB_STYLE } from './top_tabs.js';
import { settings as store, SETTING_SECTIONS } from '../../engine/settings.js';
import { audioManager } from '../../engine/audio.js';

const PREVIEW_SOUND = { sfx: 'gunshot', ui: 'ui_hover' };

export default class SettingsScreen {
  constructor(onClose) {
    this.onClose = onClose;
    this.onTabSwitch = null;
    this.open = false;
    this.activeTab = 'settings';
    this.sectionIndex = 0;
    this.rowIndex = 0;
    this.dragging = null; // item being dragged
    this.layout = null;
    this.canvas = null;
  }

  get section() {
    return SETTING_SECTIONS[this.sectionIndex];
  }

  openScreen() {
    this.open = true;
    this.rowIndex = 0;
    if (!this.canvas) this.attachPointer(document.getElementById('gameCanvas'));
  }

  closeScreen() {
    this.open = false;
    this.dragging = null;
  }

  // ---------------------------------------------------------------- input

  // Pointer events (not the game's mouse state) so sliders can be dragged with a finger too
  attachPointer(canvas) {
    if (!canvas) return;
    this.canvas = canvas;
    const toCanvas = (e) => {
      const r = canvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) };
    };
    canvas.addEventListener('pointerdown', (e) => { if (this.open) this.pointerDown(toCanvas(e)); });
    window.addEventListener('pointermove', (e) => { if (this.open && this.dragging) this.dragTo(toCanvas(e).x); });
    window.addEventListener('pointerup', () => this.endDrag());
    window.addEventListener('pointercancel', () => this.endDrag());
  }

  pointerDown({ x, y }) {
    const L = this.layout;
    if (!L) return;
    for (const t of getTabHitRects(this.canvas.width)) {
      if (x >= t.x && x <= t.x + t.width && y >= t.y && y <= t.y + t.height) {
        if (t.id !== 'settings' && this.onTabSwitch) this.onTabSwitch(t.id);
        return;
      }
    }
    L.sections.forEach((r, i) => {
      if (inside(r, x, y) && i !== this.sectionIndex) { this.sectionIndex = i; this.rowIndex = 0; audioManager.play('ui_hover'); }
    });
    if (inside(L.reset, x, y)) { store.reset(this.section.id); audioManager.play('ui_hover'); return; }
    this.section.items.forEach((item, i) => {
      const row = L.rows[i];
      if (!row || !inside(row, x, y)) return;
      this.rowIndex = i;
      if (item.type === 'slider') { this.dragging = item; this.dragTo(x); }
      else if (item.type === 'toggle') this.toggle(item);
      else this.pickChoice(item, x);
    });
  }

  dragTo(x) {
    const item = this.dragging;
    const track = this.layout?.track;
    if (!item || !track) return;
    const t = Math.min(1, Math.max(0, (x - track.x) / track.w));
    store.set(item.key, this.snap(item, item.min + t * (item.max - item.min)));
  }

  endDrag() {
    if (!this.dragging) return;
    const bus = this.dragging.preview;
    if (PREVIEW_SOUND[bus]) audioManager.play(PREVIEW_SOUND[bus], 0.5); // hear the new level
    this.dragging = null;
  }

  snap(item, v) {
    const stepped = Math.round((v - item.min) / item.step) * item.step + item.min;
    return Math.round(Math.min(item.max, Math.max(item.min, stepped)) * 1000) / 1000;
  }

  toggle(item) {
    store.set(item.key, !store.get(item.key));
    audioManager.play('ui_hover');
  }

  cycle(item, dir) {
    const opts = item.options;
    const i = opts.indexOf(store.get(item.key));
    store.set(item.key, opts[(i + dir + opts.length) % opts.length]);
    audioManager.play('ui_hover');
  }

  // Tap on a segment picks that option; tap elsewhere on the row cycles
  pickChoice(item, x) {
    const L = this.layout;
    const w = L.track.w + 74, segW = w / item.options.length;
    const i = Math.floor((x - L.controlX) / segW);
    if (i >= 0 && i < item.options.length) {
      if (store.get(item.key) !== item.options[i]) { store.set(item.key, item.options[i]); audioManager.play('ui_hover'); }
    } else this.cycle(item, 1);
  }

  adjust(item, dir) {
    if (item.type === 'slider') {
      store.set(item.key, this.snap(item, store.get(item.key) + dir * item.step));
      if (PREVIEW_SOUND[item.preview]) audioManager.play(PREVIEW_SOUND[item.preview], 0.5);
    } else if (item.type === 'toggle') this.toggle(item);
    else this.cycle(item, dir);
  }

  update(dt, input) {
    if (!this.open) return;
    if (input.isPressed('Escape')) {
      this.closeScreen();
      if (this.onClose) this.onClose();
      return;
    }
    const n = SETTING_SECTIONS.length;
    for (let i = 0; i < n; i++) if (input.isPressed(String(i + 1))) { this.sectionIndex = i; this.rowIndex = 0; }
    if (input.isPressed('q')) { this.sectionIndex = (this.sectionIndex + n - 1) % n; this.rowIndex = 0; }
    if (input.isPressed('e')) { this.sectionIndex = (this.sectionIndex + 1) % n; this.rowIndex = 0; }

    const items = this.section.items;
    if (input.isPressed('w') || input.isPressed('arrowup')) this.rowIndex = (this.rowIndex + items.length - 1) % items.length;
    if (input.isPressed('s') || input.isPressed('arrowdown')) this.rowIndex = (this.rowIndex + 1) % items.length;
    const item = items[this.rowIndex];
    if (input.isPressed('a') || input.isPressed('arrowleft')) this.adjust(item, -1);
    if (input.isPressed('d') || input.isPressed('arrowright')) this.adjust(item, 1);
    if (input.isPressed('enter') && item.type !== 'slider') this.adjust(item, 1);
  }

  // Clicks are handled by pointer events above; kept so the game loop's call stays harmless
  handleClick() {
    return false;
  }

  // ---------------------------------------------------------------- layout + drawing

  computeLayout(w, h) {
    const compact = h < 560;
    const top = TAB_STYLE.y + TAB_STYLE.height + (compact ? 14 : 28);
    const panelW = Math.min(760, w - SCREEN_EDGE * 2);
    const x = (w - panelW) / 2;
    const tabH = compact ? 32 : 40;
    const sections = SETTING_SECTIONS.map((_, i) => ({ x: x + i * (panelW / SETTING_SECTIONS.length), y: top, w: panelW / SETTING_SECTIONS.length, h: tabH }));
    const listY = top + tabH + (compact ? 10 : 18);
    const resetH = compact ? 30 : 36;
    const bottomLimit = h - SCREEN_EDGE - 52 - resetH - 10; // keep clear of the shared back button
    const rowH = Math.max(30, Math.min(compact ? 36 : 48, (bottomLimit - listY) / this.section.items.length));
    const rows = this.section.items.map((_, i) => ({ x, y: listY + i * rowH, w: panelW, h: rowH - 4 }));
    const controlX = x + panelW * 0.5;
    const track = { x: controlX, w: panelW * 0.5 - 90 };
    const resetY = listY + this.section.items.length * rowH + 8;
    return { compact, x, w: panelW, sections, rows, track, controlX, reset: { x: x + panelW - 180, y: resetY, w: 180, h: resetH } };
  }

  draw(ctx) {
    if (!this.open) return;
    const w = ctx.canvas.width, h = ctx.canvas.height;
    const L = this.layout = this.computeLayout(w, h);

    const bg = ctx.createRadialGradient(w * 0.3, h * 0.2, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.8);
    bg.addColorStop(0, '#0d0d1a');
    bg.addColorStop(0.4, '#06060e');
    bg.addColorStop(1, '#020205');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    drawTopTabs(ctx, w, 'settings');
    drawCornerAccents(ctx, w, h);

    // Section tabs
    SETTING_SECTIONS.forEach((s, i) => {
      const r = L.sections[i];
      const active = i === this.sectionIndex;
      roundRectPath(ctx, r.x + 2, r.y, r.w - 4, r.h, 4);
      ctx.fillStyle = active ? 'rgba(255,107,53,0.14)' : 'rgba(16,16,28,0.85)';
      ctx.fill();
      ctx.strokeStyle = active ? MENU_COLORS.accent : 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.font = `bold ${L.compact ? 12 : 13}px ${FONT}`;
      ctx.fillStyle = active ? MENU_COLORS.selected : MENU_COLORS.label;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(s.label, r.x + r.w / 2, r.y + r.h / 2);
    });

    // Rows
    this.section.items.forEach((item, i) => {
      const r = L.rows[i];
      const value = store.get(item.key);
      const selected = i === this.rowIndex;
      if (selected) {
        roundRectPath(ctx, r.x, r.y, r.w, r.h, 4);
        ctx.fillStyle = 'rgba(255,107,53,0.07)';
        ctx.fill();
      }
      const cy = r.y + r.h / 2;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = `${L.compact ? 13 : 15}px ${FONT}`;
      ctx.fillStyle = selected ? MENU_COLORS.selected : MENU_COLORS.title;
      ctx.fillText(item.label, r.x + 16, item.note && !L.compact ? cy - 6 : cy);
      if (item.note && !L.compact) {
        ctx.font = `11px ${FONT}`;
        ctx.fillStyle = MENU_COLORS.hint;
        ctx.fillText(item.note, r.x + 16, cy + 10);
      }

      if (item.type === 'slider') this.drawSlider(ctx, L, item, value, cy);
      else if (item.type === 'toggle') this.drawToggle(ctx, L, value, cy);
      else this.drawChoice(ctx, L, item, value, cy);
    });

    // Reset this section
    const b = L.reset;
    roundRectPath(ctx, b.x, b.y, b.w, b.h, 4);
    ctx.strokeStyle = 'rgba(255,107,53,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.font = `600 12px ${FONT}`;
    ctx.fillStyle = MENU_COLORS.accent;
    ctx.textAlign = 'center';
    ctx.fillText('RESET SECTION', b.x + b.w / 2, b.y + b.h / 2);

    if (!L.compact) {
      ctx.font = `12px ${FONT}`;
      ctx.fillStyle = MENU_COLORS.footer;
      ctx.fillText('[Q/E] Section   [W/S] Option   [A/D] Adjust   [Enter] Toggle   [Esc] Back', w / 2, h - 30);
    }
    ctx.textBaseline = 'alphabetic';
  }

  drawSlider(ctx, L, item, value, cy) {
    const t = (value - item.min) / (item.max - item.min);
    const { x, w } = L.track;
    roundRectPath(ctx, x, cy - 3, w, 6, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fill();
    if (t > 0) {
      roundRectPath(ctx, x, cy - 3, w * t, 6, 3);
      ctx.fillStyle = MENU_COLORS.accent;
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(x + w * t, cy, this.dragging === item ? 11 : 9, 0, Math.PI * 2);
    ctx.fillStyle = MENU_COLORS.selected;
    ctx.fill();
    ctx.font = `600 ${L.compact ? 13 : 14}px ${FONT}`;
    ctx.fillStyle = MENU_COLORS.title;
    ctx.textAlign = 'right';
    ctx.fillText(item.format === 'percent' ? `${Math.round(value * 100)}%` : String(value), L.x + L.w - 16, cy);
  }

  drawToggle(ctx, L, on, cy) {
    const x = L.controlX, w = 46, h = 24;
    roundRectPath(ctx, x, cy - h / 2, w, h, h / 2);
    ctx.fillStyle = on ? MENU_COLORS.accent : 'rgba(255,255,255,0.12)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(on ? x + w - h / 2 : x + h / 2, cy, h / 2 - 3, 0, Math.PI * 2);
    ctx.fillStyle = on ? '#050508' : MENU_COLORS.label;
    ctx.fill();
    ctx.font = `600 ${L.compact ? 12 : 13}px ${FONT}`;
    ctx.fillStyle = on ? MENU_COLORS.selected : MENU_COLORS.hint;
    ctx.textAlign = 'left';
    ctx.fillText(on ? 'ON' : 'OFF', x + w + 12, cy);
  }

  drawChoice(ctx, L, item, value, cy) {
    const x = L.controlX, w = L.track.w + 74, h = L.compact ? 26 : 30;
    const segW = w / item.options.length;
    item.options.forEach((opt, i) => {
      const sx = x + i * segW;
      const active = opt === value;
      roundRectPath(ctx, sx + 1, cy - h / 2, segW - 2, h, 4);
      ctx.fillStyle = active ? 'rgba(255,107,53,0.2)' : 'rgba(255,255,255,0.05)';
      ctx.fill();
      if (active) { ctx.strokeStyle = MENU_COLORS.accent; ctx.lineWidth = 1; ctx.stroke(); }
      ctx.font = `${active ? 'bold ' : ''}${L.compact ? 12 : 13}px ${FONT}`;
      ctx.fillStyle = active ? MENU_COLORS.selected : MENU_COLORS.label;
      ctx.textAlign = 'center';
      ctx.fillText(opt, sx + segW / 2, cy);
    });
  }
}

function inside(r, x, y) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}
