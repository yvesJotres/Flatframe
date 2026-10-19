import { SimulacrumSpawner } from './spawner.js';
import { FONT, MENU_COLORS, MENU_SIDE_MARGIN, MENU_TOP_MARGIN, roundRectPath } from '../../menus/menu_style.js';

// Spawner panel for the Simulacrum arena.
// Left: enemy grid with filters (All / Grineer / Corpus / Infested / Search).
// Right: spawn list (up to MAX_SPAWN), level, spawn position, Pause AI (also makes you invulnerable), Spawn/Clear.

export const MAX_SPAWN = 20;
const FILTERS = [
  { id: 'all', label: 'ALL' },
  { id: 'grineer', label: 'GRINEER' },
  { id: 'corpus', label: 'CORPUS' },
  { id: 'infested', label: 'INFESTED' },
  { id: 'search', label: 'SEARCH' },
];
const FACTION_COLORS = { grineer: '#e5484d', corpus: '#4ade80', infested: '#a3e635' };
const MODES = ['RANDOM', 'NEAR PLAYER', 'EAST 10M'];
const AROUND_PLAYER = 450; // Random spawns land within this many units of the player

export class SimulacrumMenu {
  constructor() {
    this.visible = false;
    this.spawner = new SimulacrumSpawner();
    this.roster = this.spawner.list().flatMap(f =>
      f.types.map(type => ({ key: `${f.faction}/${type}`, faction: f.faction, type, label: type }))
    );
    this.filter = 'all';
    this.query = '';
    this.cursor = 0;            // index into the visible (filtered) grid
    this.selected = new Map();  // key -> count
    this.level = 30;
    this.spawnMode = 0;         // 0 random, 1 near player, 2 east 10m
    this.pauseAI = false;       // enemies stay still and do not shoot
    this.invulnerable = false;  // the player cannot die (enemies are unaffected)
    this.killAllRequested = false; // set by KILL ALL; the game removes every enemy and reads this via takeKillAll()
    this.hover = null;          // { kind, key/id } under the mouse

    // Text entry: a hidden input receives typing (desktop keys and the phone keyboard).
    // It must be focused from a real tap, so focus happens in the pointer handler below.
    this.editing = null; // 'search' | 'level' | null
    this.input = document.createElement('input');
    Object.assign(this.input, { type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: false });
    Object.assign(this.input.style, { position: 'fixed', left: '0', bottom: '0', width: '1px', height: '1px', opacity: '0', fontSize: '16px', border: '0', padding: '0' });
    this.input.addEventListener('input', () => this.onTyped());
    this.input.addEventListener('keydown', (e) => {
      e.stopPropagation(); // typing must not also trigger the game's shortcuts (Q/E/I/M/Space...)
      if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); this.stopEdit(); }
    });
    this.input.addEventListener('blur', () => { this.editing = null; });
    document.body.appendChild(this.input);
    const canvas = document.getElementById('gameCanvas');
    canvas?.addEventListener('pointerdown', (e) => this.onPointerDown(e, canvas));
  }

  onPointerDown(e, canvas) {
    if (!this.visible) return;
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) * (canvas.width / r.width);
    const y = (e.clientY - r.top) * (canvas.height / r.height);
    const hit = this.hitTest(x, y, canvas);
    if (hit?.kind === 'search') this.startEdit('search');
    else if (hit?.kind === 'levelEdit') this.startEdit('level');
  }

  startEdit(kind) {
    this.editing = kind;
    this.input.type = kind === 'level' ? 'number' : 'text';
    this.input.inputMode = kind === 'level' ? 'numeric' : 'text';
    this.input.value = kind === 'search' ? this.query : String(this.level);
    this.input.focus({ preventScroll: true });
  }

  stopEdit() {
    this.input.blur();
    this.editing = null;
  }

  onTyped() {
    if (this.editing === 'search') {
      this.query = this.input.value;
      this.cursor = 0;
    } else if (this.editing === 'level') {
      const n = parseInt(this.input.value, 10);
      if (Number.isFinite(n)) this.level = Math.max(1, Math.min(150, n));
    }
  }

  toggle() {
    this.visible = !this.visible;
  }

  get total() {
    let n = 0;
    for (const c of this.selected.values()) n += c;
    return n;
  }

  visibleRoster() {
    const q = this.query.trim().toLowerCase();
    return this.roster.filter(e => {
      if (this.filter === 'grineer' || this.filter === 'corpus' || this.filter === 'infested') return e.faction === this.filter;
      if (this.filter === 'search') return !q || e.label.toLowerCase().includes(q) || e.faction.includes(q);
      return true;
    });
  }

  addOne(entry) {
    if (this.total >= MAX_SPAWN) return;
    this.selected.set(entry.key, (this.selected.get(entry.key) ?? 0) + 1);
  }

  removeOne(entry) {
    const n = (this.selected.get(entry.key) ?? 0) - 1;
    if (n > 0) this.selected.set(entry.key, n);
    else this.selected.delete(entry.key);
  }

  setFilter(id) {
    this.filter = id;
    this.cursor = 0;
  }

  // addEnemy(enemy): the game owns the enemy list and replaces it every frame, so spawns go through it
  update(input, canvas, addEnemy, player) {
    if (!this.visible) { if (this.editing) this.stopEdit(); return false; }
    const cards = this.visibleRoster();
    const searching = this.filter === 'search';
    this.cursor = Math.max(0, Math.min(cards.length - 1, this.cursor));

    // Mouse
    const mouse = input.getMousePos();
    this.hover = this.hitTest(mouse.x, mouse.y, canvas);
    if (input.isMouseClicked() && this.hover) this.activate(this.hover, canvas, addEnemy, player);

    // Keyboard
    const cols = this.layout(canvas).cols;
    if (input.isKeyPressed('arrowleft')) this.cursor = Math.max(0, this.cursor - 1);
    if (input.isKeyPressed('arrowright')) this.cursor = Math.min(cards.length - 1, this.cursor + 1);
    if (input.isKeyPressed('arrowup')) this.cursor = Math.max(0, this.cursor - cols);
    if (input.isKeyPressed('arrowdown')) this.cursor = Math.min(cards.length - 1, this.cursor + cols);
    if (!searching) {
      if (input.isKeyPressed('q')) this.setFilter(FILTERS[(FILTERS.findIndex(f => f.id === this.filter) + FILTERS.length - 1) % FILTERS.length].id);
      if (input.isKeyPressed('e')) this.setFilter(FILTERS[(FILTERS.findIndex(f => f.id === this.filter) + 1) % FILTERS.length].id);
      if (input.isKeyPressed('space')) this.spawnAll(addEnemy, canvas, player);
      if (input.isKeyPressed('m')) this.spawnMode = (this.spawnMode + 1) % MODES.length;
      if (input.isKeyPressed('i')) this.pauseAI = !this.pauseAI;
      if (input.isKeyPressed('equals')) this.level = Math.min(150, this.level + 1);
      if (input.isKeyPressed('minus')) this.level = Math.max(1, this.level - 1);
      if (input.isKeyPressed('backspace') && cards[this.cursor]) this.removeOne(cards[this.cursor]);
    } else if (input.isKeyPressed('backspace') && this.query === '' && cards[this.cursor]) {
      this.removeOne(cards[this.cursor]);
    }
    if (input.isKeyPressed('enter') && cards[this.cursor]) this.addOne(cards[this.cursor]);
    return true; // the world is frozen while the spawner is open
  }

  activate(hit, canvas, addEnemy, player) {
    switch (hit.kind) {
      case 'filter': this.setFilter(hit.id); break;
      case 'card': {
        const entry = this.visibleRoster()[hit.index];
        this.cursor = hit.index;
        if (entry) this.addOne(entry);
        break;
      }
      case 'remove': this.removeOne(hit.entry); break;
      case 'add': this.addOne(hit.entry); break;
      case 'level': this.level = Math.max(1, Math.min(150, this.level + hit.delta)); break;
      case 'mode': this.spawnMode = (this.spawnMode + 1) % MODES.length; break;
      case 'pause': this.pauseAI = !this.pauseAI; break;
      case 'invulnerable': this.invulnerable = !this.invulnerable; break;
      case 'spawn': this.spawnAll(addEnemy, canvas, player); break;
      case 'clear': this.selected.clear(); break;
      case 'killAll': this.killAllRequested = true; break;
      default: break;
    }
  }

  spawnAll(addEnemy, canvas, player) {
    for (const [key, count] of this.selected) {
      const entry = this.roster.find(e => e.key === key);
      if (!entry) continue;
      for (let i = 0; i < count; i++) this.spawnOne(entry, addEnemy, canvas, player);
    }
  }

  spawnOne(entry, addEnemy, canvas, player) {
    let x, y;
    if (this.spawnMode === 0) { // random around the player
      x = player.x + (Math.random() * 2 - 1) * AROUND_PLAYER;
      y = player.y + (Math.random() * 2 - 1) * AROUND_PLAYER;
    } else if (this.spawnMode === 1) { // right on the player
      x = player.x + (Math.random() - 0.5) * 60;
      y = player.y + (Math.random() - 0.5) * 60;
    } else { // 10 m east
      x = player.x + 400;
      y = player.y;
    }
    this.spawner.spawn(entry.faction, entry.type, x, y, this.level).then(enemy => {
      if (enemy) addEnemy(enemy);
    });
  }

  // ------------------------------------------------------------ layout (shared by draw + clicks)

  layout(canvas) {
    const w = canvas.width, h = canvas.height;
    const compact = h < 560;
    const panelW = Math.round(Math.max(250, Math.min(320, w * 0.3)));
    // Keep clear of the ammo counter (bottom-right HUD) and the key-hint line at the bottom
    // Full-height panel, flush to the top, bottom and right screen edges
    const panelTop = compact ? 120 : 150;
    const panel = { x: w - panelW, y: 0, w: panelW, h };
    const gridX = MENU_SIDE_MARGIN;
    const gridR = panel.x - 20;
    const gridW = gridR - gridX;

    const tabY = compact ? 66 : 84;
    const tabH = compact ? 26 : 30;
    const tabs = FILTERS.map((f, i) => {
      const tw = Math.min(120, gridW / FILTERS.length - 6);
      return { id: f.id, label: f.label, x: gridX + i * (tw + 6), y: tabY, w: tw, h: tabH };
    });

    const searchY = tabY + tabH + 10;
    const searchBox = { x: gridX, y: searchY, w: Math.min(320, gridW), h: 28 };
    const gridY = this.filter === 'search' ? searchY + 36 : searchY;
    const gap = 10;
    const cols = Math.max(2, Math.floor((gridW + gap) / (compact ? 150 : 170)));
    const cardW = (gridW - gap * (cols - 1)) / cols;
    const cardH = compact ? 50 : 66;
    const cards = this.visibleRoster().map((e, i) => ({
      index: i, entry: e,
      x: gridX + (i % cols) * (cardW + gap),
      y: gridY + Math.floor(i / cols) * (cardH + gap),
      w: cardW, h: cardH,
    }));

    // Right panel rows
    const rows = [];
    let py = panelTop + 56;
    const rowH = compact ? 24 : 28;
    const selectedEntries = [...this.selected.entries()].map(([key, count]) => ({ entry: this.roster.find(e => e.key === key), count }))
      .filter(s => s.entry);
    for (const s of selectedEntries) {
      rows.push({ kind: 'row', entry: s.entry, count: s.count, y: py, h: rowH });
      py += rowH;
    }
    py = Math.max(py, panelTop + 56 + rowH * 3) + 8; // keep a fixed-ish area for the list
    const controlsY = py;

    const ctrl = {
      levelY: controlsY,
      modeY: controlsY + 34,
      pauseY: controlsY + 68,
      invulnerableY: controlsY + 94,
      spawnY: panel.h - (compact ? 80 : 96),
      clearY: panel.h - (compact ? 44 : 50),
    };
    const btnH = compact ? 30 : 34;
    return {
      w, h, compact, cols, panel, panelW, tabs, cards, rows, ctrl, btnH, rowH, searchY,
      killAllX: panel.x + 8 + (panel.w - 16 - 6) / 2 + 6, // left edge of KILL ALL in the bottom row (see draw)
      gridY, gridX, gridR, panelTop, searchBox, footerY: h - MENU_TOP_MARGIN - 4,
    };
  }

  hitTest(x, y, canvas) {
    const L = this.layout(canvas);
    const inside = (r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    for (const t of L.tabs) if (inside(t)) return { kind: 'filter', id: t.id };
    if (this.filter === 'search' && inside(L.searchBox)) return { kind: 'search' };
    for (const c of L.cards) if (inside({ x: c.x, y: c.y, w: c.w, h: c.h })) return { kind: 'card', index: c.index };
    const P = L.panel;
    const rowInside = (r) => x >= P.x + 8 && x <= P.x + P.w - 8 && y >= r.y && y <= r.y + r.h;
    for (const r of L.rows) {
      const minusX = P.x + P.w - 92, plusX = P.x + P.w - 28;
      if (rowInside(r)) {
        if (x >= minusX - 4 && x <= minusX + 26) return { kind: 'remove', entry: r.entry };
        if (x >= plusX - 4 && x <= plusX + 26) return { kind: 'add', entry: r.entry };
      }
    }
    const row = (yy, hh = 28) => y >= yy && y <= yy + hh && x >= P.x + 8 && x <= P.x + P.w - 8;
    if (row(L.ctrl.levelY)) {
      if (x < P.x + P.w * 0.3) return { kind: 'level', delta: -1 };
      if (x > P.x + P.w * 0.7) return { kind: 'level', delta: 1 };
      return { kind: 'levelEdit' };
    }
    if (row(L.ctrl.modeY)) return { kind: 'mode' };
    if (row(L.ctrl.pauseY)) return { kind: 'pause' };
    if (row(L.ctrl.invulnerableY)) return { kind: 'invulnerable' };
    if (y >= L.ctrl.spawnY && y <= L.ctrl.spawnY + L.btnH && x >= P.x + 8 && x <= P.x + P.w - 8) return { kind: 'spawn' };
    // CLEAR (left half) and KILL ALL (right half) share the bottom row
    if (y >= L.ctrl.clearY && y <= L.ctrl.clearY + L.btnH && x >= P.x + 8 && x <= P.x + P.w - 8) {
      return x < L.killAllX ? { kind: 'clear' } : { kind: 'killAll' };
    }
    return null;
  }

  // ------------------------------------------------------------ drawing

  draw(ctx, canvas) {
    if (!this.visible) return;
    const L = this.layout(canvas);
    const { w, h } = L;

    ctx.save();
    const veil = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
    veil.addColorStop(0, 'rgba(6,6,14,0.86)');
    veil.addColorStop(1, 'rgba(2,2,5,0.96)');
    ctx.fillStyle = veil;
    ctx.fillRect(0, 0, w, h);

    this.drawFilters(ctx, L);
    if (this.filter === 'search') this.drawSearch(ctx, L);
    this.drawGrid(ctx, L);
    this.drawPanel(ctx, L);

    // Key hints only make sense with a keyboard; on touch the SPAWNER button sits here instead
    if (!document.body.classList.contains('touch-device')) {
    ctx.font = `11px ${FONT}`;
    ctx.fillStyle = MENU_COLORS.footer;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('[Click] Add  [Bksp] Remove  [Q/E] Filter  [I] AI  [M] Mode  [Space] Spawn  [P] Close', L.gridX + 130, L.footerY);
    }
    ctx.restore();
  }

  drawFilters(ctx, L) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of L.tabs) {
      const active = t.id === this.filter;
      roundRectPath(ctx, t.x, t.y, t.w, t.h, 4);
      ctx.fillStyle = active ? 'rgba(255,107,53,0.2)' : 'rgba(16,16,28,0.85)';
      ctx.fill();
      ctx.strokeStyle = active ? MENU_COLORS.accent : 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.font = `600 ${L.compact ? 11 : 12}px ${FONT}`;
      ctx.fillStyle = active ? MENU_COLORS.selected : MENU_COLORS.label;
      ctx.fillText(t.label, t.x + t.w / 2, t.y + t.h / 2);
    }
  }

  drawSearch(ctx, L) {
    const x = L.gridX, y = L.searchY, w = Math.min(320, L.gridR - L.gridX), hh = 28;
    roundRectPath(ctx, x, y, w, hh, 4);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fill();
    ctx.strokeStyle = MENU_COLORS.accent;
    ctx.stroke();
    ctx.font = `13px ${FONT}`;
    ctx.fillStyle = MENU_COLORS.title;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const caret = Math.floor(Date.now() / 500) % 2 ? '|' : ' ';
    ctx.fillText((this.query || '') + caret, x + 10, y + hh / 2);
    if (!this.query) {
      ctx.fillStyle = MENU_COLORS.hint;
      ctx.fillText('Type a name…', x + 10 + 0, y + hh / 2);
    }
  }

  drawGrid(ctx, L) {
    const cards = L.cards;
    if (cards.length === 0) {
      ctx.font = `14px ${FONT}`;
      ctx.fillStyle = MENU_COLORS.hint;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('No enemies match.', L.gridX, L.gridY + 20);
    }
    for (const c of cards) {
      const count = this.selected.get(c.entry.key) ?? 0;
      const hot = this.cursor === c.index;
      const color = FACTION_COLORS[c.entry.faction] ?? MENU_COLORS.accent;
      roundRectPath(ctx, c.x, c.y, c.w, c.h, 6);
      ctx.fillStyle = count > 0 ? 'rgba(255,107,53,0.14)' : 'rgba(16,16,28,0.88)';
      ctx.fill();
      ctx.strokeStyle = hot ? MENU_COLORS.accent : count > 0 ? 'rgba(255,107,53,0.6)' : 'rgba(255,255,255,0.08)';
      ctx.lineWidth = hot ? 2 : 1;
      ctx.stroke();
      // faction color bar
      ctx.fillStyle = color;
      ctx.fillRect(c.x + 1, c.y + 10, 3, c.h - 20);

      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = `600 ${L.compact ? 14 : 16}px ${FONT}`;
      ctx.fillStyle = hot || count > 0 ? MENU_COLORS.selected : MENU_COLORS.title;
      ctx.fillText(c.entry.label, c.x + 14, c.y + c.h / 2 - (L.compact ? 0 : 7));
      if (!L.compact) {
        ctx.font = `11px ${FONT}`;
        ctx.fillStyle = color;
        ctx.fillText(c.entry.faction.toUpperCase(), c.x + 14, c.y + c.h / 2 + 11);
      }
      if (count > 0) {
        ctx.textAlign = 'right';
        ctx.font = `bold ${L.compact ? 13 : 15}px ${FONT}`;
        ctx.fillStyle = MENU_COLORS.accent;
        ctx.fillText(`×${count}`, c.x + c.w - 12, c.y + c.h / 2);
      }
    }
  }

  drawPanel(ctx, L) {
    const P = L.panel;
    ctx.fillStyle = 'rgba(16,16,28,0.94)';
    ctx.fillRect(P.x, P.y, P.w, P.h);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(P.x, P.y, 1, P.h); // hairline on the left edge

    const pad = P.x + 14;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = `600 11px ${FONT}`;
    ctx.fillStyle = MENU_COLORS.hint;
    ctx.fillText('SPAWN LIST', pad, L.panelTop + 22);
    ctx.textAlign = 'right';
    ctx.fillStyle = this.total >= MAX_SPAWN ? MENU_COLORS.danger : MENU_COLORS.selected;
    ctx.font = `bold 13px ${FONT}`;
    ctx.fillText(`${this.total} / ${MAX_SPAWN}`, P.x + P.w - 14, L.panelTop + 22);

    // selected rows with -/+
    ctx.textAlign = 'left';
    if (L.rows.length === 0) {
      ctx.font = `12px ${FONT}`;
      ctx.fillStyle = MENU_COLORS.hint;
      ctx.fillText('Click enemies to add them', pad, L.panelTop + 56 + 14);
    }
    for (const r of L.rows) {
      ctx.font = `13px ${FONT}`;
      ctx.fillStyle = MENU_COLORS.title;
      ctx.textAlign = 'left';
      ctx.fillText(r.entry.label, pad, r.y + r.h / 2);
      this.drawStepper(ctx, P.x + P.w - 92, r.y + r.h / 2 - 11, r.count);
    }

    // divider
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(P.x + 10, L.ctrl.levelY - 8, P.w - 20, 1);

    // level
    this.drawRowLabel(ctx, pad, L.ctrl.levelY + 14, 'LEVEL');
    this.drawStepper(ctx, P.x + P.w - 92, L.ctrl.levelY + 3, this.level);

    // spawn position (click cycles)
    this.drawRowLabel(ctx, pad, L.ctrl.modeY + 14, 'SPAWN AT');
    ctx.textAlign = 'right';
    ctx.font = `600 12px ${FONT}`;
    ctx.fillStyle = MENU_COLORS.selected;
    ctx.fillText(`${MODES[this.spawnMode]} ›`, P.x + P.w - 14, L.ctrl.modeY + 14);

    // pause AI and player invulnerability: two independent checkboxes
    this.drawCheckbox(ctx, pad, L.ctrl.pauseY + 14, this.pauseAI, 'PAUSE AI');
    this.drawCheckbox(ctx, pad, L.ctrl.invulnerableY + 14, this.invulnerable, 'INVULNERABLE');

    // buttons
    const btnX = P.x + 8, btnW = P.w - 16;
    const canSpawn = this.total > 0;
    this.drawButton(ctx, btnX, L.ctrl.spawnY, btnW, L.btnH,
      canSpawn ? `SPAWN ${this.total}` : 'SPAWN', canSpawn, true);
    const halfW = (btnW - 6) / 2;
    this.drawButton(ctx, btnX, L.ctrl.clearY, halfW, L.btnH, 'CLEAR', this.total > 0, false);
    this.drawButton(ctx, L.killAllX, L.ctrl.clearY, halfW, L.btnH, 'KILL ALL', true, false);
  }

  /** True once after KILL ALL was clicked; the game then removes every enemy. */
  takeKillAll() {
    const requested = this.killAllRequested;
    this.killAllRequested = false;
    return requested;
  }

  drawRowLabel(ctx, x, y, text) {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = `600 11px ${FONT}`;
    ctx.fillStyle = MENU_COLORS.hint;
    ctx.fillText(text, x, y);
  }

  drawStepper(ctx, x, y, value) {
    const w = 84, h = 22;
    roundRectPath(ctx, x, y, w, h, 4);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fill();
    ctx.font = `bold 13px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = MENU_COLORS.accent;
    ctx.fillText('−', x + 12, y + h / 2);
    ctx.fillText('+', x + w - 12, y + h / 2);
    ctx.fillStyle = MENU_COLORS.title;
    ctx.fillText(String(value), x + w / 2, y + h / 2);
  }

  drawCheckbox(ctx, x, y, on, label) {
    const s = 16;
    roundRectPath(ctx, x, y - s / 2, s, s, 3);
    ctx.fillStyle = on ? MENU_COLORS.accent : 'rgba(255,255,255,0.06)';
    ctx.fill();
    ctx.strokeStyle = on ? MENU_COLORS.accent : 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
    if (on) {
      ctx.strokeStyle = '#050508';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 4, y);
      ctx.lineTo(x + 7, y + 3);
      ctx.lineTo(x + 12, y - 3);
      ctx.stroke();
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = `600 11px ${FONT}`;
    ctx.fillStyle = on ? MENU_COLORS.selected : MENU_COLORS.label;
    ctx.fillText(label, x + s + 10, y);
  }

  drawButton(ctx, x, y, w, h, label, enabled, primary) {
    roundRectPath(ctx, x, y, w, h, 4);
    if (primary && enabled) {
      const g = ctx.createLinearGradient(x, 0, x + w, 0);
      g.addColorStop(0, '#ff6b35');
      g.addColorStop(1, '#e85d2a');
      ctx.fillStyle = g;
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.font = `bold 13px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = primary && enabled ? '#050508' : enabled ? MENU_COLORS.label : MENU_COLORS.hint;
    ctx.fillText(label, x + w / 2, y + h / 2);
  }
}
