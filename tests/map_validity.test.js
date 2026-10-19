import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateMissionMap, validateMap, buildRoomTree, TILE_SIZE, ROOM_W, ROOM_H, LOCKER_SIZE, CONTAINER_SIZE,
} from '../src/missions/generator/tile_generator.js';
import { CollisionWorld } from '../src/engine/collision.js';

const MID_X = Math.floor(ROOM_W / 2);
const MID_Y = Math.floor(ROOM_H / 2);
const SEEDS = Array.from({ length: 60 }, (_, i) => i + 1);

// The collision world the game builds for a map: walls as tiles, props as solids
function worldFor(map) {
  const w = new CollisionWorld();
  w.setTiles(map.tiles.tileSize, map.tiles.layers.walls);
  for (const e of map.entities) if (e.w) w.addSolid({ x: e.x, y: e.y, w: e.w, h: e.h });
  return w;
}

test('every generated map passes the validator: all rooms and props reachable, nothing in a wall', () => {
  for (const seed of SEEDS) {
    for (const roomCount of [3, 6, 10, 14]) {
      const map = generateMissionMap({ roomCount, seed });
      assert.deepEqual(validateMap(map), [], `seed ${seed}, ${roomCount} rooms`);
    }
  }
});

test('the validator catches a blocked door', () => {
  const map = generateMissionMap({ roomCount: 6, seed: 3 });
  const start = map.rooms.find((r) => r.role === 'start');
  const door = start.doors[0];
  const gap = { n: [MID_X, 0], s: [MID_X, ROOM_H - 1], w: [0, MID_Y], e: [ROOM_W - 1, MID_Y] }[door];
  map.tiles.layers.walls.push({ x: (start.x * ROOM_W + gap[0]) * TILE_SIZE, y: (start.y * ROOM_H + gap[1]) * TILE_SIZE });
  assert.ok(validateMap(map).length > 0, 'a wall in the start room door is reported');
});

test('each room has the layout of its role', () => {
  const map = generateMissionMap({ roomCount: 10, seed: 5 });
  const wallAt = (rx, ry, i, j) => map.tiles.layers.walls.some((w) => w.x === (rx * ROOM_W + i) * TILE_SIZE && w.y === (ry * ROOM_H + j) * TILE_SIZE);
  for (const room of map.rooms) {
    if (room.role === 'connector') {
      // A hallway: only the cross through the middle is open
      assert.equal(wallAt(room.x, room.y, 1, 1), true, 'hallway corner is filled');
      assert.equal(wallAt(room.x, room.y, MID_X, 1), false, 'the column through the middle stays open');
      assert.equal(wallAt(room.x, room.y, 1, MID_Y), false, 'the row through the middle stays open');
    }
    if (room.role === 'intermediate') {
      // The wiki's intermediate shape: a block of two cells on one side, a column of single cells on the other
      assert.equal(wallAt(room.x, room.y, 1, 1), true, 'the block on one side is walls');
      assert.equal(wallAt(room.x, room.y, ROOM_W - 2, 1), true, 'the column on the other side is walls');
      assert.equal(wallAt(room.x, room.y, MID_X, MID_Y), false, 'its centre is open');
    }
    if (room.role === 'objective') {
      // An octagon: the corners are cut, and four pillars stand inside
      assert.equal(wallAt(room.x, room.y, 1, 1), true, 'corner is cut');
      assert.equal(wallAt(room.x, room.y, 2, 1), true, 'pillar stands');
      assert.equal(wallAt(room.x, room.y, MID_X, MID_Y), false, 'its centre is open');
    }
    if (room.role === 'start') {
      assert.equal(wallAt(room.x, room.y, 1, 1), true, 'the start room has a notch');
      assert.equal(wallAt(room.x, room.y, MID_X, MID_Y), false, 'its centre is open');
    }
    if (room.role === 'exit') {
      for (let j = 1; j < ROOM_H - 1; j++) for (let i = 1; i < ROOM_W - 1; i++) assert.equal(wallAt(room.x, room.y, i, j), false, 'exit interior is open');
    }
  }
});

test('tree rules: one start, one objective, one exit, dead ends only at leaves with one door', () => {
  for (const seed of SEEDS) {
    const rooms = buildRoomTree({ roomCount: 10, seed });
    const count = (role) => rooms.filter((r) => r.role === role).length;
    assert.equal(count('start'), 1);
    assert.equal(count('objective'), 1);
    assert.equal(count('exit'), 1);
    for (const r of rooms.filter((x) => x.role === 'dead end')) assert.equal(r.doors.size, 1);
  }
});

test('lockers and containers: dead ends hold them, other rooms do not hold lockers', () => {
  let lockers = 0, containers = 0;
  for (const seed of SEEDS) {
    const map = generateMissionMap({ roomCount: 12, seed });
    for (const e of map.entities) {
      const room = map.rooms.find((r) => e.x >= r.x * ROOM_W * TILE_SIZE && e.x < (r.x + 1) * ROOM_W * TILE_SIZE && e.y >= r.y * ROOM_H * TILE_SIZE && e.y < (r.y + 1) * ROOM_H * TILE_SIZE);
      if (e.type === 'locker') {
        lockers++;
        assert.equal(room.role, 'dead end', 'lockers are only in dead-end rooms');
        assert.ok(['green', 'red', 'black'].includes(e.kind));
      }
      if (e.type === 'container') {
        containers++;
        assert.ok(['dead end', 'intermediate'].includes(room.role), 'containers are in dead ends or combat rooms');
        assert.ok(['common', 'uncommon', 'rare', 'reinforced'].includes(e.kind));
      }
    }
  }
  assert.ok(lockers > 0 && containers > 0, 'the generator does place both');
});

test('a locker sits flush against a wall, faces into the room, and has open floor in front of it', () => {
  for (const seed of SEEDS) {
    const map = generateMissionMap({ roomCount: 12, seed });
    const wallSet = new Set(map.tiles.layers.walls.map((w) => `${w.x / TILE_SIZE},${w.y / TILE_SIZE}`));
    for (const e of map.entities.filter((x) => x.type === 'locker')) {
      assert.ok(Math.abs(Math.max(e.w, e.h) - LOCKER_SIZE.long) < 1e-9 && Math.abs(Math.min(e.w, e.h) - LOCKER_SIZE.deep) < 1e-9);
      const cx = Math.floor((e.x + e.w / 2) / TILE_SIZE), cy = Math.floor((e.y + e.h / 2) / TILE_SIZE);
      const back = { n: [0, 1], s: [0, -1], e: [-1, 0], w: [1, 0] }[e.facing];   // the wall behind it
      const front = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] }[e.facing];
      assert.equal(wallSet.has(`${cx + back[0]},${cy + back[1]}`), true, `locker ${e.id} has a wall behind it`);
      assert.equal(wallSet.has(`${cx + front[0]},${cy + front[1]}`), false, `locker ${e.id} has open floor in front`);
    }
  }
});

test('collision: a Warframe-sized unit fits through every door and can stand at the start, in front of every locker and on every spawn point', () => {
  for (const seed of SEEDS.slice(0, 25)) {
    const map = generateMissionMap({ roomCount: 10, seed });
    const world = worldFor(map);
    const fits = (x, y) => !world.resolveCircle({ x, y, radius: 16 });
    assert.ok(fits(map.playerStart.x, map.playerStart.y), 'the player starts clear of walls');
    for (const room of map.rooms) {
      for (const door of room.doors) {
        const gap = { n: [MID_X, 0], s: [MID_X, ROOM_H - 1], w: [0, MID_Y], e: [ROOM_W - 1, MID_Y] }[door];
        const x = (room.x * ROOM_W + gap[0]) * TILE_SIZE + TILE_SIZE / 2;
        const y = (room.y * ROOM_H + gap[1]) * TILE_SIZE + TILE_SIZE / 2;
        assert.ok(fits(x, y), `seed ${seed}: the ${door} door of the ${room.role} room is wide enough`);
      }
    }
    for (const e of map.entities.filter((x) => x.type === 'locker')) {
      const front = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] }[e.facing];
      const x = e.x + e.w / 2 + front[0] * (LOCKER_SIZE.deep / 2 + 16 + 2);
      const y = e.y + e.h / 2 + front[1] * (LOCKER_SIZE.deep / 2 + 16 + 2);
      assert.ok(fits(x, y), `seed ${seed}: a unit can stand in front of locker ${e.id}`);
    }
    for (const p of map.spawnPoints) assert.ok(fits(p.x, p.y), `seed ${seed}: spawn point is clear`);
  }
});

test('containers never stand in the open cross through a room, so every door stays passable', () => {
  for (const seed of [8, 9, 10, 11]) {
    const map = generateMissionMap({ roomCount: 12, seed });
    for (const e of map.entities.filter((x) => x.type === 'container')) {
      const room = map.rooms.find((r) => e.x >= r.x * ROOM_W * TILE_SIZE && e.x < (r.x + 1) * ROOM_W * TILE_SIZE && e.y >= r.y * ROOM_H * TILE_SIZE && e.y < (r.y + 1) * ROOM_H * TILE_SIZE);
      const i = Math.floor(e.x / TILE_SIZE) - room.x * ROOM_W;
      const j = Math.floor(e.y / TILE_SIZE) - room.y * ROOM_H;
      assert.ok(i !== MID_X && j !== MID_Y, `seed ${seed}: container at ${i},${j} is on the cross`);
    }
  }
});

test('the same seed gives the same map, including props', () => {
  assert.deepEqual(generateMissionMap({ roomCount: 9, seed: 77 }), generateMissionMap({ roomCount: 9, seed: 77 }));
});
