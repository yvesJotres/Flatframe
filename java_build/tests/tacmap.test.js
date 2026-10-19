import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateMissionMap } from '../src/missions/generator/tile_generator.js';
import { buildLevelBlocks, TacMap } from '../src/engine/navigation/tacmap.js';
import { TileMap } from '../src/engine/map/tilemap.js';
import { NavMesh } from '../src/engine/navigation/navmesh.js';

test('each room is a level block, with one portal per doorway', () => {
  const map = generateMissionMap({ roomCount: 8, seed: 7 });
  const blocks = buildLevelBlocks(map.rooms);
  assert.equal(blocks.length, map.rooms.length);
  blocks.forEach((b, i) => assert.equal(b.portals.length, map.rooms[i].doors.length));
});

test('the TacMap routes between rooms through doorways, and not within one room', () => {
  const map = generateMissionMap({ roomCount: 8, seed: 7 });
  const tac = new TacMap(buildLevelBlocks(map.rooms), map.rooms);
  const start = map.rooms.find((r) => r.role === 'start').rect;
  const spawn = map.rooms.find((r) => r.role === 'spawn').rect;
  const c = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
  assert.deepEqual(tac.route(c(start).x, c(start).y, c(start).x + 1, c(start).y), [], 'same room: no TacMap route');
  const route = tac.route(c(start).x, c(start).y, c(spawn).x, c(spawn).y);
  assert.ok(route.length >= 1, 'a route between rooms exists');
  for (const wp of route) assert.ok(Number.isFinite(wp.x) && Number.isFinite(wp.y));
});

test('a unit walks to a room in another block on the navmesh, through the TacMap', () => {
  const map = generateMissionMap({ roomCount: 8, seed: 7 });
  const nav = new NavMesh(new TileMap(map.tiles));
  nav.tacMap = new TacMap(buildLevelBlocks(map.rooms), map.rooms);
  const start = map.rooms.find((r) => r.role === 'start').rect;
  const spawn = map.rooms.find((r) => r.role === 'spawn').rect;
  const from = { x: start.x + start.w / 2, y: start.y + start.h / 2 };
  const to = { x: spawn.x + spawn.w / 2, y: spawn.y + spawn.h / 2 };
  const path = nav.findRoute(from.x, from.y, to.x, to.y);
  assert.ok(path && path.length > 0, 'a route is found');
  const last = path[path.length - 1];
  assert.ok(Math.hypot(last.x - to.x, last.y - to.y) < 60, 'the route ends in the spawn room');
});
