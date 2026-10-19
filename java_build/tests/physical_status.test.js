import { test } from 'node:test';
import assert from 'node:assert/strict';
import Crewman from '../src/enemies/corpus/crewman.js';
import { initPrimaryWeapons } from '../src/weapons/primary_weapon.js';

import { initMeleeWeapons } from '../src/weapons/melee_weapon.js';
import { initSecondaryWeapons } from '../src/weapons/secondary_weapon.js';

await initPrimaryWeapons();
await initSecondaryWeapons();
await initMeleeWeapons();

// Wiki (Damage): Puncture is 40% less damage for the first stack, +10% per stack, 80% at 5 stacks
test('Puncture: 1 stack cuts the enemy damage by 40%, 5 stacks by 80%', () => {
  const e = new Crewman(0, 0, { lvl: 1 });
  assert.equal(e.punctureOutputMultiplier(), 1);
  e.punctureTimers = [6];
  assert.ok(Math.abs(e.punctureOutputMultiplier() - 0.6) < 1e-9);
  e.punctureTimers = [6, 6, 6, 6, 6];
  assert.ok(Math.abs(e.punctureOutputMultiplier() - 0.2) < 1e-9);
});

test('Impact procs stagger the enemy for 1 s, then it can move again', () => {
  const e = new Crewman(0, 0, { lvl: 1 });
  e.takeDamage({ total: 1, impact: 1, status: 'impact' });
  assert.equal(e.staggerTimer, 1);
  e.applyVelocity(1, 0, 0.5, 100);
  assert.equal(e.velocity.x, 0, 'no movement while staggered');
  e.update(1.1, [], [], []);
  assert.equal(e.staggerTimer, 0);
});

test('Puncture procs add stacks with their own 6 s timers, capped at 5', () => {
  const e = new Crewman(0, 0, { lvl: 1 });
  for (let i = 0; i < 7; i++) e.takeDamage({ total: 1, puncture: 1, status: 'puncture' });
  assert.equal(e.punctureTimers.length, 5);
  assert.ok(e.punctureTimers.every((t) => t === 6));
});

// Wiki (Bleed): a tick is 35% of base damage, with the critical multiplier applied on crit hits
test('Bleed tick uses base damage with the crit multiplier', () => {
  const e = new Crewman(0, 0, { lvl: 1 });
  e.takeDamage({ total: 200, baseTotal: 100, procBase: 200, status: 'slash' });
  const bleed = e.status.effects.find((f) => f.config?.bypassesArmor);
  assert.ok(bleed, 'bleed effect applied');
  assert.ok(Math.abs(bleed.tickDamage - 70) < 1e-9, `tick ${bleed.tickDamage}, expected 70`);
});
