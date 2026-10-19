import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initPrimaryWeapons, PRIMARY_WEAPONS } from '../src/weapons/primary_weapon.js';
import PrimaryWeapon from '../src/weapons/primary_weapon.js';
import { Mod } from '../src/mods/mod.js';

await initPrimaryWeapons();

const serration = new Mod({
  name: 'Serration', compatName: 'Primary', currentRank: 10,
  levelStats: Array.from({ length: 10 }, (_, i) => ({ stats: [`+${15 * (i + 1)}% Damage`] })),
});

test('a Serration at rank 10 multiplies every damage type by 2.5 and leaves the base data alone', () => {
  const base = new PrimaryWeapon('Braton');
  const modded = new PrimaryWeapon('Braton');
  modded.applyMods([serration], 'primary');
  assert.ok(Math.abs(modded.damage.puncture - base.damage.puncture * 2.5) < 1e-9);
  assert.equal(PRIMARY_WEAPONS.Braton.attack.damage.puncture, base.damage.puncture, 'shared data is not mutated');
});

test('a full magazine stays full after a magazine mod', () => {
  const w = new PrimaryWeapon('Braton');
  const mag = new Mod({ name: 'Ammo', compatName: 'Primary', currentRank: 1, levelStats: [{ stats: ['+50% Magazine Capacity'] }] });
  w.applyMods([mag], 'primary');
  assert.equal(w.magazine, Math.round(45 * 1.5));
  assert.equal(w.ammo, w.magazine);
});
