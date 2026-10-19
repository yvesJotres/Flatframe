import { test } from 'node:test';
import assert from 'node:assert/strict';
import Crewman from '../src/enemies/corpus/crewman.js';
import { isInVisionCone } from '../src/enemies/enemy.js';
import { initPrimaryWeapons } from '../src/weapons/primary_weapon.js';
import { initSecondaryWeapons } from '../src/weapons/secondary_weapon.js';
import { initMeleeWeapons } from '../src/weapons/melee_weapon.js';

await initPrimaryWeapons();
await initSecondaryWeapons();
await initMeleeWeapons();

test('a blinded enemy cannot see the player, and the blind wears off', () => {
  const e = new Crewman(0, 0, { lvl: 1 });
  const target = { x: 50, y: 0 };
  e.angle = 0;
  assert.equal(isInVisionCone(e, target), true);
  e.applyBlind(7);
  assert.equal(e.isBlinded(), true);
  assert.equal(isInVisionCone(e, target), false);
  e.update(7.5, [], [], []);
  e.x = 0; e.y = 0; e.angle = 0; // an idle update moves and turns the enemy; only the blind should decide here
  assert.equal(e.isBlinded(), false);
  assert.equal(isInVisionCone(e, target), true);
});

test('a second blind keeps the longer duration', () => {
  const e = new Crewman(0, 0, { lvl: 1 });
  e.applyBlind(7);
  e.applyBlind(3);
  assert.equal(e.blindTimer, 7);
});

test('a blinded enemy is stunned (standing still) for the whole blind duration', () => {
  const e = new Crewman(0, 0, { lvl: 1 });
  e.applyBlind(7);
  e.applyVelocity(1, 0, 0.5, 100);
  assert.equal(e.velocity.x, 0, 'no movement while stunned');
  e.update(6.9, [], [], []);
  assert.ok(e.stunTimer > 0, 'still stunned just before the blind ends');
  e.update(0.2, [], [], []);
  assert.equal(e.stunTimer, 0, 'stun ends with the blind');
});
