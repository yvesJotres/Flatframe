import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Projectile from '../src/weapons/projectile.js';
import Player from '../src/warframe/player.js';
import Lancer from '../src/enemies/grineer/lancer.js';
import { HITSCAN_SPEED, UNITS_PER_METER } from '../src/engine/constants.js';
import { initPrimaryWeapons } from '../src/weapons/primary_weapon.js';
import { initSecondaryWeapons } from '../src/weapons/secondary_weapon.js';
import { initMeleeWeapons } from '../src/weapons/melee_weapon.js';

await initPrimaryWeapons();
await initSecondaryWeapons();
await initMeleeWeapons();

const dt = 1 / 60;
const HIT = { total: 10, impact: 10, puncture: 0, slash: 0, heat: 0, crit: false, status: null };

function dummy(x) {
  return { x, y: 0, radius: 16, hp: 1000, hits: 0, takeDamage() { this.hits += 1; } };
}

function hitscan(maxDistance = 300 * UNITS_PER_METER) {
  return new Projectile(0, 0, 1, 0, HIT, { speed: HITSCAN_SPEED, maxDistance });
}

describe('hitscan tracer', () => {
  it('deals damage once, however long the tracer lingers', () => {
    const target = dummy(5 * UNITS_PER_METER);
    const shot = hitscan();
    for (let i = 0; i < 20; i++) shot.update(dt, [target]);
    assert.equal(target.hits, 1);
  });

  it('fades out and ends after a hit', () => {
    const shot = hitscan();
    const target = dummy(5 * UNITS_PER_METER);
    let frames = 0;
    while (shot.active && frames < 60) { shot.update(dt, [target]); frames += 1; }
    assert.equal(shot.active, false, 'tracer should end');
    assert.ok(frames <= Math.ceil(shot.hitscanDuration / dt) + 2, `ended in ${frames} frames`);
  });

  it('fades out and ends after a miss', () => {
    const shot = hitscan();
    let frames = 0;
    while (shot.active && frames < 60) { shot.update(dt, []); frames += 1; }
    assert.equal(shot.active, false, 'a missed tracer should end too');
  });

  it('shows its tracer when it hits a target it starts inside', () => {
    const target = dummy(0);
    const shot = hitscan();
    shot.update(dt, [target]);
    assert.ok(shot.hitscanTimer > 0, 'the landed shot keeps a visible tracer');
    assert.equal(target.hits, 1);
  });

  it('never draws once spent', () => {
    const shot = hitscan();
    shot.active = false;
    let drew = false;
    shot.draw({ save() { drew = true; }, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, arc() {}, fill() {} });
    assert.equal(drew, false);
  });
});

describe('Simulacrum test states', () => {
  it('a player with invulnerable set takes no damage; normally they do', () => {
    const normal = new Player(0, 0);
    const before = normal.healthComponent.shield + normal.healthComponent.hp;
    normal.takeDamage(100);
    assert.ok(normal.healthComponent.shield + normal.healthComponent.hp < before, 'baseline: damage applies');

    const immune = new Player(0, 0);
    immune.invulnerable = true;
    const start = immune.healthComponent.shield + immune.healthComponent.hp;
    assert.equal(immune.takeDamage(100000), 0);
    assert.equal(immune.healthComponent.shield + immune.healthComponent.hp, start);
    assert.equal(immune.isBleedingOut, false);
  });

  it('invulnerability is the player only: enemies still take damage', () => {
    const lancer = new Lancer(0, 0, { lvl: 1 });
    const hp = lancer.hp;
    lancer.takeDamage({ total: 30, impact: 30, puncture: 0, slash: 0, heat: 0, crit: false, status: null });
    assert.ok(lancer.hp < hp);
  });

  it('a paused enemy stays still and does not shoot, but still takes damage', () => {
    const lancer = new Lancer(0, 0, { lvl: 1 });
    const target = { x: 100, y: 0, radius: 16, hp: 1000, alive: true, takeDamage() {} };
    const projectiles = [];
    lancer.aiPaused = true;
    for (let i = 0; i < 120; i++) lancer.update(dt, [target], projectiles, [lancer]);
    assert.equal(lancer.x, 0);
    assert.equal(lancer.y, 0);
    assert.equal(projectiles.length, 0);

    const hp = lancer.hp;
    lancer.takeDamage({ total: 30, impact: 30, puncture: 0, slash: 0, heat: 0, crit: false, status: null });
    assert.ok(lancer.hp < hp, 'paused enemies are still damageable');
  });

  it('resuming AI lets the enemy act again', () => {
    const lancer = new Lancer(0, 0, { lvl: 1 });
    const target = { x: 200, y: 0, radius: 16, hp: 1000, alive: true, takeDamage() {} };
    lancer.aiPaused = true;
    lancer.update(dt, [target], [], [lancer]);
    lancer.aiPaused = false;
    let moved = false;
    for (let i = 0; i < 240 && !moved; i++) {
      lancer.update(dt, [target], [], [lancer]);
      moved = lancer.x !== 0 || lancer.y !== 0;
    }
    assert.ok(moved, 'an unpaused Lancer moves toward or around its target');
  });
});
