import { test } from 'node:test';
import assert from 'node:assert/strict';
import Player from '../src/warframe/player.js';
import { SLASH_DASH, distanceToSegment } from '../src/warframe/abilities/excalibur_abilities.js';
import { initPrimaryWeapons } from '../src/weapons/primary_weapon.js';
import { initSecondaryWeapons } from '../src/weapons/secondary_weapon.js';
import { initMeleeWeapons } from '../src/weapons/melee_weapon.js';

await initPrimaryWeapons();
await initSecondaryWeapons();
await initMeleeWeapons();

// A stand-in enemy that records damage instead of running AI
function dummyEnemy(x, y) {
  return {
    x, y, radius: 16, hp: 1000,
    hits: [],
    takeDamage(damage) { this.hits.push(damage); this.hp -= damage; },
  };
}

function input(pressed = {}) {
  return {
    mouse: { x: 0, y: 0, down: false },
    isKeyDown: () => false,
    isKeyPressed: (k) => !!pressed[k],
  };
}

// Aim along +x (east) by putting the mouse to the right of the player
function aimEast(p) {
  return { ...input({ '1': true }), getWorldMousePos: () => ({ x: p.x + 500, y: p.y, down: false }) };
}

test('distanceToSegment measures to the segment, not the infinite line', () => {
  assert.equal(distanceToSegment(5, 3, 0, 0, 10, 0), 3);
  assert.equal(distanceToSegment(-4, 3, 0, 0, 10, 0), 5, 'past the start, nearest point is the endpoint');
  assert.equal(distanceToSegment(2, 2, 1, 1, 1, 1), Math.hypot(1, 1), 'degenerate segment is a point');
});

test('Slash Dash costs 25 energy and starts on key 1', () => {
  const p = new Player(0, 0);
  const before = p.energy;
  p.update(1 / 60, aimEast(p), [], []);
  assert.equal(p.slashDash.active, true);
  assert.equal(p.energy, before - SLASH_DASH.energyCost);
});

test('Slash Dash will not start without enough energy', () => {
  const p = new Player(0, 0);
  p.energy = SLASH_DASH.energyCost - 1;
  p.update(1 / 60, aimEast(p), [], []);
  assert.equal(p.slashDash.active, false);
  assert.equal(p.energy, SLASH_DASH.energyCost - 1);
});

test('dash covers its full range in the aim direction, then ends', () => {
  const p = new Player(0, 0);
  p.update(1 / 60, aimEast(p), [], []);
  for (let i = 0; i < 120 && p.slashDash.active; i++) p.update(1 / 60, input(), [], []);
  assert.equal(p.slashDash.active, false, 'dash finished');
  assert.ok(Math.abs(p.x - SLASH_DASH.range) < 1e-6, `moved ${p.x}, expected ${SLASH_DASH.range}`);
  assert.ok(Math.abs(p.y) < 1e-6, 'no sideways drift');
});

test('enemies on the path take 200 damage once; enemies off the path are untouched', () => {
  const p = new Player(0, 0);
  const onPath = dummyEnemy(150, 0);
  const offPath = dummyEnemy(150, 200);
  const enemies = [onPath, offPath];
  p.update(1 / 60, aimEast(p), [], enemies);
  for (let i = 0; i < 120; i++) p.update(1 / 60, input(), [], enemies);
  assert.deepEqual(onPath.hits, [SLASH_DASH.damage], 'hit exactly once for 200');
  assert.deepEqual(offPath.hits, [], 'enemy far from the path was not hit');
});

test('enemies beyond the dash range are not hit', () => {
  const p = new Player(0, 0);
  const far = dummyEnemy(SLASH_DASH.range + 200, 0);
  p.update(1 / 60, aimEast(p), [], [far]);
  for (let i = 0; i < 120; i++) p.update(1 / 60, input(), [], [far]);
  assert.deepEqual(far.hits, []);
});
