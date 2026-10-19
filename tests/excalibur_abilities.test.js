import { test } from 'node:test';
import assert from 'node:assert/strict';
import Player from '../src/warframe/player.js';
import { RADIAL_BLIND, RADIAL_JAVELIN, EXALTED_BLADE, castRadialBlind, castRadialJavelin, ExaltedBlade } from '../src/warframe/abilities/excalibur_abilities.js';
import { initPrimaryWeapons } from '../src/weapons/primary_weapon.js';
import { initSecondaryWeapons } from '../src/weapons/secondary_weapon.js';
import { initMeleeWeapons } from '../src/weapons/melee_weapon.js';

await initPrimaryWeapons();
await initSecondaryWeapons();
await initMeleeWeapons();

function dummyEnemy(x, y) {
  return {
    x, y, radius: 16, hp: 1000, blindTimer: 0,
    applyBlind(duration) { this.blindTimer = Math.max(this.blindTimer, duration); },
    hits: [],
    takeDamage(damage) { this.hits.push(damage); this.hp -= damage; },
  };
}

function input(pressed = {}) {
  return {
    mouse: { x: 0, y: 0, down: false },
    isKeyDown: () => false,
    isKeyPressed: (k) => !!pressed[k],
  };
}

test('ability keys are 2, 3 and 4 and do not clash with Slash Dash', () => {
  assert.deepEqual([RADIAL_BLIND.key, RADIAL_JAVELIN.key, EXALTED_BLADE.key], ['2', '3', '4']);
});

test('Radial Blind costs 50, blinds enemies within 8m for 7s, and skips the rest', () => {
  const p = new Player(0, 0, { frameRank: 30 }); p.energy = p.maxEnergy;
  const near = dummyEnemy(RADIAL_BLIND.radius - 20, 0);
  const far = dummyEnemy(RADIAL_BLIND.radius + 100, 0);
  assert.equal(castRadialBlind(p, [near, far]), true);
  assert.equal(p.energy, 150 - RADIAL_BLIND.energyCost);
  assert.equal(near.blindTimer, RADIAL_BLIND.duration);
  assert.equal(far.blindTimer, 0);
});

test('Radial Javelin costs 75 and deals 500 to enemies within 15m only', () => {
  const p = new Player(0, 0, { frameRank: 30 }); p.energy = p.maxEnergy;
  const near = dummyEnemy(RADIAL_JAVELIN.radius - 20, 0);
  const far = dummyEnemy(RADIAL_JAVELIN.radius + 100, 0);
  assert.equal(castRadialJavelin(p, [near, far]), true);
  assert.equal(p.energy, 150 - RADIAL_JAVELIN.energyCost);
  assert.deepEqual(near.hits, [RADIAL_JAVELIN.damage]);
  assert.deepEqual(far.hits, []);
});

test('abilities 2 and 3 do nothing without enough energy', () => {
  const p = new Player(0, 0, { frameRank: 30 }); p.energy = p.maxEnergy;
  p.energy = 40;
  const enemy = dummyEnemy(10, 0);
  assert.equal(castRadialBlind(p, [enemy]), false);
  assert.equal(castRadialJavelin(p, [enemy]), false);
  assert.equal(p.energy, 40);
  assert.equal(enemy.blindTimer, 0);
  assert.deepEqual(enemy.hits, []);
});

test('Exalted Blade toggles on for 25 energy, then drains 2.5 per second', () => {
  const p = new Player(0, 0, { frameRank: 30 }); p.energy = p.maxEnergy;
  const blade = new ExaltedBlade();
  assert.equal(blade.toggle(p), true);
  assert.equal(blade.active, true);
  assert.equal(p.energy, 150 - EXALTED_BLADE.energyCost);
  for (let i = 0; i < 60; i++) blade.update(1 / 60, p);
  assert.ok(Math.abs(p.energy - (150 - EXALTED_BLADE.energyCost - EXALTED_BLADE.drainPerSecond)) < 1e-6, `energy ${p.energy}`);
  blade.toggle(p);
  assert.equal(blade.active, false, 'pressing again dismisses it');
});

test('Exalted Blade dismisses itself when energy runs out', () => {
  const p = new Player(0, 0, { frameRank: 30 }); p.energy = p.maxEnergy;
  const blade = new ExaltedBlade();
  p.energy = EXALTED_BLADE.energyCost;
  blade.toggle(p);
  for (let i = 0; i < 120 && blade.active; i++) blade.update(1 / 60, p);
  assert.equal(blade.active, false);
  assert.equal(p.energy, 0);
});

test('pressing 2, 3 and 4 in the player update casts those abilities', () => {
  const p = new Player(0, 0, { frameRank: 30 }); p.energy = p.maxEnergy;
  const enemy = dummyEnemy(10, 0);
  p.update(1 / 60, input({ '3': true }), [], [enemy]);
  assert.deepEqual(enemy.hits, [RADIAL_JAVELIN.damage]);
  p.update(1 / 60, input({ '2': true }), [], [enemy]);
  assert.ok(enemy.blindTimer > 0 && enemy.blindTimer <= RADIAL_BLIND.duration);
  p.energy = 100; // the earlier casts left too little to sustain the blade
  p.update(1 / 60, input({ '4': true }), [], [enemy]);
  assert.equal(p.exaltedBlade.active, true);
});
