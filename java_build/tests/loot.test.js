import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  rollLootDrop,
  applyLootPickup,
  LOOT_TYPES,
  DEFAULT_LOOT_WEIGHTS,
} from '../src/pickups/loot.js';

// A dead enemy to roll against (shape matches what game.js passes). Crewman has a wiki drop table.
const corpse = { x: 100, y: 100, name: 'Crewman' };

// Deterministic runs: seed Math.random with a stub returning queued values (defaults to 0.5 when empty).
function withRandom(values, fn) {
  const original = Math.random;
  const queue = [...values];
  Math.random = () => queue.shift() ?? 0.5;
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}

test('loot weights cover the whole 0..1 range (nothing falls through)', () => {
  const sum = Object.values(DEFAULT_LOOT_WEIGHTS).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9, `weights sum to 1, got ${sum}`);
});

test('50% drop chance: rolls under 0.5 drop, over/equal do not', () => {
  const dropped = withRandom([0.1], () => rollLootDrop(corpse));
  assert.equal(dropped.length, 1, 'roll 0.1 should drop');
  const skipped = withRandom([0.9], () => rollLootDrop(corpse));
  assert.equal(skipped.length, 0, 'roll 0.9 should not drop');
});

test('energy 30% — but non-energy is NOT energy', () => {
  // 0.55 falls in the health bucket (0.3–0.6), never energy
  const loot = withRandom([0.1, 0.55], () => rollLootDrop(corpse));
  assert.equal(loot[0].type, LOOT_TYPES.HEALTH, '0.55 falls in health bucket, not energy');
});

test('primary/secondary ammo 20% each', () => {
  const primary = withRandom([0.1, 0.7], () => rollLootDrop(corpse));
  assert.equal(primary[0].type, LOOT_TYPES.PRIMARY_AMMO, '0.7 falls in primary bucket (0.6–0.8)');
  const secondary = withRandom([0.1, 0.9], () => rollLootDrop(corpse));
  assert.equal(secondary[0].type, LOOT_TYPES.SECONDARY_AMMO, '0.9 falls in secondary bucket (0.8–1.0)');
});

test('loot spawns at the corpse position with an offset', () => {
  const loot = withRandom([0.1, 0.05], () => rollLootDrop(corpse));
  assert.equal(loot.length, 1);
  assert.ok(Math.abs(loot[0].x - 100) <= 10, 'x near corpse');
  assert.ok(Math.abs(loot[0].y - 100) <= 10, 'y near corpse');
});

test('health heals +50 clamped to maxHealth', () => {
  const player = { maxHealth: 370, health: 100, energy: 150, maxEnergy: 150 };
  applyLootPickup(player, { type: LOOT_TYPES.HEALTH });
  assert.equal(player.health, 150, 'health +50');
  player.health = 360;
  applyLootPickup(player, { type: LOOT_TYPES.HEALTH });
  assert.equal(player.health, 370, 'clamped at maxHealth');
});

test('energy grants +25 clamped to maxEnergy', () => {
  const player = { maxHealth: 370, health: 370, energy: 140, maxEnergy: 150 };
  applyLootPickup(player, { type: LOOT_TYPES.ENERGY });
  assert.equal(player.energy, 150, 'energy +25 clamped to 150');
});

test('valid loot weights never produce an undefined type', () => {
  const seen = new Set();
  for (let i = 0; i < 500; i++) {
    for (const n of [0.1, 0.3, 0.5, 0.7, 0.9]) {
      const loot = withRandom([0.1, n], () => rollLootDrop(corpse));
      seen.add(loot[0].type);
    }
  }
  assert.deepEqual(
    [...seen].sort(),
    [LOOT_TYPES.ENERGY, LOOT_TYPES.HEALTH, LOOT_TYPES.PRIMARY_AMMO, LOOT_TYPES.SECONDARY_AMMO].sort(),
    'all four types reachable'
  );
});

test('an enemy with no drop table gets no mods, Endo or resources, but can still drop Credits', () => {
  const runner = { x: 0, y: 0, name: 'Runner', lvl: 1 };
  // item roll misses (0.9), credits roll hits (0.1)
  const loot = withRandom([0.9, 0.1], () => rollLootDrop(runner));
  assert.equal(loot.length, 1);
  assert.equal(loot[0].type, LOOT_TYPES.CREDITS);
  assert.equal(loot[0].amount, 20);
});

test('an unknown enemy drops nothing when its item and Credits rolls miss', () => {
  const loot = withRandom([0.9, 0.9], () => rollLootDrop({ x: 0, y: 0, name: 'Nobody' }));
  assert.equal(loot.length, 0);
});

test('Crewman endo row: the 15 Endo orb drops on its own chance', () => {
  // item roll 0.9 (no item), credit roll 0.9 (no credits), five mod rows miss, endo 15 row hits at 0.001
  const loot = withRandom([0.9, 0.9, 0.5, 0.5, 0.5, 0.5, 0.5, 0.001], () => rollLootDrop(corpse));
  assert.equal(loot.length, 1);
  assert.equal(loot[0].type, LOOT_TYPES.ENDO);
  assert.equal(loot[0].amount, 15);
});

test('Crewman mod row: Ammo Drum drops with its mod id', () => {
  const loot = withRandom([0.9, 0.9, 0.001], () => rollLootDrop(corpse));
  assert.equal(loot.length, 1);
  assert.equal(loot[0].type, LOOT_TYPES.MOD);
  assert.equal(loot[0].modId, '/Lotus/Upgrades/Mods/Weapon/AmmoDrumMod');
});

test('region row picks one of the Earth resources', () => {
  // item 0.9 (none), credits 0.9 (none), mod and endo rows miss, region row hits at 0.01,
  // the orb takes four randoms (x, y, bob offset, bob speed), then 0.99 picks the 4th resource
  const queue = [0.9, 0.9, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.01, 0.5, 0.5, 0.5, 0.5, 0.99];
  const loot = withRandom(queue, () => rollLootDrop(corpse));
  assert.equal(loot.length, 1);
  assert.equal(loot[0].type, LOOT_TYPES.RESOURCE);
  assert.equal(loot[0].currency, 'detonite_ampule');
});

test('endo pickup adds the orb amount to the wallet', async () => {
  const { wallet } = await import('../src/economy/wallet.js');
  const before = wallet.get('endo');
  applyLootPickup({}, { type: LOOT_TYPES.ENDO, amount: 80 });
  assert.equal(wallet.get('endo'), before + 80);
  wallet.balances.endo = before; // restore so other tests start from the same balance
});

test('resource pickup adds one of the named resource to the wallet', async () => {
  const { wallet } = await import('../src/economy/wallet.js');
  const before = wallet.get('ferrite');
  applyLootPickup({}, { type: LOOT_TYPES.RESOURCE, currency: 'ferrite', amount: 1 });
  assert.equal(wallet.get('ferrite'), before + 1);
  wallet.balances.ferrite = before;
});
