import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateArenaMap, ARENA } from '../src/missions/generator/arena.js';
import { validateMap } from '../src/missions/generator/tile_generator.js';

test('the Defense arena has the objective in the middle and spawns on every side', () => {
  const map = generateArenaMap();
  const cx = map.bounds.width / 2, cy = map.bounds.height / 2;
  assert.equal(map.objectiveSpot.x, cx);
  assert.equal(map.objectiveSpot.y, cy);
  const sides = { left: 0, right: 0, top: 0, bottom: 0 };
  for (const p of map.spawnPoints) {
    if (p.x < cx) sides.left++; else sides.right++;
    if (p.y < cy) sides.top++; else sides.bottom++;
  }
  for (const [side, n] of Object.entries(sides)) assert.ok(n > 0, `spawns on the ${side}`);
});

test('the arena is a valid map: everything reachable, nothing in a wall', () => {
  const map = generateArenaMap();
  assert.deepEqual(validateMap(map), []);
  assert.equal(map.rooms.length, 1);
  assert.equal(map.tiles.layers.walls.length > 0, true);
  assert.ok(ARENA.cols * ARENA.rows > 100);
});
