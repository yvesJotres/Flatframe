import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AUTO_PLAY_RANGE, findAutoPlayTarget, autoPlayAimPoint } from '../src/engine/auto_play.js';

const enemy = (x, y, hp = 100) => ({ x, y, hp });

test('picks the nearest live enemy within range', () => {
  const far = enemy(200, 0);
  const near = enemy(50, 0);
  assert.equal(findAutoPlayTarget({ x: 0, y: 0 }, [far, near]), near);
});

test('ignores dead enemies even when they are closest', () => {
  const dead = enemy(10, 0, 0);
  const alive = enemy(100, 0);
  assert.equal(findAutoPlayTarget({ x: 0, y: 0 }, [dead, alive]), alive);
});

test('returns null when nothing is in range', () => {
  const out = enemy(AUTO_PLAY_RANGE + 10, 0);
  assert.equal(findAutoPlayTarget({ x: 0, y: 0 }, [out]), null);
  assert.equal(findAutoPlayTarget({ x: 0, y: 0 }, []), null);
  assert.equal(findAutoPlayTarget(null, [enemy(1, 0)]), null);
});

test('aim point sits at the given distance toward the target', () => {
  const p = autoPlayAimPoint({ x: 500, y: 300 }, { x: 0, y: 0 }, { x: 0, y: 40 }, 220);
  assert.ok(Math.abs(p.x - 500) < 1e-9);
  assert.ok(Math.abs(p.y - 520) < 1e-9);
});

test('auto-play shoots only enemies that are alerted, never unalerted or cautious ones (so they can be finished quietly)', () => {
  const from = { x: 0, y: 0 };
  const unalerted = { x: 100, y: 0, hp: 50, alertState: 'unalerted' };
  const cautious = { x: 120, y: 0, hp: 50, alertState: 'cautious' };
  const alerted = { x: 300, y: 0, hp: 50, alertState: 'alerted' };
  assert.equal(findAutoPlayTarget(from, [unalerted, cautious, alerted]), alerted);
  assert.equal(findAutoPlayTarget(from, [unalerted, cautious]), null);
});
