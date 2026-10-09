import Player from './entities/player.js';
import Lancer from './entities/ai/enemies/factions/grineer/lancer.js';
import CryoPod from './entities/objective.js';
import Hud from './ui/hud.js';
import PauseMenu from './ui/menu.js';
import MissionSelect from './ui/mission_select.js';
import { MainMenu } from './ui/main_menu.js';
import { SimulacrumMenu } from './ui/simulacrum/core/menu.js';
import { InputHandler } from './core/input_handler.js';
import { getMission, waveSize } from './missions/missions.js';
import { spawnEnemy, updateSpawns, initSpawnSystem, setEnemies } from './entities/ai/spawner.js';
import { audioManager } from './core/audio.js';
import { createMenuMusic } from './core/menu_music.js';
import { rollLootDrop, applyLootPickup } from './entities/loot.js';
import { UNITS_PER_METER } from './core/constants.js';
import { updateEnemies } from './core/ai_behavior.js';

window.onerror = function (msg, url, lineNo, columnNo, error) {
  console.error('[GLOBAL ERROR]:', { msg, url, lineNo, columnNo, error });
  return false;
};
window.addEventListener('unhandledrejection', function (event) {
  console.error('[UNHANDLED REJECTION]:', event.reason);
});

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

const menuMusic = createMenuMusic({ audio: audioManager, name: 'launcher_music' });
function unlockAudio() {
  audioManager.ready().then(() => menuMusic.enable());
  window.removeEventListener('mousedown', unlockAudio);
  window.removeEventListener('keydown', unlockAudio);
}
window.addEventListener('mousedown', unlockAudio);
window.addEventListener('keydown', unlockAudio);

const inputHandler = new InputHandler(canvas);
const hud = new Hud();
const pauseMenu = new PauseMenu();
const missionSelect = new MissionSelect();
const mainMenu = new MainMenu();
const simulacrumMenu = new SimulacrumMenu();

let player = null, enemies = [], loot = [], projectiles = [], objective = null;
let screen = 'main-menu', mission = null, kills = 0, elapsed = 0, currentWave = 1;
let waveEnemiesSpawned = 0, waveEnemiesTotal = 0, waveTimer = 0, spawnTimer = 0, lastTimestamp = 0, gameExited = false;

// Camera
let camera = { x: 0, y: 0, zoom: 1 };
const cameraLerp = 0.1; // smooth follow

function updateCamera(dt) {
  if (!player) return;
  // Target: center player on screen
  const targetX = player.x - canvas.width / 2;
  const targetY = player.y - canvas.height / 2;
  camera.x += (targetX - camera.x) * cameraLerp;
  camera.y += (targetY - camera.y) * cameraLerp;
}

function clampToArena(entity) {
  if (!entity) return;
  const margin = entity.radius ?? 16;
  entity.x = Math.max(margin, Math.min(canvas.width - margin, entity.x));
  entity.y = Math.max(margin, Math.min(canvas.height - margin, entity.y));
}

const GRID_SIZE = UNITS_PER_METER; // 15px = 1m

function drawGrid() {
  // Draw in SCREEN space (viewport-fixed) so grid doesn't lag with camera lerp
  // Snap to integer screen pixels for crisp lines
  const worldLeft = camera.x;
  const worldTop = camera.y;

  const firstX = Math.floor(worldLeft / GRID_SIZE) * GRID_SIZE;
  const firstY = Math.floor(worldTop / GRID_SIZE) * GRID_SIZE;

  // Convert to screen coordinates, then snap to pixel grid
  let screenFirstX = Math.round((firstX - worldLeft) * camera.zoom);
  let screenFirstY = Math.round((firstY - worldTop) * camera.zoom);
  const step = Math.max(1, Math.round(GRID_SIZE * camera.zoom));

  ctx.lineWidth = 1 / camera.zoom; // hairline
  ctx.strokeStyle = '#1a1a20';

  // Vertical lines
  for (let sx = screenFirstX; sx <= canvas.width; sx += step) {
    ctx.beginPath();
    ctx.moveTo(sx + 0.5, 0); // +0.5 for crisp 1px lines
    ctx.lineTo(sx + 0.5, canvas.height);
    ctx.stroke();
  }
  // Horizontal lines
  for (let sy = screenFirstY; sy <= canvas.height; sy += step) {
    ctx.beginPath();
    ctx.moveTo(0, sy + 0.5);
    ctx.lineTo(canvas.width, sy + 0.5);
    ctx.stroke();
  }

  // Major lines every 5m
  const majorStep = step * 5;
  const majorFirstX = ((screenFirstX % majorStep) + majorStep) % majorStep;
  const majorFirstY = ((screenFirstY % majorStep) + majorStep) % majorStep;
  ctx.strokeStyle = '#2a2a35';
  ctx.lineWidth = 2 / camera.zoom;

  for (let sx = majorFirstX; sx <= canvas.width; sx += majorStep) {
    ctx.beginPath();
    ctx.moveTo(Math.round(sx) + 0.5, 0);
    ctx.lineTo(Math.round(sx) + 0.5, canvas.height);
    ctx.stroke();
  }
  for (let sy = majorFirstY; sy <= canvas.height; sy += majorStep) {
    ctx.beginPath();
    ctx.moveTo(0, Math.round(sy) + 0.5);
    ctx.lineTo(canvas.width, Math.round(sy) + 0.5);
    ctx.stroke();
  }
}


function updateWorld(dt, { withMission = false } = {}) {
  player.update(dt, inputHandler, projectiles, enemies, camera);
  clampToArena(player);
  updateCamera(dt);

  updateEnemies(dt, enemies, player, objective, projectiles);
  for (const enemy of enemies) {
    if (enemy.update && enemy.hp > 0) {
      clampToArena(enemy);
    }
  }

  if (withMission) {
    updateSpawns(dt);
    if (objective) objective.update(dt);
  }

  for (const projectile of projectiles) { projectile.update(dt, enemies); }
  for (const item of loot) { 
      const result = item.update(dt, player);
      if (result === 'collect') applyLootPickup(player, item);
  }

  const survivors = enemies.filter((enemy) => enemy.hp > 0);
    for (const dead of enemies.filter(e => e.hp <= 0)) {
      // Emit kill noise at death position (audible ~5m per wiki)
      if (player && !player.isSilenced) {
        player.lastNoisePosition = { x: dead.x, y: dead.y };
        player.lastNoiseTime = 0;
      }
      loot.push(...rollLootDrop(dead));
    }
    kills += enemies.length - survivors.length;
    enemies = survivors;
    setEnemies(enemies);
    loot = loot.filter(l => !l.collected && l.age < l.lifetime);
    projectiles = projectiles.filter((p) => p.active);
}

function missionFailed() {
  if (!player.alive) return true;
  return !!(objective && !objective.alive);
}

function missionWon() {
  if (!mission) return false;
  if (mission.id === 'exterminate') return kills >= mission.killQuota;
  if (mission.id === 'defense') return currentWave >= mission.waveLimit && enemies.length === 0 && waveEnemiesSpawned >= waveEnemiesTotal;
  return false;
}

function startMission(missionId) {
  mission = getMission(missionId);
  screen = 'playing';
  player = new Player(canvas.width / 2, canvas.height / 2);
  enemies = []; loot = []; projectiles = []; kills = 0; elapsed = 0;
  spawnTimer = 0; currentWave = 1; waveEnemiesSpawned = 0;
  waveEnemiesTotal = waveSize(mission, currentWave);
  waveTimer = 0;
  initSpawnSystem(canvas, player, enemies, mission, kills, waveEnemiesSpawned, waveEnemiesTotal, spawnTimer, currentWave, waveTimer);

  if (mission.objective) {
    objective = new CryoPod(canvas.width / 2 + 60, canvas.height / 2, mission.objective);
    player.x -= 60;
  } else {
    objective = null;
  }
  hud.reset();
  hud.setMission(mission);
  hud.setVisible(true);
  pauseMenu.close();
  menuMusic.stop();
}

function openMainMenu() {
  screen = 'main-menu';
  mainMenu.visible = true;
  simulacrumMenu.visible = false;
  pauseMenu.close();
  hud.setVisible(false);
}

function openMissionSelect() {
  screen = 'mission-select';
  mainMenu.visible = false;
  missionSelect.open(mission?.id);
  hud.setVisible(false);
}

function updateHud(dt) {
  hud.updateVitals(player, dt);
  hud.updateWeapon(player);
  hud.updateDev(player);
  if (player.isBleedingOut) return;
  let primary = '', detail = '', progress = null;
  if (mission.id === 'exterminate') {
    primary = `${mission.objectiveLabel} ${kills} / ${mission.killQuota}`;
    detail = `Enemies ${enemies.length} / ${mission.maxEnemies}`;
    progress = kills / mission.killQuota;
  } else if (mission.id === 'defense' || mission.id === 'survival') {
    primary = `${mission.objectiveLabel} ${currentWave}`;
    if (mission.waveLimit) primary += ` / ${mission.waveLimit}`;
    if (waveEnemiesSpawned < waveEnemiesTotal) {
      detail = `Enemies ${enemies.length} / ${mission.maxEnemies}`;
      progress = waveEnemiesSpawned / waveEnemiesTotal;
    } else {
      const isLastWave = mission.waveLimit && currentWave >= mission.waveLimit;
      detail = isLastWave ? 'Clear remaining enemies' : `Next wave in ${Math.max(0, (mission.waveBreak ?? 3) - waveTimer).toFixed(1)}s`;
      progress = isLastWave ? 1 : 0;
    }
    if (mission.id === 'defense' && objective) progress = objective.healthPercent;
  }
  hud.updateObjective(primary, detail, progress);
}

function gameLoop(timestamp) {
    if (gameExited) { drawExitScreen(); return; }
    if (!lastTimestamp) lastTimestamp = timestamp;
    const dt = Math.min(0.05, (timestamp - lastTimestamp) / 1000);
    lastTimestamp = timestamp;

    menuMusic.sync(screen, gameExited);

    if (screen === 'main-menu') {
      const choice = mainMenu.update(inputHandler, canvas);
      if (choice) {
        if (choice.action === 'start-mission') startMission(choice.mission);
        else if (choice.action === 'simulacrum') {
          screen = 'simulacrum';
          mainMenu.visible = false;
          player = new Player(canvas.width / 2, canvas.height / 2);
          enemies = []; loot = []; projectiles = []; kills = 0;
          mission = null; objective = null;
          hud.reset(); hud.setVisible(true);
        } else if (choice.action === 'world-builder') {
          window.open('world_builder.html?dev=1', '_blank');
        }
      }
      mainMenu.draw(ctx, canvas);
      requestAnimationFrame(gameLoop);
      return;
    }

    if (screen === 'simulacrum') {
      if (inputHandler.isKeyPressed('escape')) {
        if (simulacrumMenu.visible) simulacrumMenu.visible = false;
        else { openMainMenu(); requestAnimationFrame(gameLoop); return; }
      }
      if (inputHandler.isKeyPressed('p')) simulacrumMenu.toggle();
      const menuActive = simulacrumMenu.update(inputHandler, canvas, enemies, player);
      
      if (!menuActive) {
        updateWorld(dt);
        if (missionFailed()) { screen = 'failed'; hud.setVisible(false); }
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const enemy of enemies) enemy.draw(ctx);
      player.draw(ctx);
      for (const p of projectiles) p.draw(ctx);
      for (const l of loot) l.draw(ctx);
      hud.updateVitals(player, dt); hud.updateWeapon(player); hud.updateDev(player);
      hud.updateObjective('SIMULACRUM', 'Press P to open spawner · Esc to exit', null);
      simulacrumMenu.draw(ctx, canvas);
      requestAnimationFrame(gameLoop);
      return;
    }

    if (screen === 'mission-select') {
      if (inputHandler.isKeyPressed('escape')) openMainMenu();
      const chosen = missionSelect.update(inputHandler, canvas);
      if (chosen) startMission(chosen);
      else missionSelect.draw(ctx, canvas);
      requestAnimationFrame(gameLoop);
      return;
    }

    if (screen === 'failed' || screen === 'complete') {
      drawOutcomeScreen();
      if (inputHandler.isKeyPressed('m')) openMissionSelect();
      else if (inputHandler.isKeyPressed('enter') || inputHandler.isMouseClicked()) {
        if (mission) startMission(mission.id);
        else openMainMenu();
            requestAnimationFrame(gameLoop);
      return;
    }
  }

    if (inputHandler.isKeyPressed('escape')) pauseMenu.toggle();
    if (pauseMenu.visible) {
      const action = pauseMenu.update(inputHandler, canvas);
      if (action === 'resume') pauseMenu.close();
      else if (action === 'restart') startMission(mission.id);
      else if (action === 'abort') { pauseMenu.close(); openMainMenu(); }
    } else {
      elapsed += dt;
      updateWorld(dt, { withMission: true });
      if (missionFailed()) { screen = 'failed'; hud.setVisible(false); }
      else if (missionWon()) { screen = 'complete'; hud.setVisible(false); }
    }

  
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Apply camera transform
    ctx.save();
    ctx.translate(-camera.x, -camera.y);
    drawGrid();
    
    if (objective) objective.draw(ctx);
    for (const enemy of enemies) enemy.draw(ctx);
    if (player.alive || player.isBleedingOut) player.draw(ctx);
    for (const p of projectiles) p.draw(ctx);
    for (const l of loot) l.draw(ctx);
    
    ctx.restore();
    updateHud(dt);
    pauseMenu.draw(ctx, canvas);
    simulacrumMenu.draw(ctx, canvas);
    requestAnimationFrame(gameLoop);
}

function drawOutcomeScreen() {
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const win = screen === 'complete';
  ctx.fillStyle = win ? '#4ade80' : '#f87171';
  ctx.font = 'bold 48px system-ui, sans-serif';
  ctx.fillText(win ? 'MISSION COMPLETE' : 'MISSION FAILED', canvas.width / 2, canvas.height / 2 - 40);

  ctx.fillStyle = '#ffffff';
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText(win ? 'You survived the onslaught.' : 'Your Warframe was destroyed.', canvas.width / 2, canvas.height / 2 + 10);

  ctx.fillStyle = '#9aa0b4';
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('Press Enter to Retry · M for Mission Select', canvas.width / 2, canvas.height / 2 + 60);
  ctx.restore();
}

function drawExitScreen() {
  ctx.save();
  ctx.fillStyle = '#0a0a0c';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 32px system-ui';
  ctx.fillText('Thanks for playing Flatframe.', canvas.width / 2, canvas.height / 2 - 20);
  ctx.font = '18px system-ui';
  ctx.fillStyle = '#9aa0b4';
  ctx.fillText('Refresh the tab to play again.', canvas.width / 2, canvas.height / 2 + 30);
  ctx.restore();
}

openMainMenu();
requestAnimationFrame(gameLoop);
