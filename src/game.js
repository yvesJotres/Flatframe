import Player from './warframe/player.js';
import Lancer from './enemies/grineer/lancer.js';
import CryoPod from './missions/objective.js';
import Hud from './ui/hud.js';
import PauseMenu from './ui/menus/pause_menu.js';
import MissionSelect from './ui/menus/mission_select.js';
import Navigation from './ui/menus/star_chart.js';
import { startAccount } from './account/sections.js';
import Arsenal, { initMods } from './ui/menus/arsenal.js';
import Profile from './ui/menus/profile.js';
import Settings from './ui/menus/settings.js';
import { MainMenu } from './ui/menus/main_menu.js';
import { SimulacrumMenu } from './ui/simulacrum/core/menu.js';
import WorkInProgressScreen from './ui/menus/work_in_progress.js';
import { InputHandler } from './engine/input_handler.js';
import { TouchControls, isTouchDevice } from './engine/touch_controls.js';
import { GamepadControls } from './engine/gamepad.js';
import { startUpdateWatch } from './engine/update_prompt.js';
import { BackButton } from './ui/menus/back_button.js';
import { settings as settingsStore } from './engine/settings.js';
import { FrameStats, updateFpsReadout } from './engine/frame_stats.js';
import { DamageNumberMode } from './combat/damage_numbers.js';
import { getMission, waveSize } from './missions/missions.js';
import { spawnEnemy, updateSpawns, initSpawnSystem, setEnemies, setSpawnBounds, setSpawnPoints, waveState, setLevelRange, continueRotation } from './enemies/spawner.js';
import { buildLootables, nearestUsableLocker } from './pickups/lootable.js';
import { drawMapTiles, drawGate } from './engine/map/tile_art.js';
import { drawVisualEffect, EFFECT_NAMES } from './engine/visual_effects.js';
import { gameNow, advanceGameClock } from './engine/game_clock.js';
import { audioManager } from './engine/audio.js';
import { createMenuMusic } from './engine/menu_music.js';
import { rollLootDrop, applyLootPickup } from './pickups/loot.js';
import { resetMissionStats, missionStats, recordLoot, recordAffinity } from './missions/mission_stats.js';
import { awardKillAffinity } from './progression/progression.js';
import { generateMissionMap } from './missions/generator/tile_generator.js';
import { generateArenaMap } from './missions/generator/arena.js';
import { collision } from './engine/collision.js';
import { UNITS_PER_METER } from './engine/constants.js';
import { updateEnemies, setHearingRooms, setBodies } from './enemies/ai_behavior.js';
import { setPatrolProfile } from './enemies/patrol.js';
import { damageNumbersManager } from './combat/damage_numbers.js';
import { initPrimaryWeapons } from './weapons/primary_weapon.js';
import { initSecondaryWeapons } from './weapons/secondary_weapon.js';
import { initMeleeWeapons } from './weapons/melee_weapon.js';
import { initWarframes } from './warframe/warframes.js';
import { wallet } from './economy/wallet.js';
import { startCurrencyToasts } from './ui/currency_toast.js';
import { installDebugCheats } from './debug/cheats.js';
import { openUserPanel } from './ui/user_panel.js';
import { openLoginScreen } from './ui/login_screen.js';
import { openSquad, closeSquad, isSquadOpen, syncModeDrop, updateModeList, SQUAD_MODE_BOX } from './ui/squad.js';
import { liveModeBox } from './ui/menus/top_bar.js';
import { setMenuPointer } from './ui/menus/menu_style.js';
import { installLayoutEditor } from './debug/layout_editor.js';
import { isSignedIn } from './user/auth.js';
import { ensureAdminUser } from './user/accounts.js';
import { creditReward } from './economy/rewards.js';

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
loading.set(0.8, 'Loading warframes…');
await initWarframes();
await initMods();
startAccount();
loading.set(0.9, 'Preparing the Origin System…');

// Short screens (phones in landscape) render the canvas at a higher internal
// resolution and let CSS shrink it, so menus and the world are drawn smaller
// (and sharper on high-DPI phones). 1 = desktop size.
let uiScale = 1;
function resizeCanvas() {
  // Size from the container, which covers the whole screen (window.innerHeight is short on iPad full-screen apps)
  const box = canvas.parentElement.getBoundingClientRect();
  const w = box.width || window.innerWidth;
  const h = box.height || window.innerHeight;
  uiScale = h < 600 ? Math.max(0.75, h / 560) : 1;
  canvas.width = Math.round(w / uiScale);
  canvas.height = Math.round(h / uiScale);
  document.documentElement.style.setProperty('--ui-scale', uiScale);
}
window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', resizeCanvas);
window.visualViewport?.addEventListener('resize', resizeCanvas);
resizeCanvas();

const menuMusic = createMenuMusic({ audio: audioManager, name: 'launcher_music' });
function unlockAudio() {
  audioManager.library.unlock();
  audioManager.ready().then(() => menuMusic.enable());
  window.removeEventListener('mousedown', unlockAudio);
  window.removeEventListener('keydown', unlockAudio);
  window.removeEventListener('touchend', unlockAudio);
  window.removeEventListener('gamepadpress', unlockAudio);
}
window.addEventListener('mousedown', unlockAudio);
window.addEventListener('keydown', unlockAudio);
window.addEventListener('touchend', unlockAudio);
window.addEventListener('gamepadpress', unlockAudio);

const inputHandler = new InputHandler(canvas);
// One close (×) button for every menu screen (acts like Escape); also handles Android's back gesture
startCurrencyToasts();
// Console cheats (src/debug/cheats.js): the hooks reach into this file's mission state
installDebugCheats({
  winMission: () => {
    if (screen !== 'playing' || !mission) return 'No mission running';
    awardMissionCredits();
    showOutcome('complete');
    return 'Mission won';
  },
  startMap: () => {
    startMission('exterminate_e_prime'); // the generated map
    return 'Starting the generated map';
  },
  killAll: () => {
    for (const e of enemies) e.takeDamage(1e9); // dead enemies drop loot on the next update
    return `Killed ${enemies.length} enemies`;
  },
});
new BackButton(inputHandler, {
  // Hidden during live gameplay (missions and the arena with the spawner closed); shown on menus and the spawner
  // The Arsenal draws its own Back button in the bottom-right corner instead
  isVisible: () => !['playing', 'main-menu', 'arsenal', 'navigation'].includes(screen) && !gameExited
    && !(screen === 'simulacrum' && !simulacrumMenu.visible),
  handlesSystemBack: () => screen !== 'main-menu',
});

// Apply player settings now and whenever they change on the Settings screen
let backgrounded = false;
// Set by the Max Framerate and Field of View options (read by applySettings and the game loop)
let frameCapMs = 0; // minimum time between frames (0 = no cap)
let fovZoom = 1;
let smoothing = true; // Anti-Aliasing option: smooth image scaling on the canvas
// Film grain: a full-screen layer of animated noise (created the first time the option is turned on)
let grainLayer = null;
function setFilmGrain(on) {
  if (on && !grainLayer) {
    grainLayer = document.createElement('div');
    grainLayer.setAttribute('aria-hidden', 'true');
    const noise = document.createElement('canvas');
    noise.width = noise.height = 128;
    const nctx = noise.getContext('2d');
    const img = nctx.createImageData(128, 128);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 40;
    }
    nctx.putImageData(img, 0, 0);
    grainLayer.style.cssText = `position:fixed;inset:0;pointer-events:none;z-index:45;background-image:url(${noise.toDataURL()});mix-blend-mode:overlay;opacity:0.5;animation:film-grain 0.4s steps(4) infinite;`;
    document.body.appendChild(grainLayer);
  }
  if (grainLayer) grainLayer.style.display = on ? 'block' : 'none';
}
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
  document.body.classList.toggle('show-fps', v.showFps);

  // Interface and video
  document.body.classList.toggle('hide-hud', !v.showHud);
  root.setProperty('--hud-scale', v.hudScale / 100);
  canvas.style.filter = `brightness(${v.brightness / 50}) contrast(${v.contrast / 50})`; // 50 is normal
  // Graphics: how the image is scaled, the smoothing, film grain and the window mode
  canvas.style.imageRendering = v.upscalingMethod === 'None' ? 'pixelated' : 'auto';
  smoothing = v.antiAliasing !== 'Off';
  setFilmGrain(!!v.filmGrain);
  if (v.displayMode === 'Windowed' && document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  if (v.displayMode !== 'Windowed' && !document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {}); // needs a click first
  inputHandler.thumbBack = !!v.mouseThumbBack; // the mouse's thumb button acts as Back
  // Video: the frame cap and the field of view (wider view = zoomed out)
  frameCapMs = v.maxFramerate === 'Unlimited' ? 0 : 1000 / Number(v.maxFramerate);
  fovZoom = 90 / v.fieldOfView;
}
settingsStore.subscribe(applySettings);
document.addEventListener('visibilitychange', () => {
  backgrounded = document.hidden;
  applySettings(settingsStore.values);
});
// Live play (missions and the Simulacrum arena with the spawner closed): stick aim and moves apply
const isLivePlay = () => (screen === 'playing' && !pauseMenu.visible) || (screen === 'simulacrum' && !simulacrumMenu.visible);
startUpdateWatch(() => screen !== 'playing' && screen !== 'simulacrum'); // the update prompt waits out fights
// Bluetooth gamepad: idle until a pad connects (see engine/gamepad.js)
new GamepadControls(inputHandler, {
  isPlaying: isLivePlay,
  getPlayerScreenPos: () => (player ? { x: player.x - camera.x, y: player.y - camera.y } : null),
  isDowned: () => !!player && !!player.isBleedingOut,
  // X interacts instead of reloading while something usable is in reach (see gamepad.js actionFor)
  canInteract: () => isLivePlay() && !!player && (!!nearestUsableLocker(lockers, player) || !!finisherTargetNow()),
});
const touchSetting = settingsStore.get('touchControls');
if (touchSetting === 'On' || (touchSetting === 'Auto' && isTouchDevice())) {
  new TouchControls(inputHandler, {
    isPlaying: isLivePlay,
    mode: () => {
      if (screen === 'simulacrum') return simulacrumMenu.visible ? 'sim-menu' : 'sim-play';
      return screen === 'playing' && !pauseMenu.visible ? 'play' : 'menu';
    },
    getPlayerScreenPos: () => (player ? { x: player.x - camera.x, y: player.y - camera.y } : null),
    getPlayerWorldPos: () => (player ? { x: player.x, y: player.y } : null),
    getEnemies: () => enemies,
    autoAim: () => settingsStore.get('touchAutoAim') === 'On',
    isMeleeEquipped: () => !!player && player.currentWeapon === player.meleeWeapon,
  });
}
const hud = new Hud();
const pauseMenu = new PauseMenu();
const missionSelect = new MissionSelect();
const navigation = new Navigation(startMission);
installLayoutEditor(navigation); // debug tool: drag missions to set their positions
// Opens the Simulacrum test arena (from the Navigation screen button or the main menu)
function startSimulacrum() {
  screen = 'simulacrum';
  mainMenu.visible = false;
  navigation.open = false;
  player = new Player(canvas.width / 2, canvas.height / 2);
  enemies = []; loot = []; projectiles = []; kills = 0;
  mission = null; objective = null;
  // No map: nothing from an earlier mission may block movement here
  arenaBounds = null; mapWalls = []; setSpawnBounds(null); setSpawnPoints(null); setHearingRooms(null); setPatrolProfile(null); collision.clear();
  lockers = []; containers = []; pads = []; gates = []; missionNavMesh = null;
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
arsenal.onProfile = () => openUserPanel();
// The squad panel: one panel for every squad icon. Anchored under the squad-mode icon, so it is small here.
navigation.onSquad = (anchor) => openSquad({ size: 'small', anchor });
arsenal.onSquad = (anchor) => openSquad({ size: 'small', anchor });
ensureAdminUser();
// Plain HTTP (e.g. the iPad over Tailscale) can't hash passwords, so sign-in is skipped there
if (window.isSecureContext && !isSignedIn()) openLoginScreen();
const profile = new Profile(() => {
  openMainMenu();
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

// Settings can be opened from the pause menu during a mission; closing it then returns to the paused mission
let settingsFromPause = false;
const settings = new Settings(() => {
  if (settingsFromPause) {
    settingsFromPause = false;
    screen = 'playing';
    pauseMenu.open();
    return;
  }
  openMainMenu();
});
settings.onTabSwitch = (tab) => {
  if (settingsFromPause) return; // no other screens from inside a mission
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
  mainMenu.onSquad = (anchor) => openSquad({ size: 'small', anchor }); // same panel as navigation and Arsenal
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
let missionNode = null; // { planet, node } of the star-chart node being played, for marking it complete on a win
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

// Generated maps set their own bounds and walls (see loadMissionMap); other maps keep the canvas as the arena
let arenaBounds = null;
let mapWalls = [];
let mapWallKeys = null; // the wall tiles as "gx,gy" keys, for the high-definition tile art
let gates = []; // doorway gates of a generated map (pickups/lootable.js Gate)
let missionNavMesh = null; // the navmesh of the current mission, so gates can block its cells
let mapTileSize = 0;
// Props of a generated map: lockers and breakable containers (both solid), and the objective and exit pads
let lockers = [];
let containers = [];
let pads = [];

function clampToArena(entity) {
  if (!entity) return;
  const margin = entity.radius ?? 16;
  const width = arenaBounds?.width ?? canvas.width;
  const height = arenaBounds?.height ?? canvas.height;
  entity.x = Math.max(margin, Math.min(width - margin, entity.x));
  entity.y = Math.max(margin, Math.min(height - margin, entity.y));
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


// Draws the world through the camera. Missions and the Simulacrum share this, so they look and behave the same.
function renderWorld() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(-camera.x, -camera.y);
  drawGrid();
  ctx.fillStyle = '#2a2f3d';
  if (arenaBounds && mapWallKeys) {
    // Generated maps: high-definition floor and wall tiles, drawn only where the camera sees them
    drawMapTiles(ctx, { tileSize: mapTileSize, walls: mapWallKeys, bounds: arenaBounds }, { x: camera.x, y: camera.y, w: canvas.width, h: canvas.height });
  } else {
    ctx.fillStyle = '#2a2f3d';
    for (const wall of mapWalls) ctx.fillRect(wall.x, wall.y, mapTileSize, mapTileSize);
  }
  for (const g of gates) drawGate(ctx, g);
  // Props (settings in src/engine/visual_effects.js)
  for (const p of pads) drawVisualEffect(EFFECT_NAMES.PAD, ctx, p);
  // Survival: life support capsules waiting to be picked up
  for (const c of capsules) drawVisualEffect(EFFECT_NAMES.CAPSULE, ctx, c);
  // Extraction appears once the kill quota is reached (Exterminate) or the 5 minutes pass (Survival)
  if (extractionOpen() && extraction) drawVisualEffect(EFFECT_NAMES.PAD, ctx, { x: extraction.x, y: extraction.y, role: 'exit' });
  for (const l of lockers) drawVisualEffect(EFFECT_NAMES.LOCKER, ctx, { ...l.rect, kind: l.kind, facing: l.facing, opened: l.opened });
  for (const c of containers) drawVisualEffect(EFFECT_NAMES.CONTAINER, ctx, { ...c.rect, kind: c.kind, hpFraction: c.hp / c.maxHp, flash: c.flash });
  // Names above containers, like an enemy's label; containers also show their health
  for (const c of containers) drawVisualEffect(EFFECT_NAMES.PROP_LABEL, ctx, { x: c.x, y: c.rect.y - 24, text: c.name, hpFraction: c.hp / c.maxHp });
  const usable = player ? nearestUsableLocker(lockers, player) : null;
  if (usable) drawVisualEffect(EFFECT_NAMES.INTERACT_PROMPT, ctx, { x: usable.x, y: usable.rect.y - 22, text: usable.prompt() });
  // A knocked-down enemy in reach: X finishes it (the same kind of prompt as a locker)
  const finish = !usable && player ? finisherTargetNow() : null;
  if (finish) drawVisualEffect(EFFECT_NAMES.INTERACT_PROMPT, ctx, { x: finish.x, y: finish.y - finish.radius - 22, text: '[X] FINISH' });

  if (objective) objective.draw(ctx);
  for (const body of corpses) drawVisualEffect(EFFECT_NAMES.CORPSE, ctx, { ...body, fade: body.age > CORPSE_SECONDS - 1 ? CORPSE_SECONDS - body.age : 1 });
  for (const enemy of enemies) enemy.draw(ctx);
  if (player.alive || player.isBleedingOut) player.draw(ctx);
  for (const p of projectiles) p.draw(ctx);
  for (const l of loot) l.draw(ctx);

  ctx.restore();
}

// Lockers open on X; containers break when their hit points run out and give their loot
function finisherTargetNow() {
  return player && player.meleeWeapon ? player.meleeWeapon.finisherTargetFor(player, enemies) : null;
}

// Opens or closes a gate. Open, it is not solid and its navmesh cells are free; closed, it blocks walking, bullets,
// sight and paths
function setGateOpen(gate, open) {
  gate.open = open;
  if (open) collision.removeSolid(gate.rect);
  else collision.addSolid(gate.rect);
  missionNavMesh?.setBlocked(gate.rect, !open);
  audioManager.play('loot_pick', 0.5); // placeholder: no door sound yet
}

function updateLootables(dt) {
  // Gates open and close by themselves around the Warframe (pickups/lootable.js Gate)
  if (player) for (const g of gates) { const wantOpen = g.update(dt, player); if (wantOpen !== g.open) setGateOpen(g, wantOpen); }
  if (player && player.alive && !player.isBleedingOut && inputHandler.isKeyPressed('x')) {
    const locker = nearestUsableLocker(lockers, player);
    const downed = !locker ? finisherTargetNow() : null;
    if (downed) {
      player.meleeWeapon.finish(player, downed, enemies); // X on a knocked-down enemy: a ground finisher
    } else if (locker) {
      const result = locker.interact();
      loot.push(...result.drops);
      if (result.opened) audioManager.play('loot_pick');
      if (result.opened && isSurvival()) lifeSupport = Math.min(100, lifeSupport + SURVIVAL.moduleGain); // a locker holds a module
    }
  }
  for (const c of containers) c.update(dt);
  const broken = containers.filter((c) => c.broken);
  if (broken.length) {
    for (const c of broken) {
      loot.push(...c.drops());
      collision.removeSolid(c.rect);
      if (isSurvival() && Math.random() < SURVIVAL.containerModuleChance) lifeSupport = Math.min(100, lifeSupport + SURVIVAL.moduleGain);
    }
    containers = containers.filter((c) => !c.broken);
  }
}

function updateWorld(dt, { withMission = false } = {}) {
  player.breakables = containers; // melee can break containers
  player.update(dt, inputHandler, projectiles, enemies, camera);
  clampToArena(player);
  collision.resolveCircle(player); // walls and props stop the Warframe
  updateCamera(dt);

  // Bodies stay for CORPSE_SECONDS, then go
  for (const c of corpses) c.age += dt;
  corpses = corpses.filter((c) => c.age < CORPSE_SECONDS);
  setBodies(corpses);
  updateEnemies(dt, enemies, player, objective, projectiles);
  for (const enemy of enemies) {
    if (enemy.update && enemy.hp > 0) {
      clampToArena(enemy);
      collision.resolveCircle(enemy);
    }
  }

  if (withMission) {
    updateSpawns(dt);
    // The spawner owns the wave count; copy it so the HUD and the wave rules read the same numbers
    const ws = waveState();
    if (ws) ({ currentWave, waveEnemiesSpawned, waveEnemiesTotal, waveTimer } = ws);
    if (ws?.rotationChoice && screen === 'playing') enterRotation();
    if (objective) objective.update(dt);
  }

  // Bullets can hit enemies and also break containers
  const hittables = containers.length ? enemies.concat(containers) : enemies;
  for (const projectile of projectiles) { projectile.update(dt, hittables); }
  updateLootables(dt);
  // Enemies that are not engaged rush to the extraction point once it is open (wiki)
  // Unengaged enemies rush the extraction once it is open, and in Defense the cryopod (wiki)
  const rush = extractionOpen() ? extraction : objective?.alive ? objective : null;
  for (const enemy of enemies) enemy.rushTarget = rush;
  updateNoKillTimer();
  updateSurvival(dt);
  for (const item of loot) {
      const result = item.update(dt, player);
      if (result === 'collect') {
        applyLootPickup(player, item);
        recordLoot(item.type, item.amount ?? 1);
      }
  }

  const survivors = enemies.filter((enemy) => enemy.hp > 0);
    for (const dead of enemies.filter(e => e.hp <= 0)) {
      // The body stays on the map for a while, and an unalerted enemy that sees it is alerted
      corpses.push({ x: dead.x, y: dead.y, radius: dead.radius ?? 16, color: dead.color, age: 0 });
      // Emit kill noise at death position (audible ~5m per wiki)
      if (player && !player.isSilenced) {
        player.lastNoisePosition = { x: dead.x, y: dead.y };
        player.lastNoiseTime = 0;
      }
      loot.push(...rollLootDrop(dead));
      if (player) recordAffinity(awardKillAffinity(dead, 'Excalibur', player.currentWeapon?.name ?? 'Excalibur'));
      // Survival: a kill can drop a personal life support module (wiki: 5%)
      if (isSurvival() && Math.random() < SURVIVAL.killModuleChance) lifeSupport = Math.min(100, lifeSupport + SURVIVAL.moduleGain);
    }
    kills += enemies.length - survivors.length;
    enemies = survivors;
    setEnemies(enemies);
    loot = loot.filter(l => !l.collected && l.age < l.lifetime);
    projectiles = projectiles.filter((p) => p.active);
}

// Credits paid for the mission just won (0 when none), shown on the complete screen
let lastCreditReward = 0;

function awardMissionCredits() {
  lastCreditReward = creditReward(mission);
  if (lastCreditReward > 0) wallet.add('credits', lastCreditReward);
}

function missionFailed() {
  if (!player.alive) return true;
  if (noKillFailed()) return true;
  if (survivalFailed()) return true;
  return !!(objective && !objective.alive);
}

// Exterminate (wiki): if no enemy is killed for 15 minutes a short warning appears, and the mission fails if no kill follows.
// The 15 minutes is from the wiki; the length of the warning is a placeholder.
const NO_KILL_WARNING_S = 15 * 60;
const NO_KILL_GRACE_S = 30;
let lastKillAt = 0;
let noKillWarningAt = null;
let lastKillCount = 0;

function updateNoKillTimer() {
  if (!mission || mission.family !== 'exterminate') return;
  if (kills !== lastKillCount) {
    lastKillCount = kills;
    lastKillAt = elapsed;
    noKillWarningAt = null;
  }
  if (noKillWarningAt === null && elapsed - lastKillAt >= NO_KILL_WARNING_S) noKillWarningAt = elapsed;
}

function noKillWarningActive() {
  return noKillWarningAt !== null;
}

function noKillFailed() {
  return noKillWarningAt !== null && elapsed - noKillWarningAt >= NO_KILL_GRACE_S;
}

// Exterminate (wiki): reaching the kill quota opens the extraction zone; the mission is won by reaching it.
// The zone is the exit of a generated map, or a point far from the player on a hand-made map.
const EXTRACT_RADIUS = 96;
let extraction = null;

function extractionPointFor(map, px, py) {
  const exit = (map.entities ?? []).find((e) => e.type === 'pad' && e.role === 'exit');
  if (exit) return { x: exit.x, y: exit.y };
  const w = arenaBounds?.width ?? canvas.width, h = arenaBounds?.height ?? canvas.height;
  return { x: px < w / 2 ? w - 160 : 160, y: py < h / 2 ? h - 160 : 160 };
}

// Survival (wiki): life support starts at 100% and drops 1% every 1.5 s. Modules (5%) come from kills, lockers and
// containers. Life support capsules (30%) appear every 90 s. At 0% before the 5 minute mark the mission fails at once;
// after it, the squad's health drains until the 5 minutes end. Extraction opens at 5 minutes.
// The 20% kill chance, 30% container chance and the capsule spot are placeholders.
const SURVIVAL = {
  extractAt: 300, decayPerS: 1 / 1.5, moduleGain: 5, capsuleGain: 30, capsuleEvery: 90, maxCapsules: 8,
  killModuleChance: 0.2, containerModuleChance: 0.3, drainSeconds: 300,
};
// Dead enemies stay on the map this long (seconds), then disappear
const CORPSE_SECONDS = 5;
let corpses = [];
let lifeSupport = 100;
let nextCapsuleAt = SURVIVAL.capsuleEvery;
let capsules = [];
let drainStartedAt = null;

function isSurvival() {
  return !!mission && mission.id === 'survival';
}

function updateSurvival(dt) {
  if (!isSurvival()) return;
  lifeSupport = Math.max(0, lifeSupport - dt * SURVIVAL.decayPerS); // percent per second
  if (elapsed >= nextCapsuleAt && capsules.length < SURVIVAL.maxCapsules && player) {
    nextCapsuleAt += SURVIVAL.capsuleEvery;
    // Dropped near the middle of the map, a little away from the player
    capsules.push({ x: player.x + (Math.random() < 0.5 ? -240 : 240), y: player.y + (Math.random() - 0.5) * 240, radius: 16 });
  }
  if (player && player.alive) {
    capsules = capsules.filter((c) => {
      if (Math.hypot(c.x - player.x, c.y - player.y) > 40) return true;
      lifeSupport = Math.min(100, lifeSupport + SURVIVAL.capsuleGain);
      return false;
    });
  }
  // Health drains once life support is empty and the 5 minutes have run (placeholder rate: from full to 5 HP in 5 minutes)
  if (lifeSupport <= 0 && elapsed >= SURVIVAL.extractAt && player && player.healthComponent) {
    if (drainStartedAt === null) drainStartedAt = elapsed;
    const hc = player.healthComponent;
    hc.hp = Math.max(5, hc.hp - (hc.maxHp - 5) * dt / SURVIVAL.drainSeconds);
  }
}

function survivalFailed() {
  if (!isSurvival()) return false;
  if (lifeSupport <= 0 && elapsed < SURVIVAL.extractAt) return true; // empty before extraction: lost at once
  return drainStartedAt !== null && elapsed - drainStartedAt >= SURVIVAL.drainSeconds; // the drain timer ran out
}

function extractionOpen() {
  if (!mission) return false;
  if (mission.family === 'exterminate') return kills >= mission.killQuota;
  if (isSurvival()) return elapsed >= SURVIVAL.extractAt;
  return false;
}

function missionWon() {
  if (!mission) return false;
  if (mission.family === 'exterminate' || isSurvival()) {
    return extractionOpen() && !!player && !!extraction && Math.hypot(player.x - extraction.x, player.y - extraction.y) <= EXTRACT_RADIUS;
  }
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
  // 'generated' builds a new room layout each time (see src/missions/generator/tile_generator.js)
  if (baseName === 'generated') {
    // ?seed=N in the page address fixes the layout (for comparing builds); otherwise each run is new
    const urlSeed = Number(new URLSearchParams(globalThis.location?.search ?? "").get("seed"));
    const seed = Number.isInteger(urlSeed) && urlSeed > 0 ? urlSeed : Math.floor(Math.random() * 2 ** 31);
    return generateMissionMap({ roomCount: 8, seed });
  }
  // 'arena' is the Defense arena: one open floor with the objective in the middle (see missions/generator/arena.js)
  if (baseName === 'arena') return generateArenaMap();
  const response = await fetch(`/src/missions/maps/${baseName}.json`);
  return response.json();
}

async function startMission(missionId) {
  // The star chart passes its full launch object (with the planet and node it came from);
  // retries pass the bare id again, so keep the node for the same mission
  const launch = typeof missionId === 'string' ? null : missionId;
  const id = launch ? launch.id : missionId;
  if (launch) missionNode = { planet: launch.planet, node: launch.node };
  else if (!mission || mission.id !== id) missionNode = null;
  mission = getMission(id);
  // Enemies of this node spawn in its level range (wiki); a retry keeps the range of the node it started from
  if (launch) setLevelRange(launch.levelRange ?? null);
  else if (!missionNode) setLevelRange(null);
  lastCreditReward = 0;
  screen = 'playing';
  player = new Player(canvas.width / 2, canvas.height / 2, arsenal.currentLoadout);
  enemies = []; loot = []; projectiles = []; kills = 0; elapsed = 0;
  lastKillAt = 0; noKillWarningAt = null; lastKillCount = 0; extraction = null;
  lifeSupport = 100; nextCapsuleAt = SURVIVAL.capsuleEvery; capsules = []; drainStartedAt = null;
  corpses = [];
  spawnTimer = 0; currentWave = 1; waveEnemiesSpawned = 0;
  rotationCredits = 0; rotationsDone = 0;
  resetMissionStats();
  waveEnemiesTotal = waveSize(mission, currentWave);
  waveTimer = 0;

  // Initialize NavMesh from mission map
      const mapData = await loadMissionMap(mission.map);
    arenaBounds = mapData.generated ? mapData.bounds : null;
    setSpawnBounds(arenaBounds);
    mapWalls = mapData.tiles.layers.walls;
    const wallTile = mapData.tiles.tileSize;
    mapWallKeys = new Set(mapWalls.map((w) => Math.floor(w.x / wallTile) + ',' + Math.floor(w.y / wallTile)));
    mapTileSize = mapData.tiles.tileSize;
    // Walls (and later props) block the player, enemies and bullets
    collision.clear();
    collision.setTiles(mapData.tiles.tileSize, mapData.tiles.layers.walls);
    const built = buildLootables(mapData.entities);
    lockers = built.lockers; containers = built.containers; pads = built.pads;
    gates = built.gates;
    for (const g of gates) collision.addSolid(g.rect); // closed until opened
    for (const prop of [...lockers, ...containers]) collision.addSolid(prop.rect);
    setSpawnPoints(mapData.spawnPoints);
    setHearingRooms(mapData.rooms ? mapData.rooms.map((r) => r.rect) : null);
    setPatrolProfile(mission.patrol ?? null); // a mission can change how its enemies patrol (patrol.js)
    extraction = (mission.family === 'exterminate' || mission.id === 'survival') ? extractionPointFor(mapData, player.x, player.y) : null;
    if (mapData.generated) {
      player.x = mapData.playerStart.x;
      player.y = mapData.playerStart.y;
    }
    const tileMapModule = await import('./engine/map/tilemap.js');
    const NavMesh = (await import('./engine/navigation/navmesh.js')).NavMesh;
    const { TacMap, buildLevelBlocks } = await import('./engine/navigation/tacmap.js');
    const tileMap = new tileMapModule.TileMap(mapData.tiles);
    const navMesh = new NavMesh(tileMap);
    // Generated maps add the TacMap: level blocks per room, with portals at the doorways (engine/navigation/tacmap.js)
    if (mapData.rooms) navMesh.tacMap = new TacMap(buildLevelBlocks(mapData.rooms), mapData.rooms);
    missionNavMesh = navMesh;
    for (const g of gates) navMesh.setBlocked(g.rect, true); // gates start closed
    window.navMesh = navMesh; // Expose globally for spawner

    initSpawnSystem(canvas, player, enemies, mission, kills, waveEnemiesSpawned, waveEnemiesTotal, spawnTimer, currentWave, waveTimer);

    // Assign NavMesh to all existing enemies
    for (const enemy of enemies) {
      enemy.navMesh = navMesh;
    }

  if (mission.objective) {
    // A generated map puts the objective on its objective pad; the other maps use the middle of the screen
    const spot = mapData.generated && mapData.objectiveSpot ? mapData.objectiveSpot : { x: canvas.width / 2 + 60, y: canvas.height / 2 };
    objective = new CryoPod(spot.x, spot.y, mission.objective);
    if (!mapData.generated) player.x -= 60;
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
  if (mission.family === 'exterminate') {
    primary = extractionOpen() ? 'EXTRACT' : `${mission.objectiveLabel} ${kills} / ${mission.killQuota}`;
    if (noKillWarningActive()) primary = 'NO KILLS - MISSION FAILING';
    detail = `Enemies ${enemies.length} / ${mission.maxEnemies}`;
    progress = kills / mission.killQuota;
  } else if (mission.id === 'defense' || mission.id === 'survival') {
    primary = isSurvival() ? `LIFE SUPPORT ${Math.ceil(lifeSupport)}%` : `${mission.objectiveLabel} ${currentWave}`;
    if (isSurvival() && extractionOpen()) primary = 'EXTRACT';
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

// ---- Rotations (wiki: Defense) ------------------------------------------------------------------------------------
// Every 3 waves the rotation ends. Each player then extracts with the rewards so far, or continues against harder
// enemies. Rewards are kept only by extracting: failing after a continue loses them all (wiki).
const ROTATION_CREDITS = 1000; // placeholder: the rotation reward is this times the rotation number
const ROTATION_LOCKOUT_MS = 600;
let rotationCredits = 0, rotationsDone = 0, rotationReadyAt = 0, rotationButtons = null;

function enterRotation() {
  rotationsDone += 1;
  rotationCredits += ROTATION_CREDITS * rotationsDone;
  screen = 'rotation';
  rotationReadyAt = gameNow() + ROTATION_LOCKOUT_MS;
  hud.setVisible(false);
}

function finishWithRotation() {
  lastCreditReward = rotationCredits;
  if (lastCreditReward > 0) wallet.add('credits', lastCreditReward);
  if (missionNode) navigation.completeMission(missionNode.planet, missionNode.node);
  showOutcome('complete');
}

function resumeAfterRotation() {
  continueRotation();
  screen = 'playing';
  hud.setVisible(true);
}

function insideRect(r, p) {
  return !!r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

function drawRotationScreen() {
  const cx = canvas.width / 2, cy = canvas.height / 2;
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 40px system-ui, sans-serif';
  ctx.fillText(`ROTATION ${rotationsDone} COMPLETE`, cx, cy - 110);
  ctx.fillStyle = '#7fc8e8';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText(`Reward so far: ${rotationCredits} credits`, cx, cy - 60);
  ctx.fillStyle = '#ffffff';
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText('Extract now to keep the reward, or continue against harder enemies.', cx, cy - 25);
  ctx.fillStyle = '#f87171';
  ctx.fillText('If you continue and fail the next rotation, every reward is lost.', cx, cy + 5);
  rotationButtons = {
    extract: { x: cx - 230, y: cy + 50, w: 210, h: 52 },
    continue: { x: cx + 20, y: cy + 50, w: 210, h: 52 },
  };
  const drawButton = (r, label, hint, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 - 8);
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(hint, r.x + r.w / 2, r.y + r.h / 2 + 12);
  };
  drawButton(rotationButtons.extract, 'EXTRACT', '[Y] / [A]', 'rgba(74, 222, 128, 0.35)');
  drawButton(rotationButtons.continue, 'CONTINUE', '[N] / [B]', 'rgba(248, 113, 113, 0.35)');
  ctx.restore();
}

const frameStats = new FrameStats();
const fpsReadout = document.getElementById('fps-readout');

let lastFrameAt = 0;
function gameLoop(timestamp) {
    // Max Framerate: skip frames that come too soon after the last one
    if (frameCapMs && timestamp - lastFrameAt < frameCapMs - 1) { requestAnimationFrame(gameLoop); return; }
    lastFrameAt = timestamp;
    camera.zoom = fovZoom; // the Field of View option
    ctx.imageSmoothingEnabled = smoothing; // the Anti-Aliasing option
    frameStats.tick(timestamp);
    if (settingsStore.get('showFps')) updateFpsReadout(fpsReadout, frameStats, timestamp);
    inputHandler.beginFrame();
    if (window.gamePaused) { lastTimestamp = 0; requestAnimationFrame(gameLoop); return; }
    if (gameExited) { drawExitScreen(); return; }
    if (!lastTimestamp) lastTimestamp = timestamp;
    const dt = Math.min(0.05, (timestamp - lastTimestamp) / 1000);
    lastTimestamp = timestamp;
    // Combo, parry and lockout timers run on this clock, which stops while the pause menu is open
    if (!pauseMenu.visible) advanceGameClock(dt);

    // Escape closes the squad panel first; the screen behind it does not see that key
    if (isSquadOpen() && inputHandler.isKeyPressed('escape')) closeSquad();

    // Damage numbers only move during a fight. Leaving one clears them, so none stay frozen on a menu
    if (screen !== 'playing' && screen !== 'simulacrum' && damageNumbersManager.numbers.length) damageNumbersManager.clear();

    menuMusic.sync(screen, gameExited);
    // The matchmaking list on hover: the main menu's icons are 54px, the other screens' 42px
    setMenuPointer(inputHandler.mouseInside ? inputHandler.mouse : null);
    const upgradeScreen = screen === 'arsenal' && arsenal.isUpgradeView();
    syncModeDrop(['main-menu', 'navigation', 'arsenal'].includes(screen) && !gameExited && !upgradeScreen,
      screen === 'main-menu' ? liveModeBox() : SQUAD_MODE_BOX);
    updateModeList(inputHandler, upgradeScreen);
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
            }
      mainMenu.draw(ctx, canvas);
      requestAnimationFrame(gameLoop);
      return;
    } // end if (screen === 'main-menu')

    if (screen === 'simulacrum') {
      if (inputHandler.isKeyPressed('escape')) {
        if (simulacrumMenu.visible) simulacrumMenu.visible = false;
        else { openMainMenu(); requestAnimationFrame(gameLoop); return; }
      }
      if (inputHandler.isKeyPressed('p')) simulacrumMenu.toggle();
      const menuActive = simulacrumMenu.update(inputHandler, canvas, (enemy) => enemies.push(enemy), player);
      // KILL ALL: remove every enemy in place (no loot or kill count; this is a test arena)
      if (simulacrumMenu.takeKillAll()) enemies.length = 0;

      // The Simulacrum is the normal world (same updateWorld and renderWorld as missions). The spawner only
      // adds enemies, sets their level, and toggles two test states: enemy AI paused, player invulnerable.
      player.invulnerable = simulacrumMenu.invulnerable;
      for (const enemy of enemies) enemy.aiPaused = simulacrumMenu.pauseAI;
      if (!menuActive) {
        updateWorld(dt);
        damageNumbersManager.update(dt);
        if (missionFailed()) showOutcome('failed');
      }
      renderWorld();
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
              // The pointer over a mission shows its card
              const pointer = inputHandler.getMousePos();
              navigation.handleMove(pointer.x, pointer.y);
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

  // Rotation choice: the world waits while each player extracts or continues
  if (screen === 'rotation') {
    renderWorld();
    drawRotationScreen();
    // Read the inputs every frame so clicks and keys from the fight are cleared, but only act once the lockout ends
    const clicked = inputHandler.isMouseClicked();
    const mouse = inputHandler.getMousePos();
    // Keyboard Y/N, or the controller's A (pad0) and B (pad1)
    const yes = inputHandler.isKeyPressed('y') || inputHandler.isKeyPressed('pad0');
    const no = inputHandler.isKeyPressed('n') || inputHandler.isKeyPressed('pad1');
    if (gameNow() >= rotationReadyAt) {
      if (yes || (clicked && insideRect(rotationButtons?.extract, mouse))) finishWithRotation();
      else if (no || (clicked && insideRect(rotationButtons?.continue, mouse))) resumeAfterRotation();
    }
    requestAnimationFrame(gameLoop);
    return;
  }

    if (screen === 'failed' || screen === 'complete') {
      drawOutcomeScreen();
      // Read the inputs every frame so clicks and keys from the fight are cleared, but only act once the lockout ends
      const wantsSelect = inputHandler.isKeyPressed('m');
      const wantsRetry = inputHandler.isKeyPressed('enter') || inputHandler.isMouseClicked();
      if (gameNow() >= outcomeReadyAt) {
        if (wantsSelect) openMissionSelect();
        else if (wantsRetry) {
          if (mission) startMission(mission.id);
          else openMainMenu();
        }
      }
      requestAnimationFrame(gameLoop);
      return;
    }

    if (inputHandler.isKeyPressed('escape')) { pauseMenu.missionName = mission?.name ?? ''; pauseMenu.toggle(); }
    hud.setVisible(!pauseMenu.visible); // the pause screen covers the whole view, like the main menu
    if (pauseMenu.visible) {
      const action = pauseMenu.update(inputHandler, canvas);
      if (action === 'settings') {
        pauseMenu.close();
        settingsFromPause = true;
        settings.openScreen();
        screen = 'settings';
        hud.setVisible(false);
      }
      else if (action === 'resume') pauseMenu.close();
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
          if (missionFailed()) showOutcome('failed');
          else if (missionWon()) {
            awardMissionCredits();
            if (missionNode) navigation.completeMission(missionNode.planet, missionNode.node);
            showOutcome('complete');
          }
        }

  
    renderWorld();
    updateHud(dt);
    pauseMenu.draw(ctx, canvas);
    simulacrumMenu.draw(ctx, canvas);
    requestAnimationFrame(gameLoop);
}

// Outcome screen input is ignored for a moment after it opens: a click or Enter from the fight
// (firing, last kill) would otherwise restart the mission before the result is seen
const OUTCOME_LOCKOUT_MS = 800;
let outcomeReadyAt = 0;

function showOutcome(next) {
  screen = next;
  outcomeReadyAt = gameNow() + OUTCOME_LOCKOUT_MS;
  hud.setVisible(false);
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

  if (win && lastCreditReward > 0) {
    ctx.fillStyle = '#7fc8e8';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText(`+${lastCreditReward.toLocaleString('en-US')} Credits`, canvas.width / 2, canvas.height / 2 + 44);
  }

  if (win) drawResultsPanel();
  ctx.fillStyle = '#9aa0b4';
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('Press Enter to Retry · M for Mission Select', canvas.width / 2, win ? canvas.height - 36 : canvas.height / 2 + 84);
  ctx.restore();
}

// The results panel on a completed mission: the statistics of the run and the loot it brought in
const LOOT_LABELS = {
  credits: 'Credits', health: 'Health orbs', energy: 'Energy orbs', primary_ammo: 'Primary ammo',
  secondary_ammo: 'Secondary ammo', endo: 'Endo', resource: 'Region resources', mod: 'Mods',
};

function drawResultsPanel() {
  const s = missionStats();
  const cx = canvas.width / 2;
  const top = canvas.height / 2 + 80;
  const panelW = 880, panelH = 320;
  ctx.fillStyle = 'rgba(14, 16, 24, 0.92)';
  ctx.fillRect(cx - panelW / 2, top - 24, panelW, panelH);
  ctx.strokeStyle = 'rgba(74, 222, 128, 0.5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(cx - panelW / 2, top - 24, panelW, panelH);

  const num = (n) => Math.round(n).toLocaleString('en-US');
  const mins = Math.floor(elapsed / 60), secs = Math.floor(elapsed % 60);
  const statRows = [
    ['Time', `${mins}:${String(secs).padStart(2, '0')}`],
    ['Enemies killed', num(s.kills)],
    ['Melee kills', num(s.meleeKills)],
    ['Damage dealt', num(s.damageDealt)],
    ['Damage received', num(s.damageReceived)],
    ['XP (affinity)', num(s.affinity)],
  ];
  const lootRows = Object.entries(s.loot).map(([type, n]) => [LOOT_LABELS[type] ?? type, num(n)]);
  if (lastCreditReward > 0) lootRows.unshift(['Mission credits', num(lastCreditReward)]);
  if (!lootRows.length) lootRows.push(['No loot collected', '']);

  const colLeft = cx - panelW / 2 + 36, colRight = cx + 40;
  const rowH = 36;
  const row = (x, y, label, value, width) => {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#c9cde0';
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText(label, x, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText(value, x + width, y);
  };
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#4ade80';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('MISSION STATISTICS', colLeft, top + 4);
  ctx.fillText('LOOT', colRight, top + 4);
  statRows.forEach(([label, value], i) => row(colLeft, top + 40 + i * rowH, label, value, 380));
  lootRows.forEach(([label, value], i) => row(colRight, top + 40 + i * rowH, label, value, 380));
  ctx.textBaseline = 'middle';
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
