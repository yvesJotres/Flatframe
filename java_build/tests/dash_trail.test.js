import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DashTrail, DASH_TRAIL } from '../src/warframe/abilities/excalibur_abilities.js';

test('the dash trail records the path, skips tiny steps, and fades away', () => {
  const t = new DashTrail();
  t.record(0, 0);
  t.record(1, 0); // too close to the last point
  t.record(20, 0);
  assert.equal(t.points.length, 2);
  t.update(DASH_TRAIL.seconds + 0.01);
  assert.equal(t.points.length, 0, 'gone after its lifetime');
});
