import { test } from 'node:test';
import assert from 'node:assert/strict';
import Player from '../src/warframe/player.js';
import { initPrimaryWeapons } from '../src/weapons/primary_weapon.js';
import { initSecondaryWeapons } from '../src/weapons/secondary_weapon.js';
import { initMeleeWeapons } from '../src/weapons/melee_weapon.js';
import BaseEnemy from '../src/enemies/enemy.js';

// A crouched jump toward the aim (the whole frame loop, not just the jump state), with the landing blast on an enemy
test('a crouched bullet jump flies toward the aim and its landing blast damages a nearby enemy', async () => {
  await initPrimaryWeapons(); await initSecondaryWeapons(); await initMeleeWeapons();
  const player = new Player(0, 0);
  const enemy = new BaseEnemy(20, 0, {});
  const enemies = [enemy];
  const input = (pressed, down) => ({
    mouse: { x: 300, y: 0, down: false, rightDown: false, middleDown: false },
    isKeyPressed: (k) => pressed.has(k),
    isKeyDown: (k) => down.has(k),
    gamepadMove: null,
  });
  player.update(1 / 60, input(new Set(), new Set(['control'])), [], enemies, { x: 0, y: 0 });
  player.update(1 / 60, input(new Set(['shift']), new Set(['control'])), [], enemies, { x: 0, y: 0 });
  assert.equal(player.jump.bulletActive, true);
  for (let i = 0; i < 300; i++) player.update(1 / 60, input(new Set(), new Set(['control'])), [], enemies, { x: 0, y: 0 });
  assert.ok(Math.abs(player.x - 210) < 20, `flew to x=${player.x}`);
  assert.ok(enemy.hp < 100, 'the landing blast hit the enemy');
});
