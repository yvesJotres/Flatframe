// Stealth melee and finishers (wiki): the bonus, who can be stealth attacked, true damage, and the stealth kill alert.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stealthMultiplier, isStealthTarget, applyStealthHit, alertAfterStealthKill, STEALTH } from '../src/combat/stealth.js';
import HealthComponent from '../src/combat/health.js';

test('the stealth multiplier is 2x unranked and 8x at rank 30, linear in between', () => {
  assert.equal(stealthMultiplier(0), 2);
  assert.equal(stealthMultiplier(30), 8);
  assert.ok(Math.abs(stealthMultiplier(15) - 5) < 1e-9);
  assert.equal(stealthMultiplier(99), 8, 'does not go past rank 30');
});

test('only unalerted or blinded enemies can be stealth attacked', () => {
  assert.equal(isStealthTarget({ alertState: 'unalerted' }), true);
  assert.equal(isStealthTarget({ alertState: 'cautious' }), false);
  assert.equal(isStealthTarget({ alertState: 'alerted' }), false);
  assert.equal(isStealthTarget({ alertState: 'alerted', isBlinded: () => true }), true);
});

test('a stealth hit is multiplied and marked as true damage', () => {
  const hit = applyStealthHit({ total: 100, baseTotal: 100, status: null }, 30);
  assert.equal(hit.total, 800);
  assert.equal(hit.trueDamage, true);
  assert.equal(hit.finisher, true);
});

test('true damage ignores armour, normal damage does not', () => {
  const armoured = () => new HealthComponent({ maxHp: 1000, maxShield: 0, armor: 2000 }, false);
  const normal = armoured();
  normal.takeDamage({ total: 100 });
  const truth = armoured();
  truth.takeDamage({ total: 100, trueDamage: true });
  assert.ok(normal.hp > 1000 - 100, 'armour reduces normal damage');
  assert.equal(truth.hp, 900, 'true damage goes straight through');
});

test('a stealth kill makes unaware enemies within 5 m cautious, and leaves far ones alone', () => {
  const dead = { x: 0, y: 0, hp: 0 };
  const near = { x: 4 * 15, y: 0, hp: 50, alertState: 'unalerted', transitionToCautious() { this.alertState = 'cautious'; } };
  const far = { x: 20 * 15, y: 0, hp: 50, alertState: 'unalerted', transitionToCautious() { this.alertState = 'cautious'; } };
  alertAfterStealthKill(dead, [dead, near, far]);
  assert.equal(near.alertState, 'cautious');
  assert.equal(far.alertState, 'unalerted');
  assert.equal(STEALTH.cautiousRadiusM, 5);
});

// Knockdown and ground finishers
import Crewman from '../src/enemies/corpus/crewman.js';
import { applyFinisherHit, GROUND_FINISHER_MULTIPLIER, KNOCKDOWN_SECONDS } from '../src/combat/stealth.js';
import { initPrimaryWeapons } from '../src/weapons/primary_weapon.js';
import { initSecondaryWeapons } from '../src/weapons/secondary_weapon.js';
import { initMeleeWeapons } from '../src/weapons/melee_weapon.js';
await initPrimaryWeapons();
await initSecondaryWeapons();
await initMeleeWeapons();

test('a knocked-down enemy is downed for the knockdown time, then gets up', () => {
  const e = new Crewman(0, 0, { lvl: 1 });
  assert.equal(e.isDowned(), false);
  e.knockDown();
  assert.equal(e.isDowned(), true);
  e.update(KNOCKDOWN_SECONDS + 0.1, [], [], []);
  assert.equal(e.isDowned(), false, 'it gets back up after the knockdown time');
});

test('a downed enemy does not move', () => {
  const e = new Crewman(0, 0, { lvl: 1 });
  e.knockDown();
  e.applyVelocity(1, 0, 0.5, 100);
  e.update(0.1, [], [], []);
  assert.equal(e.velocity.x, 0);
});

test('a ground finisher is 4x damage and true damage (ignores armour)', () => {
  const f = applyFinisherHit({ total: 100 });
  assert.equal(f.total, 100 * GROUND_FINISHER_MULTIPLIER);
  assert.equal(f.trueDamage, true);
});

// Auto attacks only target alerted enemies that are not blinded
import { canAutoAttack } from '../src/combat/stealth.js';
test('auto attacks skip unalerted, cautious and blinded enemies', () => {
  assert.equal(canAutoAttack({ alertState: 'alerted' }), true);
  assert.equal(canAutoAttack({ alertState: 'unalerted' }), false);
  assert.equal(canAutoAttack({ alertState: 'cautious' }), false);
  assert.equal(canAutoAttack({ alertState: 'alerted', isBlinded: () => true }), false);
});
