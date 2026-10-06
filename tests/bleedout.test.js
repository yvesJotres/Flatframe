import { test } from 'node:test';
import assert from 'node:assert/strict';
import Player from '../src/entities/player.js';
import BaseEnemy from '../src/entities/ai/enemies/base.js';

function noInput(overrides = {}) {
  return {
    mouse: { x: 0, y: 0, down: false },
    isKeyDown: () => false,
    isKeyPressed: () => false,
    ...overrides,
  };
}

// Drive the player to a downed state with one lethal hit.
function downed() {
  const p = new Player(0, 0);
  p.shield = 0;
  p.health = 1;
  p.takeDamage(100000);
  assert.equal(p.isBleedingOut, true, 'lethal hit should enter bleedout');
  assert.equal(p.alive, true, 'bleeding out is not dead');
  return p;
}

test('lethal damage enters bleedout, not instant death', () => {
  const p = downed();
  assert.ok(Math.abs(p.bleedoutTimer - 20) < 1e-9, 'bleedout lasts 20s');
  assert.equal(p.health, 1, 'downed player hangs on at 1 HP');
});

test('downed player is ignored by enemy damage', () => {
  const p = downed();
  assert.equal(p.takeDamage(5000), 0, 'damage returns 0 while bleeding out');
  assert.equal(p.health, 1, 'health untouched while downed');
});

test('downed combat uses the secondary only — no primary, no melee, no swapping', () => {
  const p = downed();
  const primaryAmmo = p.primaryWeapon.ammo;
  const projectiles = [];
  const swapInput = noInput({
    mouse: { x: 300, y: 0, down: true },
    isKeyDown: (k) => k === '1' || k === 'e' || k === 'f',
    isKeyPressed: (k) => k === '1' || k === 'e',
  });
  for (let i = 0; i < 60; i++) p.update(1 / 60, swapInput, projectiles, []);
  assert.ok(projectiles.length > 0, `fired ${projectiles.length} projectiles while downed`);
  assert.equal(p.currentWeapon, p.secondaryWeapon, 'secondary stays equipped');
  assert.equal(p.primaryWeapon.ammo, primaryAmmo, 'primary never fired');
  assert.equal(p.isBleedingOut, true, 'still bleeding out after firing');
});

test('bleedout timer expiry → awaiting self-revive, body gone, X marker left', () => {
  const p = downed();
  p.x = 400;
  p.y = 250;
  for (let i = 0; i < 420; i++) p.update(0.05, noInput(), [], []);
  assert.equal(p.alive, true, 'not dead — waiting for self-revive');
  assert.equal(p.isBleedingOut, true, 'still downed');
  assert.equal(p.awaitingRevive, true, 'awaiting revive flag set');
  assert.equal(p.x, 400, 'marker parked at the downed position');
  assert.equal(p.y, 250, 'marker parked at the downed position');
  // No actions while awaiting: firing does nothing.
  const projectiles = [];
  const firing = noInput({ mouse: { x: 300, y: 0, down: true } });
  for (let i = 0; i < 60; i++) p.update(1 / 60, firing, projectiles, []);
  assert.equal(projectiles.length, 0, 'cannot shoot without a body');
  // Still immune to enemies.
  assert.equal(p.takeDamage(5000), 0, 'immune while awaiting revive');
});

test('hold X revives from the awaiting state, consuming one charge', () => {
  const p = downed();
  for (let i = 0; i < 420; i++) p.update(0.05, noInput(), [], []);
  assert.equal(p.awaitingRevive, true, 'started out awaiting');
  const input = noInput({ isKeyDown: (k) => k === 'x' });
  for (let i = 0; i < 130; i++) p.update(1 / 60, input, [], []);
  assert.equal(p.awaitingRevive, false, 'no longer awaiting');
  assert.equal(p.isBleedingOut, false, 'no longer downed');
  assert.equal(p.alive, true, 'alive');
  assert.equal(p.revivesRemaining, 3, 'one revive consumed');
  assert.equal(p.health, p.maxHealth, 'health restored');
});

test('zero revives left = instant death, no bleedout', () => {
  const p = new Player(0, 0);
  p.shield = 0;
  p.health = 1;
  p.revivesRemaining = 0;
  p.takeDamage(100000);
  assert.equal(p.alive, false, 'dead');
  assert.equal(p.isBleedingOut, false, 'no bleedout with no revives');
  assert.equal(p.awaitingRevive, false, 'not awaiting');
});

test('holding X for 2s revives with one fewer revive', () => {
  const p = downed();
  const revivesBefore = p.revivesRemaining;
  const input = noInput({ isKeyDown: (k) => k === 'x' });
  for (let i = 0; i < 130; i++) p.update(1 / 60, input, [], []);
  assert.equal(p.isBleedingOut, false, 'no longer bleeding out');
  assert.equal(p.alive, true, 'alive again');
  assert.equal(p.revivesRemaining, revivesBefore - 1, 'one revive consumed');
  assert.equal(p.health, p.maxHealth, 'health restored');
  assert.equal(p.shield, p.maxShield, 'shields restored');
});

test('enemies wander instead of freezing when no target is eligible', () => {
  const e = new BaseEnemy(100, 100);
  const { x, y } = e;
  for (let i = 0; i < 240; i++) e.update(1 / 60, [], [], []);
  assert.ok(Math.hypot(e.x - x, e.y - y) > 1, 'enemy drifted while targetless');
});

test('enemy becomes alerted and moves toward attacker when damaged', () => {
  const e = new BaseEnemy(100, 100);
  // Attack from the right (player at x=200)
  e.takeDamage(10, 200, 100);
  assert.equal(e.alertTimer, 3, 'alert timer set');
  assert.ok(e.lastDamageAngle === 0 || e.lastDamageAngle > 0, 'damage angle stored (0 = right)');
  
  // Update a few frames - should move toward attacker
  const startX = e.x;
  for (let i = 0; i < 60; i++) e.update(1 / 60, [], [], []);
  assert.ok(e.x > startX, 'enemy moved toward attacker (right)');
});

test('enemy acquires player as focus when alerted and player in range', () => {
  const e = new BaseEnemy(100, 100);
  const player = { x: 300, y: 100, isPlayer: true, alive: true, hp: 100, health: { isDead: false } };
  
  // Attack from far away (outside normal vision)
  e.takeDamage(10, 300, 100);
  assert.equal(e.alertTimer, 3);
  
  // Update with player in candidates - should acquire focus
  e.update(1/60, player, [], []);
  assert.equal(e.focus, player, 'enemy acquired player as focus while alerted');
});
