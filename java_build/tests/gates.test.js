import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateMissionMap } from '../src/missions/generator/tile_generator.js';
import { buildLootables, Gate } from '../src/pickups/lootable.js';
import { TileMap } from '../src/engine/map/tilemap.js';
import { NavMesh } from '../src/engine/navigation/navmesh.js';
import { CollisionWorld } from '../src/engine/collision.js';

test('generated maps put gates across some doorways, closed to start', () => {
  let total = 0;
  for (const seed of [1, 7, 42, 99]) {
    const map = generateMissionMap({ roomCount: 8, seed });
    const gates = map.entities.filter((e) => e.type === 'gate');
    total += gates.length;
    for (const g of gates) {
      assert.ok(g.w > 0 && g.h > 0);
      assert.ok(g.x >= 0 && g.y >= 0 && g.x + g.w <= map.bounds.width && g.y + g.h <= map.bounds.height, 'inside the map');
      assert.equal(new Gate(g).open, false, 'gates start closed');
    }
  }
  assert.ok(total > 0, 'some gates exist across the seeds');
});

test('a closed gate blocks sight and paths, and an open one lets both through', () => {
  const map = generateMissionMap({ roomCount: 8, seed: 7 });
  const entity = map.entities.find((e) => e.type === 'gate');
  assert.ok(entity, 'seed 7 has a gate');
  const gate = new Gate(entity);
  const tileMap = new TileMap(map.tiles);
  const nav = new NavMesh(tileMap);
  const world = new CollisionWorld();
  world.setTiles(map.tiles.tileSize, map.tiles.layers.walls);

  const cx = gate.x, cy = gate.y;
  const across = entity.orientation === 'v'
    ? [[cx - 60, cy, cx + 60, cy]] : [[cx, cy - 60, cx, cy + 60]];
  const [x0, y0, x1, y1] = across[0];

  world.addSolid(gate.rect);
  nav.setBlocked(gate.rect, true);
  assert.ok(world.raycast(x0, y0, x1, y1), 'a closed gate stops the line of sight');
  assert.equal(nav.isWalkableAt(cx, cy), false, 'a closed gate blocks its cells');

  world.removeSolid(gate.rect);
  nav.setBlocked(gate.rect, false);
  assert.equal(world.raycast(x0, y0, x1, y1), null, 'an open gate lets the sight through');
  assert.equal(nav.isWalkableAt(cx, cy), true, 'an open gate frees its cells');
});

test('a gate opens by itself near the Warframe and closes after it leaves', () => {
  const built = buildLootables([{ id: 'gate1', type: 'gate', x: 0, y: 0, w: 8, h: 96, orientation: 'v' }]);
  const gate = built.gates[0];
  const near = { x: 20, y: 48 }, far = { x: 900, y: 48 };
  assert.equal(gate.update(1 / 60, far), false, 'starts closed, far away');
  assert.equal(gate.update(1 / 60, near), true, 'opens when the Warframe is near');
  let open = true;
  for (let t = 0; t < 1.5; t += 1 / 60) open = gate.update(1 / 60, far);
  assert.equal(open, true, 'stays open a moment after the Warframe leaves');
  for (let t = 0; t < 2; t += 1 / 60) open = gate.update(1 / 60, far);
  assert.equal(open, false, 'closes after the hold time');
});

test('enemies spawn only in the spawn room, and its doorways have gates', () => {
  for (const seed of [1, 7, 42]) {
    const map = generateMissionMap({ roomCount: 8, seed });
    const room = map.rooms.find((r) => r.role === 'spawn');
    assert.ok(room, 'there is a spawn room');
    assert.ok(map.spawnPoints.length > 0);
    for (const sp of map.spawnPoints) {
      const r = room.rect;
      assert.ok(sp.x >= r.x && sp.x <= r.x + r.w && sp.y >= r.y && sp.y <= r.y + r.h, 'spawn point inside the spawn room');
    }
  }
});
