// The Warframe walking around a generated map with the real player, the real collision world and the game's own
// per-frame order (player moves, then walls and props push it back).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import Player from '../src/warframe/player.js';
import { collision } from '../src/engine/collision.js';
import Projectile from '../src/weapons/projectile.js';
import { generateMissionMap, TILE_SIZE, ROOM_W, ROOM_H } from '../src/missions/generator/tile_generator.js';
import { buildLootables } from '../src/pickups/lootable.js';
import { initPrimaryWeapons } from '../src/weapons/primary_weapon.js';
import { initSecondaryWeapons } from '../src/weapons/secondary_weapon.js';
import { initMeleeWeapons } from '../src/weapons/melee_weapon.js';

await initPrimaryWeapons();
await initSecondaryWeapons();
await initMeleeWeapons();

// Loads a map into the shared collision world, as the game does when a mission starts
function loadMap(map) {
  collision.clear();
  collision.setTiles(map.tiles.tileSize, map.tiles.layers.walls);
  const built = buildLootables(map.entities);
  for (const prop of [...built.lockers, ...built.containers]) collision.addSolid(prop.rect);
  return built;
}

// An input that holds the given keys down
function holding(...keys) {
  const down = new Set(keys);
  return {
    mouse: { x: 0, y: 0, down: false },
    isKeyDown: (k) => down.has(k),
    isKeyPressed: () => false,
    isPressed: () => false,
    getWorldMousePos: (p) => ({ x: p.x + 100, y: p.y, down: false }),
    gamepadMove: { x: 0, y: 0 },
  };
}

// One game frame for the player: move, then be pushed out of walls and props
function step(player, input, dt = 1 / 60) {
  player.update(dt, input, [], [], { x: 0, y: 0, zoom: 1 });
  collision.resolveCircle(player);
}

test('walking into a wall stops the Warframe at the wall, and it never overlaps one', () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const map = generateMissionMap({ roomCount: 8, seed });
    loadMap(map);
    for (const key of ['w', 'a', 's', 'd']) {
      const player = new Player(map.playerStart.x, map.playerStart.y, { frameRank: 30 });
      const input = holding(key);
      for (let i = 0; i < 900; i++) {
        step(player, input);
        assert.equal(collision.isSolidAt(player.x, player.y), false, `seed ${seed} ${key}: centre inside a wall at step ${i}`);
        if (i % 50 === 0) assert.equal(collision.resolveCircle({ x: player.x, y: player.y, radius: player.radius }), false, `seed ${seed} ${key}: overlapping at step ${i}`);
      }
    }
  }
  collision.clear();
});

test('a Warframe walks straight through a door', () => {
  const map = generateMissionMap({ roomCount: 8, seed: 3 });
  loadMap(map);
  const start = map.rooms.find((r) => r.role === 'start');
  const door = start.doors[0];
  const key = { n: 'w', s: 's', w: 'a', e: 'd' }[door];
  const player = new Player(map.playerStart.x, map.playerStart.y, { frameRank: 30 });
  const input = holding(key);
  const roomLeft = start.x * ROOM_W * TILE_SIZE, roomTop = start.y * ROOM_H * TILE_SIZE;
  for (let i = 0; i < 600; i++) step(player, input);
  const outside = player.x < roomLeft || player.x > roomLeft + ROOM_W * TILE_SIZE || player.y < roomTop || player.y > roomTop + ROOM_H * TILE_SIZE;
  assert.ok(outside, `the Warframe left the start room through its ${door} door (at ${player.x}, ${player.y})`);
  collision.clear();
});

test('a bullet stops at a wall, and a bullet fired in the open flies its full range', () => {
  // A seed whose start room has a plain wall on at least one side
  let map, start;
  for (let seed = 4; seed < 40; seed++) {
    map = generateMissionMap({ roomCount: 8, seed });
    start = map.rooms.find((r) => r.role === 'start');
    if (start.doors.length < 4) break;
  }
  loadMap(map);
  // Toward the east wall of the start room unless a door is there; pick a wall direction without a door
  const dir = ['e', 'w', 'n', 's'].find((d) => !start.doors.includes(d));
  const v = { e: [1, 0], w: [-1, 0], n: [0, -1], s: [0, 1] }[dir];
  const shot = new Projectile(map.playerStart.x, map.playerStart.y, v[0], v[1], 10, { speed: 700, maxDistance: 5000 });
  for (let i = 0; i < 600 && shot.active; i++) shot.update(1 / 60, []);
  assert.equal(shot.active, false, 'the bullet ended');
  assert.equal(collision.isSolidAt(shot.x, shot.y) || collision.isSolidAt(shot.x + v[0] * 2, shot.y + v[1] * 2), true, 'it ended at a wall');
  assert.ok(Math.hypot(shot.x - map.playerStart.x, shot.y - map.playerStart.y) < 5000, 'it did not fly through the wall');
  collision.clear();
  const open = new Projectile(0, 0, 1, 0, 10, { speed: 700, maxDistance: 1000 });
  for (let i = 0; i < 600 && open.active; i++) open.update(1 / 60, []);
  assert.ok(open.x >= 999, `an open shot flies its whole range (${open.x})`);
});

test('a hitscan shot through a wall hits only what is in front of the wall', () => {
  collision.clear();
  collision.setTiles(160, [{ x: 480, y: 0 }]);
  const before = { x: 300, y: 80, radius: 16, hp: 100, hits: 0, takeDamage() { this.hits++; } };
  const behind = { x: 700, y: 80, radius: 16, hp: 100, hits: 0, takeDamage() { this.hits++; } };
  const shot = new Projectile(100, 80, 1, 0, 10, { speed: 100000, maxDistance: 2000 });
  shot.update(1 / 60, [before, behind]);
  assert.equal(before.hits, 1, 'the enemy in front is hit');
  assert.equal(behind.hits, 0, 'the enemy behind the wall is not');
  collision.clear();
});

test('a container in the way stops the Warframe and breaking it clears the way', () => {
  const map = generateMissionMap({ roomCount: 12, seed: 8 });
  const built = loadMap(map);
  const c = built.containers.find((k) => {
    // a container with a clear straight run to its left, so the test walks into it and not into a wall first
    const ray = collision.raycast(k.x - 200, k.y, k.x, k.y);
    return !ray;
  });
  if (!c) return; // no such container on this map: nothing to test
  const player = new Player(c.x - 120, c.y, { frameRank: 30 });
  const input = holding('d');
  for (let i = 0; i < 240; i++) step(player, input);
  assert.ok(player.x <= c.rect.x - player.radius + 1e-6, `stopped by the container (x ${player.x}, container at ${c.rect.x})`);
  collision.removeSolid(c.rect);
  for (let i = 0; i < 240; i++) step(player, input);
  assert.ok(player.x > c.rect.x, 'the Warframe passes once the container is gone');
  collision.clear();
});
