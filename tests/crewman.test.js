import { describe, it } from 'node:test';
import assert from 'node:assert';
import Crewman from '../src/enemies/corpus/crewman.js';
import Grenade from '../src/weapons/grenade.js';
import { UNITS_PER_METER } from '../src/engine/constants.js';
import { initPrimaryWeapons } from '../src/weapons/primary_weapon.js';
import { initMeleeWeapons } from '../src/weapons/melee_weapon.js';

await initPrimaryWeapons();
await initMeleeWeapons();

const dt = 1 / 60;

function makeTarget(x, y, hp = 1000) {
  return {
    x, y, radius: 16, hp, isPlayer: true,
    get alive() { return this.hp > 0; },
    takeDamage(n) { this.hp -= typeof n === 'number' ? n : n.total; },
  };
}

function facing(crewman, target) {
  crewman.angle = Math.atan2(target.y - crewman.y, target.x - crewman.x);
  crewman.aimDelay = 0;
}

describe('Crewman (wiki behavior)', () => {
  it('has wiki stats and a Dera that does 7 damage split 75/15/10', () => {
    const c = new Crewman(0, 0, { lvl: 1 });
    assert.equal(c.maxHp, 90);
    assert.equal(c.health.maxShield, 120);
    assert.equal(c.weapon.name, 'Dera');
    assert.ok(Math.abs(c.weapon.totalDamage - 7) < 1e-9);
    assert.ok(Math.abs(c.weapon.damage.puncture - 5.25) < 1e-9);
    assert.equal(c.weapon.statusChance, 0.01);
  });

  it('fires almost continuously rather than in bursts', () => {
    const c = new Crewman(0, 0);
    const target = makeTarget(9 * UNITS_PER_METER, 0);
    facing(c, target);
    const projectiles = [];
    for (let i = 0; i < 180; i++) c.behavior(dt, target, projectiles, []);
    assert.ok(projectiles.length >= 15, `only ${projectiles.length} shots in 3s`);
  });

  it('blind-fires from cover with reduced accuracy', () => {
    const c = new Crewman(0, 0);
    const target = makeTarget(300, 0);
    facing(c, target);
    c.enterCover();
    const seen = new Set();
    for (let i = 0; i < 60 * 6; i++) {
      c.behavior(dt, target, [], []);
      seen.add(c.weapon.minSpread);
      if (c.tactic.phase !== 'covered') break;
    }
    assert.ok(seen.has(1.5), 'aimed fire while peeking');
    assert.ok(seen.has(8), 'blind fire spread while covered');
  });

  it('finds cover behind a wall and prefers walkable spots', () => {
    const c = new Crewman(0, 0);
    c.navMesh = { isWalkableAt: (x) => !(x >= 100 && x <= 140), findPath: () => null };
    const target = makeTarget(300, 0);
    const spot = c.findCover(target, [3, 8]);
    assert.ok(spot, 'cover spot found');
    assert.ok(c.walkable(spot.x, spot.y));
    assert.ok(c.lineBlocked(spot.x, spot.y, target.x, target.y));
  });

  it('winds up then throws a grenade that damages by distance from the blast', () => {
    const c = new Crewman(0, 0);
    const near = makeTarget(10 * UNITS_PER_METER, 0);
    const far = makeTarget(10 * UNITS_PER_METER + 200, 0);
    facing(c, near);
    c.grenadeTimer = c.grenadeCooldown;
    const projectiles = [];

    c.behavior(dt, near, projectiles, []);
    assert.equal(c.tactic.phase, 'throw');
    assert.equal(projectiles.filter((p) => p instanceof Grenade).length, 0, 'not thrown during wind-up');

    for (let i = 0; i < 60 && !projectiles.some((p) => p instanceof Grenade); i++) c.behavior(dt, near, projectiles, []);
    const grenade = projectiles.find((p) => p instanceof Grenade);
    assert.ok(grenade, 'grenade thrown');
    assert.equal(grenade.damage, 400);
    grenade.targets = [near, far];

    for (let i = 0; i < 60 * 3 && !grenade.exploded; i++) grenade.update(dt);
    assert.ok(grenade.exploded);
    assert.ok(near.hp < 1000 - 300, `direct hit should be near 400, took ${1000 - near.hp}`);
    assert.equal(far.hp, 1000, 'target outside the blast is untouched');
    assert.ok(c.grenadeTimer === 0 && c.grenadeCooldown >= 8);
  });

  it('grenades charge faster from cover', () => {
    const target = makeTarget(10 * UNITS_PER_METER, 0);
    const open = new Crewman(0, 0);
    const covered = new Crewman(0, 0);
    open.grenadeCooldown = covered.grenadeCooldown = 100;
    facing(open, target);
    facing(covered, target);
    covered.enterCover();
    for (let i = 0; i < 120; i++) {
      open.behavior(dt, target, [], []);
      covered.behavior(dt, target, [], []);
    }
    assert.ok(covered.grenadeTimer > open.grenadeTimer);
  });
});
