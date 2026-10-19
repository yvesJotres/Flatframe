import { strict as assert } from 'node:assert';
import Lancer from '../src/enemies/grineer/lancer.js';
import { getFactionDamageMultiplier } from '../src/combat/damage_types.js';
import { reduceDamage } from '../src/combat/damage.js';
import HealthComponent from '../src/combat/health.js';
import { initPrimaryWeapons } from '../src/weapons/primary_weapon.js';
import { initMeleeWeapons } from '../src/weapons/melee_weapon.js';
import { loadWeapon } from './helpers/weapon_data.js';
const BRATON = await loadWeapon('Braton');

const UNITS_PER_METER = 15;

// Initialize weapons before running tests
await initPrimaryWeapons();
await initMeleeWeapons();

// Mock weapon firing - simulates one Braton shot
function simulateBratonShot(target) {
  const attack = BRATON.attacks.normal;
  const dmg = attack.damage;
  
  // Build damage object with faction multipliers applied
  const impact = dmg.impact * getFactionDamageMultiplier('grineer', 'impact');
  const puncture = dmg.puncture * getFactionDamageMultiplier('grineer', 'puncture');
  const slash = dmg.slash * getFactionDamageMultiplier('grineer', 'slash');
  
  const totalRaw = impact + puncture + slash;
  
  // Apply armor DR (enemy formula)
  const armor = target.armor;
  const dr = 0.9 * Math.sqrt(Math.min(2700, Math.max(0, armor)) / 2700);
  const finalDamage = totalRaw * (1 - dr);
  
  return {
    rawDamage: dmg,
    factionAdjusted: { impact, puncture, slash, total: totalRaw },
    armorDR: dr,
    finalDamage,
    isCrit: false
  };
}

function simulateCritShot(target) {
  const result = simulateBratonShot(target);
  result.finalDamage *= 1.6; // Braton crit multiplier (ref: 1.60x)
  result.isCrit = true;
  return result;
}

// Test: Braton vs Level 1 Lancer
function testBratonVsLancer() {
  const lancer = new Lancer(0, 0, { lvl: 1 });
  
  console.log('=== Braton vs Lv1 Lancer ===');
  console.log(`Lancer HP: ${lancer.hp}, Armor: ${lancer.armor}`);
  
  const normal = simulateBratonShot(lancer);
  console.log(`Normal shot: ${normal.finalDamage.toFixed(2)} dmg (raw: ${normal.factionAdjusted.total.toFixed(2)}, DR: ${(normal.armorDR*100).toFixed(1)}%)`);
  
  const crit = simulateCritShot(lancer);
  console.log(`Crit shot:   ${crit.finalDamage.toFixed(2)} dmg`);
  
  // Ref (Braton page + Damage 3.0): Impact 7.92 x1.5 + Puncture 7.92 + Slash 8.16 = 27.96 vs Grineer
  // After 24.5% DR (200 armor): ~21.1
  const shotsNormal = Math.ceil(lancer.hp / normal.finalDamage);
  const shotsCrit = Math.ceil(lancer.hp / crit.finalDamage);
  console.log(`Shots to kill: ${shotsNormal} (normal) / ${shotsCrit} (crit)`);
  
  // Assertions (updated for Damage 3.0 multipliers + new Braton stats)
  assert(normal.finalDamage > 20.5 && normal.finalDamage < 21.5, 'Normal damage in expected range');
  assert(crit.finalDamage > 33 && crit.finalDamage < 34.5, 'Crit damage in expected range');
  assert(shotsNormal === 5, 'Normal shots to kill = 5');
  assert(shotsCrit === 3, 'Crit shots to kill = 3');
  
  console.log('✓ All assertions passed\n');
}

// Test: Braton vs higher level Lancer (armor scaling)
function testBratonVsHighLevelLancer() {
  const lancer = new Lancer(0, 0, { lvl: 50 });
  
  console.log('=== Braton vs Lv50 Lancer ===');
  console.log(`Lancer HP: ${lancer.hp}, Armor: ${lancer.armor}`);
  
  const normal = simulateBratonShot(lancer);
  console.log(`Normal shot: ${normal.finalDamage.toFixed(2)} dmg (raw: ${normal.factionAdjusted.total.toFixed(2)}, DR: ${(normal.armorDR*100).toFixed(1)}%)`);
  
  const shotsNormal = Math.ceil(lancer.hp / normal.finalDamage);
  console.log(`Shots to kill: ${shotsNormal}`);
  
  // At high armor, damage should drop significantly (capped at 2700 -> 90% DR)
  // At armor 554: DR = 0.9 * sqrt(554/2700) = 0.9 * 0.453 = 40.8%
  // Damage = 24.30 * (1 - 0.408) = 14.39
  assert(normal.finalDamage < 20 && normal.finalDamage > 10, 'High armor reduces damage');
  console.log('✓ High-level armor scaling works\n');
}

// Test: Faction multiplier correctness
function testFactionMultipliers() {
  console.log('=== Faction Multiplier Tests ===');
  
  // Values from ref/extracted/Damage - WARFRAME Wiki.txt (Update 36.0 table)
  // Grineer: vulnerable to Impact and Corrosive, no resistances
  assert(getFactionDamageMultiplier('grineer', 'impact') === 1.5);
  assert(getFactionDamageMultiplier('grineer', 'corrosive') === 1.5);
  assert(getFactionDamageMultiplier('grineer', 'puncture') === 1.0);
  assert(getFactionDamageMultiplier('grineer', 'heat') === 1.0);
  assert(getFactionDamageMultiplier('grineer', 'slash') === 1.0);
  assert(getFactionDamageMultiplier('kuva_grineer', 'heat') === 0.5);

  // Corpus: vulnerable to Puncture and Magnetic
  assert(getFactionDamageMultiplier('corpus', 'puncture') === 1.5);
  assert(getFactionDamageMultiplier('corpus', 'magnetic') === 1.5);
  assert(getFactionDamageMultiplier('corpus', 'electricity') === 1.0);
  assert(getFactionDamageMultiplier('corpus', 'blast') === 1.0);
  assert(getFactionDamageMultiplier('corpus_amalgam', 'blast') === 0.5);

  // Infested: vulnerable to Slash and Heat
  assert(getFactionDamageMultiplier('infested', 'slash') === 1.5);
  assert(getFactionDamageMultiplier('infested', 'heat') === 1.5);
  assert(getFactionDamageMultiplier('infested', 'toxin') === 1.0);
  assert(getFactionDamageMultiplier('infested', 'viral') === 1.0);
  assert(getFactionDamageMultiplier('infested_deimos', 'viral') === 0.5);

  // Orokin: vulnerable to Puncture and Viral, resistant to Radiation
  assert(getFactionDamageMultiplier('orokin', 'puncture') === 1.5);
  assert(getFactionDamageMultiplier('orokin', 'viral') === 1.5);
  assert(getFactionDamageMultiplier('orokin', 'radiation') === 0.5);
  assert(getFactionDamageMultiplier('orokin', 'slash') === 1.0);
  console.log('Faction multipliers OK');
}

// Test: Armor DR formula
function testArmorDR() {
  console.log('=== Armor DR Formula Tests ===');
  
  // 0 armor = 0% DR
  assert(reduceDamage(100, 0, false) === 100);
  
  // 200 armor (Lv1 Lancer) = 90% × 200 ÷ 2700 ≈ 6.7% DR (wiki: linear up to 2700)
  const dr200 = 1 - reduceDamage(100, 200, false) / 100;
  assert(dr200 > 0.06 && dr200 < 0.07);
  
  // 2700 armor (cap) = 90% DR
  const dmg2700 = reduceDamage(100, 2700, false);
  assert(Math.abs(dmg2700 - 10) < 0.1);
  
  // 10000 armor still capped at 90% DR
  const dmg10000 = reduceDamage(100, 10000, false);
  assert(Math.abs(dmg10000 - 10) < 0.1);
  
  console.log('✓ Armor DR formula works correctly\n');
}

// Run all tests
testFactionMultipliers();
testArmorDR();
testBratonVsLancer();
testBratonVsHighLevelLancer();

console.log('🎯 All shoot tests passed!');