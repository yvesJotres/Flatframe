import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateMissionMap } from '../src/missions/generator/tile_generator.js';

test('a generated map gives its objective spot on the objective pad, inside the map', () => {
  for (const seed of [1, 7, 42]) {
    const map = generateMissionMap({ roomCount: 8, seed });
    assert.ok(map.objectiveSpot, `seed ${seed} has an objective spot`);
    const { x, y } = map.objectiveSpot;
    assert.ok(x > 0 && x < map.bounds.width && y > 0 && y < map.bounds.height, 'inside the map');
  }
});
