import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLevelRange, enemyLevelForWave } from '../src/enemies/levels.js';

test('a node level range reads as low and high levels', () => {
  assert.deepEqual(parseLevelRange('1-6'), { lo: 1, hi: 6 });
  assert.deepEqual(parseLevelRange(' 8 - 13 '), { lo: 8, hi: 13 });
  assert.equal(parseLevelRange('Hub'), null);
});

test('enemies stay inside the range, start at the low end, and rise slowly to the top', () => {
  const range = { lo: 1, hi: 6 };
  assert.equal(enemyLevelForWave(range, 1, () => 0.999), 1, 'wave 1 is only the low end');
  assert.equal(enemyLevelForWave(range, 3, () => 0.999), 2, 'wave 3 can reach low + 1');
  for (let w = 1; w <= 30; w++) {
    for (const r of [0, 0.5, 0.999]) {
      const lvl = enemyLevelForWave(range, w, () => r);
      assert.ok(lvl >= 1 && lvl <= 6, `wave ${w} level ${lvl} inside 1-6`);
    }
  }
  assert.equal(enemyLevelForWave(range, 30, () => 0.999), 6, 'the top is reached and never passed');
});
