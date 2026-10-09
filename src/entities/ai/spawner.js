import Lancer from './enemies/factions/grineer/lancer.js';
import { waveSize } from '../../missions/missions.js';

// ---- Old-sig exports (matching game.js globals) ----
// game.js calls: spawnEnemy(lvl) and updateSpawns(dt)
// These wrappers keep the globals intact.

let _canvas, _player, _enemies, _mission, _kills, _waveEnemiesSpawned, _waveEnemiesTotal, _spawnTimer, _currentWave, _waveTimer;

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
  _enemies.push(new Lancer(x, y, { lvl: lvl || 1 }));
}

export function updateSpawns(dt) {
  if (!_mission) return;
  _spawnTimer += dt;
  const interval = _mission.spawnInterval ?? 1.1;

  if (_mission.id === 'exterminate') {
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

// ---- Initializer: wire up the globals once per mission start ----
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
}

// Call this when game.js reassigns the enemies array (e.g., after filtering dead)
export function setEnemies(arr) {
  _enemies = arr;
}