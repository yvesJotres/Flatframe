import { test } from 'node:test';
import { gameNow } from '../src/engine/game_clock.js';
import assert from 'node:assert/strict';
import MeleeWeapon, { MELEE_WEAPONS, DEFAULT_MELEE } from '../src/weapons/melee_weapon.js';
import Player from '../src/warframe/player.js';
import { initPrimaryWeapons } from '../src/weapons/primary_weapon.js';
import { initSecondaryWeapons } from '../src/weapons/secondary_weapon.js';
import { initMeleeWeapons } from '../src/weapons/melee_weapon.js';

await initPrimaryWeapons();
await initSecondaryWeapons();
await initMeleeWeapons();

// MeleeWeapon gates on gameNow(); prime lastMeleeTime into the past
// so the *first* test swing is never gated by process-start uptime.
function readyToSwing(weapon) {
  weapon.lastMeleeTime = gameNow() - 2000;
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

test('constructor: defaults to Skana, melee category, 45° arc; unknown name throws', () => {
  const w = new MeleeWeapon();
  assert.equal(w.name, 'Skana');
  assert.equal(w.category, 'melee');
  assert.equal(DEFAULT_MELEE, 'Skana');
  assert.ok(MELEE_WEAPONS.Skana, 'Skana registered in MELEE_WEAPONS');
  assert.ok(Math.abs(w.arc - (45 * Math.PI) / 180) < 1e-9, 'arc converted to radians');
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

test('combo multiplier math (wiki): 0-19 hits = 1x, 20 = 2x, 40 = 3x, capped at 12x', () => {
  const w = new MeleeWeapon();
  w.comboCount = 0;
  assert.equal(w.getComboMultiplier(), 1);
  w.comboCount = 19;
  assert.equal(w.getComboMultiplier(), 1);
  w.comboCount = 20;
  assert.equal(w.getComboMultiplier(), 2);
  w.comboCount = 40;
  assert.equal(w.getComboMultiplier(), 3);
  w.comboCount = 220;
  assert.equal(w.getComboMultiplier(), 12);
  w.comboCount = 500;
  assert.equal(w.getComboMultiplier(), 12);
});

test('normal swings are not multiplied by the combo; comboCount grows per enemy struck', () => {
  const w = new MeleeWeapon();
  readyToSwing(w);
  w.rollHit = () => ({ total: 40, crit: false, status: null }); // deterministic
  w.comboCount = 20;
  const a = makeEnemy(20, 0);
  const b = makeEnemy(15, 5);
  const struck = w.melee(playerAtOrigin(), [a, b]);
  assert.equal(struck.length, 2);
  assert.equal(a.damages[0].total, 40, 'normal hit is unscaled');
  assert.equal(b.damages[0].total, 40, 'normal hit is unscaled');
  assert.equal(w.comboCount, 22, 'grew by one per struck enemy');
});

test('cooldown is the weapon cooldown regardless of combo (the wiki has no combo speed-up)', () => {
  const comboed = new MeleeWeapon();
  comboed.comboCount = 100;
  comboed.comboTimer = 5000;
  comboed.lastMeleeTime = gameNow() - 400;
  assert.equal(comboed.melee(playerAtOrigin(), []), null, '400ms < base cooldown → gated even at high combo');
});

test('update() decays the combo after the 5s timer expires', () => {
  const w = new MeleeWeapon();
  w.comboCount = 25;
  w.comboTimer = 5000;
  w.update(1.0); // partial tick: 5000 → 4000
  assert.equal(w.comboCount, 25, 'combo kept while timer runs');
  assert.equal(w.comboTimer, 4000);
  w.update(5.1); // expires
  assert.equal(w.comboCount, 0, 'combo reset when timer expires');
});

test('5s of swing inactivity resets the combo on the next swing', () => {
  const w = new MeleeWeapon();
  readyToSwing(w);
  w.comboCount = 25;
  w.comboTimer = 5000;
  w.lastMeleeTime = gameNow() - 6000; // stale swing
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

test('Heavy attack: wiki stats (120 base), 140° arc, consumes combo multiplier then resets combo', () => {
  const w = new MeleeWeapon();
  readyToSwing(w);
  w.comboCount = 20; // 2x
  // make crit deterministic: disable crit chance
  w.heavyAttackData.critChance = 0;
  const enemy = makeEnemy(20, 0);
  const struck = w.heavyAttack(playerAtOrigin(), [enemy]);
  
  assert.equal(struck.length, 1);
  // Wiki: normal damage {impact:18, puncture:18, slash:84} total=120
  // heavy_attack.damage_multiplier=2 (not confirmed on the wiki) => heavy total=240
  // combo 2x (wiki) => 240 * 2 = 480
  assert.equal(enemy.damages[0].total, 480);
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
  assert.equal(w.attack.fireRate, 0.833);
  assert.equal(w.attack.range, 2.5);
  assert.equal(w.attack.critMultiplier, 1.5);
  assert.equal(w.attack.damage.slash, 84);
});

