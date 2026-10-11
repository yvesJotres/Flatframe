import { drawCornerAccents, SCREEN_EDGE, FONT, MENU_COLORS, roundRectPath } from './menu_style.js';
import { getMission } from '../../missions/missions.js';
import { TOP_TABS, TAB_STYLE, drawTopTabs, getTabHitRects } from './top_tabs.js';

const PLANET_ICONS = { Mercury: '☿', Venus: '♀', Earth: '♁', Mars: '♂', Phobos: '◆', Ceres: '⚳', Jupiter: '♃', Europa: '❄', Saturn: '♄', Uranus: '♅', Neptune: '♆', Pluto: '♇', Sedna: '⯲', Eris: '⯰', Void: '◆', Lua: '☾', 'Kuva Fortress': '⛨' };
const MISSION_ICONS = { Exterminate: '✦', Defense: '◆', Survival: '▲', Capture: '●', Spy: '■', Sabotage: '◆', Interception: '◆', 'Mobile Defense': '◆', 'Dark Sector Defense': '◆' };
const FACTION_COLORS = { grineer: '#e85d2a', corpus: '#3a8fce', infested: '#7ab800', corrupted: '#e8e8f0', sentient: '#ff2a8a' };

const STAR_CHART = [
  { name: 'Earth', faction: 'grineer', angle: 0, distance: 0.5, nodes: [ 
    { name: 'Everest', type: 'Exterminate', level: '1-5', pos: { x: -0.3, y: -0.2 } }, 
    { name: 'Mariana', type: 'Defense', level: '5-10', pos: { x: 0.25, y: -0.35 } }, 
    { name: 'Scotia', type: 'Survival', level: '10-15', pos: { x: 0.4, y: 0.15 } },
    { name: 'Cervantes', type: 'Capture', level: '3-5', pos: { x: -0.4, y: 0.3 } },
    { name: 'Tikal', type: 'Dark Sector Defense', level: '5-15', faction: 'infested', pos: { x: 0.1, y: 0.4 } }
  ] }
];

const JUNCTIONS = [];

export default class Navigation {
  constructor(onLaunch) {
    this.onLaunch = onLaunch;
    this.onClose = null;
    this.canvas = null;
    this.ctx = null;
    this.open = false;
    this.selectedPlanet = null;
    this.selectedMission = null;
    this.hoveredPlanet = null;
    this.hoveredMission = null;
    this.animTime = 0;
    this.mode = 'origin';
    this.panelAlpha = 0;
    this.targetPanelAlpha = 0;
    this.activeTab = 'navigation';
    this.completedMissions = new Set(JSON.parse(localStorage.getItem('fm_completed') || '[]'));
    this.unlockedPlanets = new Set(['Earth']);
    this.loadProgress();
  }

  loadProgress() {
    try {
      const data = JSON.parse(localStorage.getItem('fm_nav_progress') || '{}');
      this.completedMissions = new Set(data.completed || []);
      const savedUnlocked = new Set(data.unlocked || []);
      // Earth-only mode: only restore Earth if it was unlocked, otherwise default to Earth
      if (savedUnlocked.has('Earth')) {
        this.unlockedPlanets = new Set(['Earth']);
      } else {
        this.unlockedPlanets = new Set(['Earth']);
      }
    } catch {}
  }

  saveProgress() {
    localStorage.setItem('fm_nav_progress', JSON.stringify({
      completed: [...this.completedMissions],
      unlocked: [...this.unlockedPlanets]
    }));
  }

  isPlanetUnlocked(planetName) {
    return this.unlockedPlanets.has(planetName);
  }

  isMissionCompleted(planetName, missionName) {
    return this.completedMissions.has(`${planetName}:${missionName}`);
  }

  completeMission(planetName, missionName) {
    this.completedMissions.add(`${planetName}:${missionName}`);
    this.checkPlanetUnlock(planetName);
    this.saveProgress();
  }

  checkPlanetUnlock(planetName) {
    // Single planet mode - no further planets to unlock
  }

  openScreen() {
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
    const w = 340, x = W - w - SCREEN_EDGE; // right edge on the corner-bracket line
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

  update(dt, input) {
    if (!this.open) return;
    this.animTime += dt;
    this.panelAlpha += (this.targetPanelAlpha - this.panelAlpha) * 0.15;
    
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

  handleClick(x, y) {
    if (!this.open || !this.canvas) return false;
    
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    const scale = Math.min(this.canvas.width, this.canvas.height) * 0.42;
    const w = this.canvas?.width ?? 1280;
    
    // Top tabs click handling - use universal module
    const hitRects = getTabHitRects(w);
    for (const rect of hitRects) {
      if (x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height) {
        this.activeTab = rect.id;
        if (this.onTabSwitch) this.onTabSwitch(this.activeTab);
        return true;
      }
    }

    const sb = this.simulacrumButton(w);
    if (x >= sb.x && x <= sb.x + sb.w && y >= sb.y && y <= sb.y + sb.h) {
      if (this.onSimulacrum) this.onSimulacrum();
      return true;
    }

    if (this.selectedPlanet) {
      const planet = STAR_CHART.find(p => p.name === this.selectedPlanet);
      if (!planet) return true;

      // Check mission nodes around planet - Earth is drawn at center (cx, cy)
      const missionScale = scale * 0.6;
      const planetX = cx;
      const planetY = cy;
      
      for (const mission of planet.nodes) {
        const pos = mission.pos || { x: 0, y: 0 };
        const mx = planetX + pos.x * missionScale;
        const my = planetY + pos.y * missionScale;
        const nodeR = 28; // generous hit area for touch
        if (Math.hypot(x - mx, y - my) < nodeR) {
          if (this.isMissionCompleted(planet.name, mission.name)) return true;
          if (this.selectedMission === mission.name) {
            this.launchMission(planet, mission);
          } else {
            this.selectedMission = mission.name;
            this.targetPanelAlpha = 1;
          }
          return true;
        }
      }

      const G = this.panelGeom(planet);
      const panelW = G.w, panelX = G.x, panelY = G.y, itemH = G.itemH, startY = G.startY;

      const btnY = G.btnY;
      if (this.selectedMission && x >= panelX + 16 && x <= panelX + panelW - 16 && y >= btnY && y <= btnY + G.btnH) {
        const mission = planet.nodes.find(m => m.name === this.selectedMission);
        if (mission && !this.isMissionCompleted(planet.name, mission.name)) this.launchMission(planet, mission);
        return true;
      }

      if (x >= panelX && x <= panelX + panelW && y >= startY) {
        const idx = Math.floor((y - startY) / itemH);
        if (idx >= 0 && idx < planet.nodes.length && y < btnY) {
          const mission = planet.nodes[idx];
          if (this.isMissionCompleted(planet.name, mission.name)) return true;
          if (this.selectedMission === mission.name) {
            this.launchMission(planet, mission);
          } else {
            this.selectedMission = mission.name;
            this.targetPanelAlpha = 1;
          }
          return true;
        }
      }

      if (x < panelX || x > panelX + panelW || y < panelY || y > panelY + G.h) {
        this.selectedPlanet = null;
        this.targetPanelAlpha = 0;
      }
      return true;
    }

    for (const planet of STAR_CHART) {
      if (!this.isPlanetUnlocked(planet.name)) continue;
      // Earth drawn at center
      const px = cx;
      const py = cy;
      const dist = Math.hypot(x - px, y - py);
      if (dist < 68) {  // planet radius + hover padding
        this.selectedPlanet = planet.name;
        this.selectedMission = null;
        this.targetPanelAlpha = 0.5;
        return true;
      }
    }
    return false;
  }

  handleMove(x, y) {
    if (!this.open || !this.canvas) return;
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    const scale = Math.min(this.canvas.width, this.canvas.height) * 0.42;

    this.hoveredPlanet = null;
    this.hoveredMission = null;

    if (this.selectedPlanet) {
      const planet = STAR_CHART.find(p => p.name === this.selectedPlanet);
      if (planet) {
        // Check mission nodes around planet - Earth drawn at center
        const missionScale = scale * 0.6;
        const planetX = cx;
        const planetY = cy;
        for (const mission of planet.nodes) {
          const pos = mission.pos || { x: 0, y: 0 };
          const mx = planetX + pos.x * missionScale;
          const my = planetY + pos.y * missionScale;
          const nodeR = 28; // generous hit area for touch
          if (Math.hypot(x - mx, y - my) < nodeR) {
            this.hoveredMission = mission.name;
            return;
          }
        }

        const G = this.panelGeom(planet);
        const panelW = G.w, panelX = G.x, startY = G.startY, itemH = G.itemH;
        if (x >= panelX && x <= panelX + panelW && y >= startY && y < G.btnY) {
          const idx = Math.floor((y - startY) / itemH);
          if (idx >= 0 && idx < planet.nodes.length) {
            this.hoveredMission = planet.nodes[idx].name;
          }
        }
      }
    } else {
      for (const planet of STAR_CHART) {
        if (!this.isPlanetUnlocked(planet.name)) continue;
        // Earth drawn at center
        const px = cx;
        const py = cy;
        if (Math.hypot(x - px, y - py) < 68) {
          this.hoveredPlanet = planet.name;
          break;
        }
      }
    }
  }

  launchMission(planet, mission) {
    const typeToId = {
      'Exterminate': 'exterminate',
      'Defense': 'defense',
      'Survival': 'survival',
      'Capture': 'capture',
      'Sabotage': 'sabotage',
      'Interception': 'interception',
      'Mobile Defense': 'mobile_defense',
      'Dark Sector Defense': 'dark_sector_defense'
    };
    const missionId = typeToId[mission.type];
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
    const cx = w / 2;
    const cy = h / 2;
    const scale = Math.min(w, h) * 0.42;

    this.drawSpaceBackground(w, h);
    this.drawOrbitRings(cx, cy, scale);
    this.drawConnectionLines(cx, cy, scale);
    this.drawJunctions(cx, cy, scale);
    this.drawPlanets(cx, cy, scale);
    this.drawDetailPanel(cx, cy, scale);
    this.drawUI(w, h);
  }

  drawSpaceBackground(w, h) {
    const g = this.ctx.createRadialGradient(w * 0.2, h * 0.3, 0, w * 0.5, h * 0.5, Math.max(w, h));
    g.addColorStop(0, '#0a0a14');
    g.addColorStop(0.4, '#06060a');
    g.addColorStop(1, '#030305');
    this.ctx.fillStyle = g;
    this.ctx.fillRect(0, 0, w, h);

    // Nebula glows
    this.ctx.save();
    this.ctx.globalCompositeOperation = 'lighter';
    const n1 = this.ctx.createRadialGradient(w * 0.15, h * 0.25, 0, w * 0.15, h * 0.25, w * 0.5);
    n1.addColorStop(0, 'rgba(255,107,53,0.03)'); n1.addColorStop(1, 'transparent');
    this.ctx.fillStyle = n1; this.ctx.fillRect(0, 0, w, h);
    const n2 = this.ctx.createRadialGradient(w * 0.85, h * 0.75, 0, w * 0.85, h * 0.75, w * 0.5);
    n2.addColorStop(0, 'rgba(58,143,206,0.02)'); n2.addColorStop(1, 'transparent');
    this.ctx.fillStyle = n2; this.ctx.fillRect(0, 0, w, h);
    this.ctx.restore();
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
      const isHovered = this.hoveredPlanet === planet.name;
      const isSelected = this.selectedPlanet === planet.name;
      const r = 60 + (isHovered || isSelected ? 8 : 0);
      const color = FACTION_COLORS[planet.faction];
      const completed = planet.nodes.filter(n => this.isMissionCompleted(planet.name, n.name)).length;
      const total = planet.nodes.length;
      const progress = total ? completed / total : 0;

      this.ctx.save();
      this.ctx.translate(x, y);

      // Atmosphere glow
      if (unlocked) {
        const atmo = this.ctx.createRadialGradient(0, 0, r, 0, 0, r + 80);
        atmo.addColorStop(0, 'rgba(232,93,42,0.15)');
        atmo.addColorStop(0.5, 'rgba(232,93,42,0.05)');
        atmo.addColorStop(1, 'transparent');
        this.ctx.fillStyle = atmo;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, r + 80, 0, Math.PI * 2);
        this.ctx.fill();
      }

      // Planet body - gradient sphere
      const planetGrad = this.ctx.createRadialGradient(-r * 0.3, -r * 0.3, 0, 0, 0, r);
      planetGrad.addColorStop(0, '#4a3a2a');
      planetGrad.addColorStop(0.4, '#3a2a1a');
      planetGrad.addColorStop(1, '#1a1008');
      this.ctx.fillStyle = planetGrad;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, r, 0, Math.PI * 2);
      this.ctx.fill();

      // Land masses
      this.ctx.fillStyle = 'rgba(100,80,50,0.6)';
      this.ctx.beginPath();
      this.ctx.ellipse(-r * 0.2, -r * 0.1, r * 0.35, r * 0.25, 0.5, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.beginPath();
      this.ctx.ellipse(r * 0.15, r * 0.1, r * 0.3, r * 0.2, -0.3, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.beginPath();
      this.ctx.ellipse(-r * 0.1, r * 0.35, r * 0.25, r * 0.15, 0.8, 0, Math.PI * 2);
      this.ctx.fill();

      // Glow on hover/select
      if (isHovered || isSelected) {
        const glow = this.ctx.createRadialGradient(0, 0, r, 0, 0, r + 30);
        glow.addColorStop(0, color + '33');
        glow.addColorStop(1, 'transparent');
        this.ctx.fillStyle = glow;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, r + 30, 0, Math.PI * 2);
        this.ctx.fill();
      }

      // Hex frame
      this.ctx.strokeStyle = unlocked ? color : '#444466';
      this.ctx.lineWidth = isSelected ? 3 : (isHovered ? 2.5 : 2);
      this.drawHexagon(0, 0, r + 6);
      this.ctx.stroke();

      // Progress ring
      if (completed > 0) {
        this.ctx.strokeStyle = '#ffd700';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, r + 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
        this.ctx.stroke();
      }

      // Draw mission nodes around planet when selected/hovered
      if ((isSelected || isHovered) && unlocked) {
        this.drawMissionNodes(planet, r, scale);
      }

      // Label
      if (isHovered || isSelected) {
        this.ctx.font = 'bold 12px "Segoe UI", Roboto, system-ui, sans-serif';
        this.ctx.fillStyle = '#f0e8e0';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'top';
        this.ctx.fillText(planet.name.toUpperCase(), 0, r + 20);
      }

      // Locked indicator
      if (!unlocked) {
        this.ctx.fillStyle = '#8a8aaa';
        this.ctx.font = '14px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('🔒', 0, 0);
      }

      this.ctx.restore();
    }
  }

  drawMissionNodes(planet, planetRadius, scale) {
    const missionScale = scale * 0.6;
    for (const mission of planet.nodes) {
      const pos = mission.pos || { x: 0, y: 0 };
      const mx = pos.x * missionScale;
      const my = pos.y * missionScale;
      const isHovered = this.hoveredMission === mission.name;
      const isSelected = this.selectedMission === mission.name;
      const completed = this.isMissionCompleted(planet.name, mission.name);
      const nodeR = 14 + (isHovered || isSelected ? 4 : 0);
      const missionColor = mission.faction ? FACTION_COLORS[mission.faction] : FACTION_COLORS[planet.faction];

      this.ctx.save();
      this.ctx.translate(mx, my);

      // Connection line to planet center
      this.ctx.strokeStyle = missionColor + '44';
      this.ctx.lineWidth = 1;
      this.ctx.setLineDash([4, 4]);
      this.ctx.beginPath();
      this.ctx.moveTo(0, 0);
      this.ctx.lineTo(-mx * 0.5, -my * 0.5);
      this.ctx.stroke();
      this.ctx.setLineDash([]);

      // Glow
      if (isHovered || isSelected) {
        const glow = this.ctx.createRadialGradient(0, 0, 0, 0, 0, nodeR + 12);
        glow.addColorStop(0, missionColor + '55');
        glow.addColorStop(1, 'transparent');
        this.ctx.fillStyle = glow;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, nodeR + 12, 0, Math.PI * 2);
        this.ctx.fill();
      }

      // Node hex
      this.ctx.fillStyle = completed ? '#2a3a1a' : 'rgba(18,18,30,0.95)';
      this.ctx.strokeStyle = completed ? '#44aa44' : (isSelected ? missionColor : (isHovered ? missionColor + 'cc' : missionColor + '88'));
      this.ctx.lineWidth = isSelected ? 2.5 : (isHovered ? 2 : 1.5);
      this.drawHexagon(0, 0, nodeR);
      this.ctx.fill();
      this.ctx.stroke();

      // Mission icon
      this.ctx.font = `${nodeR * 0.7}px Arial`;
      this.ctx.fillStyle = completed ? '#44aa44' : missionColor;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.shadowColor = missionColor;
      this.ctx.shadowBlur = 6;
      this.ctx.fillText(MISSION_ICONS[mission.type] || '◆', 0, 0);
      this.ctx.shadowBlur = 0;

      // Progress ring for completed
      if (completed) {
        this.ctx.strokeStyle = '#ffd700';
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, nodeR + 3, -Math.PI / 2, Math.PI * 1.5);
        this.ctx.stroke();
      }

      // Label on hover
      if (isHovered || isSelected) {
        this.ctx.font = 'bold 12px "Segoe UI", Roboto, system-ui, sans-serif';
        this.ctx.fillStyle = '#f0e8e0';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'top';
        this.ctx.fillText(mission.name, 0, nodeR + 8);
        this.ctx.font = '11px "Segoe UI", Roboto, system-ui, sans-serif';
        this.ctx.fillStyle = '#ffd700';
        this.ctx.fillText(`Lv ${mission.level}`, 0, nodeR + 22);
      }

      this.ctx.restore();
    }
  }

  drawDetailPanel(cx, cy, scale) {
    if (!this.selectedPlanet || this.panelAlpha < 0.01) return;
    const planet = STAR_CHART.find(p => p.name === this.selectedPlanet);
    if (!planet) return;

    const G = this.panelGeom(planet);
    const { w, x, y, h } = G;

    this.ctx.save();
    this.ctx.globalAlpha = this.panelAlpha;

    // Panel bg
    const grad = this.ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, 'rgba(18,18,30,0.98)');
    grad.addColorStop(1, 'rgba(10,10,20,0.99)');
    this.ctx.fillStyle = grad;
    this.ctx.strokeStyle = FACTION_COLORS[planet.faction] + '66';
    this.ctx.lineWidth = 1;
    this.roundRect(x, y, w, h, 8);
    this.ctx.fill();
    this.ctx.stroke();

    // Header
    this.ctx.fillStyle = FACTION_COLORS[planet.faction] + '22';
    this.roundRect(x, y, w, 60, 8);
    this.ctx.fill();
    
    this.ctx.font = 'bold 16px "Segoe UI", Roboto, system-ui, sans-serif';
    this.ctx.fillStyle = '#f0e8e0';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(planet.name.toUpperCase(), x + 16, y + 28);
    
    this.ctx.font = '12px "Segoe UI", Roboto, system-ui, sans-serif';
    this.ctx.fillStyle = FACTION_COLORS[planet.faction];
    this.ctx.fillText(planet.faction.toUpperCase() + ' CONTROL', x + 16, y + 46);

    // Close hint
    this.ctx.font = '12px "Segoe UI", Roboto, system-ui, sans-serif';
    this.ctx.fillStyle = '#8a8aaa';
    this.ctx.textAlign = 'right';
    this.ctx.fillText('[ESC] Back', x + w - 16, y + 28);

    // Mission list
    const startY = G.startY - 5;
    const itemH = G.itemH;
    planet.nodes.forEach((mission, idx) => {
      const itemY = startY + idx * itemH;
      const completed = this.isMissionCompleted(planet.name, mission.name);
      const isHovered = this.hoveredMission === mission.name;
      const isSelected = this.selectedMission === mission.name;

      // Item bg
      if (isSelected) {
        this.ctx.fillStyle = FACTION_COLORS[planet.faction] + '33';
        this.ctx.strokeStyle = FACTION_COLORS[planet.faction];
        this.ctx.lineWidth = 2;
      } else if (isHovered) {
        this.ctx.fillStyle = 'rgba(255,107,53,0.1)';
        this.ctx.strokeStyle = FACTION_COLORS[planet.faction] + '88';
        this.ctx.lineWidth = 1.5;
      } else if (completed) {
        this.ctx.fillStyle = '#44aa4422';
        this.ctx.strokeStyle = '#44aa4466';
        this.ctx.lineWidth = 1;
      } else {
        this.ctx.fillStyle = 'rgba(10,10,20,0.6)';
        this.ctx.strokeStyle = '#333355';
        this.ctx.lineWidth = 1;
      }
      this.roundRect(x + 8, itemY, w - 16, itemH - 8, 4);
      this.ctx.fill();
      this.ctx.stroke();

      // Mission icon
      const iconX = x + 20;
      const iconY = itemY + 8;
      const iconR = 20;
      this.ctx.fillStyle = completed ? '#44aa44' : (FACTION_COLORS[planet.faction] + '33');
      this.ctx.strokeStyle = completed ? '#44aa44' : FACTION_COLORS[planet.faction];
      this.ctx.lineWidth = 1.5;
      this.ctx.save();
      this.ctx.translate(iconX + iconR, iconY + iconR);
      this.drawHexagon(0, 0, iconR);
      this.ctx.fill();
      this.ctx.stroke();
      this.ctx.font = `${iconR * 0.8}px Arial`;
      this.ctx.fillStyle = completed ? '#050508' : FACTION_COLORS[planet.faction];
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(MISSION_ICONS[mission.type] || '◆', 0, 0);
      this.ctx.restore();

      // Mission name
      this.ctx.font = 'bold 12px "Segoe UI", Roboto, system-ui, sans-serif';
      this.ctx.fillStyle = completed ? '#44aa44' : '#f0e8e0';
      this.ctx.textAlign = 'left';
      this.ctx.textBaseline = 'top';
      this.ctx.fillText(mission.name, iconX + 50, itemY + 10);

      // Meta
      this.ctx.font = '11px "Segoe UI", Roboto, system-ui, sans-serif';
      this.ctx.fillStyle = '#ffd700';
      this.ctx.fillText(`Lv ${mission.level}`, iconX + 50, itemY + 30);
      this.ctx.fillStyle = '#9a8a7a';
      this.ctx.fillText(mission.type, iconX + 120, itemY + 30);

      if (completed) {
        this.ctx.fillStyle = '#44aa44';
        this.ctx.font = 'bold 12px "Segoe UI", Roboto, system-ui, sans-serif';
        this.ctx.fillText('COMPLETED', x + w - 100, itemY + 10);
      }
    });

    // Launch button
    if (this.selectedMission) {
      const btnY = G.btnY;
      const mission = planet.nodes.find(n => n.name === this.selectedMission);
      const canLaunch = mission && !this.isMissionCompleted(planet.name, mission.name);
      
      this.ctx.fillStyle = canLaunch ? 
        this.ctx.createLinearGradient(x + 16, btnY, x + w - 16, btnY) : '#333355';
      if (canLaunch) {
        const g = this.ctx.fillStyle;
        g.addColorStop(0, '#ff6b35');
        g.addColorStop(1, '#e85d2a');
      }
      this.ctx.strokeStyle = canLaunch ? '#ff6b35' : '#444466';
      this.ctx.lineWidth = 1;
      this.roundRect(x + 16, btnY, w - 32, G.btnH, 4);
      this.ctx.fill();
      this.ctx.stroke();

      this.ctx.font = 'bold 12px "Segoe UI", Roboto, system-ui, sans-serif';
      this.ctx.fillStyle = canLaunch ? '#050508' : '#8a8aaa';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(canLaunch ? `LAUNCH ${mission.type}` : 'SELECT MISSION', x + w/2, btnY + G.btnH / 2);
    }

    this.ctx.restore();
  }

  drawTopTabs(ctx, w) {
    drawTopTabs(ctx, w, 'navigation');
  }

  // Small Simulacrum button in the top-right corner, kept clear of the Earth planet and its panel
  simulacrumButton(w) {
    return { x: w - SCREEN_EDGE - 34 - 12 - 150, y: SCREEN_EDGE, w: 150, h: 28 }; // left of the × close button
  }

  drawSimulacrumButton(ctx, w) {
    const b = this.simulacrumButton(w);
    roundRectPath(ctx, b.x, b.y, b.w, b.h, 4);
    ctx.fillStyle = 'rgba(16,16,28,0.9)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,107,53,0.6)';
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
    this.drawTopTabs(this.ctx, w);
    drawCornerAccents(this.ctx, w, h);
    this.drawSimulacrumButton(this.ctx, w);

    // Subtitle
    this.ctx.font = '12px "Segoe UI", Roboto, system-ui, sans-serif';
    this.ctx.fillStyle = '#9a8a7a';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('ORIGIN SYSTEM  •  ' + this.mode.toUpperCase(), w/2, 86);

    // Hint
    if (!this.selectedPlanet) {
      this.ctx.font = '12px "Segoe UI", Roboto, system-ui, sans-serif';
      this.ctx.fillStyle = '#8a8aaa';
      this.ctx.textAlign = 'center';
      this.ctx.fillText((document.body.classList.contains('touch-device') ? 'Tap' : 'Click') + ' a planet to view missions  ·  [Enter] Select', w/2, h - 20);
    }
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