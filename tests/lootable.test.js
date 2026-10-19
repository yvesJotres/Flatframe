import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  Container, Locker, rollLootableDrops, buildLootables, nearestUsableLocker,
  CONTAINER_HP, REGION_RESOURCE_CHANCE, RESOURCE_ROLLS, ENDO_ORB, INTERACT_RANGE,
} from '../src/pickups/lootable.js';
import { LOOT_TYPES } from '../src/pickups/loot.js';
import { REGION_RESOURCES } from '../src/enemies/drop_tables.js';
import { seededRandom } from '../src/missions/generator/tile_generator.js';

// Deterministic random from a queue (0.5 when empty)
const queue = (values) => { const q = [...values]; return () => q.shift() ?? 0.5; };
// A stream of seeded randoms for statistics
const lcg = seededRandom;

const containerEntity = { id: 'c1', type: 'container', kind: 'common', x: 100, y: 100, w: 56, h: 56 };
const lockerEntity = (kind) => ({ id: 'l1', type: 'locker', kind, facing: 'n', x: 200, y: 200, w: 64, h: 44 });

test('a container breaks when its hit points run out, and a Reinforced one takes the most damage', () => {
  const c = new Container(containerEntity);
  assert.equal(c.broken, false);
  c.takeDamage({ total: CONTAINER_HP.common - 1 });
  assert.equal(c.broken, false);
  c.takeDamage(1);
  assert.equal(c.broken, true);
  const hp = Object.values(CONTAINER_HP);
  assert.deepEqual([...hp].sort((a, b) => a - b), hp, 'common < uncommon < rare < reinforced');
});

test('a container looks like a target to bullets: it has a position, a radius and hit points', () => {
  const c = new Container(containerEntity);
  assert.equal(c.x, 128);
  assert.equal(c.y, 128);
  assert.equal(c.radius, 28);
  assert.equal(typeof c.hp, 'number');
  c.applyBlind(7); // abilities call this on every target: it must not throw
});

test('a common container holds 0 to 3 items, an uncommon one 1 to 3', () => {
  const items = (kind, seed) => rollLootableDrops(kind, 0, 0, lcg(seed)).filter((d) => d.type !== LOOT_TYPES.RESOURCE && d.type !== LOOT_TYPES.ENDO).length;
  const common = new Set(), uncommon = new Set();
  for (let s = 1; s <= 300; s++) { common.add(items('common', s)); uncommon.add(items('uncommon', s)); }
  assert.deepEqual([...common].sort(), [0, 1, 2, 3]);
  assert.deepEqual([...uncommon].sort(), [1, 2, 3]);
});

test('a region resource comes with the wiki chance per roll (18.97%), once per roll for each container kind', () => {
  const r = lcg(42);
  let hits = 0;
  const N = 20000;
  for (let i = 0; i < N; i++) hits += rollLootableDrops('common', 0, 0, r).filter((d) => d.type === LOOT_TYPES.RESOURCE).length;
  const rate = hits / N / RESOURCE_ROLLS.common;
  assert.ok(Math.abs(rate - REGION_RESOURCE_CHANCE) < 0.01, `rate ${rate}`);
  // Reinforced rolls four times as often
  const r2 = lcg(43);
  let hits4 = 0;
  for (let i = 0; i < N; i++) hits4 += rollLootableDrops('reinforced', 0, 0, r2).filter((d) => d.type === LOOT_TYPES.RESOURCE).length;
  assert.ok(Math.abs(hits4 / N / RESOURCE_ROLLS.reinforced - REGION_RESOURCE_CHANCE) < 0.01);
});

test('region resources are Earth resources only, and Rare and Reinforced containers hold 80 Endo', () => {
  const r = lcg(7);
  for (let i = 0; i < 2000; i++) {
    for (const d of rollLootableDrops('rare', 0, 0, r)) if (d.type === LOOT_TYPES.RESOURCE) assert.ok(REGION_RESOURCES.earth.includes(d.currency));
  }
  for (const kind of ['rare', 'reinforced']) {
    const endo = rollLootableDrops(kind, 0, 0, lcg(1)).find((d) => d.type === LOOT_TYPES.ENDO);
    assert.equal(endo?.amount, ENDO_ORB);
  }
  assert.equal(rollLootableDrops('common', 0, 0, lcg(1)).some((d) => d.type === LOOT_TYPES.ENDO), false);
});

test('only the item types the wiki lists can drop', () => {
  const allowed = new Set([LOOT_TYPES.CREDITS, LOOT_TYPES.PRIMARY_AMMO, LOOT_TYPES.SECONDARY_AMMO, LOOT_TYPES.ENERGY, LOOT_TYPES.HEALTH, LOOT_TYPES.RESOURCE, LOOT_TYPES.ENDO]);
  const r = lcg(9);
  for (let i = 0; i < 1000; i++) for (const d of rollLootableDrops('uncommon', 0, 0, r)) assert.ok(allowed.has(d.type), d.type);
});

test('a green locker opens once and gives loot; a second try gives nothing', () => {
  const l = new Locker(lockerEntity('green'));
  assert.equal(l.prompt(), '[X] OPEN');
  const first = l.interact(lcg(3));
  assert.equal(first.opened, true);
  assert.ok(first.drops.length >= 1);
  assert.equal(l.prompt(), null);
  const second = l.interact(lcg(3));
  assert.equal(second.opened, false);
  assert.deepEqual(second.drops, []);
});

test('a red locker stays locked and a black one gives no prompt at all', () => {
  const red = new Locker(lockerEntity('red'));
  assert.equal(red.prompt(), 'LOCKED');
  const result = red.interact();
  assert.equal(result.opened, false);
  assert.equal(result.locked, true);
  assert.deepEqual(result.drops, []);
  const black = new Locker(lockerEntity('black'));
  assert.equal(black.prompt(), null);
  assert.equal(black.interact().opened, false);
});

test('the nearest usable locker is found by distance to its edge, and out of range ones are ignored', () => {
  const near = new Locker({ ...lockerEntity('green'), id: 'near', x: 100, y: 100 });
  const far = new Locker({ ...lockerEntity('green'), id: 'far', x: 900, y: 900 });
  const black = new Locker({ ...lockerEntity('black'), id: 'black', x: 100, y: 160 });
  const player = { x: 132, y: 100 + 44 + INTERACT_RANGE - 5 };
  assert.equal(nearestUsableLocker([far, near, black], { x: 132, y: 160 })?.id, 'near');
  assert.equal(nearestUsableLocker([far], player), null);
  assert.equal(nearestUsableLocker([black], { x: 132, y: 165 }), null, 'a black locker never offers a prompt');
});

test('buildLootables sorts entities into lockers, containers and pads', () => {
  const { lockers, containers, pads } = buildLootables([
    lockerEntity('green'), containerEntity, { id: 'p', type: 'pad', role: 'exit', x: 1, y: 1 }, { type: 'unknown' },
  ]);
  assert.equal(lockers.length, 1);
  assert.equal(containers.length, 1);
  assert.equal(pads.length, 1);
});

test('drops land near the container, not far away', () => {
  const c = new Container(containerEntity);
  for (let s = 1; s <= 50; s++) for (const d of c.drops(lcg(s))) assert.ok(Math.hypot(d.x - c.x, d.y - c.y) <= 30, 'within 30px');
});
