import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOD_EFFECTS, weaponDamageMultiplier, healthMultiplier } from '../src/mods/mod_effects.js';
import PrimaryWeapon, { initPrimaryWeapons } from '../src/weapons/primary_weapon.js';
import SecondaryWeapon, { initSecondaryWeapons } from '../src/weapons/secondary_weapon.js';
import MeleeWeapon, { initMeleeWeapons } from '../src/weapons/melee_weapon.js';
import Player from '../src/warframe/player.js';

await initPrimaryWeapons();
await initSecondaryWeapons();
await initMeleeWeapons();

// Mods as the arsenal hands them over: anything with a name and a currentRank
const mod = (name, currentRank = 0) => ({ name, currentRank });

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} !== ${expected}`);

test('Serration gives +15% at rank 0 and +165% at rank 10', () => {
  close(weaponDamageMultiplier([mod('Serration', 0)], 'primary'), 1.15);
  close(weaponDamageMultiplier([mod('Serration', 10)], 'primary'), 2.65);
});

test('Hornet Strike gives +20% at rank 0 and +220% at rank 10 on secondaries', () => {
  close(weaponDamageMultiplier([mod('Hornet Strike', 0)], 'secondary'), 1.2);
  close(weaponDamageMultiplier([mod('Hornet Strike', 10)], 'secondary'), 3.2);
});

test('Pressure Point gives +20% per rank, capped at rank 5 (+120%)', () => {
  close(weaponDamageMultiplier([mod('Pressure Point', 0)], 'melee'), 1.2);
  close(weaponDamageMultiplier([mod('Pressure Point', 5)], 'melee'), 2.2);
  close(weaponDamageMultiplier([mod('Pressure Point', 9)], 'melee'), 2.2);
});

test('mods only affect the weapon category they are for', () => {
  const mods = [mod('Serration', 10), mod('Hornet Strike', 10), mod('Pressure Point', 5)];
  close(weaponDamageMultiplier(mods, 'primary'), 2.65);
  close(weaponDamageMultiplier(mods, 'secondary'), 3.2);
  close(weaponDamageMultiplier(mods, 'melee'), 2.2);
  close(weaponDamageMultiplier([mod('Serration', 10)], 'melee'), 1);
});

test('Serration does not apply to shotguns', () => {
  close(weaponDamageMultiplier([mod('Serration', 10)], 'primary', true), 1);
});

test('no mods means no multiplier', () => {
  close(weaponDamageMultiplier([], 'primary'), 1);
  close(weaponDamageMultiplier(undefined, 'melee'), 1);
  close(healthMultiplier([]), 1);
});

test('Vitality gives +9% at rank 0 and +100% max health at rank 10', () => {
  close(healthMultiplier([mod('Vitality', 0)]), 1.09);
  close(healthMultiplier([mod('Vitality', 10)]), 2);
});

test('a rank above the max is capped, not extrapolated', () => {
  close(weaponDamageMultiplier([mod('Serration', 99)], 'primary'), 2.65);
  assert.equal(MOD_EFFECTS.Serration.maxRank, 10);
});

test('equipMods changes the damage of the next hit, not the stored base damage', () => {
  const weapon = new PrimaryWeapon('Braton');
  weapon.critChance = 0; // keep the hit exact
  const baseTotal = weapon.totalDamage;
  const before = weapon.rollHit().total;
  weapon.equipMods([mod('Serration', 10)]);
  assert.equal(weapon.totalDamage, baseTotal);
  close(weapon.rollHit().total / before, 2.65);
});

test('Hornet Strike applies to a secondary weapon hit', () => {
  const weapon = new SecondaryWeapon();
  weapon.critChance = 0;
  const base = weapon.rollHit().total;
  weapon.equipMods([mod('Hornet Strike', 0)]);
  close(weapon.rollHit().total / base, 1.2);
});

test('Pressure Point is set on a melee weapon', () => {
  const weapon = new MeleeWeapon();
  weapon.equipMods([mod('Pressure Point', 5)]);
  close(weapon.modDamageMult, 2.2);
});

test('Vitality raises the player max health, and Serration reaches the primary weapon', () => {
  const plain = new Player(0, 0, {});
  const boosted = new Player(0, 0, { mods: [mod('Vitality', 10), mod('Serration', 10)] });
  assert.equal(plain.maxHealth, 370);
  assert.equal(boosted.maxHealth, 740);
  assert.equal(boosted.health, 740);
  close(boosted.primaryWeapon.modDamageMult, 2.65);
  close(plain.primaryWeapon.modDamageMult, 1);
});
