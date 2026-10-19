import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rollPelletCount } from '../src/weapons/weapon.js';

test('whole multishot always fires that many projectiles', () => {
  assert.equal(rollPelletCount(1, () => 0.99), 1);
  assert.equal(rollPelletCount(5, () => 0.99), 5);
});

test('fraction is the chance of one extra projectile (2.8: 2 always, a third 80% of the time)', () => {
  assert.equal(rollPelletCount(2.8, () => 0.79), 3, 'roll under 0.8 gives the extra one');
  assert.equal(rollPelletCount(2.8, () => 0.81), 2, 'roll over 0.8 does not');
});

test('at least one projectile always fires', () => {
  assert.equal(rollPelletCount(0, () => 0.99), 1);
});
