import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseModStat, weaponModBonuses } from '../src/mods/mod_effects.js';
import { Mod } from '../src/mods/mod.js';

const serration = (rank) => new Mod({
  name: 'Serration', compatName: 'Primary', currentRank: rank,
  levelStats: [{ stats: ['+15% Damage'] }, { stats: ['+30% Damage'] }, { stats: ['+165% Damage'] }],
});

test('parseModStat reads wiki rank text into a percent bonus', () => {
  assert.deepEqual(parseModStat('+165% Damage'), { key: 'damage', percent: 165 });
  assert.deepEqual(parseModStat('+30% Critical Chance'), { key: 'critChance', percent: 30 });
  assert.deepEqual(parseModStat('+12.5% Fire Rate'), { key: 'fireRate', percent: 12.5 });
  assert.equal(parseModStat('+2 Max Ammo'), null, 'flat values are not percent bonuses');
});

test('weaponModBonuses uses only the current rank, not the sum of ranks', () => {
  assert.equal(weaponModBonuses([serration(2)], 'primary').damage, 30);
  assert.equal(weaponModBonuses([serration(3)], 'primary').damage, 165);
});

test('mods only count for the weapon slot they fit, and rank 0 adds nothing', () => {
  assert.equal(weaponModBonuses([serration(3)], 'secondary').damage, 0);
  assert.equal(weaponModBonuses([serration(0)], 'primary').damage, 0);
});
