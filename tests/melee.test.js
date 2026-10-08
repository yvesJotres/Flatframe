import { test } from 'node:test';
import assert from 'node:assert/strict';
import MeleeWeapon, { MELEE_WEAPONS, DEFAULT_MELEE } from '../src/weapons/melee_weapon.js';
import Player from '../src/entities/player.js';

// MeleeWeapon gates on performance.now(); prime lastMeleeTime into the past
// so the *first* test swing is never gated by process-start uptime.
function readyToSwing(weapon) {
  weapon.lastMeleeTime = performance.now() - 2000;
}

function makeEnemy(x, y, opts = {}) {
  return {
    x,
    y,
    hp: opts.hp ?? 100,
    radius: opts.radius ?? 16,
    damages: [],
    takeDamage(hit) {
      this.damages.push(hit);
      this.hp -= hit.total;
    },
  };
}

// Player at (0,0) facing +x (angle 0), like a fresh spawn aiming right.
const playerAtOrigin = () => ({ x: 0, y: 0, angle: 0 });

test('constructor: defaults to Skana, melee category, 120° arc; unknown name throws', () => {
  const w = new MeleeWeapon();
  assert.equal(w.name, 'Skana');
  assert.equal(w.category, 'melee');
  assert.equal(DEFAULT_MELEE, 'Skana');
  assert.ok(MELEE_WEAPONS.Skana, 'Skana registered in MELEE_WEAPONS');
  assert.ok(Math.abs(w.arc - (120 * Math.PI) / 180) < 1e-9, 'arc converted to radians');
  assert.throws(() => new MeleeWeapon('Lightsaber'), /Unknown melee weapon/);
});

test('fire() is a safe no-op (melee never spawns projectiles or burns ammo)', () => {
  const w = new MeleeWeapon();
  const ammo = w.ammo;
  assert.doesNotThrow(() => w.fire());
  assert.equal(w.ammo, ammo);
});

test('swing hits an enemy directly in front, within range', () => {
  const w = new MeleeWeapon();
  readyToSwing(w);
  const enemy = makeEnemy(20, 0); // distance 20, reach = 3 * 8 (+ radius)
  const struck = w.melee(playerAtOrigin(), [enemy]);
  assert.ok(Array.isArray(struck), 'real swing returns an array');
  assert.equal(struck.length, 1);
  assert.equal(struck[0], enemy);
  assert.equal(enemy.damages.length, 1, 'enemy received damage');
});

test('enemy behind the player is NOT struck (arc/facing filter)', () => {
  const w = new MeleeWeapon();
  readyToSwing(w);
  const behind = makeEnemy(-20, 0);
  const struck = w.melee(playerAtOrigin(), [behind]);
  assert.ok(Array.isArray(struck));
  assert.equal(struck.length, 0, 'behind the swing arc');
  assert.equal(behind.damages.length, 0);
});

test('enemy out of reach is NOT struck', () => {
  const w = new MeleeWeapon();
  readyToSwing(w);
  const far = makeEnemy(500, 0); // reach + radius = 24 + 16 = 40
  const struck = w.melee(playerAtOrigin(), [far]);
  assert.ok(Array.isArray(struck));
  assert.equal(struck.length, 0);
});

test('whiff returns an empty ARRAY (distinct from a cooldown-gated null)', () => {
  const w = new MeleeWeapon();
  readyToSwing(w);
  const struck = w.melee(playerAtOrigin(), []); // real swing, nothing to hit
  assert.ok(Array.isArray(struck), 'whiff is an array, not null');
  assert.equal(struck.length, 0);
});

test('second swing inside the 450ms cooldown returns null (gated)', () => {
  const w = new MeleeWeapon();
  readyToSwing(w);
  const first = w.melee(playerAtOrigin(), []);
  assert.ok(Array.isArray(first), 'first swing goes through');
  const second = w.melee(playerAtOrigin(), []);
  assert.equal(second, null, 'gated by cooldown');
});

test('combo multiplier math: 0/19 hits = 1x, 20 = 1.25x, 40 = 1.5x', () => {
  const w = new MeleeWeapon();
  w.comboCount = 0;
  assert.equal(w.getComboMultiplier(), 1);
  w.comboCount = 19;
  assert.equal(w.getComboMultiplier(), 1);
  w.comboCount = 20;
  assert.equal(w.getComboMultiplier(), 1.25);
  w.comboCount = 40;
  assert.equal(w.getComboMultiplier(), 1.5);
});

test('combo multiplier scales damage and comboCount grows per enemy struck', () => {
  const w = new MeleeWeapon();
  readyToSwing(w);
  w.rollHit = () => ({ total: 40, crit: false, status: null }); // deterministic
  w.comboCount = 20; // 1.25x
  const a = makeEnemy(20, 0);
  const b = makeEnemy(15, 5);
  const struck = w.melee(playerAtOrigin(), [a, b]);
  assert.equal(struck.length, 2);
  assert.equal(a.damages[0].total, 50, '40 * 1.25');
  assert.equal(b.damages[0].total, 50, '40 * 1.25');
  assert.equal(w.comboCount, 22, 'grew by one per struck enemy');
});

test('cooldown shortens at higher combo (0.45s base / 1.25 at 20 combo)', () => {
  const noCombo = new MeleeWeapon();
  noCombo.lastMeleeTime = performance.now() - 400; // 400ms ago
  assert.equal(noCombo.melee(playerAtOrigin(), []), null, '400ms < 450ms → gated');

  const comboed = new MeleeWeapon();
  comboed.comboCount = 20;
  comboed.comboTimer = 3000;
  comboed.lastMeleeTime = performance.now() - 400;
  assert.ok(Array.isArray(comboed.melee(playerAtOrigin(), [])), '400ms >= 360ms → swing');
});

test('update() decays the combo after the 3s timer expires', () => {
  const w = new MeleeWeapon();
  w.comboCount = 25;
  w.comboTimer = 3000;
  w.update(1.0); // partial tick: 3000 → 2000
  assert.equal(w.comboCount, 25, 'combo kept while timer runs');
  assert.equal(w.comboTimer, 2000);
  w.update(3.1); // expires
  assert.equal(w.comboCount, 0, 'combo reset when timer expires');
});

test('3s of swing inactivity resets the combo on the next swing', () => {
  const w = new MeleeWeapon();
  readyToSwing(w);
  w.comboCount = 25;
  w.comboTimer = 3000;
  w.lastMeleeTime = performance.now() - 4000; // stale swing
  const enemy = makeEnemy(20, 0);
  const struck = w.melee(playerAtOrigin(), [enemy]);
  assert.equal(struck.length, 1);
  assert.equal(w.comboCount, 1, 'stale combo dropped before counting this hit');
});

test('Player: whiffed swing still shows the swing visual (meleeSwingTimer set)', () => {
  const player = new Player(0, 0);
  player.currentWeapon = player.meleeWeapon;
  readyToSwing(player.meleeWeapon);
  const input = {
    mouse: { x: 100, y: 0, down: true, rightDown: false, middleDown: false },
    isKeyPressed: () => false,
    isKeyDown: () => false,
  };
  const mouseWorld = { x: 100, y: 0, down: true, rightDown: false, middleDown: false };

  player.handleWeapons(0, input, [], [], mouseWorld); // holding fire, no enemies → whiff
  console.log('After handleWeapons, meleeSwingTimer:', player.meleeSwingTimer);
  assert.equal(player.meleeSwingTimer, 0.15, 'whiff still swings visually');
  assert.deepEqual(player.meleeSwingHits, [], 'no hit sparks on a whiff');

  // Next frame: still on cooldown → gated (null) → visual must NOT re-arm.
  player.meleeSwingTimer = 0;
  player.handleWeapons(0, input, [], [], mouseWorld);
  assert.equal(player.meleeSwingTimer, 0, 'gated swing does not re-arm the visual');
});

test('Heavy attack: wiki stats (90 base), 140° arc, consumes combo multiplier then resets combo', () => {
  const w = new MeleeWeapon();
  readyToSwing(w);
  w.comboCount = 20; // 1.25x
  // make crit deterministic: disable crit chance
  w.heavyAttackData.critChance = 0;
  const enemy = makeEnemy(20, 0);
  const struck = w.heavyAttack(playerAtOrigin(), [enemy]);
  
  assert.equal(struck.length, 1);
  // heavyBase 90 * comboMult 1.25 * critMult 1 = 112.5
  assert.equal(enemy.damages[0].total, 112.5);
  assert.equal(enemy.damages[0].isHeavy, true);
  assert.equal(w.comboCount, 0, 'combo consumed');
});

test('Heavy attack: gated by 0.6s wind-up', () => {
  const w = new MeleeWeapon();
  readyToSwing(w);
  w.heavyAttack(playerAtOrigin(), []); // first one goes through
  const second = w.heavyAttack(playerAtOrigin(), []);
  assert.equal(second, null, 'gated by 0.6s wind-up');
});

test('Wiki Alignment: Normal attack stats', () => {
  const w = new MeleeWeapon();
  assert.equal(w.attack.fireRate, 1.0);
  assert.equal(w.attack.range, 2.5);
  assert.equal(w.attack.critMultiplier, 1.8);
  assert.equal(w.attack.damage.slash, 45);
});

