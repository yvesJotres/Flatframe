import { THEME } from '../theme.js';
import { SCREEN_EDGE, MENU_SIDE_MARGIN, MENU_TOP_MARGIN, FONT, MENU_COLORS, roundRectPath, drawProfileAndInvite, drawReturnButton } from './menu_style.js';
import { getMission, NODE_MISSION_IDS } from '../../missions/missions.js';
import { user } from '../../user/user_data.js';
import { getMode } from '../squad.js';
import { drawCurrencyBar } from './top_bar.js';
import { audioManager } from '../../engine/audio.js';
import { drawVisualEffect, EFFECT_NAMES } from '../../engine/visual_effects.js';

const PLANET_ICONS = { Mercury: '☿', Venus: '♀', Earth: '♁', Mars: '♂', Phobos: '◆', Ceres: '⚳', Jupiter: '♃', Europa: '❄', Saturn: '♄', Uranus: '♅', Neptune: '♆', Pluto: '♇', Sedna: '⯲', Eris: '⯰', Void: '◆', Lua: '☾', 'Kuva Fortress': '⛨' };
const MISSION_ICONS = { Exterminate: '✦', Defense: '◆', Survival: '▲', Capture: '●', Spy: '■', Sabotage: '◆', Interception: '◆', 'Mobile Defense': '◆', 'Dark Sector Defense': '◆' };
const FACTION_COLORS = { grineer: '#e85d2a', corpus: '#3a8fce', infested: '#7ab800', corrupted: '#e8e8f0', sentient: '#ff2a8a' };

export const STAR_CHART = [
  { name: 'Earth', faction: 'grineer', angle: 0, distance: 0.5, nodes: [ 
    // pos is where the mission sits on the planet, as a fraction of its radius from the centre
    { name: 'E Prime', type: 'Exterminate', level: '1-3', pos: { x: -0.88, y: -0.08 } },
    { name: 'Mariana', type: 'Exterminate', level: '1-3', pos: { x: -0.69, y: -0.45 } },
    { name: 'Gaia', type: 'Interception', level: '1-6', pos: { x: -0.24, y: 0.21 } },
    { name: 'Lith', type: 'Defense', level: '1-6', pos: { x: -0.39, y: -0.77 } },
    { name: 'Erpo', type: 'Mobile Defense', level: '1-6', pos: { x: 1.02, y: 0.55 } },
    { name: 'Everest', type: 'Excavation', level: '1-6', pos: { x: 0.45, y: -0.31 } },
    { name: 'Mantle', type: 'Capture', level: '2-4', pos: { x: -0.45, y: -0.20 } },
    { name: 'Cambria', type: 'Spy', level: '2-4', pos: { x: -0.55, y: 0.62 } },
    { name: 'Eurasia', type: 'Mobile Defense', level: '3-5', pos: { x: 0.13, y: -0.85 } },
    { name: 'Pacific', type: 'Rescue', level: '3-6', pos: { x: 0.68, y: 1.00 } },
    { name: 'Cervantes', type: 'Sabotage', level: '4-6', pos: { x: 0.90, y: -0.07 } },
    { name: "Saya's Visions", type: 'Shrine Defense', level: '5-15', faction: 'infested', pos: { x: 0.06, y: -0.02 } },
    { name: 'Coba', type: 'Dark Sector Defense', level: '6-16', faction: 'infested', pos: { x: 0.78, y: -0.43 } },
    { name: 'Tikal', type: 'Dark Sector Excavation', level: '6-16', faction: 'infested', pos: { x: 0.14, y: 0.24 } },
    { name: 'Plains of Eidolon', type: 'Open World', level: '10-30', pos: { x: 0.04, y: -0.55 } },
    { name: 'Oro', type: 'Assassination', level: '20-25', pos: { x: 0.47, y: 0.52 } },
    { name: 'Cetus', type: 'Hub', level: '0-0', pos: { x: -0.22, y: -0.34 } },
  ] }
];

const JUNCTIONS = [];

// Mission types the game can start, and the id each one has in the missions data
const LAUNCH_IDS = {
  'Exterminate': 'exterminate',
  'Defense': 'defense',
  'Survival': 'survival',
  'Capture': 'capture',
  'Sabotage': 'sabotage',
  'Interception': 'interception',
  'Mobile Defense': 'mobile_defense',
  'Dark Sector Defense': 'dark_sector_defense',
  'Excavation': 'excavation',
  'Spy': 'spy',
  'Rescue': 'rescue',
  'Sabotage': 'sabotage',
  'Shrine Defense': 'shrine_defense',
  'Dark Sector Excavation': 'dark_sector_excavation',
  'Open World': 'open_world',
  'Assassination': 'assassination',
};

// The mission id a star-chart node launches: a node-specific one if it has one, else its type's
function launchIdFor(mission) {
  return NODE_MISSION_IDS[mission.name] ?? LAUNCH_IDS[mission.type];
}

// Nodes floating in the sky: not tied to a planet, always open. x and y are fractions of the screen.
export const SKY_NODES = [
  { label: 'SIMULACRUM', action: 'simulacrum', x: 0.68, y: 0.3 },
];

// Earth routes: each is a chain of mission names, in the order the route runs
export const EARTH_ROUTES = [
  ['E Prime', 'Mariana', 'Lith', 'Eurasia'],
  ['Mariana', 'Mantle', 'Cetus', "Saya's Visions"],
  ['Cetus', 'Plains of Eidolon', 'Everest', 'Cervantes', 'Erpo', 'Oro'],
  ['Coba', 'Everest'],
  ['Mantle', 'Gaia', 'Pacific'],
  ['Cambria', 'Gaia'],
  ['Tikal', 'Oro'],
];

// Missions a route links directly to `name`. Hubs are passed through (they are always open and never
// "played"), so a mission past a hub is still linked. Routes are two-way.
function linkedMissions(planet, name) {
  const typeOf = (n) => planet.nodes.find((m) => m.name === n)?.type;
  const adjacent = (n) => {
    const out = [];
    for (const route of EARTH_ROUTES) {
      route.forEach((m, i) => {
        if (m !== n) return;
        if (i > 0) out.push(route[i - 1]);
        if (i < route.length - 1) out.push(route[i + 1]);
      });
    }
    return out;
  };
  const linked = new Set();
  const seen = new Set([name]);
  const queue = [name];
  while (queue.length) {
    for (const next of adjacent(queue.shift())) {
      if (seen.has(next)) continue;
      seen.add(next);
      if (typeOf(next) === 'Hub') queue.push(next);
      else linked.add(next);
    }
  }
  return linked;
}

// Seconds from selecting a mission to starting it
const START_COUNTDOWN = 5;

export default class Navigation {
  constructor(onLaunch) {
    this.onLaunch = onLaunch;
    this.onClose = null;
    this.canvas = null;
    this.ctx = null;
    this.open = false;
    this.selectedPlanet = null;
    this.selectedMission = null;
    this.startPaused = false; // the start bar's pause / play toggle
    this.editor = null; // dev only: the layout editor, set by src/debug/layout_editor.js (absent in release)
    this.countdown = START_COUNTDOWN; // seconds left before the mission starts
    this.countdownFor = null; // the mission the countdown is running for
    this.hoveredPlanet = null;
    this.hoveredMission = null;
    this.animTime = 0;
    this.mode = 'origin';
    this.panelAlpha = 0;
    this.targetPanelAlpha = 0;
    this.activeTab = 'navigation';
    this.onSquad = null; // set by game.js: opens the squad panel under the squad-mode icon (anchor = that icon's box)
    this.loadProgress();
  }

  // Unlocked planets belong to the active user; Earth is always open (single planet mode)
  loadProgress() {
    this.unlockedPlanets = new Set(['Earth', ...user.get('unlockedPlanets')]);
  }

  saveProgress() {
    user.set('unlockedPlanets', [...this.unlockedPlanets]);
  }

  isPlanetUnlocked(planetName) {
    return this.unlockedPlanets.has(planetName);
  }

  // Completed nodes belong to the active user (src/user/user_data.js), so each account has its own progress
  isMissionCompleted(planetName, missionName) {
    return user.get('completedNodes').includes(`${planetName}:${missionName}`);
  }

  completeMission(planetName, missionName) {
    const key = `${planetName}:${missionName}`;
    user.set('completedNodes', [...new Set([...user.get('completedNodes'), key])]);
    this.checkPlanetUnlock(planetName);
    this.saveProgress();
  }

  checkPlanetUnlock(planetName) {
    // Single planet mode - no further planets to unlock
  }

  openScreen() {
    this.loadProgress(); // the active user may have changed since the chart was built
    // Every route into the star chart needs the canvas for drawing and hit-testing
    if (!this.canvas) this.handleResize(document.getElementById('gameCanvas'));
    this.open = true;
    this.selectedPlanet = null;
    this.selectedMission = null;
    this.targetPanelAlpha = 0;
  }

  closeScreen() {
    this.open = false;
    this.selectedPlanet = null;
    this.selectedMission = null;
  }

  // Mission panel geometry, shared by drawing and hit-testing; shrinks to fit short (phone) screens
  panelGeom(planet) {
    const W = this.canvas.width, H = this.canvas.height;
    const w = 340, x = W - w - MENU_SIDE_MARGIN;
    const y = H < 500 ? 76 : 60;
    const h = Math.min(400, H - y - 8);
    const compact = h < 400;
    const startY = y + (compact ? 64 : 80);
    const btnH = compact ? 36 : 40;
    const btnY = y + h - btnH - (compact ? 8 : 16);
    const n = Math.max(1, planet?.nodes?.length ?? 5);
    const itemH = Math.max(40, Math.min(56, Math.floor((btnY - 6 - startY) / n)));
    return { x, y, w, h, startY, itemH, btnY, btnH };
  }

  handleResize(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  // Where the big planet sits: centred, a little low, like the reference. Everything on it scales with its radius.
  planetLayout(w = this.canvas.width, h = this.canvas.height) {
    const r = Math.min(h * 0.30, w * 0.18);
    return { cx: w * 0.5, cy: h * 0.52, r, k: r / 324 }; // k is 1 at 1080p
  }

  // Width of a mission's label on the planet, so the label can be clicked as well as the marker
  nodeLabelWidth(mission, k) {
    const ctx = this.ctx;
    const text = mission.name.toUpperCase();
    if (!ctx) return text.length * 16 * k;
    ctx.save();
    ctx.font = `bold ${22 * k}px "Segoe UI", Roboto, system-ui, sans-serif`;
    const w = ctx.measureText(text).width + text.length * 2 * k;
    ctx.restore();
    return w;
  }

  // The mission under a screen point (marker or label), or null
  missionAt(planet, x, y) {
    const { cx, cy, r, k } = this.planetLayout();
    for (const mission of planet.nodes) {
      // Locked missions cannot be hovered or clicked (layout edit can still move them)
      if (!this.editor?.isOn() && !this.isMissionUnlocked(planet, mission)) continue;
      const pos = mission.pos || { x: 0, y: 0 };
      const mx = cx + pos.x * r, my = cy + pos.y * r;
      const reach = 24 * k;
      if (x >= mx - reach && x <= mx + reach + 10 * k + this.nodeLabelWidth(mission, k) && Math.abs(y - my) <= reach) return mission;
    }
    return null;
  }

  update(dt, input) {
    if (!this.open) return;
    this.animTime += dt;

    // The start countdown runs while a mission is selected and not paused
    if (this.selectedMission !== this.countdownFor) {
      this.countdownFor = this.selectedMission;
      this.countdown = START_COUNTDOWN;
    }
    const sb = this.startBar();
    if (sb && !this.startPaused && this.countdown > 0) {
      const before = Math.ceil(this.countdown);
      this.countdown = Math.max(0, this.countdown - dt);
      // Tick each time the displayed number changes (4, 3, 2, 1); the launch itself is the last beat.
      if (Math.ceil(this.countdown) < before && this.countdown > 0) audioManager.play('countdown_tick', 0.6);
      // The countdown stops at zero and stays there until another mission is selected
      if (this.countdown <= 0) this.launchMission(sb.planet, sb.mission);
    }
    this.panelAlpha += (this.targetPanelAlpha - this.panelAlpha) * 0.15;

    // Keyboard and gamepad: left/right step through unlocked planets, up/down through the selected planet's missions
    const planetStep = (input.isPressed('arrowright') || input.isPressed('d') ? 1 : 0) - (input.isPressed('arrowleft') || input.isPressed('a') ? 1 : 0);
    const missionStep = (input.isPressed('arrowdown') || input.isPressed('s') ? 1 : 0) - (input.isPressed('arrowup') || input.isPressed('w') ? 1 : 0);
    if (planetStep) {
      const unlocked = STAR_CHART.filter(p => this.isPlanetUnlocked(p.name));
      const i = unlocked.findIndex(p => p.name === this.selectedPlanet);
      if (unlocked.length) {
        const next = unlocked[i < 0 ? 0 : (i + planetStep + unlocked.length) % unlocked.length];
        this.selectedPlanet = next.name;
        this.selectedMission = null;
        this.targetPanelAlpha = 0.5;
      }
    }
    if (missionStep && this.selectedPlanet) {
      const planet = STAR_CHART.find(p => p.name === this.selectedPlanet);
      const nodes = planet?.nodes ?? [];
      if (nodes.length) {
        const i = nodes.findIndex(m => m.name === this.selectedMission);
        const next = nodes[i < 0 ? (missionStep > 0 ? 0 : nodes.length - 1) : (i + missionStep + nodes.length) % nodes.length];
        this.selectedMission = next.name;
        this.targetPanelAlpha = 1;
      }
    }

    if (input.isPressed('enter')) {
      const planet = STAR_CHART.find(p => p.name === this.selectedPlanet);
      if (!planet) {
        const first = STAR_CHART.find(p => this.isPlanetUnlocked(p.name));
        if (first) { this.selectedPlanet = first.name; this.targetPanelAlpha = 0.5; }
      } else if (this.selectedMission) {
        const mission = planet.nodes.find(m => m.name === this.selectedMission);
        if (mission) this.launchMission(planet, mission);
      } else {
        const next = planet.nodes.find(m => !this.isMissionCompleted(planet.name, m.name));
        if (next) { this.selectedMission = next.name; this.targetPanelAlpha = 1; }
      }
    }
    if (input.isPressed('Escape')) {
      if (this.selectedMission) { this.selectedMission = null; this.targetPanelAlpha = 0.5; }
      else if (this.selectedPlanet) { this.selectedPlanet = null; this.targetPanelAlpha = 0; }
      else { this.closeScreen(); if (this.onClose) this.onClose(); }
    }
  }

  // BACK in the bottom-right corner, the same button and place as on the Arsenal screen
  backRect(w, h) {
    const bw = 140, bh = 40;
    return { x: w - 96 - bw, y: h - 73 - bh / 2, w: bw, h: bh };
  }

  drawBackButton(ctx, w, h) {
    drawReturnButton(ctx, this.backRect(w, h), !!this.backHover);
  }

  handleClick(x, y) {
    if (!this.open || !this.canvas) return false;
    const w = this.canvas.width;

    // Layout edit (dev only): the editor takes every click while it is on
    if (this.editor?.isOn()) return this.editor.click(this, x, y);

    // Sky nodes: open their screen when clicked
    const skyNode = this.skyNodeAt(x, y);
    if (skyNode) {
      if (skyNode.action === 'simulacrum' && this.onSimulacrum) this.onSimulacrum();
      return true;
    }

    // BACK closes the navigation screen, as Escape does
    const back = this.backRect(w, this.canvas.height);
    if (x >= back.x && x <= back.x + back.w && y >= back.y && y <= back.y + back.h) {
      this.closeScreen();
      if (this.onClose) this.onClose();
      return true;
    }

    // Profile icon and invite button both open the squad panel
    const sq = this.squadButtons();
    const inBox = (r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    // The matchmaking icon (sq.mode) is not clickable: its list shows on hover
    if (inBox(sq.profile) || inBox(sq.invite)) {
      if (this.onSquad) this.onSquad(sq.mode);
      return true;
    }


    // Top-left bar: X cancels the selection, the rest of the bar launches the mission
    const startInfo = this.startBar();
    if (startInfo) {
      const { close, bar, toggle } = startInfo;
      if (x >= toggle.x && x <= toggle.x + toggle.w && y >= toggle.y && y <= toggle.y + toggle.h) {
        this.startPaused = !this.startPaused;
        return true;
      }
      if (x >= close.x && x <= close.x + close.w && y >= close.y && y <= close.y + close.h) {
        this.selectedMission = null;
        this.targetPanelAlpha = 0;
        return true;
      }
      if (x >= bar.x && x <= bar.x + bar.w && y >= bar.y && y <= bar.y + bar.h) {
        // Paused: the start waits until play is pressed again
        if (!this.startPaused) this.launchMission(startInfo.planet, startInfo.mission);
        return true;
      }
    }

    // The mission card (for the selected or hovered mission) launches the mission when clicked
    const active = this.activeCard();
    if (active && this.hitCard(this.cardRect(active.mission), x, y)) {
      this.launchMission(active.planet, active.mission);
      return true;
    }

    // Missions on the planet's surface: the marker or its name. First click selects, second click launches.
    for (const planet of STAR_CHART) {
      if (!this.isPlanetUnlocked(planet.name)) continue;
      const mission = this.missionAt(planet, x, y);
      if (!mission) continue;
      this.selectedPlanet = planet.name;
      // Completed missions can be selected to see their card; launching them stays blocked (see launch checks)
      if (this.selectedMission === mission.name) {
        this.launchMission(planet, mission);
      } else {
        this.selectedMission = mission.name;
        this.targetPanelAlpha = 1;
      }
      return true;
    }

    // The planet itself selects it
    const { cx, cy, r } = this.planetLayout();
    for (const planet of STAR_CHART) {
      if (!this.isPlanetUnlocked(planet.name)) continue;
      if (Math.hypot(x - cx, y - cy) < r) {
        this.selectedPlanet = planet.name;
        this.selectedMission = null;
        this.targetPanelAlpha = 0.5;
        return true;
      }
    }

    // Clicking empty space clears the selection
    if (this.selectedMission || this.selectedPlanet) {
      this.selectedMission = null;
      this.selectedPlanet = null;
      this.targetPanelAlpha = 0;
      return true;
    }
    return false;
  }

  handleMove(x, y) {
    if (!this.open || !this.canvas) return;
    // Layout edit (dev only): a dragged mission follows the pointer
    if (this.editor?.move(this, x, y)) return;
    const back = this.backRect(this.canvas.width, this.canvas.height);
    this.backHover = x >= back.x && x <= back.x + back.w && y >= back.y && y <= back.y + back.h;
    this.hoveredPlanet = null;
    this.hoveredMission = null;
    this.hoveredSky = this.skyNodeAt(x, y)?.label ?? null;
    for (const planet of STAR_CHART) {
      if (!this.isPlanetUnlocked(planet.name)) continue;
      const mission = this.missionAt(planet, x, y);
      if (mission) {
        this.hoveredMission = mission.name;
        return;
      }
    }
    const { cx, cy, r } = this.planetLayout();
    if (Math.hypot(x - cx, y - cy) < r) this.hoveredPlanet = 'Earth';
  }

  // The mission whose card is showing: the hovered one, otherwise the selected one
  activeCard() {
    // In layout edit the hover card is hidden, so the markers can be seen while dragging
    const name = (this.editor?.isOn() ? null : this.hoveredMission) ?? this.selectedMission;
    if (!name) return null;
    for (const planet of STAR_CHART) {
      const mission = planet.nodes.find((m) => m.name === name);
      if (mission) return { planet, mission };
    }
    return null;
  }

  // Where a mission's card sits: just below its marker, kept on screen
  cardRect(mission) {
    const { cx, cy, r, k } = this.planetLayout();
    const pos = mission.pos || { x: 0, y: 0 };
    const mx = cx + pos.x * r, my = cy + pos.y * r;
    const w = 300 * k, imgH = 150 * k, bodyH = 150 * k;
    const x = Math.min(Math.max(8, mx - 40 * k), this.canvas.width - w - 8);
    const y = Math.min(my + 26 * k, this.canvas.height - (imgH + bodyH) - 8);
    return { x, y, w, imgH, bodyH, h: imgH + bodyH, k };
  }

  hitCard(card, x, y) {
    return x >= card.x && x <= card.x + card.w && y >= card.y && y <= card.y + card.h;
  }

  launchMission(planet, mission) {
    const missionId = launchIdFor(mission);
    const missionDef = getMission(missionId);
    if (missionDef && this.onLaunch) {
      this.onLaunch({
        ...missionDef,
        planet: planet.name,
        node: mission.name,
        type: mission.type,
        levelRange: mission.level,
        faction: planet.faction
      });
    }
    this.closeScreen();
  }

  draw(ctx) {
    if (!this.open) return;
    this.ctx = ctx;
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    const { cx, cy } = this.planetLayout(w, h);
    const scale = Math.min(w, h) * 0.42;

    this.drawSpaceBackground(w, h);
    this.drawDestinations(w, h);
    this.drawSkyNodes(w, h);
    this.drawOrbitRings(cx, cy, scale);
    this.drawConnectionLines(cx, cy, scale);
    this.drawJunctions(cx, cy, scale);
    this.drawPlanets(cx, cy, scale);
    this.drawRoutes();
    this.drawDetailPanel(cx, cy, scale);
    this.drawStartBar();
    this.drawSquadButtons();
    drawCurrencyBar(ctx, w);
    this.drawBackButton(ctx, w, h);
    this.editor?.drawLabel(ctx, h);
    this.drawUI(w, h);
  }

  drawSpaceBackground(w, h) {
    const g = this.ctx.createRadialGradient(w * 0.2, h * 0.3, 0, w * 0.5, h * 0.5, Math.max(w, h));
    g.addColorStop(0, THEME.space.center);
    g.addColorStop(0.4, THEME.space.mid);
    g.addColorStop(1, THEME.space.edge);
    this.ctx.fillStyle = g;
    this.ctx.fillRect(0, 0, w, h);

    // Same nebula and starfield as the main menu (settings in src/engine/visual_effects.js)
    drawVisualEffect(EFFECT_NAMES.NEBULA, this.ctx, { width: w, height: h, offset: this.animTime });
    drawVisualEffect(EFFECT_NAMES.STARFIELD, this.ctx, { width: w, height: h, time: this.animTime, offset: this.animTime });
  }

  // Smooth routes through the missions on Earth. Each route is a list of mission names in order.
  // The curve runs through every mission with no corners. A segment that leads to a locked mission is dashed.
  drawRoutes() {
    const { cx, cy, r, k } = this.planetLayout();
    const earth = STAR_CHART.find((p) => p.name === 'Earth');
    if (!earth) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = THEME.highlightSoft;
    ctx.lineWidth = 1.5 * k;
    ctx.lineCap = 'round';
    for (const route of EARTH_ROUTES) {
      const nodes = route.map((name) => earth.nodes.find((n) => n.name === name)).filter(Boolean);
      if (nodes.length < 2) continue;
      const pts = nodes.map((n) => ({ x: cx + n.pos.x * r, y: cy + n.pos.y * r }));
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
        const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
        const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
        ctx.setLineDash(this.isMissionUnlocked(earth, nodes[i + 1]) ? [] : [4 * k, 5 * k]);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.bezierCurveTo(c1x, c1y, c2x, c2y, p2.x, p2.y);
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);
    ctx.lineCap = 'butt';
    ctx.restore();
  }

  drawOrbitRings(cx, cy, scale) {
    // Single planet - no orbit rings needed
  }

  drawConnectionLines(cx, cy, scale) {
    // Single planet - no connections
  }

  drawJunctions(cx, cy, scale) {
    // Single planet - no junctions
  }

  drawHexagon(x, y, r) {
    this.ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI / 3) - Math.PI / 6;
      this.ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    this.ctx.closePath();
  }

  drawPlanets(cx, cy, scale) {
    for (const planet of STAR_CHART) {
      const unlocked = this.isPlanetUnlocked(planet.name);
      // Earth at center for single planet view
      const x = cx;
      const y = cy;
      const isSelected = this.selectedPlanet === planet.name;
      const { r: baseR, k } = this.planetLayout();
      const r = baseR; // the planet keeps its size when clicked
      const color = FACTION_COLORS[planet.faction];
      const completed = planet.nodes.filter(n => this.isMissionCompleted(planet.name, n.name)).length;
      const total = planet.nodes.length;
      const progress = total ? completed / total : 0;

      this.ctx.save();
      this.ctx.translate(x, y);

      const isEarth = planet.name === 'Earth';

      // Atmosphere glow (blue for Earth) and the planet body (settings in src/engine/visual_effects.js)
      if (unlocked) drawVisualEffect(EFFECT_NAMES.ATMOSPHERE, this.ctx, { radius: r, reach: 80 * k, isEarth });
      drawVisualEffect(isEarth ? EFFECT_NAMES.PLANET_EARTH : EFFECT_NAMES.PLANET_BODY, this.ctx, { radius: r });

      // Hex frame (small planets only: Earth is shown big and unframed)
      if (!isEarth) {
        this.ctx.strokeStyle = unlocked ? color : '#444466';
        this.ctx.lineWidth = isSelected ? 3 : (isHovered ? 2.5 : 2);
        this.drawHexagon(0, 0, r + 6);
        this.ctx.stroke();
      }

      // Progress ring
      if (completed > 0) {
        this.ctx.strokeStyle = THEME.gold;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, r + 14 * k, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
        this.ctx.stroke();
      }

      // Missions sit on the planet's surface, always visible
      if (unlocked) {
        this.drawMissionNodes(planet, r, k);
      }

      // Earth's name, spaced out above the planet
      if (isEarth) {
        this.ctx.font = `bold ${34 * k}px "Segoe UI", Roboto, system-ui, sans-serif`;
        this.ctx.fillStyle = THEME.text.title;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        if ('letterSpacing' in this.ctx) this.ctx.letterSpacing = `${14 * k}px`;
        this.ctx.fillText('EARTH', 0, -r - 46 * k);
        if ('letterSpacing' in this.ctx) this.ctx.letterSpacing = '0px';
      } else if (isHovered || isSelected) { // Label
        this.ctx.font = 'bold 12px "Segoe UI", Roboto, system-ui, sans-serif';
        this.ctx.fillStyle = THEME.text.title;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'top';
        this.ctx.fillText(planet.name.toUpperCase(), 0, r + 20);
      }

      // Locked indicator
      if (!unlocked) {
        this.ctx.fillStyle = THEME.text3.grey;
        this.ctx.font = '14px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('🔒', 0, 0);
      }

      this.ctx.restore();
    }
  }

  // Missions on the planet's surface: a marker with the mission's name beside it. The ctx is centred on the planet.
  // A mission is unlocked when it is played, or when a played mission is linked to it by a route.
  // Until something is played, the first mission is open as the entry point. Hubs are always open.
  isMissionUnlocked(planet, mission) {
    if (mission.type === 'Hub') return true;
    if (this.isMissionCompleted(planet.name, mission.name)) return true;
    const played = planet.nodes.some((m) => m.type !== 'Hub' && this.isMissionCompleted(planet.name, m.name));
    if (!played) return planet.nodes.find((m) => m.type !== 'Hub') === mission;
    if (planet.name !== 'Earth') return false;
    return [...linkedMissions(planet, mission.name)].some((name) => this.isMissionCompleted(planet.name, name));
  }

  // A rhombus (diamond) at the origin, half-diagonal d
  drawRhombus(ctx, d, color) {
    ctx.beginPath();
    ctx.moveTo(0, -d); ctx.lineTo(d, 0); ctx.lineTo(0, d); ctx.lineTo(-d, 0);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  // A padlock, drawn at the origin: grey body with a shackle
  drawLock(ctx, k) {
    const bw = 10 * k, bh = 8 * k;
    ctx.fillStyle = THEME.text3.grey2;
    ctx.fillRect(-bw / 2, -bh / 2 + 2 * k, bw, bh);
    ctx.strokeStyle = THEME.text3.grey2;
    ctx.lineWidth = 2 * k;
    ctx.beginPath();
    ctx.arc(0, -bh / 2 + 2 * k, 3.5 * k, Math.PI, 0);
    ctx.stroke();
  }

  drawMissionNodes(planet, planetRadius, k) {
    const ctx = this.ctx;
    for (const mission of planet.nodes) {
      const pos = mission.pos || { x: 0, y: 0 };
      const mx = pos.x * planetRadius;
      const my = pos.y * planetRadius;
      const isHovered = this.hoveredMission === mission.name;
      const isSelected = this.selectedMission === mission.name;
      const completed = this.isMissionCompleted(planet.name, mission.name);
      const nodeR = (13 + (isHovered || isSelected ? 3 : 0)) * k;
      const missionColor = mission.faction ? FACTION_COLORS[mission.faction] : FACTION_COLORS[planet.faction];

      ctx.save();
      ctx.translate(mx, my);

      // Glow when hovered or selected
      if (isHovered || isSelected) {
        const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, nodeR + 16 * k);
        glow.addColorStop(0, completed ? 'rgba(255,255,255,0.55)' : missionColor + '77'); // played nodes glow white
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, 0, nodeR + 16 * k, 0, Math.PI * 2);
        ctx.fill();
      }

      // Marker: a white rhombus when played, a pulsing blue node when unlocked but not played, a lock when locked
      const unlocked = this.isMissionUnlocked(planet, mission);
      if (completed) {
        this.drawRhombus(ctx, 6 * k, THEME.text.white);
      } else if (unlocked) {
        const pulse = 1 + Math.sin(this.animTime * 4) * 0.12;
        this.drawRhombus(ctx, 9 * k * pulse + 4 * k * pulse, 'rgba(77,163,255,0.25)');
        this.drawRhombus(ctx, 9 * k * pulse, THEME.info);
      } else {
        this.drawLock(ctx, k);
      }

      // Name beside the marker, with a dark halo so it reads over the planet
      const fontSize = 22 * k;
      ctx.font = `bold ${fontSize}px "Segoe UI", Roboto, system-ui, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.95)';
      ctx.shadowBlur = 7 * k;
      ctx.fillStyle = completed ? THEME.complete : (isHovered || isSelected ? THEME.text.selected : THEME.text.title);
      if ('letterSpacing' in ctx) ctx.letterSpacing = `${2 * k}px`;
      ctx.fillText(mission.name.toUpperCase(), nodeR + 10 * k, 0);
      if (isHovered || isSelected) {
        ctx.font = `${fontSize * 0.6}px "Segoe UI", Roboto, system-ui, sans-serif`;
        ctx.fillStyle = THEME.gold;
        ctx.fillText(`${mission.type}  ·  Lv ${mission.level}`, nodeR + 10 * k, fontSize * 0.95);
      }
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      ctx.shadowBlur = 0;

      ctx.restore();
    }
  }

  // The sky node under a point: the node itself or its name beside it
  skyNodeAt(x, y) {
    const { k } = this.planetLayout();
    const ctx = this.ctx;
    for (const node of SKY_NODES) {
      const nx = this.canvas.width * node.x, ny = this.canvas.height * node.y;
      let textW = 0;
      if (ctx) {
        ctx.save();
        ctx.font = `bold ${22 * k}px "Segoe UI", Roboto, system-ui, sans-serif`;
        textW = ctx.measureText(node.label).width;
        ctx.restore();
      }
      if (x >= nx - 30 && x <= nx + 20 * k + textW + 10 && Math.abs(y - ny) <= 30) return node;
    }
    return null;
  }

  // Sky nodes: a white rhombus with its name beside it
  drawSkyNodes(w, h) {
    const ctx = this.ctx;
    const { k } = this.planetLayout(w, h);
    for (const node of SKY_NODES) {
      const x = w * node.x, y = h * node.y;
      const hovered = this.hoveredSky === node.label;
      ctx.save();
      ctx.translate(x, y);
      if (hovered) {
        // Same glow as a hovered mission
        const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 22 * k);
        glow.addColorStop(0, 'rgba(255,255,255,0.45)');
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, 0, 22 * k, 0, Math.PI * 2);
        ctx.fill();
      }
      this.drawRhombus(ctx, 6 * k, THEME.text.white);
      ctx.font = `bold ${22 * k}px "Segoe UI", Roboto, system-ui, sans-serif`;
      ctx.fillStyle = hovered ? THEME.text.selected : THEME.text.title;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.95)';
      ctx.shadowBlur = 7 * k;
      ctx.fillText(node.label, 20 * k, 0);
      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }

  // Neighbouring planets around Earth, dimmed because only Earth can be visited so far.
  // Positions are fractions of the screen, taken from the reference.
  drawDestinations(w, h) {
    const ctx = this.ctx;
    const { cx, cy, r, k } = this.planetLayout(w, h);
    const places = [
      { label: 'TO MARS', from: 'Eurasia', x: w * 0.508, y: h * 0.111 },
      { label: 'TO VENUS', from: 'Cambria', x: w * 0.458, y: h * 0.898 },
      { label: 'TO LUA', from: 'Cervantes', x: w * 0.763, y: h * 0.489 },
    ];
    const earth = STAR_CHART.find((planet) => planet.name === 'Earth');
    ctx.save();
    ctx.globalAlpha = 0.5;
    for (const p of places) {
      // Curved route from its mission on Earth to the marker
      const from = earth?.nodes.find((n) => n.name === p.from);
      if (from) {
        const ax = cx + from.pos.x * r, ay = cy + from.pos.y * r;
        const len = Math.hypot(p.x - ax, p.y - ay) || 1;
        const bend = len * 0.2;
        const qx = (ax + p.x) / 2 - ((p.y - ay) / len) * bend;
        const qy = (ay + p.y) / 2 + ((p.x - ax) / len) * bend;
        ctx.strokeStyle = 'rgba(200,210,230,0.55)';
        ctx.lineWidth = 1.5 * k;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.quadraticCurveTo(qx, qy, p.x, p.y);
        ctx.stroke();
      }

      // Double diamond marker
      ctx.strokeStyle = THEME.text3.bright;
      ctx.lineWidth = 2 * k;
      for (const s of [18 * k, 11 * k]) {
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - s); ctx.lineTo(p.x + s, p.y); ctx.lineTo(p.x, p.y + s); ctx.lineTo(p.x - s, p.y);
        ctx.closePath();
        ctx.stroke();
      }

      // Label
      ctx.font = `bold ${28 * k}px "Segoe UI", Roboto, system-ui, sans-serif`;
      ctx.fillStyle = THEME.text3.bright;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      if ('letterSpacing' in ctx) ctx.letterSpacing = `${3 * k}px`;
      ctx.fillText(p.label, p.x + 34 * k, p.y);
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    }
    ctx.restore();
  }

  // Top-left profile icon and invite (+) button. Both open the same squad panel (this.onSquad).
  squadButtons() {
    const y = MENU_TOP_MARGIN;
    return {
      profile: { x: MENU_SIDE_MARGIN, y, w: 42, h: 42 },
      mode: { x: MENU_SIDE_MARGIN + 42 + 6, y, w: 42, h: 42 },
      invite: { x: MENU_SIDE_MARGIN + 42 + 6 + 42 + 6, y, w: 42, h: 42 },
    };
  }

  // Drawn by the same function as the Arsenal's, so the two screens match
  drawSquadButtons() {
    const b = this.squadButtons();
    this.ctx.save();
    drawProfileAndInvite(this.ctx, b.profile, b.invite, { box: b.mode, glyph: getMode().glyph });
    this.ctx.restore();
  }

  // Top-left "Starting <mission> (<planet>)" bar, shown once a mission is selected by clicking.
  // Level circle on the left, an X that cancels the selection, and the name. Clicking the bar launches the mission.
  startBar() {
    if (!this.selectedMission || !this.canvas) return null;
    const planet = STAR_CHART.find((p) => p.name === this.selectedPlanet);
    const mission = planet?.nodes.find((m) => m.name === this.selectedMission);
    if (!mission) return null;
    const k = this.planetLayout().k;
    // Starts after the profile, mode and invite buttons (42px each, 6px apart, 7px before the bar)
    const x = MENU_SIDE_MARGIN + 3 * 42 + 2 * 6 + 7, y = MENU_TOP_MARGIN, h = 42; // the same 42px height as the icons
    // Wide enough for the whole "Starting <mission> (<planet>)" text, with room after it
    let textW = 0;
    if (this.ctx) {
      this.ctx.save();
      this.ctx.font = `bold ${22 * k}px "Segoe UI", Roboto, system-ui, sans-serif`;
      textW = this.ctx.measureText(`Starting ${mission.name} (${planet.name})`).width;
      this.ctx.restore();
    }
    const w = Math.max(330 * k, 126 * k + textW + 16 * k);
    return {
      planet, mission, k,
      bar: { x, y, w, h },
      level: { x: x + 24 * k, y: y + h / 2, r: 16 * k },
      toggle: { x: x + 48 * k, y: y + (h - 28 * k) / 2, w: 28 * k, h: 28 * k },
      close: { x: x + 84 * k, y: y + (h - 28 * k) / 2, w: 28 * k, h: 28 * k },
    };
  }

  drawStartBar() {
    const sb = this.startBar();
    if (!sb) return;
    const { planet, mission, k, bar, level, close, toggle } = sb;
    const ctx = this.ctx;
    ctx.save();
    // The same box as the squad icons and the currency bar: panel fill, faint outline, small corners
    ctx.fillStyle = THEME.panel.fill;
    ctx.strokeStyle = THEME.panel.stroke;
    ctx.lineWidth = 1;
    this.roundRect(bar.x, bar.y, bar.w, bar.h, 2 * k);
    ctx.fill();
    ctx.stroke();

    // Countdown: a ring that drains as the seconds run out, with the seconds in the middle
    const lr = level.r, lcx = level.x, lcy = level.y;
    // Each second the ring drains fully and starts again; the number steps down once per cycle
    const elapsed = Math.min(START_COUNTDOWN, START_COUNTDOWN - this.countdown);
    const left = 1 - (elapsed % 1);
    ctx.beginPath();
    ctx.arc(lcx, lcy, lr, 0, Math.PI * 2);
    ctx.strokeStyle = THEME.dropdown.stroke;
    ctx.lineWidth = 2 * k;
    ctx.stroke();
    if (left > 0) {
      // The remaining time runs counter-clockwise from 12 o'clock
      ctx.beginPath();
      ctx.arc(lcx, lcy, lr, -Math.PI / 2, -Math.PI / 2 - Math.PI * 2 * left, true);
      ctx.strokeStyle = THEME.text.selected;
      ctx.lineWidth = 2 * k;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.lineCap = 'butt';
    }
    ctx.font = `bold ${22 * k}px "Segoe UI", Roboto, system-ui, sans-serif`; // same size as the mission name
    ctx.fillStyle = THEME.text.selected;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(Math.max(1, Math.ceil(this.countdown))), lcx, lcy);

    // Pause / play in its own box, like the X: a bar pair while the start is on, a triangle while it is paused
    ctx.fillStyle = THEME.line.faint;
    ctx.fillRect(toggle.x, toggle.y, toggle.w, toggle.h);
    ctx.strokeStyle = THEME.line.strong;
    ctx.lineWidth = 1;
    ctx.strokeRect(toggle.x + 0.5, toggle.y + 0.5, toggle.w - 1, toggle.h - 1);
    ctx.fillStyle = THEME.text.title;
    const tx = toggle.x + toggle.w / 2, ty = toggle.y + toggle.h / 2, ts = 7 * k;
    ctx.beginPath();
    if (this.startPaused) {
      ctx.moveTo(tx - ts * 0.7, ty - ts); ctx.lineTo(tx + ts, ty); ctx.lineTo(tx - ts * 0.7, ty + ts);
    } else {
      ctx.rect(tx - ts * 0.8, ty - ts, ts * 0.6, ts * 2);
      ctx.rect(tx + ts * 0.2, ty - ts, ts * 0.6, ts * 2);
    }
    ctx.closePath();
    ctx.fill();

    // Cancel X in its own box
    ctx.fillStyle = THEME.line.faint;
    ctx.fillRect(close.x, close.y, close.w, close.h);
    ctx.strokeStyle = THEME.line.strong;
    ctx.lineWidth = 1;
    ctx.strokeRect(close.x + 0.5, close.y + 0.5, close.w - 1, close.h - 1);
    ctx.strokeStyle = THEME.text.title;
    ctx.lineWidth = 3 * k;
    const cx = close.x + close.w / 2, cy = close.y + close.h / 2, s = 7 * k;
    ctx.beginPath();
    ctx.moveTo(cx - s, cy - s); ctx.lineTo(cx + s, cy + s);
    ctx.moveTo(cx + s, cy - s); ctx.lineTo(cx - s, cy + s);
    ctx.stroke();

    // "Starting <mission> (<planet>)"
    ctx.font = `${22 * k}px "Segoe UI", Roboto, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillStyle = THEME.text.selected;
    const lead = 'Starting ';
    ctx.fillText(lead, close.x + close.w + 14 * k, bar.y + bar.h / 2);
    const leadW = ctx.measureText(lead).width;
    ctx.fillStyle = THEME.text.title;
    ctx.font = `bold ${22 * k}px "Segoe UI", Roboto, system-ui, sans-serif`;
    ctx.fillText(`${mission.name} (${planet.name})`, close.x + close.w + 14 * k + leadW, bar.y + bar.h / 2);
    ctx.restore();
  }

  // The mission card: a banner, the mission name, its type, faction and level, and suggested damage.
  // The banner uses the faction colour and mission icon, since there is no mission art yet.
  drawDetailPanel() {
    const active = this.activeCard();
    if (!active) return;
    const { planet, mission } = active;
    const card = this.cardRect(mission);
    const { x, y, w, imgH, bodyH, h, k } = card;
    const ctx = this.ctx;
    const faction = mission.faction ?? planet.faction;
    const color = FACTION_COLORS[faction] ?? '#e85d2a';
    const completed = this.isMissionCompleted(planet.name, mission.name);

    ctx.save();
    // Frame and body
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 18 * k;
    this.roundRect(x, y, w, h, 6 * k);
    ctx.fillStyle = THEME.cardFill;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = THEME.cardBorder;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Banner (clipped to the card's top corners)
    ctx.save();
    this.roundRect(x, y, w, h, 6 * k);
    ctx.clip();
    const banner = ctx.createLinearGradient(x, y, x + w, y + imgH);
    banner.addColorStop(0, color + '55');
    banner.addColorStop(0.6, THEME.cardBanner[0]);
    banner.addColorStop(1, THEME.cardBanner[1]);
    ctx.fillStyle = banner;
    ctx.fillRect(x, y, w, imgH);
    ctx.font = `${96 * k}px Arial`;
    ctx.fillStyle = color + '88';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(MISSION_ICONS[mission.type] || '◆', x + w * 0.72, y + imgH * 0.5);
    // Name over the bottom of the banner
    ctx.font = `bold ${30 * k}px "Segoe UI", Roboto, system-ui, sans-serif`;
    ctx.fillStyle = THEME.text3.cream;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${1 * k}px`;
    ctx.fillText(mission.name.toUpperCase(), x + 16 * k, y + imgH - 16 * k);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.restore();

    // Body text
    const tx = x + 16 * k;
    let ty = y + imgH + 30 * k;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${18 * k}px "Segoe UI", Roboto, system-ui, sans-serif`;
    ctx.fillStyle = THEME.text.selected;
    ctx.fillText(mission.type.toUpperCase(), tx, ty);
    ty += 28 * k;
    ctx.font = `bold ${15 * k}px "Segoe UI", Roboto, system-ui, sans-serif`;
    ctx.fillStyle = THEME.text.title;
    ctx.fillText(faction.toUpperCase(), tx, ty);
    ctx.fillStyle = THEME.gold;
    ctx.fillText(mission.level, tx + ctx.measureText(faction.toUpperCase() + '  ').width, ty);
    ty += 28 * k;
    ctx.font = `${13 * k}px "Segoe UI", Roboto, system-ui, sans-serif`;
    ctx.fillStyle = THEME.text.dim;
    ctx.fillText('SUGGESTED DAMAGE', tx, ty);
    // Placeholder damage icons until real damage data exists
    for (let i = 0; i < 2; i++) {
      const dx = tx + ctx.measureText('SUGGESTED DAMAGE  ').width + i * 22 * k;
      ctx.strokeStyle = THEME.text.dim;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(dx + 8 * k, ty - 7 * k); ctx.lineTo(dx + 15 * k, ty); ctx.lineTo(dx + 8 * k, ty + 7 * k); ctx.lineTo(dx + 1 * k, ty);
      ctx.closePath();
      ctx.stroke();
    }

    if (completed) {
      ctx.font = `bold ${13 * k}px "Segoe UI", Roboto, system-ui, sans-serif`;
      ctx.fillStyle = THEME.complete;
      ctx.textAlign = 'right';
      ctx.fillText('COMPLETED', x + w - 16 * k, y + imgH - 16 * k - 34 * k);
    }
    ctx.restore();
  }

  // Small Simulacrum button in the top-right corner, kept clear of the Earth planet and its panel
  simulacrumButton(w) {
    return { x: w - SCREEN_EDGE - 34 - 12 - 150, y: SCREEN_EDGE, w: 150, h: 28 }; // left of the × close button
  }

  drawSimulacrumButton(ctx, w) {
    const b = this.simulacrumButton(w);
    roundRectPath(ctx, b.x, b.y, b.w, b.h, 4);
    ctx.fillStyle = THEME.panelFillAlt;
    ctx.fill();
    ctx.strokeStyle = THEME.accentStrong;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.font = `600 12px ${FONT}`;
    ctx.fillStyle = MENU_COLORS.selected;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SIMULACRUM', b.x + b.w / 2, b.y + b.h / 2);
    ctx.textBaseline = 'alphabetic';
  }

  drawUI(w, h) {

    // Subtitle
    this.ctx.font = '12px "Segoe UI", Roboto, system-ui, sans-serif';
    this.ctx.fillStyle = THEME.text3.dark;
    this.ctx.textAlign = 'center';
    this.ctx.fillText('ORIGIN SYSTEM  •  ' + this.mode.toUpperCase(), w/2, 86);

  }

  roundRect(x, y, w, h, r) {
    this.ctx.beginPath();
    this.ctx.moveTo(x + r, y);
    this.ctx.lineTo(x + w - r, y);
    this.ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    this.ctx.lineTo(x + w, y + h - r);
    this.ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    this.ctx.lineTo(x + r, y + h);
    this.ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    this.ctx.lineTo(x, y + r);
    this.ctx.quadraticCurveTo(x, y, x + r, y);
    this.ctx.closePath();
  }
}