import Player from './warframe/player.js';
import Lancer from './enemies/grineer/lancer.js';
import CryoPod from './missions/objective.js';
import Hud from './ui/hud.js';
import PauseMenu from './ui/menus/pause_menu.js';
import MissionSelect from './ui/menus/mission_select.js';
import Navigation from './ui/menus/star_chart.js';
import Arsenal from './ui/menus/arsenal.js';
import Profile from './ui/menus/profile.js';
import Settings from './ui/menus/settings.js';
import { MainMenu } from './ui/menus/main_menu.js';
import { SimulacrumMenu } from './ui/simulacrum/core/menu.js';
import WorkInProgressScreen from './ui/menus/work_in_progress.js';
import { InputHandler } from './engine/input_handler.js';
import { TouchControls, isTouchDevice } from './engine/touch_controls.js';
import { BackButton } from './ui/menus/back_button.js';
import { settings as settingsStore } from './engine/settings.js';
import { DamageNumberMode } from './combat/damage_numbers.js';
import { getMission, waveSize } from './missions/missions.js';
import { spawnEnemy, updateSpawns, initSpawnSystem, setEnemies } from './enemies/spawner.js';
import { audioManager } from './engine/audio.js';
import { createMenuMusic } from './engine/menu_music.js';
import { rollLootDrop, applyLootPickup } from './pickups/loot.js';
import { UNITS_PER_METER } from './engine/constants.js';
import { updateEnemies } from './enemies/ai_behavior.js';
import { damageNumbersManager } from './combat/damage_numbers.js';
import { initPrimaryWeapons } from './weapons/primary_weapon.js';
import { initSecondaryWeapons } from './weapons/secondary_weapon.js';
import { initMeleeWeapons } from './weapons/melee_weapon.js';

window.onerror = function (msg, url, lineNo, columnNo, error) {
  console.error('[GLOBAL ERROR]:', { msg, url, lineNo, columnNo, error });
  return false;
};
window.addEventListener('unhandledrejection', function (event) {
  console.error('[UNHANDLED REJECTION]:', event.reason);
});

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Initialize weapon data before creating Arsenal
const loading = window.loadingScreen ?? { set() {}, done() {}, fail() {} };
loading.set(0.4, 'Loading primary weapons…');
await initPrimaryWeapons();
loading.set(0.6, 'Loading secondary weapons…');
await initSecondaryWeapons();
loading.set(0.75, 'Loading melee weapons…');
await initMeleeWeapons();
loading.set(0.9, 'Preparing the Origin System…');

// Short screens (phones in landscape) render the canvas at a higher internal
// resolution and let CSS shrink it, so menus and the world are drawn smaller
// (and sharper on high-DPI phones). 1 = desktop size.
let uiScale = 1;
function resizeCanvas() {
  const h = window.innerHeight;
  uiScale = h < 600 ? Math.max(0.75, h / 560) : 1;
  canvas.width = Math.round(window.innerWidth / uiScale);
  canvas.height = Math.round(h / uiScale);
  document.documentElement.style.setProperty('--ui-scale', uiScale);
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

const menuMusic = createMenuMusic({ audio: audioManager, name: 'launcher_music' });
function unlockAudio() {
  audioManager.library.unlock();
  audioManager.ready().then(() => menuMusic.enable());
  window.removeEventListener('mousedown', unlockAudio);
  window.removeEventListener('keydown', unlockAudio);
}
window.addEventListener('mousedown', unlockAudio);
window.addEventListener('keydown', unlockAudio);

const inputHandler = new InputHandler(canvas);
// One close (×) button for every menu screen (acts like Escape); also handles Android's back gesture
new BackButton(inputHandler, {
  // Hidden during live gameplay (missions and the arena with the spawner closed); shown on menus and the spawner
  isVisible: () => !['playing', 'main-menu'].includes(screen) && !gameExited
    && !(screen === 'simulacrum' && !simulacrumMenu.visible),
  handlesSystemBack: () => screen !== 'main-menu',
});

// Apply player settings now and whenever they change on the Settings screen
let backgrounded = false;
function applySettings(v) {
  const lib = audioManager.library;
  lib.setVolume('master', v.masterVolume);
  lib.setVolume('music', v.musicVolume);
  lib.setVolume('sfx', v.sfxVolume);
  lib.setVolume('ui', v.uiVolume);
  lib.setVolume('ambience', v.ambienceVolume);
  lib.setMuted(v.muteAll || (v.muteInBackground && backgrounded));

  const modes = { Enhanced: DamageNumberMode.ENHANCED, Legacy: DamageNumberMode.LEGACY, Off: DamageNumberMode.OFF };
  damageNumbersManager.updateSettings({
    mode: modes[v.damageNumbers], scale: v.damageNumberScale,
    opacity: v.damageNumberOpacity, compact: v.compactDamageNumbers,
  });

  const root = document.documentElement.style;
  root.setProperty('--hud-opacity', v.hudOpacity);
  root.setProperty('--touch-opacity', v.touchOpacity);
  root.setProperty('--touch-scale', v.touchSize);
  document.body.classList.toggle('hide-debug', !v.showDebugInfo);
}
settingsStore.subscribe(applySettings);
document.addEventListener('visibilitychange', () => {
  backgrounded = document.hidden;
  applySettings(settingsStore.values);
});
const touchSetting = settingsStore.get('touchControls');
if (touchSetting === 'On' || (touchSetting === 'Auto' && isTouchDevice())) {
  new TouchControls(inputHandler, {
    // Live play (missions and the Simulacrum arena with the spawner closed): stick aim and moves apply
    isPlaying: () => (screen === 'playing' && !pauseMenu.visible) || (screen === 'simulacrum' && !simulacrumMenu.visible),
    // Triple-tap exits landscape anywhere outside live gameplay: every menu, the pause screen, mission results
    mode: () => {
      if (screen === 'simulacrum') return simulacrumMenu.visible ? 'sim-menu' : 'sim-play';
      return screen === 'playing' && !pauseMenu.visible ? 'play' : 'menu';
    },
    canExitLandscape: () => !(screen === 'playing' && !pauseMenu.visible) && !(screen === 'simulacrum' && !simulacrumMenu.visible),
    getPlayerScreenPos: () => (player ? { x: player.x - camera.x, y: player.y - camera.y } : null),
  });
}
const hud = new Hud();
const pauseMenu = new PauseMenu();
const missionSelect = new MissionSelect();
const navigation = new Navigation(startMission);
// Opens the Simulacrum test arena (from the Navigation screen button or the main menu)
function startSimulacrum() {
  screen = 'simulacrum';
  mainMenu.visible = false;
  navigation.open = false;
  player = new Player(canvas.width / 2, canvas.height / 2);
  enemies = []; loot = []; projectiles = []; kills = 0;
  mission = null; objective = null;
  hud.reset();
  hud.setMission({ name: 'Simulacrum', id: 'simulacrum' }); // replaces the last mission's title
  hud.setVisible(true);
}
navigation.onSimulacrum = startSimulacrum;
navigation.onClose = () => {
  openMainMenu();
};
navigation.onTabSwitch = (tab) => {
  if (tab === 'arsenal') {
    screen = 'arsenal';
    arsenal.open({
      primary: player?.primaryWeapon?.name,
      secondary: player?.secondaryWeapon?.name,
      melee: player?.meleeWeapon?.name,
    }, 'navigation');
    navigation.closeScreen();
    hud.setVisible(false);
  } else if (tab === 'profile') {
    profile.openScreen();
    screen = 'profile';
    navigation.closeScreen();
    hud.setVisible(false);
  } else if (tab === 'settings') {
    settings.openScreen();
    screen = 'settings';
    navigation.closeScreen();
    hud.setVisible(false);
  }
};
const arsenal = new Arsenal();
arsenal.onTabSwitch = (tab) => {
  if (tab === 'navigation') {
    navigation.handleResize(canvas);
    navigation.openScreen();
    screen = 'navigation';
    arsenal.close();
    hud.setVisible(false);
  } else if (tab === 'profile') {
    profile.openScreen();
    screen = 'profile';
    arsenal.close();
    hud.setVisible(false);
  } else if (tab === 'settings') {
    settings.openScreen();
    screen = 'settings';
    arsenal.close();
    hud.setVisible(false);
  }
};
const profile = new Profile(() => {
  navigation.handleResize(canvas);
  navigation.openScreen();
  screen = 'navigation';
  hud.setVisible(false);
});
profile.onTabSwitch = (tab) => {
  if (tab === 'arsenal') {
    screen = 'arsenal';
    arsenal.open({
      primary: player?.primaryWeapon?.name,
      secondary: player?.secondaryWeapon?.name,
      melee: player?.meleeWeapon?.name,
    }, 'navigation');
    profile.closeScreen();
    hud.setVisible(false);
  } else if (tab === 'navigation') {
    navigation.openScreen();
    screen = 'navigation';
    profile.closeScreen();
    hud.setVisible(false);
  } else if (tab === 'settings') {
    settings.openScreen();
    screen = 'settings';
    profile.closeScreen();
    hud.setVisible(false);
  } else {
    wipScreen.open('WORK IN PROGRESS', `${tab.charAt(0).toUpperCase() + tab.slice(1)} screen not yet implemented.`, 'Check back in a future update.');
  }
};

const settings = new Settings(() => {
  navigation.handleResize(canvas);
  navigation.openScreen();
  screen = 'navigation';
  hud.setVisible(false);
});
settings.onTabSwitch = (tab) => {
  if (tab === 'arsenal') {
    screen = 'arsenal';
    arsenal.open({
      primary: player?.primaryWeapon?.name,
      secondary: player?.secondaryWeapon?.name,
      melee: player?.meleeWeapon?.name,
    }, 'navigation');
    settings.closeScreen();
    hud.setVisible(false);
  } else if (tab === 'navigation') {
    navigation.openScreen();
    screen = 'navigation';
    settings.closeScreen();
    hud.setVisible(false);
  } else if (tab === 'profile') {
    profile.openScreen();
    screen = 'profile';
    settings.closeScreen();
    hud.setVisible(false);
  } else {
    wipScreen.open('WORK IN PROGRESS', `${tab.charAt(0).toUpperCase() + tab.slice(1)} screen not yet implemented.`, 'Check back in a future update.');
  }
  };
  const mainMenu = new MainMenu();
  const simulacrumMenu = new SimulacrumMenu();
  const wipScreen = new WorkInProgressScreen(() => {
    if (screen === 'arsenal') {
      navigation.openScreen();
      screen = 'navigation';
      hud.setVisible(false);
    } else if (screen === 'profile') {
      navigation.openScreen();
      screen = 'navigation';
      hud.setVisible(false);
    } else if (screen === 'settings') {
      navigation.openScreen();
      screen = 'navigation';
      hud.setVisible(false);
    } else {
      navigation.openScreen();
      screen = 'navigation';
      hud.setVisible(false);
    }
  });

  // Expose game state globally for debugging
  window.game = {
    player: () => player,
    enemies: () => enemies,
    simulacrum: () => simulacrumMenu,
    screen: () => screen,
    setScreen: (s) => screen = s,
    navigation: () => navigation,
    arsenal: () => arsenal,
    profile: () => profile,
    settings: () => settings,
    wipScreen: () => wipScreen,
    mainMenu: () => mainMenu,
    inputHandler: () => inputHandler
  };

  // Damage numbers layer
const damageLayer = document.getElementById('damage-numbers-layer');
damageNumbersManager.setLayer(damageLayer);

// World-to-screen transform (camera + canvas)
damageNumbersManager.setTransform((worldX, worldY) => {
  // Camera transform: world point -> screen point = world - camera
  // Camera is already: camera.x ≈ player.x - canvas.width/2
  // Canvas pixels -> CSS pixels for the DOM layer (differs when uiScale < 1)
  const screenX = (worldX - camera.x) * uiScale;
  const screenY = (worldY - camera.y) * uiScale;
  return { x: screenX, y: screenY };
});

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
  // Defense & Survival are endless — they only "win" when player manually extracts
  // (handled via UI, not automatic). Return false here; completion screen triggered by extraction choice.
  return false;
}

// Async map loader for mission maps (browser-compatible)
// Fetches from the server's static file server
// mission.map already includes the .json extension (e.g. 'exterminate_ship.json')
async function loadMissionMap(missionMap) {
  // Strip .json extension for the fetch path, then add it back
  const baseName = missionMap.replace(/\.json$/, '');
  const response = await fetch(`/src/missions/maps/${baseName}.json`);
  return response.json();
}

async function startMission(missionId) {
  mission = getMission(missionId);
  screen = 'playing';
  player = new Player(canvas.width / 2, canvas.height / 2, arsenal.currentLoadout);
  enemies = []; loot = []; projectiles = []; kills = 0; elapsed = 0;
  spawnTimer = 0; currentWave = 1; waveEnemiesSpawned = 0;
  waveEnemiesTotal = waveSize(mission, currentWave);
  waveTimer = 0;

  // Initialize NavMesh from mission map
      const mapData = await loadMissionMap(mission.map);
    const tileMapModule = await import('./engine/map/tilemap.js');
    const NavMesh = (await import('./engine/navigation/navmesh.js')).NavMesh;
    const tileMap = new tileMapModule.TileMap(mapData.tiles);
    const navMesh = new NavMesh(tileMap);
    window.navMesh = navMesh; // Expose globally for spawner

    initSpawnSystem(canvas, player, enemies, mission, kills, waveEnemiesSpawned, waveEnemiesTotal, spawnTimer, currentWave, waveTimer);

    // Assign NavMesh to all existing enemies
    for (const enemy of enemies) {
      enemy.navMesh = navMesh;
    }

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
  navigation.handleResize(canvas);
  navigation.openScreen();
  screen = 'navigation';
  mainMenu.visible = false;
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
    // Simulacrum spawner is drawn on the canvas: lift the canvas above the HUD while it is open,
    // so the HUD sits underneath the spawner UI (and is dimmed by its backdrop)
    document.body.classList.toggle('sim-menu-open', screen === 'simulacrum' && simulacrumMenu.visible);

    if (screen === 'main-menu') {
                  const choice = mainMenu.update(inputHandler, canvas);
                  if (choice) {
                    if (choice.action === 'start-mission') startMission(choice.mission);
                    else if (choice.action === 'arsenal') {
                                  arsenal.open({
                                    primary: player?.primaryWeapon?.name,
                                    secondary: player?.secondaryWeapon?.name,
                                    melee: player?.meleeWeapon?.name,
                                  }, 'main-menu');
                                  screen = 'arsenal';
                                  mainMenu.visible = false;
                                }
                else if (choice.action === 'navigation') {
                                  navigation.handleResize(canvas);
                                  navigation.openScreen();
                                  screen = 'navigation';
                                  mainMenu.visible = false;
                                  hud.setVisible(false);
                                }
                else if (choice.action === 'profile') {
                                  profile.openScreen();
                                  screen = 'profile';
                                  mainMenu.visible = false;
                                  hud.setVisible(false);
                                }
                else if (choice.action === 'settings') {
                                  settings.openScreen();
                                  screen = 'settings';
                                  mainMenu.visible = false;
                                  hud.setVisible(false);
                                }
                else if (choice.action === 'simulacrum') {
                  startSimulacrum();
                             }
              mainMenu.draw(ctx, canvas);
              requestAnimationFrame(gameLoop);
              return;
            }
    } // end if (screen === 'main-menu')

    if (screen === 'simulacrum') {
      if (inputHandler.isKeyPressed('escape')) {
        if (simulacrumMenu.visible) simulacrumMenu.visible = false;
        else { openMainMenu(); requestAnimationFrame(gameLoop); return; }
      }
      if (inputHandler.isKeyPressed('p')) simulacrumMenu.toggle();
      const menuActive = simulacrumMenu.update(inputHandler, canvas, (enemy) => enemies.push(enemy), player);

      if (!menuActive) {
        if (simulacrumMenu.pauseAI) {
          // AI paused: enemies stay still and do not shoot; you keep moving and can test freely
          player.update(dt, inputHandler, projectiles, enemies, camera);
          clampToArena(player);
          updateCamera(dt);
          for (const projectile of projectiles) projectile.update(dt, enemies);
        } else {
          updateWorld(dt);
        }
        damageNumbersManager.update(dt);
        if (missionFailed()) { screen = 'failed'; hud.setVisible(false); }
      }
      if (simulacrumMenu.pauseAI) {
        // Invulnerable while AI is paused
        const hc = player.healthComponent;
        hc.hp = hc.maxHp;
        hc.shield = hc.maxShield;
        player.isBleedingOut = false;
        player.awaitingRevive = false;
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

    if (screen === 'navigation') {
              if (inputHandler.isKeyPressed('escape')) {
                if (navigation.selectedMission) { 
                  navigation.selectedMission = null; 
                } else if (navigation.selectedPlanet) { 
                  navigation.selectedPlanet = null; 
                } else { 
                  openMainMenu(); 
                }
              }
              if (inputHandler.isMouseClicked()) {
                const mouse = inputHandler.getMousePos();
                navigation.handleClick(mouse.x, mouse.y);
              }
              navigation.update(dt, inputHandler);
              navigation.draw(ctx);
              requestAnimationFrame(gameLoop);
              return;
            }

        if (screen === 'arsenal') {
                                  const result = arsenal.update(inputHandler, canvas);
                                  if (result?.action === 'close') {
                                              screen = result.returnScreen;
                                              if (screen === 'main-menu') {
                                                  mainMenu.visible = true;
                                                  player = null; // cleanup
                                              } else if (screen === 'navigation') {
                                                  navigation.handleResize(canvas);
                                                  navigation.openScreen();
                                                  hud.setVisible(false);
                                              }
                                            }
                                  if (inputHandler.isMouseClicked()) {
                                    const mouse = inputHandler.getMousePos();
                                    arsenal.handleClick(mouse.x, mouse.y);
                                  }
                                  arsenal.draw(ctx, canvas);
                                  requestAnimationFrame(gameLoop);
                                  return;
                                                              }
                
                                                          if (screen === 'wip') {
                                                                    wipScreen.update(dt, inputHandler);
                                                                    if (inputHandler.isMouseClicked()) {
                                                                      const mouse = inputHandler.getMousePos();
                                                                      wipScreen.handleClick(mouse.x, mouse.y);
                                                                    }
                                                                    wipScreen.draw(ctx, canvas);
                                                                    requestAnimationFrame(gameLoop);
                                                                    return;
                                                                  }

                                              if (screen === 'profile') {
                              profile.update(dt, inputHandler);
                              if (inputHandler.isMouseClicked()) {
                                const mouse = inputHandler.getMousePos();
                                profile.handleClick(mouse.x, mouse.y);
                              }
                              profile.draw(ctx);
                              requestAnimationFrame(gameLoop);
                              return;
                            }

                        if (screen === 'settings') {
                              settings.update(dt, inputHandler);
                              if (inputHandler.isMouseClicked()) {
                                const mouse = inputHandler.getMousePos();
                                settings.handleClick(mouse.x, mouse.y);
                              }
                              settings.draw(ctx);
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

    if (inputHandler.isKeyPressed('escape')) { pauseMenu.missionName = mission?.name ?? ''; pauseMenu.toggle(); }
    hud.setVisible(!pauseMenu.visible); // the pause screen covers the whole view, like the main menu
    if (pauseMenu.visible) {
      const action = pauseMenu.update(inputHandler, canvas);
      if (action === 'resume') pauseMenu.close();
      else if (action === 'restart') startMission(mission.id);
      else if (action === 'abort') {
        pauseMenu.close();
        openMainMenu();
        player = null; // stop the rest of this frame (and later ones) from updating the mission HUD
        requestAnimationFrame(gameLoop);
        return;
      }
    } else {
          elapsed += dt;
          updateWorld(dt, { withMission: true });
          damageNumbersManager.update(dt);
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
requestAnimationFrame((t) => {
  gameLoop(t);
  loading.done(); // hide once the first frame (the main menu) is on screen
});
