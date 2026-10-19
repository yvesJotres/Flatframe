import { test } from 'node:test';
import assert from 'node:assert/strict';
import HealthComponent from '../src/combat/health.js';

function enemyWithShield() {
  return new HealthComponent({ maxHp: 1000, maxShield: 1000, armor: 0 }, false);
}

test('without Magnetic, shields take the raw damage', () => {
  const h = enemyWithShield();
  h.takeDamage({ total: 100 });
  assert.equal(h.shield, 900);
});

test('one Magnetic stack doubles the damage to shields (+100%)', () => {
  const h = enemyWithShield();
  h.takeDamage({ total: 0, magnetic: 1 }); // a Magnetic proc
  h.takeDamage({ total: 100 });
  assert.equal(h.shield, 800);
});

test('Magnetic bonus caps at +325% and stacks stop at 10', () => {
  const h = enemyWithShield();
  for (let i = 0; i < 12; i++) h.takeDamage({ total: 0, magnetic: 1 });
  assert.equal(h.magneticStacks.length, 10);
  assert.equal(h.magneticShieldBonus(), 3.25);
});

test('Magnetic stacks run out after their duration', () => {
  const h = enemyWithShield();
  h.takeDamage({ total: 0, magnetic: 1 });
  h.update(7);
  assert.equal(h.magneticStacks.length, 0);
});
