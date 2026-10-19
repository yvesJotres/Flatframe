import { strict as assert } from 'node:assert';
import Lancer from '../src/enemies/grineer/lancer.js';
import Crewman from '../src/enemies/corpus/crewman.js';
import { getFactionDamageMultiplier } from '../src/combat/damage_types.js';
import { initPrimaryWeapons } from '../src/weapons/primary_weapon.js';
import { initMeleeWeapons } from '../src/weapons/melee_weapon.js';
import { loadWeapon } from './helpers/weapon_data.js';
const BRATON = await loadWeapon('Braton');
const DERA = await loadWeapon('Dera');
const PROVA = await loadWeapon('Prova');

await initPrimaryWeapons();
await initMeleeWeapons();

function testWeaponVsEnemy(weapon, enemyClass, enemyName, level = 1) {
  console.log(`\n=== ${weapon.name} vs Lv${level} ${enemyName} ===`);
  
  const enemy = new enemyClass(0, 0, { lvl: level });
  const baseDmg = weapon.attacks?.normal?.damage ?? {};
  const total = Object.values(baseDmg).reduce((a, b) => a + b, 0);
  
  console.log(`Weapon: ${weapon.name}`);
  console.log(`  Base: I=${baseDmg.impact ?? 0}, P=${baseDmg.puncture ?? 0}, S=${baseDmg.slash ?? 0}, E=${baseDmg.electricity ?? 0}`);
  console.log(`Enemy: ${enemyName} (${enemy.faction})`);
  console.log(`  Level: ${enemy.lvl}, HP: ${enemy.maxHp}, Armor: ${enemy.armor}, Shield: ${enemy.maxShield ?? 0}`);
  
  // Calculate hit damage with faction multipliers
  const impact = (baseDmg.impact ?? 0) * getFactionDamageMultiplier(enemy.faction, 'impact');
  const puncture = (baseDmg.puncture ?? 0) * getFactionDamageMultiplier(enemy.faction, 'puncture');
  const slash = (baseDmg.slash ?? 0) * getFactionDamageMultiplier(enemy.faction, 'slash');
  const electricity = (baseDmg.electricity ?? 0) * getFactionDamageMultiplier(enemy.faction, 'electricity');
  const totalHit = impact + puncture + slash + electricity;
  
  console.log(`Hit Damage (with faction):`);
  console.log(`  Impact: ${impact.toFixed(2)} (${baseDmg.impact ?? 0} × ${getFactionDamageMultiplier(enemy.faction, 'impact')})`);
  console.log(`  Puncture: ${puncture.toFixed(2)} (${baseDmg.puncture ?? 0} × ${getFactionDamageMultiplier(enemy.faction, 'puncture')})`);
  console.log(`  Slash: ${slash.toFixed(2)} (${baseDmg.slash ?? 0} × ${getFactionDamageMultiplier(enemy.faction, 'slash')})`);
  console.log(`  Electricity: ${electricity.toFixed(2)} (${baseDmg.electricity ?? 0} × ${getFactionDamageMultiplier(enemy.faction, 'electricity')})`);
  console.log(`  Total: ${totalHit.toFixed(2)}`);
  
  return { totalHit };
}

// Test Dera vs Crewman
const crewman1 = testWeaponVsEnemy(DERA, Crewman, 'Crewman', 1);
const crewman50 = testWeaponVsEnemy(DERA, Crewman, 'Crewman', 50);

// Test Prova vs Crewman
const prova1 = testWeaponVsEnemy(PROVA, Crewman, 'Crewman', 1);

console.log('\n=== Corpus Damage Multipliers ===');
console.log('Impact: 1.0x');
console.log('Puncture: 1.5x');
console.log('Slash: 1.0x');
console.log('Magnetic: 1.5x');
console.log('Electricity: 1.0x');
console.log('All others: 1.0x');