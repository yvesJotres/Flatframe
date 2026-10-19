// Repro: enemy should move when player is in its LOS.
// Simulates the game loop: updateEnemies -> enemy.update -> behavior -> navigate.
import Lancer from '../src/enemies/grineer/lancer.js';
import { updateEnemies } from '../src/enemies/ai_behavior.js';
import { NavMesh } from '../src/engine/navigation/navmesh.js';
import { isInVisionCone } from '../src/enemies/enemy.js';
import { initPrimaryWeapons } from '../src/weapons/primary_weapon.js';
import { initMeleeWeapons } from '../src/weapons/melee_weapon.js';

await initPrimaryWeapons();
await initMeleeWeapons();

const navMesh = new NavMesh(null, { width: 1600, height: 900 });

// Fake player standing in the enemy's LOS
const player = { x: 400, y: 300, alive: true, isPlayer: true, hp: 100 };

// Enemy placed to the right of the player, facing the player (angle = PI)
const enemy = new Lancer(700, 300, { lvl: 1 });
enemy.navMesh = navMesh;
enemy.angle = Math.PI; // facing left toward player
enemy.alertState = 'unalerted';

console.log('vision check:', isInVisionCone(enemy, player));
console.log('enemy radius:', enemy.radius, 'moveSpeed:', enemy.moveSpeed, 'navMesh:', !!enemy.navMesh);

const projectiles = [];
const dt = 1 / 60;

const startX = enemy.x, startY = enemy.y;
for (let i = 0; i < 60; i++) { // 1 second of frames
  updateEnemies(dt, [enemy], player, null, projectiles);
}

const moved = Math.hypot(enemy.x - startX, enemy.y - startY);
console.log('alertState after 60 frames:', enemy.alertState);
console.log('focus:', enemy.focus ? 'set' : 'null');
console.log('moved pixels in 1s:', moved.toFixed(2));
console.log('path:', enemy.path ? enemy.path.length + ' nodes' : 'null');

if (moved < 1) {
  console.log('FAIL: enemy did not move');
  // Instrument: run behavior manually and log internals
  if (enemy.focus) {
    const dx = enemy.focus.x - enemy.x;
    const dy = enemy.focus.y - enemy.y;
    console.log('debug: velocity =', enemy.velocity);
    console.log('debug: equippedSlot =', enemy.equippedSlot, 'primary =', !!enemy.primary, 'secondary =', !!enemy.secondary, 'melee =', !!enemy.melee);
    enemy.navigate(dt, dx, dy, Math.hypot(dx, dy), [enemy]);
    console.log('after manual navigate: velocity =', enemy.velocity, 'x =', enemy.x);
  }
  process.exit(1);
} else {
  console.log('PASS: enemy moved toward player');
}
