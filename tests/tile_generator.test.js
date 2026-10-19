import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRoomTree, generateMissionMap, TILE_SIZE, ROOM_W, ROOM_H } from '../src/missions/generator/tile_generator.js';

test('room layout is a tree: rooms - 1 connections, all rooms reachable from the start', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const rooms = buildRoomTree({ roomCount: 10, seed });
    const byKey = new Map(rooms.map((r) => [`${r.gx},${r.gy}`, r]));
    let doorPairs = 0;
    for (const r of rooms) doorPairs += r.doors.size;
    assert.equal(doorPairs / 2, rooms.length - 1, `seed ${seed}: no loops`);

    const seen = new Set(['0,0']);
    const queue = ['0,0'];
    while (queue.length) {
      const k = queue.shift();
      const room = byKey.get(k);
      for (const d of room.doors) {
        const offset = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] }[d];
        const nk = `${room.gx + offset[0]},${room.gy + offset[1]}`;
        assert.ok(byKey.get(nk)?.doors.has({ n: 's', s: 'n', e: 'w', w: 'e' }[d]), `seed ${seed}: door ${d} from ${k} matches`);
        if (!seen.has(nk)) { seen.add(nk); queue.push(nk); }
      }
    }
    assert.equal(seen.size, rooms.length, `seed ${seed}: every room reachable`);
  }
});

test('a map has one start, one objective, one exit, and dead ends only at leaves', () => {
  const rooms = buildRoomTree({ roomCount: 12, seed: 7 });
  const count = (role) => rooms.filter((r) => r.role === role).length;
  assert.equal(count('start'), 1);
  assert.equal(count('objective'), 1);
  assert.equal(count('exit'), 1);
  for (const r of rooms.filter((x) => x.role === 'dead end')) assert.equal(r.doors.size, 1);
});

test('the same seed gives the same map', () => {
  const a = generateMissionMap({ roomCount: 8, seed: 42 });
  const b = generateMissionMap({ roomCount: 8, seed: 42 });
  assert.deepEqual(a, b);
});

test('generated map uses the existing format and leaves the start room open', () => {
  const map = generateMissionMap({ roomCount: 8, seed: 3 });
  assert.equal(map.tiles.tileSize, TILE_SIZE);
  assert.ok(map.tiles.layers.walls.length > 0);
  for (const w of map.tiles.layers.walls) {
    assert.equal(w.x % TILE_SIZE, 0);
    assert.equal(w.y % TILE_SIZE, 0);
  }
  // Player starts in the centre of the start room
  const wallAtStart = map.tiles.layers.walls.some(
    (w) => Math.abs(w.x - map.playerStart.x) < TILE_SIZE / 2 && Math.abs(w.y - map.playerStart.y) < TILE_SIZE / 2
  );
  assert.equal(wallAtStart, false, 'no wall on the player start');
});

test('room doors are open: no wall sits in a door gap', () => {
  const rooms = buildRoomTree({ roomCount: 8, seed: 11 });
  const map = generateMissionMap({ roomCount: 8, seed: 11 });
  const minX = Math.min(...rooms.map((r) => r.gx));
  const minY = Math.min(...rooms.map((r) => r.gy));
  const walls = new Set(map.tiles.layers.walls.map((w) => `${w.x},${w.y}`));
  const roomPx = { w: ROOM_W * TILE_SIZE, h: ROOM_H * TILE_SIZE };
  const midX = Math.floor(ROOM_W / 2) * TILE_SIZE;
  const midY = Math.floor(ROOM_H / 2) * TILE_SIZE;
  for (const r of rooms) {
    const ox = (r.gx - minX) * roomPx.w;
    const oy = (r.gy - minY) * roomPx.h;
    if (r.doors.has('e')) assert.ok(!walls.has(`${ox + roomPx.w - TILE_SIZE},${oy + midY}`), 'east door open');
    if (r.doors.has('w')) assert.ok(!walls.has(`${ox},${oy + midY}`), 'west door open');
    if (r.doors.has('n')) assert.ok(!walls.has(`${ox + midX},${oy}`), 'north door open');
    if (r.doors.has('s')) assert.ok(!walls.has(`${ox + midX},${oy + roomPx.h - TILE_SIZE}`), 'south door open');
  }
});
