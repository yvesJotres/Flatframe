import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EnergyWave, ENERGY_WAVE, ExaltedBlade, EXALTED_BLADE_WEAPON, EXALTED_WAVE_COOLDOWN } from '../src/warframe/abilities/excalibur_abilities.js';

function dummy(x, y) {
  return { x, y, radius: 16, hp: 100, takenDamage: 0, takeDamage(d) { this.takenDamage += d; this.hp -= d; } };
}

test('the Exalted Blade weapon is the wiki normal attack: 250 total damage, 2.8 m range', () => {
  const dmg = Object.values(EXALTED_BLADE_WEAPON.attack.damage).reduce((a, b) => a + b, 0);
  assert.equal(dmg, 250);
  assert.equal(EXALTED_BLADE_WEAPON.range, 2.8);
});

test('an energy wave hits an enemy in its path, and does less the farther it has flown', () => {
  const near = dummy(100, 0);
  const wave = new EnergyWave(0, 0, 0, 250);
  for (let i = 0; i < 60; i++) wave.update(1 / 60, [near]);
  assert.ok(near.takenDamage > 0 && near.takenDamage < 250, `took ${near.takenDamage}`);
  const far = dummy(600, 0);
  const wave2 = new EnergyWave(0, 0, 0, 250);
  for (let i = 0; i < 300; i++) wave2.update(1 / 60, [far]);
  assert.ok(far.takenDamage < near.takenDamage, 'more falloff farther out');
});

test('a wave passing a second enemy does 20% less and loses range', () => {
  const a = dummy(60, 0), b = dummy(200, 0);
  const wave = new EnergyWave(0, 0, 0, 250);
  const before = wave.maxDistance;
  for (let i = 0; i < 400; i++) wave.update(1 / 60, [a, b]);
  assert.ok(b.takenDamage < a.takenDamage, 'second enemy takes less');
  assert.equal(wave.maxDistance, before - 2 * ENERGY_WAVE.hitRangeLoss);
});

test('the blade throws waves only while summoned, with a cooldown', () => {
  const blade = new ExaltedBlade();
  const player = { x: 0, y: 0, angle: 0, energy: 100 };
  blade.fireWave(player);
  assert.equal(blade.waves.length, 0, 'not summoned: no wave');
  blade.toggle(player);
  blade.fireWave(player);
  blade.fireWave(player);
  assert.equal(blade.waves.length, 1, 'cooldown stops a second wave');
  blade.update(EXALTED_WAVE_COOLDOWN + 0.01, player);
  blade.fireWave(player);
  assert.equal(blade.waves.length, 2, 'a new wave after the cooldown');
});
