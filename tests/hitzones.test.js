import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hitZone } from '../src/combat/hitzones.js';
import { calculateStealthHeadshotBonus } from '../src/combat/critical.js';
import Crewman from '../src/enemies/corpus/crewman.js';
import { initPrimaryWeapons } from '../src/weapons/primary_weapon.js';
import { initSecondaryWeapons } from '../src/weapons/secondary_weapon.js';
import { initMeleeWeapons } from '../src/weapons/melee_weapon.js';

await initPrimaryWeapons();
await initSecondaryWeapons();
await initMeleeWeapons();

const enemy = { x: 100, y: 100, radius: 20 };

test('a point above the enemy centre is in the head circle', () => {
  assert.equal(hitZone(enemy, 100, 100 - 0.6 * 20), 'head');
});

test('a point at the middle of the enemy is in the body capsule', () => {
  assert.equal(hitZone(enemy, 100, 100), 'body');
});

test('a point well outside the enemy hits no zone', () => {
  assert.equal(hitZone(enemy, 300, 300), null);
});

test('a headshot deals twice the body shot damage (base damage counted again)', () => {
  const dealt = (isWeakspot) => {
    const e = new Crewman(0, 0, { lvl: 1 });
    e.health.shield = 0;
    e.health.hp = 1000;
    const before = e.hp;
    e.takeDamage({ total: 100, baseTotal: 100, isWeakspot, status: null });
    return before - e.hp;
  };
  const bonus = calculateStealthHeadshotBonus(false, true) - 1; // +100%
  assert.ok(Math.abs(dealt(true) / dealt(false) - (1 + bonus)) < 1e-6, 'headshot is body damage plus the bonus');
});
