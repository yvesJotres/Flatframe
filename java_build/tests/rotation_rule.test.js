import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getMission } from '../src/missions/missions.js';

test('Defense missions run in rotations of 3 waves (wiki)', () => {
  assert.equal(getMission('defense').rotationWaves, 3);
  assert.equal(getMission('dark_sector_defense').rotationWaves, 3);
  assert.equal(getMission('exterminate_e_prime').rotationWaves, undefined, 'other missions have no rotations');
});
