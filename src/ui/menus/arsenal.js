/**
 * Arsenal - Warframe-style loadout screen.
 *
 * Top left: profile avatar and the squad invite (+) button.
 * Top right: currencies (credits, platinum) and the foundry "ready to claim" indicator.
 * Left column: loadout name bar, the four loadout tabs (Loadout, Companion, Gear, Vehicles),
 *   then the equipment: Warframe card, Primary, Secondary, Melee.
 *   The focused equipment shows an action menu beside it: SWAP, UPGRADE, APPEARANCE (+ ABILITIES on the frame).
 * Centre: the frame on its pedestal.
 * Right column: info panel (name, rank, description) and stats panel for whatever is focused.
 *
 * Views: 'main' (above), 'swap' (pick another item for a slot), 'abilities' (the frame's abilities).
 * Keyboard: W/S move, D/Right opens the action menu, A/Left leaves it, Enter acts, Esc goes back.
 * Mouse/touch: hover (or tap) equipment to focus it, click an action.
 */
import { PRIMARY_WEAPONS, DEFAULT_PRIMARY } from '../../weapons/primary_weapon.js';
import { SECONDARY_WEAPONS, DEFAULT_SECONDARY } from '../../weapons/secondary_weapon.js';
import { MELEE_WEAPONS, DEFAULT_MELEE } from '../../weapons/melee_weapon.js';
import { WARFRAMES, DEFAULT_WARFRAME, RANKED_FRAME_STATS } from '../../warframe/warframes.js';
import { audioManager } from '../../engine/audio.js';
import { wallet } from '../../economy/wallet.js';
import { DISPLAY_CURRENCIES } from '../../economy/currencies.js';
import { slotKind, canPlace } from '../../mods/placement.js';
import { itemUpgrades, UPGRADES } from '../../economy/item_upgrades.js';
import { getMode } from '../squad.js';
import { user } from '../../user/user_data.js';
import { FONT, MENU_COLORS, SCREEN_EDGE, roundRectPath, drawFrameGlyph, drawProfileAndInvite, drawReturnButton } from './menu_style.js';

const MAX_RANK = 30;

// Warframe swap grid: 3 columns of frame tiles below the header card, filter row and search row
const GRID = { cols: 3, cellH: 118, gap: 8, headerGap: 116 };

// Placeholder rank and XP progress (0..1 toward the next rank), matching the reference screenshot
const MOCK_PROGRESS = {
  Excalibur: { rank: 27, xp: 0.06 },
  Braton: { rank: 23, xp: 0.5 },
  Lato: { rank: MAX_RANK, xp: 1 },
  Skana: { rank: MAX_RANK, xp: 1 },
};

const SLOTS = [
  { id: 'warframe', label: 'WARFRAME', title: 'WARFRAMES', items: () => WARFRAMES, fallback: DEFAULT_WARFRAME,
    actions: ['SWAP', 'UPGRADE', 'APPEARANCE', 'ABILITIES'] },
  { id: 'primary', label: 'PRIMARY', title: 'PRIMARY WEAPONS', items: () => PRIMARY_WEAPONS, fallback: DEFAULT_PRIMARY,
    actions: ['SWAP', 'UPGRADE', 'APPEARANCE'] },
  { id: 'secondary', label: 'SECONDARY', title: 'SECONDARY WEAPONS', items: () => SECONDARY_WEAPONS, fallback: DEFAULT_SECONDARY,
    actions: ['SWAP', 'UPGRADE', 'APPEARANCE'] },
  { id: 'melee', label: 'MELEE', title: 'MELEE WEAPONS', items: () => MELEE_WEAPONS, fallback: DEFAULT_MELEE,
    actions: ['SWAP', 'UPGRADE', 'APPEARANCE'] },
];

const LOADOUT_TABS = [
  { id: 'loadout', label: 'LOADOUT' },
  { id: 'companion', label: 'COMPANION' },
  { id: 'gear', label: 'GEAR' },
  { id: 'vehicles', label: 'VEHICLES' },
];

// The Upgrade screen is designed at this size and scaled to the window
const DESIGN_W = 1920, DESIGN_H = 1080;

// Left margin of the Arsenal's left column, in canvas px (other screen edges use SCREEN_EDGE)
const ARSENAL_LEFT_MARGIN = 96;
// Right margin of the currency box (credits and platinum), in canvas px
const CURRENCY_RIGHT_MARGIN = 96;

const DAMAGE_COLORS = {
  impact: '#8fb3c9', puncture: '#e0c870', slash: '#d0584a',
  heat: '#ff7a2e', cold: '#7fd3ff', electricity: '#b48cff', toxin: '#7ad14a',
};

const PANEL_BG = 'rgba(24,30,44,0.92)';
const PANEL_STROKE = 'rgba(255,255,255,0.08)';
const FRAME_GREEN = '#4ade80'; // the frame's in-game colour (Player.draw)

const pct = (v) => `${Math.round((v ?? 0) * 1000) / 10}%`;
const num = (v, d = 2) => (v == null ? '—' : `${+Number(v).toFixed(d)}`);
const rankLabel = (r) => (r >= MAX_RANK ? 'Max Rank' : r > 0 ? `Rank ${r}` : 'Unranked');
const inside = (r, x, y) => r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

function wrapText(ctx, text, maxW) {
  const lines = [];
  let line = '';
  for (const word of (text ?? '').split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxW) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export default class Arsenal {
  constructor(loadout = {}) {
    this.visible = false;
    this.returnScreen = 'main-menu';
    this.loadoutFromProfile();
    this.setLoadout(loadout);
    this.loadoutName = 'Vanilla'; // saved loadouts aren't implemented yet, so this is the default name
    // No economy or foundry yet: the game can set these when those systems exist
    this.wallet = wallet; // shared player balances (src/economy/wallet.js)
    this.foundryReady = false;
    this.resetView();
    this.lastHover = '';
    this.backHover = false;
    this.toast = null;
    this.upgradeConfig = 2; // 0 = Config A, 1 = Config B, 2 = Config C
    this.actionsOpen = false; // the ACTIONS menu on the Upgrade screen
    this.onProfile = null;    // set by game.js: opens the user panel from the profile icon
    this.onSquad = null;      // set by game.js: opens the squad panel under the squad-mode icon (anchor = that icon's box)
    // Each config holds its own mod slots (10 per config). Empty until mods exist.
    this.configs = [0, 1, 2].map(() => ({ mods: Array(10).fill(null) }));
    this.expand = SLOTS.map(() => 0); // 0 = collapsed, 1 = expanded, animated toward the focused card
    this.lastTick = null;
  }

  resetView() {
    this.view = 'main';
    this.focus = 0;        // slot index
    this.menuIndex = -1;   // keyboard position in the action menu, -1 = not in it
    this.menuHover = -1;
    this.swapIndex = 0;
    this.scroll = 0;
    this.abilityIndex = 0;
  }

  setLoadout(loadout = {}) {
    // Ignore empty slots (no player yet before the first mission) so defaults stay
    for (const [slot, name] of Object.entries(loadout)) if (name) this.loadout[slot] = name;
  }

  // The active user's equipped items, on top of the defaults. Every change is saved there (see equipSwapChoice).
  loadoutFromProfile() {
    this.loadout = { warframe: DEFAULT_WARFRAME, primary: DEFAULT_PRIMARY, secondary: DEFAULT_SECONDARY, melee: DEFAULT_MELEE };
    this.setLoadout(user.get('loadout'));
  }

  open(currentLoadout = {}, returnScreen = 'main-menu') {
    this.visible = true;
    // The profile's loadout is the one in use: it stays right across account switches
    this.loadoutFromProfile();
    this.returnScreen = returnScreen;
    this.resetView();
  }

  // Leaving the arsenal saves the loadout to the active user's profile (equipping alone does not)
  close() {
    this.visible = false;
    user.set('loadout', { ...this.loadout });
  }

  get currentLoadout() {
    return { ...this.loadout, mods: this.configs[this.upgradeConfig].mods.filter(Boolean) };
  }

  // Read live: the data tables are filled after this module loads
  itemList(slot) {
    return Object.values(slot.items()).sort((a, b) => a.name.localeCompare(b.name));
  }

  equipped(slot) {
    const name = this.loadout[slot.id] || slot.fallback;
    return slot.items()[name] ?? { name };
  }

  // Rank and XP progress. Placeholder values taken from the reference screenshot until save data exists.
  itemProgress(item) {
    return MOCK_PROGRESS[item.name] ?? { rank: item.rank ?? 0, xp: 0 };
  }

  itemRank(slot, item) {
    return this.itemProgress(item).rank;
  }

  frame() {
    return this.equipped(SLOTS[0]);
  }

  showToast(text) {
    this.toast = { text, until: performance.now() + 2200 };
    audioManager.play('ui_hover');
  }

  // ---------------------------------------------------------------- actions

  runAction(name) {
    const slot = SLOTS[this.focus];
    if (name === 'SWAP') {
      const list = this.itemList(slot);
      this.view = 'swap';
      this.swapIndex = Math.max(0, list.findIndex(i => i.name === this.equipped(slot).name));
      this.scroll = 0;
      audioManager.play('ui_hover');
    } else if (name === 'UPGRADE') {
      this.view = 'upgrade';
      audioManager.play('ui_hover');
    } else if (name === 'ABILITIES') {
      this.view = 'abilities';
      this.abilityIndex = 0;
      this.scroll = 0; // the ability list never scrolls
      audioManager.play('ui_hover');
    } else {
      this.showToast(`${name[0]}${name.slice(1).toLowerCase()} isn't available yet`);
    }
  }

  equipSwapChoice() {
    const slot = SLOTS[this.focus];
    const item = this.itemList(slot)[this.swapIndex];
    if (item && this.loadout[slot.id] !== item.name) {
      this.loadout[slot.id] = item.name;
      audioManager.play(slot.id === 'melee' ? 'melee_equip1' : 'ranged_equip1', 0.6);
    }
    this.view = 'main';
  }

  back() {
    this.actionsOpen = false;
    if (this.view !== 'main') { this.view = 'main'; return null; }
    if (this.menuIndex >= 0) { this.menuIndex = -1; return null; }
    this.close();
    return { action: 'close', loadout: this.currentLoadout, returnScreen: this.returnScreen };
  }

  // Ease each card's expansion toward its target, so focus changes animate
  animateCards() {
    const now = performance.now();
    const dt = this.lastTick == null ? 0 : Math.min(0.05, (now - this.lastTick) / 1000);
    this.lastTick = now;
    const k = Math.min(1, dt * 14);
    SLOTS.forEach((_, i) => {
      const target = i === this.focus ? 1 : 0;
      this.expand[i] += (target - this.expand[i]) * k;
      if (Math.abs(target - this.expand[i]) < 0.002) this.expand[i] = target;
    });
  }

  update(input, canvas) {
    if (!this.visible) return null;
    this.animateCards();
    // isKeyPressed consumes the key, so read every key exactly once per frame
    const key = (...names) => names.map(n => input.isKeyPressed(n)).some(Boolean);
    const up = key('arrowup', 'w'), down = key('arrowdown', 's');
    const left = key('arrowleft', 'a'), right = key('arrowright', 'd');
    const enter = key('enter', ' '), esc = key('escape');
    const L = this.computeLayout(canvas.width, canvas.height);

    if (esc) {
      const result = this.back();
      if (result) return result;
    } else if (this.view === 'main') {
      const actions = SLOTS[this.focus].actions;
      if (this.menuIndex >= 0) {
        if (up) this.menuIndex = (this.menuIndex + actions.length - 1) % actions.length;
        if (down) this.menuIndex = (this.menuIndex + 1) % actions.length;
        if (left) this.menuIndex = -1;
        if (enter && this.menuIndex >= 0) this.runAction(actions[this.menuIndex]);
      } else {
        if (up) this.focus = (this.focus + SLOTS.length - 1) % SLOTS.length;
        if (down) this.focus = (this.focus + 1) % SLOTS.length;
        if (right) this.menuIndex = 0;
        if (enter) this.runAction('SWAP');
      }
      if (up || down || left || right) audioManager.play('ui_hover');
    } else if (this.view === 'swap') {
      const n = this.itemList(SLOTS[this.focus]).length;
      const cols = this.swapCols();
      if (cols > 1) {
        // Grid: left/right step through tiles, up/down move a row, no wrapping
        if (n && left) this.swapIndex = Math.max(0, this.swapIndex - 1);
        if (n && right) this.swapIndex = Math.min(n - 1, this.swapIndex + 1);
        if (n && up) this.swapIndex = Math.max(0, this.swapIndex - cols);
        if (n && down) this.swapIndex = Math.min(n - 1, this.swapIndex + cols);
      } else {
        if (n && up) this.swapIndex = (this.swapIndex + n - 1) % n;
        if (n && down) this.swapIndex = (this.swapIndex + 1) % n;
      }
      if (up || down || left || right) audioManager.play('ui_hover');
      if (enter) this.equipSwapChoice();
    } else if (this.view === 'abilities') {
      const n = this.frame().abilities?.length ?? 0;
      if (n && up) this.abilityIndex = (this.abilityIndex + n - 1) % n;
      if (n && down) this.abilityIndex = (this.abilityIndex + 1) % n;
      if (up || down) audioManager.play('ui_hover');
    }
    if (this.view === 'swap') this.keepSwapVisible(L);

    // The Upgrade screen is laid out on a fixed 1920x1080 grid that is scaled to fit, so the mouse is mapped into that grid
    const mouse = input.getMousePos();
    let hitL = L, mx = mouse.x, my = mouse.y;
    if (this.view === 'upgrade') {
      const sp = this.designSpace(canvas);
      hitL = this.computeLayout(DESIGN_W, DESIGN_H);
      mx = (mouse.x - sp.ox) / sp.s;
      my = (mouse.y - sp.oy) / sp.s;
    }
    const hit = this.hitTest(hitL, mx, my);
    const hoverKey = hit ? `${hit.type}:${hit.index ?? ''}` : '';
    if (hoverKey && hoverKey !== this.lastHover) {
      audioManager.play('ui_hover');
      // Hover drives focus, like the reference: the menu follows the cursor
      if (hit.type === 'slot' && this.focus !== hit.index) { this.focus = hit.index; this.menuIndex = -1; }
      if (hit.type === 'swapItem') this.swapIndex = hit.index;
      if (hit.type === 'ability') this.abilityIndex = hit.index;
    }
    this.menuHover = hit?.type === 'action' ? hit.index : -1;
    this.lastHover = hoverKey;

    this.backHover = hit?.type === 'back';
    // isMouseClicked() clears the click when read, so read it once
    const clicked = input.isMouseClicked();
    if (clicked && hit?.type === 'back') return this.back();
    if (clicked && !hit) this.actionsOpen = false; // clicking elsewhere closes the ACTIONS menu
    if (clicked && hit) {
      switch (hit.type) {
        case 'slot': this.focus = hit.index; break;
        case 'action': this.runAction(SLOTS[this.focus].actions[hit.index]); break;
        case 'swapItem': this.swapIndex = hit.index; this.equipSwapChoice(); break;
        case 'ability': this.abilityIndex = hit.index; break;
        case 'tab': if (LOADOUT_TABS[hit.index].id !== 'loadout') this.showToast(`${LOADOUT_TABS[hit.index].label[0]}${LOADOUT_TABS[hit.index].label.slice(1).toLowerCase()} isn't available yet`); break;
        case 'invite': this.onSquad?.(this.modeRect(L)); break; // same squad panel as the other squad icons
        case 'loadoutBar': this.showToast("Saved loadouts aren't available yet"); break;
        case 'viewBack': this.view = 'main'; break;
        case 'config':
          if (hit.index !== this.upgradeConfig) { this.upgradeConfig = hit.index; audioManager.play('ui_hover'); }
          break;
        case 'addConfig': this.showToast("More configs aren't available yet"); break;
        case 'avatar': this.onProfile?.(); break;
        case 'squadMode': break; // the matchmaking icon only shows its list on hover
        case 'upgradeAction': this.actionsOpen = !this.actionsOpen; break;
        case 'actionItem': this.actionsOpen = false; this.runUpgradeAction(); break;
      }
    }
    return null;
  }

  // Where the 1920x1080 design grid sits inside the canvas: uniform scale, centred
  designSpace(canvas) {
    const s = Math.min(canvas.width / DESIGN_W, canvas.height / DESIGN_H);
    return { s, ox: (canvas.width - DESIGN_W * s) / 2, oy: (canvas.height - DESIGN_H * s) / 2 };
  }

  // Put a mod (or null, to empty the slot) into slot `index` of the active config. Returns false when the rules refuse it.
  setModSlot(index, mod) {
    const slot = SLOTS[this.focus];
    const kind = slotKind(slot.id, index);
    if (mod && !canPlace(mod, kind, slot.id)) return false;
    this.configs[this.upgradeConfig].mods[index] = mod ?? null;
    return true;
  }

  // Clicks are handled in update(); kept so the game loop's call stays harmless
  handleClick() {
    return false;
  }

  // ---------------------------------------------------------------- layout

  computeLayout(w, h) {
    const compact = w < 1000 || h < 700;
    const E = SCREEN_EDGE;
    const EL = ARSENAL_LEFT_MARGIN; // the left column starts further in than the other edges
    const topH = 42; // profile and invite boxes are 42x42 in every layout
    const leftW = Math.round(Math.min(420, Math.max(260, w * 0.27)));
    const rightW = Math.round(Math.min(380, Math.max(240, w * 0.25)));
    // The top row (profile icon, currencies) sits 46px from the top edge, as in the reference. Compact keeps the usual margin.
    const topY = compact ? E : 46;
    const barY = topY + topH + (compact ? 10 : 27);
    // Left column: 96px from the screen edge (full-size layout). Compact keeps the usual margin.
    const leftMargin = compact ? E : EL;
    // Content and the BACK button end 96px from the right edge, mirroring the left margin
    const rightMargin = compact ? E : CURRENCY_RIGHT_MARGIN;
    const backW = compact ? 110 : 140, backH = compact ? 34 : 40;
    const backX = w - rightMargin - backW;
    const backY = compact ? h - E - backH : h - 73 - backH / 2; // BACK is centred 73px above the bottom edge
    const barH = compact ? 32 : 40;
    const tabsY = barY + barH + 6;
    const tabsH = compact ? 40 : 52;
    const slotsY = tabsY + tabsH + (compact ? 8 : 10);
    return {
      compact, w, h,
      top: { y: topY, h: topH },
      left: { x: leftMargin, w: leftW },
      bar: { y: barY, h: barH },
      tabs: { y: tabsY, h: tabsH },
      slots: { y: slotsY, cardH: 58, rowH: 58, gap: compact ? 6 : 8 }, // hovered card expands to twice cardH
      menu: { x: leftMargin + leftW + 8, w: compact ? 118 : 150, btnH: compact ? 30 : 36, gap: 4 },
      right: { x: w - rightMargin - rightW, w: rightW },
      bottom: compact ? h - E - 52 : backY - 12, // room for the Back button in the bottom-right corner
      back: { x: backX, y: backY, w: backW, h: backH },
      // The shared × close button sits in the top-right corner (back_button.js)
      currencyRight: w - CURRENCY_RIGHT_MARGIN, // currency box sits 96px in from the right edge
    };
  }

  avatarRect(L) { return { x: L.left.x, y: L.top.y, w: L.top.h, h: L.top.h }; }
  // Profile, squad mode, invite: 42px boxes with 6px gaps, the same order as on the navigation screen
  modeRect(L) { return { x: L.left.x + L.top.h + 6, y: L.top.y, w: L.top.h, h: L.top.h }; }
  inviteRect(L) { return { x: L.left.x + 2 * (L.top.h + 6), y: L.top.y, w: L.top.h, h: L.top.h }; }
  barRect(L) { return { x: L.left.x, y: L.bar.y, w: L.left.w, h: L.bar.h }; }

  tabRect(L, i) {
    const n = LOADOUT_TABS.length, gap = 6;
    const tw = (L.left.w - gap * (n - 1)) / n;
    return { x: L.left.x + i * (tw + gap), y: L.tabs.y, w: tw, h: L.tabs.h };
  }

  slotRect(L, i) {
    const S = L.slots;
    // Cards stack top to bottom; the focused card grows to twice its height as it animates
    const heightOf = (j) => S.cardH * (1 + this.expand[j]);
    let y = S.y;
    for (let j = 0; j < i; j++) y += heightOf(j) + S.gap;
    return { x: L.left.x, y, w: L.left.w, h: heightOf(i) };
  }

  actionRect(L, i) {
    const row = this.slotRect(L, this.focus);
    return { x: L.menu.x, y: row.y + i * (L.menu.btnH + L.menu.gap), w: L.menu.w, h: L.menu.btnH };
  }

  // Swap and abilities views: a list under the header bar, where the tabs and slots were
  listRow(L, i) {
    const rowH = L.slots.rowH, gap = L.slots.gap;
    const row = i - this.scroll;
    if (row < 0 || row >= this.listCapacity(L)) return null;
    return { x: L.left.x, y: L.tabs.y + row * (rowH + gap), w: L.left.w, h: rowH };
  }

  listCapacity(L) {
    if (this.swapCols() > 1) return Math.max(1, Math.floor((L.bottom - this.gridTop(L)) / (GRID.cellH + GRID.gap)));
    return Math.max(1, Math.floor((L.bottom - 40 - L.tabs.y) / (L.slots.rowH + L.slots.gap)));
  }

  // The Warframe swap view is a grid of frames; other slots keep the list
  swapCols() {
    return this.view === 'swap' && SLOTS[this.focus].id === 'warframe' ? GRID.cols : 1;
  }

  gridTop(L) {
    // Below the header card, filter row and search row
    return L.slots.y + L.slots.cardH * 2 + GRID.headerGap;
  }

  // Rect of swap item i, or null when it is scrolled out of view
  swapRect(L, i) {
    const cols = this.swapCols();
    if (cols === 1) return this.listRow(L, i);
    const row = Math.floor(i / cols) - this.scroll;
    if (row < 0 || row >= this.listCapacity(L)) return null;
    const cellW = (L.left.w - GRID.gap * (cols - 1)) / cols;
    return { x: L.left.x + (i % cols) * (cellW + GRID.gap), y: this.gridTop(L) + row * (GRID.cellH + GRID.gap), w: cellW, h: GRID.cellH };
  }

  keepSwapVisible(L) {
    const cols = this.swapCols();
    const count = this.itemList(SLOTS[this.focus]).length;
    const n = this.listCapacity(L);
    const row = Math.floor(this.swapIndex / cols);
    if (row < this.scroll) this.scroll = row;
    else if (row >= this.scroll + n) this.scroll = row - n + 1;
    const rows = Math.ceil(count / cols);
    this.scroll = Math.max(0, Math.min(this.scroll, Math.max(0, rows - n)));
  }

  hitTest(L, x, y) {
    if (inside(L.back, x, y)) return { type: 'back' };
    if (this.view === 'main' && inside(this.avatarRect(L), x, y)) return { type: 'avatar' };
    if (this.view === 'upgrade') {
      const U = this.upgradeLayout(L);
      if (this.actionsOpen && inside(this.upgradeActionMenu(L), x, y)) return { type: 'actionItem' };
      if (inside(U.buttons.rects.ACTIONS, x, y)) return { type: 'upgradeAction' };
      for (let i = 0; i < 3; i++) if (inside(U.tabs.rects[i], x, y)) return { type: 'config', index: i };
      if (inside(U.tabs.plus, x, y)) return { type: 'addConfig' };
      return null;
    }
    if (inside(this.inviteRect(L), x, y)) return { type: 'invite' };
    if (this.view === 'main') {
      const actions = SLOTS[this.focus].actions;
      for (let i = 0; i < actions.length; i++) if (inside(this.actionRect(L, i), x, y)) return { type: 'action', index: i };
      if (inside(this.barRect(L), x, y)) return { type: 'loadoutBar' };
      for (let i = 0; i < LOADOUT_TABS.length; i++) if (inside(this.tabRect(L, i), x, y)) return { type: 'tab', index: i };
      for (let i = 0; i < SLOTS.length; i++) if (inside(this.slotRect(L, i), x, y)) return { type: 'slot', index: i };
      return null;
    }
    if (inside(this.barRect(L), x, y)) return { type: 'viewBack' };
    const count = this.view === 'swap' ? this.itemList(SLOTS[this.focus]).length : (this.frame().abilities?.length ?? 0);
    const type = this.view === 'swap' ? 'swapItem' : 'ability';
    for (let i = 0; i < count; i++) {
      const rect = this.view === 'swap' ? this.swapRect(L, i) : this.listRow(L, i);
      if (inside(rect, x, y)) return { type, index: i };
    }
    return null;
  }

  // What the right-hand panels describe
  infoTarget() {
    const slot = SLOTS[this.focus];
    if (this.view === 'swap') {
      const item = this.itemList(slot)[this.swapIndex];
      return item && { kind: slot.id === 'warframe' ? 'frame' : 'weapon', slot, item };
    }
    if (this.view === 'abilities') {
      const ability = this.frame().abilities?.[this.abilityIndex];
      return ability && { kind: 'ability', slot, item: ability, index: this.abilityIndex };
    }
    return { kind: slot.id === 'warframe' ? 'frame' : 'weapon', slot, item: this.equipped(slot) };
  }

  // ---------------------------------------------------------------- drawing

  draw(ctx, canvas) {
    if (!this.visible) return;
    const w = canvas.width, h = canvas.height;
    const upgrade = this.view === 'upgrade';
    // The Upgrade screen is drawn on a fixed 1920x1080 grid, centred and scaled to fit the window
    const L = upgrade ? this.computeLayout(DESIGN_W, DESIGN_H) : this.computeLayout(w, h);

    ctx.save();
    const bg = ctx.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.8);
    bg.addColorStop(0, '#141826');
    bg.addColorStop(0.45, '#080a12');
    bg.addColorStop(1, '#020205');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    if (upgrade) {
      const sp = this.designSpace(canvas);
      ctx.translate(sp.ox, sp.oy);
      ctx.scale(sp.s, sp.s);
    }

    if (!upgrade) this.drawShowcase(ctx, L);
    this.drawTopLeft(ctx, L);
    this.drawCurrencies(ctx, L);
    if (upgrade) {
      this.drawUpgrade(ctx, L);
    } else if (this.view === 'main') {
      this.drawLoadoutBar(ctx, L);
      this.drawTabs(ctx, L);
      this.drawSlots(ctx, L);
      this.drawActionMenu(ctx, L);
    } else if (this.swapCols() > 1) {
      this.drawWarframeGrid(ctx, L);
    } else {
      this.drawViewList(ctx, L);
    }
    if (!upgrade) this.drawInfo(ctx, L);
    this.drawFooter(ctx, L);
    this.drawBackButton(ctx, L);
    this.drawToast(ctx, L);
    ctx.restore();
  }

  panel(ctx, r, active = false, radius = 4) {
    roundRectPath(ctx, r.x, r.y, r.w, r.h, radius);
    ctx.fillStyle = active ? 'rgba(255,107,53,0.12)' : PANEL_BG;
    ctx.fill();
    ctx.strokeStyle = active ? MENU_COLORS.selected : PANEL_STROKE;
    ctx.lineWidth = active ? 1.5 : 1;
    ctx.stroke();
  }

  text(ctx, str, x, y, { size = 14, weight = '', color = MENU_COLORS.title, align = 'left', base = 'middle', maxW } = {}) {
    ctx.font = `${weight ? weight + ' ' : ''}${size}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = base;
    if (maxW) ctx.fillText(str, x, y, maxW); else ctx.fillText(str, x, y);
  }

  // The frame glyph used in game (Player.draw), pointing up
  drawFrameGlyph(ctx, cx, cy, size, color = FRAME_GREEN) {
    const s = size / 32;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-Math.PI / 2);
    ctx.scale(s, s);
    ctx.beginPath();
    ctx.moveTo(20, 0); ctx.lineTo(-12, -12); ctx.lineTo(-6, 0); ctx.lineTo(-12, 12);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 2 / s;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.restore();
  }

  drawShowcase(ctx, L) {
    const from = L.menu.x + L.menu.w, to = L.right.x;
    const cx = (from + to) / 2, cy = L.h * 0.52;
    const size = Math.max(60, Math.min(to - from, L.h) * 0.32);
    const t = performance.now() / 1000;

    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 1.6);
    glow.addColorStop(0, 'rgba(74,222,128,0.10)');
    glow.addColorStop(1, 'rgba(74,222,128,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - size * 2, cy - size * 2, size * 4, size * 4);

    // Pedestal
    ctx.save();
    ctx.translate(cx, cy + size * 0.9);
    ctx.scale(1, 0.28);
    for (const [r, a] of [[size * 1.1, 0.35], [size * 0.8, 0.2]]) {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,215,138,${a})`;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.restore();

    this.drawFrameGlyph(ctx, cx, cy + Math.sin(t * 1.5) * 6, size);
  }

  drawTopLeft(ctx, L) {
    drawProfileAndInvite(ctx, this.avatarRect(L), this.inviteRect(L), { box: this.modeRect(L), glyph: getMode().glyph });
  }

  // Placeholder icons, 24x24 with the left edge at x and the vertical centre at cy
  drawCurrencyIcon(ctx, currency, x, cy, icon) {
    ctx.save();
    if (currency === 'credits') {
      ctx.fillStyle = '#7fc8e8';
      ctx.strokeStyle = '#1c2a3a';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse(x + icon / 2, cy + 4 - i * 4, icon / 2, icon / 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    } else if (currency === 'platinum') {
      ctx.beginPath();
      ctx.moveTo(x + icon / 2, cy - icon / 2);
      ctx.lineTo(x + icon, cy - icon / 6);
      ctx.lineTo(x + icon / 2, cy + icon / 2);
      ctx.lineTo(x, cy - icon / 6);
      ctx.closePath();
      ctx.fillStyle = '#c9d3e0';
      ctx.fill();
    } else {
      // Endo and any other currency: a glowing orb
      const g = ctx.createRadialGradient(x + icon / 2, cy, 1, x + icon / 2, cy, icon / 2);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.4, '#b48cff');
      g.addColorStop(1, 'rgba(180,140,255,0.15)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x + icon / 2, cy, icon / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawCurrencies(ctx, L) {
    const h = L.top.h, y = L.top.y, cy = y + h / 2;
    const size = 18; // currency text height
    ctx.font = `${size}px ${FONT}`;
    const icon = 24; // currency icons are 24x24
    const items = DISPLAY_CURRENCIES.map(c => {
      const text = this.wallet.format(c);
      return { currency: c, text, w: icon + 6 + ctx.measureText(text).width };
    });
    const boxW = 14 + items.reduce((sum, it) => sum + it.w, 0) + 16 * (items.length - 1) + 14;
    const box = { x: L.currencyRight - boxW, y, w: boxW, h };
    this.panel(ctx, box, false, 2);

    let x = box.x + 14;
    for (const it of items) {
      this.drawCurrencyIcon(ctx, it.currency, x, cy, icon);
      this.text(ctx, it.text, x + icon + 6, cy, { size });
      x += it.w + 16;
    }

    // Foundry: flask, lit when something is ready to claim
    const f = { x: box.x - h - 6, y, w: h, h };
    this.panel(ctx, f, this.foundryReady, 2);
    const fx = f.x + f.w / 2, s = 12; // crafting icon is 24x24
    ctx.beginPath();
    ctx.moveTo(fx - s * 0.3, cy - s); ctx.lineTo(fx + s * 0.3, cy - s);
    ctx.lineTo(fx + s * 0.3, cy - s * 0.2); ctx.lineTo(fx + s, cy + s);
    ctx.lineTo(fx - s, cy + s); ctx.lineTo(fx - s * 0.3, cy - s * 0.2);
    ctx.closePath();
    ctx.strokeStyle = this.foundryReady ? MENU_COLORS.selected : MENU_COLORS.hint;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    if (this.foundryReady) {
      ctx.fillStyle = MENU_COLORS.accent;
      ctx.beginPath();
      ctx.arc(f.x + f.w - 6, f.y + 6, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawLoadoutBar(ctx, L) {
    const r = this.barRect(L);
    this.panel(ctx, r, false, 2);
    this.drawFrameGlyph(ctx, r.x + 18, r.y + r.h / 2, r.h * 0.5);
    this.text(ctx, this.loadoutName ?? this.frame().name, r.x + 38, r.y + r.h / 2, { size: L.compact ? 15 : 19, maxW: r.w - 90 });
    // ">>" loadout switcher
    ctx.strokeStyle = MENU_COLORS.label;
    ctx.lineWidth = 1.5;
    const ix = r.x + r.w - 34, cy = r.y + r.h / 2;
    ctx.beginPath();
    for (const dx of [0, 7]) { ctx.moveTo(ix + dx, cy - 6); ctx.lineTo(ix + dx + 6, cy); ctx.lineTo(ix + dx, cy + 6); }
    ctx.stroke();
  }

  drawTabIcon(ctx, id, cx, cy, s, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (id === 'loadout') {
      // Nested chevrons
      for (const k of [0, 0.45]) {
        ctx.moveTo(cx - s, cy + s * 0.5 - k * s);
        ctx.lineTo(cx, cy - s * 0.4 - k * s);
        ctx.lineTo(cx + s, cy + s * 0.5 - k * s);
      }
      ctx.moveTo(cx - s * 0.6, cy + s * 0.9); ctx.lineTo(cx + s * 0.6, cy + s * 0.9);
      ctx.stroke();
    } else if (id === 'companion') {
      // Kavat head
      ctx.arc(cx, cy + s * 0.15, s * 0.6, 0, Math.PI * 2);
      ctx.moveTo(cx - s * 0.55, cy - s * 0.1); ctx.lineTo(cx - s * 0.7, cy - s * 0.9); ctx.lineTo(cx - s * 0.15, cy - s * 0.42);
      ctx.moveTo(cx + s * 0.55, cy - s * 0.1); ctx.lineTo(cx + s * 0.7, cy - s * 0.9); ctx.lineTo(cx + s * 0.15, cy - s * 0.42);
      ctx.stroke();
    } else if (id === 'gear') {
      // Gear wheel
      ctx.setLineDash([s * 0.45, s * 0.25]);
      ctx.lineWidth = s * 0.35;
      ctx.arc(cx, cy, s * 0.75, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // Archwing wings
      for (const side of [-1, 1]) {
        ctx.moveTo(cx + side * s * 0.15, cy + s * 0.8);
        ctx.lineTo(cx + side * s, cy - s * 0.8);
        ctx.lineTo(cx + side * s * 0.55, cy + s * 0.2);
        ctx.closePath();
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  drawTabs(ctx, L) {
    LOADOUT_TABS.forEach((tab, i) => {
      const r = this.tabRect(L, i);
      const active = tab.id === 'loadout';
      this.panel(ctx, r, false, 2);
      if (active) {
        ctx.fillStyle = MENU_COLORS.selected;
        ctx.fillRect(r.x, r.y + r.h - 3, r.w, 3);
      }
      this.drawTabIcon(ctx, tab.id, r.x + r.w / 2, r.y + r.h / 2, r.h * 0.28, active ? MENU_COLORS.selected : MENU_COLORS.label);
    });
    if (this.lastHover.startsWith('tab:')) {
      const i = +this.lastHover.slice(4);
      const r = this.tabRect(L, i);
      this.text(ctx, LOADOUT_TABS[i].label, r.x + r.w / 2, r.y - 8, { size: 11, weight: '600', color: MENU_COLORS.selected, align: 'center' });
    }
  }

  // Simple silhouettes for each equipment type until real item art is added (weapon data has imageName, but no images exist yet)
  drawEquipIcon(ctx, slot, cx, cy, size, color = MENU_COLORS.title) {
    if (slot.id === 'warframe') return this.drawFrameGlyph(ctx, cx, cy, size);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(size / 44, size / 44); // drawn on a 44-unit square centred on (0, 0)
    ctx.fillStyle = color;
    if (slot.id === 'primary') {
      ctx.fillRect(-20, -4, 30, 5);   // barrel
      ctx.fillRect(-8, -6, 14, 9);    // receiver
      ctx.fillRect(-18, -8, 9, 4);    // stock
      ctx.fillRect(-2, 3, 5, 10);     // grip
      ctx.fillRect(-1, -12, 3, 6);    // sight
    } else if (slot.id === 'secondary') {
      ctx.fillRect(-12, -7, 24, 6);   // slide
      ctx.fillRect(-12, -1, 8, 4);    // frame
      ctx.fillRect(-4, 3, 6, 13);     // grip
    } else {
      ctx.beginPath();                // blade
      ctx.moveTo(-3, 12); ctx.lineTo(-3, -15); ctx.lineTo(0, -21); ctx.lineTo(3, -15); ctx.lineTo(3, 12);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(-9, 11, 18, 3);    // guard
      ctx.fillRect(-2, 14, 4, 8);     // grip
    }
    ctx.restore();
  }

  drawSlots(ctx, L) {
    SLOTS.forEach((slot, i) => {
      const r = this.slotRect(L, i);
      this.drawCard(ctx, L, slot, this.equipped(slot), r, this.expand[i], i === this.focus);
    });
  }

  // One equipment card. p is the expansion progress (0 collapsed, 1 expanded).
  drawCard(ctx, L, slot, item, r, p, focused) {
    const expandedH = L.slots.cardH * 2;
    {
      this.panel(ctx, r, focused, 2);
      const cy = r.y + r.h / 2;
      const nameSize = L.compact ? 15 : 17, rankSize = 12;
      // The item icon fades in on the right as the card grows; the text stays on the left
      const iconSize = expandedH - 24;
      const textX = r.x + 12;
      const textMaxW = r.w - 24 - p * (iconSize + 14);
      if (p > 0.01) {
        ctx.save();
        ctx.globalAlpha = p;
        this.drawEquipIcon(ctx, slot, r.x + r.w - 12 - iconSize / 2, cy, iconSize * 0.8, focused ? MENU_COLORS.selected : MENU_COLORS.title);
        ctx.restore();
      }
      // Name and rank block centred vertically in the card
      const nameH = nameSize + 2, gap = 4, rankH = rankSize + 2;
      const top = cy - (nameH + gap + rankH) / 2;
      this.text(ctx, item.name.toUpperCase(), textX, top + nameH / 2, {
        size: nameSize, weight: 'bold', color: focused ? MENU_COLORS.selected : MENU_COLORS.title, maxW: textMaxW,
      });
      this.text(ctx, rankLabel(this.itemRank(slot, item)), textX, top + nameH + gap + rankH / 2, { size: rankSize, color: MENU_COLORS.label });

      // XP bar along the bottom edge, shown until the item reaches max rank
      const progress = this.itemProgress(item);
      if (progress.rank < MAX_RANK) {
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(r.x, r.y + r.h - 3, r.w, 3);
        ctx.fillStyle = MENU_COLORS.selected;
        ctx.fillRect(r.x, r.y + r.h - 3, r.w * progress.xp, 3);
      }
    }
  }

  drawActionMenu(ctx, L) {
    SLOTS[this.focus].actions.forEach((label, i) => {
      const r = this.actionRect(L, i);
      const lit = i === this.menuIndex || i === this.menuHover;
      this.panel(ctx, r, lit, 2);
      this.text(ctx, label, r.x + 12, r.y + r.h / 2, { size: L.compact ? 13 : 15, weight: 'bold', color: lit ? MENU_COLORS.selected : MENU_COLORS.title });
    });
  }

  // Warframe swap view: header card for the current frame, then filter and search rows, then the frame grid.
  // Filter and search are display-only for now (one frame exists, so there is nothing to filter yet).
  drawWarframeGrid(ctx, L) {
    const slot = SLOTS[0];
    const head = { x: L.left.x, y: L.slots.y, w: L.left.w, h: L.slots.cardH * 2 };
    this.drawCard(ctx, L, slot, this.equipped(slot), head, 1, true);

    const fy = head.y + head.h + 16;
    this.panel(ctx, { x: L.left.x, y: fy, w: 64, h: 30 }, true, 2);
    this.text(ctx, 'ALL', L.left.x + 32, fy + 15, { size: 12, weight: 'bold', color: MENU_COLORS.selected, align: 'center' });

    const sy = fy + 40, sh = 32;
    const searchW = Math.round(L.left.w * 0.66);
    this.panel(ctx, { x: L.left.x, y: sy, w: searchW, h: sh }, false, 2);
    this.text(ctx, 'SEARCH...', L.left.x + 12, sy + sh / 2, { size: 13, color: MENU_COLORS.hint });
    const sortX = L.left.x + searchW + 8;
    this.panel(ctx, { x: sortX, y: sy, w: L.left.w - searchW - 8, h: sh }, false, 2);
    this.text(ctx, 'NAME  ▾', sortX + 12, sy + sh / 2, { size: 13, color: MENU_COLORS.title });

    const list = this.itemList(slot);
    const equippedName = this.equipped(slot).name;
    list.forEach((item, i) => {
      const r = this.swapRect(L, i);
      if (!r) return;
      const lit = i === this.swapIndex;
      this.panel(ctx, r, lit, 2);
      const artH = r.h - 30;
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      ctx.fillRect(r.x + 1, r.y + 1, r.w - 2, artH);
      // Placeholder art: the frame glyph until real frame images exist
      this.drawFrameGlyph(ctx, r.x + r.w / 2, r.y + artH / 2, artH * 0.5, lit ? MENU_COLORS.selected : FRAME_GREEN);
      this.text(ctx, `${item.name.toUpperCase()} [${this.itemRank(slot, item)}]`, r.x + 8, r.y + artH + 15, {
        size: 12, weight: 'bold', color: lit ? MENU_COLORS.selected : MENU_COLORS.title, maxW: r.w - 16,
      });
      if (item.name === equippedName) {
        ctx.font = `bold 9px ${FONT}`;
        const tw = ctx.measureText('EQUIPPED').width + 10;
        roundRectPath(ctx, r.x + 6, r.y + 6, tw, 16, 3);
        ctx.fillStyle = 'rgba(255,107,53,0.18)';
        ctx.fill();
        this.text(ctx, 'EQUIPPED', r.x + 6 + tw / 2, r.y + 14, { size: 9, weight: 'bold', color: MENU_COLORS.accent, align: 'center' });
      }
    });
    const more = list.length - (this.scroll + this.listCapacity(L)) * GRID.cols; // tiles scrolled out of view below
    if (more > 0) {
      this.text(ctx, `${more} more ▾`, L.left.x + L.left.w / 2, L.bottom - 6, { size: 12, color: MENU_COLORS.hint, align: 'center' });
    }
  }

  // Upgrade view (mod configuration), laid out on the 1920x1080 design grid (see designSpace).
  // Layout only: slots, filters and mod cards are placeholders.

  // INFO, ACTIONS, MODS and REMOVE ALL, left of the shared BACK button
  upgradeButtonRects(L) {
    const labels = ['INFO', 'ACTIONS', 'MODS', 'REMOVE ALL'], widths = [44, 128, 100, 170];
    const rects = {};
    let bx = L.back.x - 12;
    for (let i = labels.length - 1; i >= 0; i--) {
      bx -= widths[i];
      rects[labels[i]] = { x: bx, y: L.back.y, w: widths[i], h: L.back.h };
      bx -= 8;
    }
    return rects;
  }

  // The ACTIONS menu opens just above its button
  upgradeActionMenu(L) {
    const a = this.upgradeButtonRects(L).ACTIONS;
    return { x: a.x + a.w - 380, y: a.y - 8 - 44, w: 380, h: 44 }; // right-aligned with ACTIONS
  }

  // Positions on the 1920x1080 design grid. L is the design layout, so the top row, left margin, right margin and BACK
  // button are shared with the Arsenal.
  upgradeLayout(L) {
    const colX = L.left.x;
    const rightEdge = L.w - CURRENCY_RIGHT_MARGIN;

    // Capacity row: 25px below the profile icon, aligned with its left edge, 428x42
    const capacityY = L.top.y + L.top.h + 25;
    const capacityW = 428, capacityH = 42;

    // Stats panel: 6px below the capacity row, 424x462, with the rank bonus button and the 62px ability row inside it
    const statsY = capacityY + capacityH + 6;
    const statsW = 424, statsH = 462;
    const rankH = 40, abilityRowH = 62, panelGap = 8;
    const rankY = statsY + statsH - abilityRowH - panelGap - rankH;

    // Config row: 1296x42, 6px right of the capacity row, top-aligned with it.
    // CONFIG A, B, C sit as a group left of centre, then the + button; three tool icons sit at the far right.
    const config = { x: colX + capacityW + 6, y: capacityY, w: 1296, h: 42 };
    const at = (f) => config.x + config.w * f;
    const centres = [0.306, 0.422, 0.538].map(at);
    const tabs = {
      row: config,
      centres,
      rects: centres.map((cx) => ({ x: cx - 75, y: config.y, w: 150, h: config.h })),
      plus: { x: at(0.621) - 20, y: config.y, w: 40, h: config.h },
      icons: [0.9097, 0.9398, 0.9699].map((f) => ({ x: at(f), y: config.y + config.h / 2 })),
    };

    // Mod slots: a 954x382 block, 352px from the right edge, 53px below the config row.
    // Slots are 222x111 with 22px gaps (4 across = 954 wide). Three rows take 377px, so 5px is left at the bottom.
    const modW = 954, modH = 382, modGap = 22;
    const modX = L.w - 352 - modW;
    const modY = config.y + config.h + 53;

    // Bottom, measured up from the bottom edge: scroll bar, then two rows of mod cards, then the filter row
    const scrollY = L.h - 110;
    const card = { w: 226, h: 120, gapX: 25, gapY: 12 };
    const cardsTop = scrollY - 33 - (card.h * 2 + card.gapY);
    const filterY = cardsTop - 54, filterH = 34;
    const stripW = 10 * 34 + 9 * 6;

    return {
      colX,
      title: { x: colX + 100, y: L.top.y + L.top.h / 2 },
      tabs,
      capacity: { x: colX, y: capacityY, w: capacityW, h: capacityH },
      stats: { x: colX, y: statsY, w: statsW, h: statsH },
      rankBonus: { x: colX + 12, y: rankY, w: statsW - 24, h: rankH },
      slots: { x0: modX, x1: modX + modW, y: modY, w: (modW - modGap * 3) / 4, h: 111, gap: modGap },
      filters: {
        y: filterY, h: filterH,
        search: { x: colX, y: filterY, w: 424, h: filterH },
        sort: { x: rightEdge - 420, y: filterY, w: 420, h: filterH },
        stripX: (L.w - stripW) / 2, // the filter icons are centred on the screen
        labelY: filterY - 16,
      },
      cards: { x: colX, y: cardsTop, ...card, totalCols: 24 }, // two cards per column, running off the right edge
      scroll: { x: colX, y: scrollY, w: rightEdge - colX, h: 6 },
      buttons: { rects: this.upgradeButtonRects(L) },
    };
  }

  // --- small placeholder glyphs used by the Upgrade screen
  strokeShape(ctx, color, width, draw) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    draw();
    ctx.stroke();
    ctx.restore();
  }

  diamond(ctx, cx, cy, r, color) {
    this.strokeShape(ctx, color, 1.5, () => {
      ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy); ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r, cy); ctx.closePath();
    });
  }

  drawUpgrade(ctx, L) {
    const U = this.upgradeLayout(L);
    const slot = SLOTS[this.focus];
    const item = this.equipped(slot);
    const rank = this.itemRank(slot, item);

    // Title: UPGRADES / ITEM [RANK], then the Forma count
    const titleSize = 42; // title text is 42px, the same height as the 42x42 boxes beside it
    this.text(ctx, 'UPGRADES /', U.title.x, U.title.y, { size: titleSize, weight: 'bold', color: MENU_COLORS.label });
    ctx.font = `bold ${titleSize}px ${FONT}`;
    const prefixW = ctx.measureText('UPGRADES / ').width;
    const nameText = `${item.name.toUpperCase()} [${rank}]`;
    this.text(ctx, nameText, U.title.x + prefixW, U.title.y, { size: titleSize, weight: 'bold', color: MENU_COLORS.selected });
    const nameW = ctx.measureText(nameText).width;
    const formaX = U.title.x + prefixW + nameW + 36;
    this.diamond(ctx, formaX + 14, U.title.y, 14, MENU_COLORS.selected);
    this.text(ctx, '0', formaX + 40, U.title.y, { size: 36, weight: 'bold' }); // Forma count (Forma isn't in the game yet)

    // Config row: CONFIG A, B, C as a group, the + button, and three tool icons at the far right
    ['CONFIG A', 'CONFIG B', 'CONFIG C'].forEach((label, i) => {
      const cx = U.tabs.centres[i], cy = U.tabs.row.y + U.tabs.row.h / 2;
      const active = i === this.upgradeConfig;
      this.text(ctx, label, cx, cy - 2, { size: 22, weight: active ? 'bold' : '', color: active ? MENU_COLORS.selected : MENU_COLORS.label, align: 'center' });
      if (active) {
        const w = ctx.measureText(label).width + 24;
        ctx.fillStyle = MENU_COLORS.selected;
        ctx.fillRect(cx - w / 2, U.tabs.row.y + U.tabs.row.h - 4, w, 3);
      }
    });
    const pc = { x: U.tabs.plus.x + U.tabs.plus.w / 2, y: U.tabs.plus.y + U.tabs.plus.h / 2 - 2 };
    this.strokeShape(ctx, MENU_COLORS.label, 2, () => {
      ctx.arc(pc.x, pc.y, 9, 0, Math.PI * 2);
      ctx.moveTo(pc.x - 5, pc.y); ctx.lineTo(pc.x + 5, pc.y);
      ctx.moveTo(pc.x, pc.y - 5); ctx.lineTo(pc.x, pc.y + 5);
    });
    const [swapIcon, editIcon, copyIcon] = U.tabs.icons;
    this.strokeShape(ctx, MENU_COLORS.label, 2, () => {
      ctx.arc(swapIcon.x, swapIcon.y, 11, 0, Math.PI * 2);                              // polarity swap
      ctx.moveTo(editIcon.x - 10, editIcon.y + 10); ctx.lineTo(editIcon.x + 9, editIcon.y - 9); // rename (pencil)
      ctx.moveTo(editIcon.x - 10, editIcon.y + 10); ctx.lineTo(editIcon.x - 10, editIcon.y + 4);
      ctx.rect(copyIcon.x - 11, copyIcon.y - 5, 14, 14);                                // copy config
      ctx.rect(copyIcon.x - 4, copyIcon.y - 12, 14, 14);
    });

    // Capacity row
    const C = U.capacity;
    this.panel(ctx, C, false, 2);
    this.text(ctx, 'CAPACITY', C.x + 12, C.y + 16, { size: 13, weight: 'bold' });
    // Used / total capacity for the focused item. Nothing is placed yet, so used is 0.
    const capacity = itemUpgrades.capacity(item.name, rank); // Catalyst or Reactor doubles it
    const used = 0;
    this.text(ctx, `${used}/${capacity}`, C.x + C.w - 12, C.y + 16, { size: 14, weight: 'bold', color: MENU_COLORS.selected, align: 'right' });
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(C.x + 12, C.y + C.h - 14, C.w - 24, 4);
    ctx.fillStyle = MENU_COLORS.title;
    ctx.fillRect(C.x + 12, C.y + C.h - 14, (C.w - 24) * Math.min(1, used / capacity), 4);

    // Stats for the focused item
    const S = U.stats;
    this.panel(ctx, S, false, 2);
    // The ability row sits at the bottom of the stats panel (62px), so the stat rows stop above it
    const abilities = item.abilities ?? [];
    const abilityH = abilities.length ? 62 : 0;
    const bodyBottom = S.y + S.h - abilityH;
    let y = S.y + 14;
    const sections = this.statSections({ kind: slot.id === 'warframe' ? 'frame' : 'weapon', slot, item });
    for (const sec of sections) {
      if (!sec.rows) continue; // damage bars are not shown in this layout
      if (sec.title) {
        if (y > bodyBottom - 22) break;
        this.text(ctx, sec.title, S.x + 12, y + 8, { size: 13, weight: 'bold', color: MENU_COLORS.selected });
        y += 20;
      }
      for (const [label, value] of sec.rows) {
        if (y > bodyBottom - 22) break;
        this.text(ctx, label, S.x + 12, y + 9, { size: 13, color: MENU_COLORS.title });
        this.text(ctx, `${value}`, S.x + S.w - 12, y + 9, { size: 13, weight: '600', color: MENU_COLORS.selected, align: 'right' });
        y += 22;
      }
      y += 8;
    }

    // Ability row: the Passive then abilities 1 to 4, flush with the bottom of the stats panel
    if (abilities.length) {
      const row = { x: S.x, y: S.y + S.h - abilityH, w: S.w, h: abilityH };
      this.panel(ctx, row, false, 2);
      const labels = [item.passive ? 'P' : null, ...abilities.map((_, i) => `${i + 1}`)].filter(Boolean);
      const n = labels.length, badge = 40;
      const step = (row.w - 24 - badge) / Math.max(1, n - 1);
      labels.forEach((label, i) => {
        const bx = row.x + 12 + (n === 1 ? (row.w - 24 - badge) / 2 : i * step);
        const by = row.y + (row.h - badge) / 2;
        this.panel(ctx, { x: bx, y: by, w: badge, h: badge }, false, 3);
        this.text(ctx, label, bx + badge / 2, by + badge / 2, { size: 16, weight: 'bold', color: FRAME_GREEN, align: 'center' });
      });
    }

    // Rank bonuses button, inside the stats panel above the ability row
    const R = U.rankBonus;
    this.panel(ctx, R, false, 2);
    this.text(ctx, 'RANK BONUSES', R.x + R.w / 2, R.y + R.h / 2, { size: 13, weight: 'bold', color: MENU_COLORS.selected, align: 'center' });

    // Mod slots: 2, 4 and 4 for a Warframe (Aura and Exilus on top), 4 and 4 for a weapon. Each has a polarity mark top right.
    const sl = U.slots;
    const isWarframe = slot.id === 'warframe';
    const rows = isWarframe ? [2, 4, 4] : [4, 4];
    const equippedMods = this.configs[this.upgradeConfig].mods;
    let slotIndex = 0;
    rows.forEach((n, row) => {
      const rowW = n * sl.w + (n - 1) * sl.gap;
      const x0 = sl.x0 + (sl.x1 - sl.x0 - rowW) / 2;
      for (let c = 0; c < n; c++, slotIndex++) {
        const r = { x: x0 + c * (sl.w + sl.gap), y: sl.y + row * (sl.h + sl.gap), w: sl.w, h: sl.h };
        this.panel(ctx, r, false, 4);
        const mod = equippedMods[slotIndex];
        this.diamond(ctx, r.x + r.w - 20, r.y + 20, 8, MENU_COLORS.hint); // polarity (none set yet)
        if (mod) {
          // An equipped mod: its name and rank in the slot
          this.text(ctx, mod.name.toUpperCase(), r.x + 12, r.y + r.h / 2 - 6, { size: 13, weight: 'bold', color: MENU_COLORS.title, maxW: r.w - 24 });
          this.text(ctx, `RANK ${mod.currentRank ?? 0}`, r.x + 12, r.y + r.h / 2 + 12, { size: 12, color: MENU_COLORS.label });
        } else if (isWarframe && row === 0) {
          const label = c === 0 ? 'AURA' : c === n - 1 ? 'EXILUS' : null;
          if (label) this.text(ctx, label, r.x + r.w / 2, r.y + r.h / 2, { size: 14, weight: 'bold', color: MENU_COLORS.hint, align: 'center' });
        }
      }
    });

    // Filter row: search with its magnifier, ALL over ten filter buttons centred on the screen, and the sort box
    const F = U.filters;
    this.panel(ctx, F.search, false, 2);
    this.text(ctx, 'SEARCH...', F.search.x + 12, F.y + F.h / 2, { size: 14, color: MENU_COLORS.hint });
    const mg = { x: F.search.x + F.search.w - 24, y: F.y + F.h / 2 - 2 };
    this.strokeShape(ctx, MENU_COLORS.label, 2, () => {
      ctx.arc(mg.x, mg.y, 6, 0, Math.PI * 2);
      ctx.moveTo(mg.x + 4.5, mg.y + 4.5); ctx.lineTo(mg.x + 10, mg.y + 10);
    });
    this.text(ctx, 'ALL', L.w / 2, F.labelY, { size: 18, weight: 'bold', align: 'center' });
    for (let i = 0; i < 10; i++) this.panel(ctx, { x: F.stripX + i * 40, y: F.y, w: 34, h: F.h }, i === 0, 2);
    this.panel(ctx, F.sort, false, 2);
    this.text(ctx, 'DRAIN', F.sort.x + 12, F.y + F.h / 2, { size: 16, color: MENU_COLORS.title });
    const tri = { x: F.sort.x + F.sort.w - 24, y: F.y + F.h / 2 };
    ctx.fillStyle = MENU_COLORS.title;
    ctx.beginPath();
    ctx.moveTo(tri.x - 8, tri.y - 5); ctx.lineTo(tri.x + 8, tri.y - 5); ctx.lineTo(tri.x, tri.y + 6);
    ctx.closePath();
    ctx.fill();

    // Mod cards: two per column, 226x120, running off the right edge, with a scroll bar underneath
    const K = U.cards;
    const visibleCols = Math.ceil((L.w - K.x) / (K.w + K.gapX));
    for (let col = 0; col < Math.min(K.totalCols, visibleCols); col++) {
      for (let r = 0; r < 2; r++) {
        const rect = { x: K.x + col * (K.w + K.gapX), y: K.y + r * (K.h + K.gapY), w: K.w, h: K.h };
        this.panel(ctx, rect, false, 3);
        this.diamond(ctx, rect.x + rect.w - 56, rect.y + 20, 7, MENU_COLORS.hint); // polarity
        this.text(ctx, '--', rect.x + rect.w - 14, rect.y + 20, { size: 16, weight: 'bold', color: MENU_COLORS.hint, align: 'right' }); // drain
        this.text(ctx, `MOD ${String(col * 2 + r + 1).padStart(2, '0')}`, rect.x + rect.w / 2, rect.y + rect.h / 2 + 4, { size: 16, color: MENU_COLORS.label, align: 'center' });
        ctx.fillStyle = 'rgba(255,255,255,0.18)'; // rank pips
        for (let p = 0; p < 10; p++) {
          ctx.beginPath();
          ctx.arc(rect.x + rect.w / 2 - 54 + p * 12, rect.y + rect.h - 16, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    const B = U.scroll;
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(B.x, B.y, B.w, B.h);
    ctx.fillStyle = MENU_COLORS.title;
    ctx.fillRect(B.x + 4, B.y, Math.max(24, B.w * Math.min(1, visibleCols / K.totalCols)), B.h);

    // Bottom buttons, left of BACK: INFO, ACTIONS, MODS, REMOVE ALL
    for (const [label, r] of Object.entries(U.buttons.rects)) {
      this.panel(ctx, r, label === 'ACTIONS' && this.actionsOpen, 3);
      if (label === 'INFO') {
        const ic = { x: r.x + r.w / 2, y: r.y + r.h / 2 };
        this.strokeShape(ctx, MENU_COLORS.title, 2, () => {
          ctx.arc(ic.x, ic.y, 10, 0, Math.PI * 2);
          ctx.moveTo(ic.x, ic.y - 1); ctx.lineTo(ic.x, ic.y + 5);
          ctx.moveTo(ic.x, ic.y - 5); ctx.lineTo(ic.x, ic.y - 4);
        });
      } else {
        this.text(ctx, label, r.x + r.w / 2, r.y + r.h / 2, { size: 14, weight: 'bold', align: 'center' });
      }
    }

    // ACTIONS menu: the Upgrade option (Reactor on Warframes, Catalyst on weapons)
    if (this.actionsOpen) {
      const m = this.upgradeActionMenu(L);
      this.panel(ctx, m, true, 3);
      const { id, def } = this.upgradeFor(slot);
      const state = itemUpgrades.has(item.name, id) ? 'INSTALLED' : itemUpgrades.owned[id] > 0 ? 'INSTALL' : `BUY · ${def.price.platinum} PLATINUM`;
      this.text(ctx, `UPGRADE: ${def.name}`, m.x + 12, m.y + m.h / 2, { size: 14, weight: 'bold', color: MENU_COLORS.selected });
      this.text(ctx, state, m.x + m.w - 12, m.y + m.h / 2, { size: 12, weight: 'bold', color: MENU_COLORS.label, align: 'right' });
    }
  }

  // The upgrade for the focused item: Reactor on Warframes, Catalyst on weapons
  upgradeFor(slot) {
    const id = slot.id === 'warframe' ? 'reactor' : 'catalyst';
    return { id, def: UPGRADES[id], kind: slot.id === 'warframe' ? 'warframe' : 'weapon' };
  }

  // Runs the Upgrade action: install if owned, buy then install if not, or say why not
  runUpgradeAction() {
    const slot = SLOTS[this.focus];
    const item = this.equipped(slot);
    const { id, def, kind } = this.upgradeFor(slot);
    if (itemUpgrades.has(item.name, id)) return this.showToast(`${def.name} is already installed`);
    if (itemUpgrades.owned[id] <= 0 && !itemUpgrades.buy(id)) return this.showToast(`Not enough Platinum for ${def.name}`);
    if (itemUpgrades.install(item.name, id, kind)) return this.showToast(`${def.name} installed`);
    this.showToast(`${def.name} can't go on this item`);
  }

  drawViewList(ctx, L) {
    const slot = SLOTS[this.focus];
    const bar = this.barRect(L);
    this.panel(ctx, bar, false, 2);
    // "<" back arrow
    ctx.strokeStyle = MENU_COLORS.label;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bar.x + 20, bar.y + bar.h / 2 - 7);
    ctx.lineTo(bar.x + 13, bar.y + bar.h / 2);
    ctx.lineTo(bar.x + 20, bar.y + bar.h / 2 + 7);
    ctx.stroke();
    const title = this.view === 'swap' ? `SELECT ${slot.label}` : `${this.frame().name.toUpperCase()} ABILITIES`;
    this.text(ctx, title, bar.x + 32, bar.y + bar.h / 2, { size: L.compact ? 14 : 17, weight: 'bold', maxW: bar.w - 44 });

    if (this.view === 'swap') {
      const list = this.itemList(slot);
      const equippedName = this.equipped(slot).name;
      list.forEach((item, i) => {
        const r = this.listRow(L, i);
        if (!r) return;
        const lit = i === this.swapIndex;
        this.panel(ctx, r, lit, 2);
        const cy = r.y + r.h / 2;
        this.text(ctx, item.name.toUpperCase(), r.x + 12, cy - (L.compact ? 8 : 10), { size: L.compact ? 15 : 18, weight: 'bold', color: lit ? MENU_COLORS.selected : MENU_COLORS.title });
        const sub = `${rankLabel(this.itemRank(slot, item))}${item.masteryReq ? `  ·  MR ${item.masteryReq}` : ''}`;
        this.text(ctx, sub, r.x + 12, cy + (L.compact ? 10 : 13), { size: L.compact ? 12 : 13, color: MENU_COLORS.label });
        if (item.name === equippedName) {
          ctx.font = `bold 10px ${FONT}`;
          const tw = ctx.measureText('EQUIPPED').width + 12;
          const cx = r.x + r.w - tw - 10;
          roundRectPath(ctx, cx, cy - 9, tw, 18, 3);
          ctx.fillStyle = 'rgba(255,107,53,0.18)';
          ctx.fill();
          this.text(ctx, 'EQUIPPED', cx + tw / 2, cy + 0.5, { size: 10, weight: 'bold', color: MENU_COLORS.accent, align: 'center' });
        }
      });
      const more = list.length - this.scroll - this.listCapacity(L);
      if (more > 0) {
        const last = this.listRow(L, this.scroll + this.listCapacity(L) - 1);
        this.text(ctx, `${more} more ▾`, L.left.x + L.left.w / 2, last.y + last.h + 14, { size: 12, color: MENU_COLORS.hint, align: 'center' });
      }
    } else {
      (this.frame().abilities ?? []).forEach((ability, i) => {
        const r = this.listRow(L, i);
        if (!r) return;
        const lit = i === this.abilityIndex;
        this.panel(ctx, r, lit, 2);
        const cy = r.y + r.h / 2;
        // Numbered ability badge
        const bs = r.h - 16;
        this.panel(ctx, { x: r.x + 8, y: r.y + 8, w: bs, h: bs }, false, 3);
        this.text(ctx, `${i + 1}`, r.x + 8 + bs / 2, cy, { size: L.compact ? 15 : 18, weight: 'bold', color: FRAME_GREEN, align: 'center' });
        const tx = r.x + bs + 20;
        this.text(ctx, ability.name.toUpperCase(), tx, cy - (L.compact ? 8 : 10), { size: L.compact ? 14 : 17, weight: 'bold', color: lit ? MENU_COLORS.selected : MENU_COLORS.title, maxW: r.w - bs - 30 });
        this.text(ctx, `${ability.energyCost} Energy`, tx, cy + (L.compact ? 10 : 13), { size: L.compact ? 12 : 13, color: MENU_COLORS.label });
      });
    }
  }

  // ---- right column

  drawInfo(ctx, L) {
    const target = this.infoTarget();
    if (!target) return;
    const { kind, slot, item } = target;
    const x = L.right.x, w = L.right.w, p = L.compact ? 10 : 14;

    // Name bar
    const nameH = L.compact ? 32 : 42;
    const nameR = { x, y: L.bar.y, w, h: nameH };
    this.panel(ctx, nameR, false, 2);
    this.text(ctx, item.name.toUpperCase(), x + p, nameR.y + nameH / 2, { size: L.compact ? 16 : 21, color: MENU_COLORS.selected, maxW: w - p * 2 });

    // Rank + description
    const lineH = L.compact ? 16 : 20;
    ctx.font = `${L.compact ? 12 : 14}px ${FONT}`;
    const desc = kind === 'ability' ? item.description : (kind === 'frame' ? item.description : item.stats?.description);
    const lines = wrapText(ctx, desc, w - p * 2).slice(0, 4);
    const descR = { x, y: nameR.y + nameH + 4, w, h: (L.compact ? 30 : 38) + lines.length * lineH + 8 };
    this.panel(ctx, descR, false, 2);
    let y = descR.y + (L.compact ? 16 : 20);
    const headline = kind === 'ability' ? `Ability ${target.index + 1}` : rankLabel(this.itemRank(slot, item));
    this.text(ctx, headline, x + p, y, { size: L.compact ? 15 : 18 });
    const badge = kind === 'ability' ? `${item.energyCost} Energy` : `MR ${item.masteryReq ?? 0}`;
    this.text(ctx, badge, x + w - p, y, { size: L.compact ? 12 : 14, weight: '600', color: MENU_COLORS.label, align: 'right' });
    y += L.compact ? 18 : 24;
    lines.forEach((line, i) => this.text(ctx, line, x + p, y + i * lineH, { size: L.compact ? 12 : 14, color: MENU_COLORS.label }));

    this.drawStatsPanel(ctx, L, target, descR.y + descR.h + 12);
  }

  statSections(target) {
    const { kind, slot, item } = target;
    if (kind === 'frame') {
      const ranked = RANKED_FRAME_STATS[item.name] ?? item;
      return [
        { rows: [['Health', ranked.health], ['Shield', ranked.shield], ['Armor', ranked.armor], ['Energy', ranked.energy], ['Sprint Speed', num(item.sprintSpeed, 2)]] },
        // No mods yet, so ability stats are at their base values
        { title: 'ABILITY', rows: [['Duration', '100%'], ['Efficiency', '100%'], ['Range', '100%'], ['Strength', '100%']] },
      ];
    }
    if (kind === 'ability') {
      const max = item.levelStats?.[item.levelStats.length - 1]?.stats ?? [];
      return [
        { rows: [['Energy Cost', item.energyCost]] },
        { title: `RANK ${Math.max(0, (item.levelStats?.length ?? 1) - 1)}`, rows: max.map(s => {
          const m = /^([\d.,]+\s*\S*)\s+(.*)$/.exec(s);
          return m ? [m[2], m[1]] : [s, ''];
        }) },
      ];
    }
    const a = item.attack ?? {};
    const isMelee = slot.id === 'melee';
    const dmg = Object.entries(a.damage ?? {}).filter(([, v]) => v > 0);
    return [
      { damage: dmg },
      { rows: [
        ['Critical Chance', pct(a.critChance)],
        ['Critical Multiplier', `${num(a.critMultiplier, 1)}x`],
        ['Status Chance', pct(a.statusChance)],
        [isMelee ? 'Attack Speed' : 'Fire Rate', num(a.fireRate, 2)],
        ...(isMelee
          ? [['Range', `${num(item.range, 1)} m`], ['Heavy Attack', a.heavyAttackData ? `${num(a.heavyAttackData.damage_multiplier ?? 2, 1)}x` : '—']]
          : [['Magazine', `${item.magazine ?? '—'}`], ['Reload', `${num(item.reload, 1)} s`], ['Ammo Max', `${item.ammoMax ?? '—'}`], ['Trigger', a.shotType === 'hit-scan' ? 'Hit-Scan' : (a.shotType ?? '—')]]),
      ] },
    ];
  }

  drawStatsPanel(ctx, L, target, minY) {
    const x = L.right.x, w = L.right.w, p = L.compact ? 10 : 14;
    const rowH = L.compact ? 19 : 23;
    const titleH = L.compact ? 26 : 32;
    const damageH = L.compact ? 54 : 62;
    const sections = this.statSections(target);
    const ability = target.kind === 'frame' && (target.item.abilities?.length ?? 0) > 0;
    const stripH = ability ? (L.compact ? 36 : 46) : 0;

    let height = 12 + stripH;
    for (const s of sections) height += (s.damage ? damageH : 0) + (s.title ? titleH : 0) + (s.rows?.length ?? 0) * rowH;
    const bottom = L.bottom;
    const top = Math.max(minY, bottom - height);
    const r = { x, y: top, w, h: bottom - top };
    this.panel(ctx, r, false, 2);
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();

    let y = top + 8;
    if (ability) {
      // Ability strip: one numbered badge per ability
      const n = target.item.abilities.length, bs = stripH - 12, gap = (w - p * 2 - n * bs) / Math.max(1, n - 1);
      target.item.abilities.forEach((ab, i) => {
        const bx = x + p + i * (bs + gap);
        this.panel(ctx, { x: bx, y, w: bs, h: bs }, false, 3);
        this.text(ctx, `${i + 1}`, bx + bs / 2, y + bs / 2, { size: L.compact ? 13 : 16, weight: 'bold', color: FRAME_GREEN, align: 'center' });
      });
      y += stripH;
    }

    for (const s of sections) {
      if (s.damage) {
        const total = s.damage.reduce((sum, [, v]) => sum + v, 0);
        this.text(ctx, 'DAMAGE', x + p, y + 10, { size: 12, weight: '600', color: MENU_COLORS.selected });
        this.text(ctx, num(total, 1), x + w - p, y + 10, { size: L.compact ? 15 : 18, weight: 'bold', align: 'right' });
        let bx = x + p;
        const bw = w - p * 2;
        for (const [type, v] of s.damage) {
          const seg = (v / total) * bw;
          ctx.fillStyle = DAMAGE_COLORS[type] ?? '#aaaaaa';
          ctx.fillRect(bx, y + 24, Math.max(1, seg - 2), 5);
          bx += seg;
        }
        let lx = x + p;
        for (const [type, v] of s.damage) {
          const label = `${type[0].toUpperCase()}${type.slice(1)} ${num(v, 1)}`;
          this.text(ctx, label, lx, y + 42, { size: 12, color: DAMAGE_COLORS[type] ?? '#aaaaaa' });
          lx += ctx.measureText(label).width + 12;
        }
        y += damageH;
      }
      if (s.title) {
        this.text(ctx, s.title, x + p, y + titleH - 10, { size: L.compact ? 13 : 15, weight: 'bold', color: MENU_COLORS.selected });
        y += titleH;
      }
      (s.rows ?? []).forEach(([label, value], i) => {
        if (i % 2 === 0) {
          ctx.fillStyle = 'rgba(255,255,255,0.03)';
          ctx.fillRect(x + 4, y, w - 8, rowH);
        }
        this.text(ctx, label, x + p, y + rowH / 2, { size: L.compact ? 12 : 14, color: MENU_COLORS.title });
        this.text(ctx, `${value}`, x + w - p, y + rowH / 2, { size: L.compact ? 12 : 14, weight: '600', color: MENU_COLORS.selected, align: 'right' });
        y += rowH;
      });
    }
    ctx.restore();
  }

  drawBackButton(ctx, L) {
    drawReturnButton(ctx, L.back, this.backHover, L.compact ? 13 : 15);
  }

  drawFooter(ctx, L) {
    // Back is the shared menu close button (back_button.js); only the key hints are drawn here
    if (L.compact || this.view === 'upgrade') return; // the upgrade screen has no key-hint line
    const hint = this.view === 'main'
      ? (this.menuIndex >= 0 ? '[W/S] Action   [Enter] Select   [A] Back' : '[W/S] Equipment   [D] Actions   [Enter] Swap   [Esc] Exit')
      : this.view === 'swap' ? '[W/S] Select   [Enter] Equip   [Esc] Back'
        : this.view === 'upgrade' ? '[Esc] Back' : '[W/S] Ability   [Esc] Back';
    this.text(ctx, hint, (L.menu.x + L.menu.w + L.right.x) / 2, L.h - 30, { size: 12, color: MENU_COLORS.footer, align: 'center' });
  }

  drawToast(ctx, L) {
    if (!this.toast || performance.now() > this.toast.until) { this.toast = null; return; }
    const alpha = Math.min(1, (this.toast.until - performance.now()) / 300);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `600 14px ${FONT}`;
    const tw = ctx.measureText(this.toast.text).width + 32;
    const cx = (L.menu.x + L.menu.w + L.right.x) / 2;
    const r = { x: cx - tw / 2, y: L.h - 96, w: tw, h: 34 };
    this.panel(ctx, r, true, 4);
    this.text(ctx, this.toast.text, cx, r.y + r.h / 2, { size: 14, weight: '600', color: MENU_COLORS.selected, align: 'center' });
    ctx.restore();
  }
}
