import Lancer from './grineer/lancer.js';
import Trooper from './grineer/trooper.js';
import Butcher from './grineer/butcher.js';
import Crewman from './corpus/crewman.js';
import { waveSize } from '../missions/missions.js';
import { isWallAt } from '../engine/navigation/walls.js';
import { parseLevelRange, enemyLevelForWave } from './levels.js';

// Enemy classes a mission's enemyPool can name
const ENEMY_CLASSES = { crewman: Crewman, trooper: Trooper, lancer: Lancer, butcher: Butcher };

// ---- Old-sig exports (matching game.js globals) ----
// game.js calls: spawnEnemy(lvl) and updateSpawns(dt)
// These wrappers keep the globals intact.

let _canvas, _player, _enemies, _mission, _kills, _waveEnemiesSpawned, _waveEnemiesTotal, _spawnTimer, _currentWave, _waveTimer;
let _navMesh = null; // NavMesh for pathfinding

// The node's enemy level range for wave missions (see levels.js); null uses the wave number as the level
let _levelRange = null;
export function setLevelRange(text) {
  _levelRange = parseLevelRange(text);
}

// Bounds of a generated map, where spawns must land on open floor (set by game.js). null for other maps.
let _bounds = null;
export function setSpawnBounds(bounds) {
  _bounds = bounds;
}

// Spawn points a generated map lists (free floor in every room except the start room). null for other maps.
let _spawnPoints = null;
export function setSpawnPoints(points) {
  _spawnPoints = points && points.length ? points : null;
}

// A spawn point at least 400 px from the player (any one if none is that far). null when the map has none.
function listedSpawnPoint() {
  if (!_spawnPoints) return null;
  const far = _spawnPoints.filter((p) => !_player || Math.hypot(p.x - _player.x, p.y - _player.y) >= 400);
  const pool = far.length ? far : _spawnPoints;
  return pool[Math.floor(Math.random() * pool.length)];
}

// A random open point inside the generated map, at least 300 px from the player. null if none found.
function openSpawnPoint() {
  const listed = listedSpawnPoint();
  if (listed) return listed;
  for (let tries = 0; tries < 60; tries++) {
    const x = Math.random() * _bounds.width;
    const y = Math.random() * _bounds.height;
    if (isWallAt(x, y)) continue;
    if (_player && Math.hypot(x - _player.x, y - _player.y) < 300) continue;
    return { x, y };
  }
  return null;
}

export function spawnEnemy(lvl = 1) {
  let x, y;
  const open = _bounds ? openSpawnPoint() : null;
  if (open) {
    ({ x, y } = open);
  } else {
    const edge = Math.floor(Math.random() * 4);
    const padding = 30;
    if (edge === 0) { x = Math.random() * _canvas.width; y = padding; }
    else if (edge === 1) { x = _canvas.width - padding; y = Math.random() * _canvas.height; }
    else if (edge === 2) { x = Math.random() * _canvas.width; y = _canvas.height - padding; }
    else { x = padding; y = Math.random() * _canvas.height; }

    if (_player) {
      const dist = Math.hypot(x - _player.x, y - _player.y);
      if (dist < 150) {
        x = (x + _canvas.width / 2) % (_canvas.width - padding * 2) + padding;
        y = (y + _canvas.height / 2) % (_canvas.height - padding * 2) + padding;
      }
    }
  }

  let enemy;
  if (_mission && _mission.family === 'exterminate') {
    const pool = _mission.enemyPool ?? ['crewman'];
    const EnemyClass = ENEMY_CLASSES[pool[Math.floor(Math.random() * pool.length)]];
    enemy = new EnemyClass(x, y, { lvl: lvl || 1 });
  } else {
    enemy = new Lancer(x, y, { lvl: lvl || 1 });
  }

  // Assign NavMesh to new enemy
  enemy.navMesh = _navMesh;
  _enemies.push(enemy);
}

// A rotation (wiki: 3 waves) ends with a choice: extract with the reward, or continue. While it waits, nothing spawns.
let _choice = false;
export function rotationChoiceOpen() {
  return _choice;
}
export function continueRotation() {
  _choice = false;
  advanceWave();
}
function advanceWave() {
  _currentWave++;
  _waveEnemiesSpawned = 0;
  _waveEnemiesTotal = waveSize(_mission, _currentWave);
}

export function updateSpawns(dt) {
  if (!_mission || _choice) return;
  _spawnTimer += dt;
  const interval = _mission.spawnInterval ?? 1.1;

  if (_mission.family === 'exterminate') {
    const level = 1 + Math.floor(_kills / (_mission.levelPerKills ?? 8));
    // Enemies keep coming after the quota (wiki): the quota only opens extraction, the spawning goes on until the player leaves
    if (_enemies.length < _mission.maxEnemies) {
      if (_spawnTimer >= interval) { _spawnTimer = 0; spawnEnemy(level); }
    }
  } else if (_mission.id === 'defense' || _mission.id === 'survival') {
    if (_waveEnemiesSpawned < _waveEnemiesTotal) {
      if (_enemies.length < _mission.maxEnemies && _spawnTimer >= interval) {
        _spawnTimer = 0;
        spawnEnemy(_levelRange ? enemyLevelForWave(_levelRange, _currentWave) : _currentWave);
        _waveEnemiesSpawned++;
      }
    } else if (_enemies.length === 0) {
      if (_mission.endless || _currentWave < (_mission.waveLimit ?? 5)) {
        _waveTimer += dt;
        if (_waveTimer >= (_mission.waveBreak ?? 3)) {
          _waveTimer = 0;
          if (_mission.rotationWaves && _currentWave % _mission.rotationWaves === 0) _choice = true; // the rotation is done
          else advanceWave();
        }
      }
    }
  }
}

// ---- Initializer: wire up the globals once per mission start ---
export function initSpawnSystem(canvas, player, enemies, mission, kills, waveEnemiesSpawned, waveEnemiesTotal, spawnTimer, currentWave, waveTimer) {
  _canvas = canvas;
  _player = player;
  _enemies = enemies;
  _mission = mission;
  _kills = kills;
  _waveEnemiesSpawned = waveEnemiesSpawned;
  _waveEnemiesTotal = waveEnemiesTotal;
  _spawnTimer = spawnTimer;
  _currentWave = currentWave;
  _waveTimer = waveTimer;
  _navMesh = window.navMesh; // Get NavMesh from game.js global
  // Assign NavMesh to pre-existing enemies (e.g. simulacrum dummy)
  if (_enemies && _navMesh) {
    for (const e of _enemies) {
      if (!e.navMesh) e.navMesh = _navMesh;
    }
  }
}

// Call this when game.js reassigns the enemies array (e.g., after filtering dead)
// The wave state the spawner keeps (the game reads it each frame, so the HUD shows the wave the spawner is on)
// null until a mission has set the spawner up (so the game keeps its own values until then)
export function waveState() {
  if (!_mission) return null;
  return { currentWave: _currentWave, waveEnemiesSpawned: _waveEnemiesSpawned, waveEnemiesTotal: _waveEnemiesTotal, waveTimer: _waveTimer, rotationChoice: _choice };
}

export function setEnemies(arr) {
  _enemies = arr;
}