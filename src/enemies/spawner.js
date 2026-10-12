import Lancer from './grineer/lancer.js';
import Trooper from './grineer/trooper.js';
import Butcher from './grineer/butcher.js';
import Crewman from './corpus/crewman.js';
import { waveSize } from '../missions/missions.js';

// Enemy classes a mission's enemyPool can name
const ENEMY_CLASSES = { crewman: Crewman, trooper: Trooper, lancer: Lancer, butcher: Butcher };

// ---- Old-sig exports (matching game.js globals) ----
// game.js calls: spawnEnemy(lvl) and updateSpawns(dt)
// These wrappers keep the globals intact.

let _canvas, _player, _enemies, _mission, _kills, _waveEnemiesSpawned, _waveEnemiesTotal, _spawnTimer, _currentWave, _waveTimer;
let _navMesh = null; // NavMesh for pathfinding

export function spawnEnemy(lvl = 1) {
  const edge = Math.floor(Math.random() * 4);
  let x, y, padding = 30;
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

export function updateSpawns(dt) {
  if (!_mission) return;
  _spawnTimer += dt;
  const interval = _mission.spawnInterval ?? 1.1;

  if (_mission.family === 'exterminate') {
    const level = 1 + Math.floor(_kills / (_mission.levelPerKills ?? 8));
    if (_kills + _enemies.length < _mission.killQuota && _enemies.length < _mission.maxEnemies) {
      if (_spawnTimer >= interval) { _spawnTimer = 0; spawnEnemy(level); }
    }
  } else if (_mission.id === 'defense' || _mission.id === 'survival') {
    if (_waveEnemiesSpawned < _waveEnemiesTotal) {
      if (_enemies.length < _mission.maxEnemies && _spawnTimer >= interval) {
        _spawnTimer = 0; spawnEnemy(_currentWave); _waveEnemiesSpawned++;
      }
    } else if (_enemies.length === 0) {
      if (_mission.endless || _currentWave < (_mission.waveLimit ?? 5)) {
        _waveTimer += dt;
        if (_waveTimer >= (_mission.waveBreak ?? 3)) {
          _waveTimer = 0; _currentWave++; _waveEnemiesSpawned = 0;
          _waveEnemiesTotal = waveSize(_mission, _currentWave);
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
export function setEnemies(arr) {
  _enemies = arr;
}