import { trackFocus, resetFocusSound } from '../focus_sound.js';
import { THEME, drawPanel, drawMenuBackground } from '../theme.js';
/**
 * Settings screen. Every option comes from engine/settings.js and is applied live
 * (and saved) the moment it changes.
 * Mouse/touch: tap a section, drag a slider, tap a toggle or choice.
 * Keyboard: Q/E or 1-3 switch section, W/S pick a row, A/D adjust, Enter toggles, Esc back.
 * Gamepad: D-pad moves, A confirms, B goes back. Gamepad rows: A, then press the button to bind.
 */
import { FONT, MENU_COLORS, MENU_SIDE_MARGIN, MENU_TOP_MARGIN, roundRectPath, drawReturnButton, drawCornerAccents } from './menu_style.js';
import { drawSquadIcons, drawCurrencyBar } from './top_bar.js';
import { settings as store, SETTING_SECTIONS } from '../../engine/settings.js';
import { BUTTON_NAMES } from '../../engine/gamepad.js';
import { audioManager } from '../../engine/audio.js';

const PREVIEW_SOUND = { sfx: 'gunshot', ui: 'ui_hover' };
const SHARED_ACTIONS = new Set(['reload', 'revive']);
const BACK_BUTTON = 1; // B
const CANCEL_HOLD_SEC = 0.6;
// Shared panel look (same as the Arsenal, navigation and squad panels)
const TOP_BAR_H = THEME.topBarHeight;
// The icon on each category tab, as in the reference
const SECTION_ICONS = { keyboardMouse: '🖱', controller: '🎮', system: '⚙', social: '☺', interface: '▤', video: '▶', audio: '🔊', accessibility: '♿' };
const BACK_W = THEME.backButton.w, BACK_H = THEME.backButton.h;

// Reads (and clears) every gamepad button press recorded this frame; returns the first button index or -1
function takePadButton(input) {
  let found = -1;
  for (let i = 0; i < BUTTON_NAMES.length; i++) {
    if (input.isPressed(`pad${i}`) && found < 0) found = i;
  }
  return found;
}

export default class SettingsScreen {
  constructor(onClose) {
    this.onClose = onClose;
    this.onTabSwitch = null;
    this.open = false;
    this.activeTab = 'settings';
    this.sectionIndex = 0;
    this.rowIndex = 0;
    this.dragging = null; // item being dragged
    this.capturing = null; // gamepad binding row waiting for a button press
    this.layout = null;
    this.canvas = null;
  }

  get section() {
    return SETTING_SECTIONS[this.sectionIndex];
  }

  openScreen() {
    resetFocusSound();
    this.open = true;
    this.rowIndex = 0;
    if (!this.canvas) this.attachPointer(document.getElementById('gameCanvas'));
  }

  closeScreen() {
    this.open = false;
    this.dragging = null;
    this.capturing = null;
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
    canvas.addEventListener('pointermove', (e) => { if (this.open && !this.dragging) this.pointerHover(toCanvas(e)); });
    window.addEventListener('pointermove', (e) => { if (this.open && this.dragging) this.dragTo(toCanvas(e).x); });
    window.addEventListener('pointerup', () => this.endDrag());
    window.addEventListener('pointercancel', () => this.endDrag());
  }

  // Hovering a section tab or a row moves the focus there (the hover sound follows it)
  pointerHover({ x, y }) {
    const L = this.layout;
    if (!L) return;
    this.backHover = inside(L.back, x, y);
    L.sections.forEach((r, i) => { if (inside(r, x, y)) this.sectionIndex = i; });
    this.section.items.forEach((item, i) => { const row = L.rows[i]; if (row && inside(row, x, y)) this.rowIndex = i; });
  }

  pointerDown({ x, y }) {
    const L = this.layout;
    if (!L) return;
    L.sections.forEach((r, i) => {
      if (inside(r, x, y) && i !== this.sectionIndex) { this.sectionIndex = i; this.rowIndex = 0; }
    });
    if (inside(L.back, x, y) || inside(L.confirm, x, y)) { this.closeScreen(); if (this.onClose) this.onClose(); return; }
    if (inside(L.reset, x, y)) { store.reset(this.section.id); audioManager.play('ui_hover'); return; }
    this.section.items.forEach((item, i) => {
      const row = L.rows[i];
      if (!row || !inside(row, x, y)) return;
      this.rowIndex = i;
      if (item.type === 'slider') { this.dragging = item; this.dragTo(x); }
      else if (item.type === 'toggle') this.toggle(item);
      else if (item.type === 'binding') this.capturing = item;
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

  // The button goes to this action; if another action had it, that action takes the old button (a swap).
  // Reload and Revive may share a button: the game picks Revive while the player is downed.
  bindButton(item, button) {
    const map = { ...store.get('gamepadBindings') };
    // Abilities can share a button with plain actions (the modifier tells them apart), as can Reload and Revive
    const isAbility = (id) => id.startsWith('ability') && id !== 'abilityModifier';
    const shares = (a, b) => (SHARED_ACTIONS.has(a) && SHARED_ACTIONS.has(b)) || isAbility(a) !== isAbility(b);
    for (const id of Object.keys(map)) {
      if (map[id] === button && !shares(id, item.action)) map[id] = map[item.action];
    }
    map[item.action] = button;
    store.set('gamepadBindings', map);
    audioManager.play('ui_hover');
  }

  adjust(item, dir) {
    if (item.type === 'slider') {
      store.set(item.key, this.snap(item, store.get(item.key) + dir * item.step));
      if (PREVIEW_SOUND[item.preview]) audioManager.play(PREVIEW_SOUND[item.preview], 0.5);
    } else if (item.type === 'toggle') this.toggle(item);
    else this.cycle(item, dir);
  }

  update(dt, input) {
    // Read every frame, even when closed, so a press made elsewhere can't start a rebind later
    const padButton = takePadButton(input);
    if (!this.open) return;
    if (this.capturing) {
      // While binding, the next button pressed is assigned. B (sent as Escape in menus) also binds on release,
      // but holding it past CANCEL_HOLD_SEC cancels instead. Read Enter and Escape so they don't leak out.
      input.isPressed('enter');
      input.isPressed('Escape');
      const backHeld = input.isKeyDown('escape');
      const finish = () => { this.capturing = null; this.cancelHeld = 0; this.backPressed = false; };
      if (padButton >= 0 && padButton !== BACK_BUTTON) {
        this.bindButton(this.capturing, padButton);
        finish();
        return;
      }
      if (padButton === BACK_BUTTON) this.backPressed = true;
      if (backHeld) this.cancelHeld = (this.cancelHeld ?? 0) + dt;
      if (this.cancelHeld >= CANCEL_HOLD_SEC) { finish(); return; }
      if (this.backPressed && !backHeld) {
        this.bindButton(this.capturing, BACK_BUTTON);
        finish();
      }
      return;
    }
    if (input.isPressed('Escape')) {
      this.closeScreen();
      if (this.onClose) this.onClose();
      return;
    }
    const n = SETTING_SECTIONS.length;
    for (let i = 0; i < n; i++) if (input.isPressed(String(i + 1))) { this.sectionIndex = i; this.rowIndex = 0; }
    if (input.isPressed('q')) { this.sectionIndex = (this.sectionIndex + n - 1) % n; this.rowIndex = 0; }
    if (input.isPressed('e')) { this.sectionIndex = (this.sectionIndex + 1) % n; this.rowIndex = 0; }

    trackFocus(`${this.sectionIndex}|${this.rowIndex}|${this.backHover}`);
    const items = this.section.items;
    // An empty category has no rows to move through or adjust
    if (items.length) {
    if (input.isPressed('w') || input.isPressed('arrowup')) this.rowIndex = (this.rowIndex + items.length - 1) % items.length;
    if (input.isPressed('s') || input.isPressed('arrowdown')) this.rowIndex = (this.rowIndex + 1) % items.length;
    }
    const item = items[this.rowIndex];
    const left = input.isPressed('a') || input.isPressed('arrowleft');
    const right = input.isPressed('d') || input.isPressed('arrowright');
    const enter = input.isPressed('enter');
    if (!item) {
      // nothing to adjust in an empty category
    } else if (item.type === 'binding') {
      if (enter) this.capturing = item;
    } else {
      if (left) this.adjust(item, -1);
      if (right) this.adjust(item, 1);
      if (enter && item.type !== 'slider') this.adjust(item, 1);
    }
  }

  // Clicks are handled by pointer events above; kept so the game loop's call stays harmless
  handleClick() {
    return false;
  }

  // ---------------------------------------------------------------- layout + drawing

  computeLayout(w, h) {
    const compact = h < 560;
    const top = MENU_TOP_MARGIN + TOP_BAR_H + THEME.topBarGap; // below the squad icons and currency bar
    const panelW = Math.min(760, w - MENU_SIDE_MARGIN * 2);
    const x = (w - panelW) / 2;
    // Heading row (category name and search), then the category tabs, then the list
    const headY = top;
    const tabH = compact ? 36 : 44;
    const tabsY = headY + 40;
    const tabGap = 6;
    const tabW = (panelW - tabGap * (SETTING_SECTIONS.length - 1)) / SETTING_SECTIONS.length;
    const sections = SETTING_SECTIONS.map((_, i) => ({ x: x + i * (tabW + tabGap), y: tabsY, w: tabW, h: tabH }));
    const listY = tabsY + tabH + 16;
    const btnH = compact ? 32 : 40;
    const btnW = 150;
    const bottomLimit = h - MENU_TOP_MARGIN - 52 - btnH - 10; // keep clear of the bottom buttons
    const rowH = Math.max(30, Math.min(compact ? 36 : 48, (bottomLimit - listY) / Math.max(1, this.section.items.length)));
    const rows = this.section.items.map((_, i) => ({ x, y: listY + i * rowH, w: panelW, h: rowH - 4 }));
    const controlX = x + panelW * 0.5;
    const track = { x: controlX, w: panelW * 0.5 - 90 };
    const back = { x: w - MENU_SIDE_MARGIN - BACK_W, y: h - MENU_TOP_MARGIN - BACK_H, w: BACK_W, h: BACK_H };
    // Bottom buttons, right to left: BACK, DEFAULTS, CONFIRM
    const btnY = back.y + (BACK_H - btnH) / 2;
    const defaults = { x: back.x - 12 - btnW, y: btnY, w: btnW, h: btnH };
    const confirm = { x: defaults.x - 12 - btnW, y: btnY, w: btnW, h: btnH };
    const search = { x: x + panelW - 260, y: headY, w: 260, h: 36 };
    return { compact, x, w: panelW, headY, sections, rows, track, controlX, back, search, confirm, reset: defaults };
  }

  draw(ctx) {
    if (!this.open) return;
    const w = ctx.canvas.width, h = ctx.canvas.height;
    const L = this.layout = this.computeLayout(w, h);

    // Same background as the Arsenal, with the shared top bar and corner accents
    drawMenuBackground(ctx, w, h);
    drawSquadIcons(ctx);
    drawCurrencyBar(ctx, w);
    drawCornerAccents(ctx, w, h);

    // Title, next to the squad icons
    ctx.font = `bold 30px ${FONT}`;
    ctx.fillStyle = MENU_COLORS.title;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '6px';
    ctx.fillText('OPTIONS', MENU_SIDE_MARGIN + 3 * 60 + 16, MENU_TOP_MARGIN + 27);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';

    // Heading: the current category, and the search box on the right
    const current = this.section.label;
    ctx.font = `bold ${L.compact ? 15 : 18}px ${FONT}`;
    ctx.fillStyle = MENU_COLORS.title;
    ctx.textAlign = 'left';
    ctx.fillText(current, L.x, L.headY + 18);
    drawPanel(ctx, L.search.x, L.search.y, L.search.w, L.search.h, { radius: 4 });
    ctx.font = `15px ${FONT}`;
    ctx.fillStyle = MENU_COLORS.hint;
    ctx.fillText('SEARCH...', L.search.x + 14, L.search.y + L.search.h / 2);
    ctx.textAlign = 'right';
    ctx.font = `18px ${FONT}`;
    ctx.fillStyle = MENU_COLORS.title;
    ctx.fillText('⌕', L.search.x + L.search.w - 12, L.search.y + L.search.h / 2);

    // Category tabs: an icon each, the active one lit
    SETTING_SECTIONS.forEach((s, i) => {
      const r = L.sections[i];
      const active = i === this.sectionIndex;
      drawPanel(ctx, r.x, r.y, r.w, r.h, { radius: 4, selected: active, faintFill: true });
      ctx.font = `${L.compact ? 16 : 20}px "Segoe UI Symbol", Arial, sans-serif`;
      ctx.fillStyle = active ? MENU_COLORS.selected : MENU_COLORS.label;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(SECTION_ICONS[s.id] ?? '•', r.x + r.w / 2, r.y + r.h / 2);
    });

    // Rows
    this.section.items.forEach((item, i) => {
      const r = L.rows[i];
      const value = store.get(item.key);
      const selected = i === this.rowIndex;
      // Every row is a panel; the selected one gets the gold outline
      drawPanel(ctx, r.x, r.y, r.w, r.h, { radius: 4, selected });
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
      else if (item.type === 'binding') this.drawBinding(ctx, L, item, value[item.action], cy);
      else this.drawChoice(ctx, L, item, value, cy);
    });

    // Bottom buttons: CONFIRM and DEFAULTS (reset this category), beside BACK
    for (const [b, label] of [[L.confirm, 'CONFIRM'], [L.reset, 'DEFAULTS']]) {
      drawPanel(ctx, b.x, b.y, b.w, b.h, { radius: 3 });
      ctx.font = `bold ${L.compact ? 13 : 15}px ${FONT}`;
      ctx.fillStyle = MENU_COLORS.title;
      ctx.textAlign = 'center';
      ctx.fillText(label, b.x + b.w / 2, b.y + b.h / 2);
    }

    drawReturnButton(ctx, L.back, !!this.backHover);

    ctx.textBaseline = 'alphabetic';
  }

  drawSlider(ctx, L, item, value, cy) {
    const t = (value - item.min) / (item.max - item.min);
    const { x, w } = L.track;
    roundRectPath(ctx, x, cy - 3, w, 6, 3);
    ctx.fillStyle = THEME.dropdown.stroke;
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
    ctx.fillStyle = on ? MENU_COLORS.accent : THEME.dropdown.stroke;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(on ? x + w - h / 2 : x + h / 2, cy, h / 2 - 3, 0, Math.PI * 2);
    ctx.fillStyle = on ? THEME.inkDark : MENU_COLORS.label;
    ctx.fill();
    ctx.font = `600 ${L.compact ? 12 : 13}px ${FONT}`;
    ctx.fillStyle = on ? MENU_COLORS.selected : MENU_COLORS.hint;
    ctx.textAlign = 'left';
    ctx.fillText(on ? 'ON' : 'OFF', x + w + 12, cy);
  }

  // button: the bound button index (-1 = none)
  drawBinding(ctx, L, item, button, cy) {
    const x = L.controlX, w = L.track.w + 74, h = L.compact ? 26 : 30;
    const waiting = this.capturing === item;
    const label = waiting ? 'PRESS A BUTTON' : (button >= 0 ? BUTTON_NAMES[button] : 'NONE');
    roundRectPath(ctx, x, cy - h / 2, w, h, 4);
    ctx.fillStyle = waiting ? THEME.accentPressed : THEME.subtle.soft;
    ctx.fill();
    if (waiting) { ctx.strokeStyle = MENU_COLORS.accent; ctx.lineWidth = 1; ctx.stroke(); }
    ctx.font = `${waiting || button >= 0 ? 'bold ' : ''}${L.compact ? 12 : 13}px ${FONT}`;
    ctx.fillStyle = waiting || button >= 0 ? MENU_COLORS.selected : MENU_COLORS.label;
    ctx.textAlign = 'center';
    ctx.fillText(label, x + w / 2, cy);
  }

  drawChoice(ctx, L, item, value, cy) {
    const x = L.controlX, w = L.track.w + 74, h = L.compact ? 26 : 30;
    const segW = w / item.options.length;
    item.options.forEach((opt, i) => {
      const sx = x + i * segW;
      const active = opt === value;
      roundRectPath(ctx, sx + 1, cy - h / 2, segW - 2, h, 4);
      ctx.fillStyle = active ? THEME.accentPressed : THEME.subtle.soft;
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
