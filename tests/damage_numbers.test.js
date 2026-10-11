// test/damageNumbers.test.js
// Regression test for damage numbers system - ensures it never gets accidentally removed

import { damageNumbersManager, DamageNumberType, DamageNumberMode, getDamageNumberType, formatDamageNumber } from '../src/combat/damage_numbers.js';

console.log('=== Damage Numbers System Regression Test ===\n');

// Test 1: All exports exist
console.log('Test 1: Exports exist');
const requiredExports = ['damageNumbersManager', 'DamageNumberType', 'DamageNumberMode', 'getDamageNumberType', 'formatDamageNumber'];
for (const exp of requiredExports) {
  if (typeof eval(exp) === 'undefined') {
    console.error(`FAIL: Missing export ${exp}`);
    process.exit(1);
  }
}
console.log('PASS: All exports present\n');

// Test 2: Manager has required methods
console.log('Test 2: Manager methods');
const requiredMethods = ['setLayer', 'setTransform', 'spawn', 'update', 'setVisible', 'updateSettings'];
for (const method of requiredMethods) {
  if (typeof damageNumbersManager[method] !== 'function') {
    console.error(`FAIL: Missing method damageNumbersManager.${method}`);
    process.exit(1);
  }
}
console.log('PASS: All manager methods present\n');

// Test 3: DamageNumberType enum values
console.log('Test 3: DamageNumberType values');
const expectedTypes = ['NORMAL', 'SHIELD', 'CRIT', 'CRIT_ORANGE', 'CRIT_RED', 'ABILITY', 'INVULNERABLE'];
for (const t of expectedTypes) {
  if (!DamageNumberType[t]) {
    console.error(`FAIL: Missing DamageNumberType.${t}`);
    process.exit(1);
  }
}
console.log('PASS: All damage number types present\n');

// Test 4: getDamageNumberType logic
console.log('Test 4: getDamageNumberType logic');
const tests = [
  { input: { isInvulnerable: true }, expected: DamageNumberType.INVULNERABLE },
  { input: { isShieldDamage: true }, expected: DamageNumberType.SHIELD },
  { input: { isAbility: true }, expected: DamageNumberType.ABILITY },
  { input: { isCritical: true, critTier: 1 }, expected: DamageNumberType.CRIT },
  { input: { isCritical: true, critTier: 2 }, expected: DamageNumberType.CRIT_ORANGE },
  { input: { isCritical: true, critTier: 3 }, expected: DamageNumberType.CRIT_RED },
  { input: {}, expected: DamageNumberType.NORMAL },
];
for (const { input, expected } of tests) {
  const result = getDamageNumberType(input);
  if (result !== expected) {
    console.error(`FAIL: getDamageNumberType(${JSON.stringify(input)}) = ${result}, expected ${expected}`);
    process.exit(1);
  }
}
console.log('PASS: getDamageNumberType logic correct\n');

// Test 5: formatDamageNumber
console.log('Test 5: formatDamageNumber');
if (formatDamageNumber(22) !== '22') { console.error('FAIL: 22'); process.exit(1); }
if (formatDamageNumber(1234) !== '1,234') { console.error('FAIL: 1234'); process.exit(1); }
// compact mode is off by default, so 1M format not expected
if (formatDamageNumber(1000000, { compact: true }) !== '1M') { console.error('FAIL: 1M with compact'); process.exit(1); }
console.log('PASS: formatDamageNumber correct\n');

// Test 6: Spawn and update cycle (simulates game loop)
console.log('Test 6: Spawn + update cycle');

// Mock DOM rendering methods on the manager instance
const originalRenderNumber = damageNumbersManager.renderNumber;
const originalRemoveNumber = damageNumbersManager.removeNumber;
const originalUpdateNumberDOM = damageNumbersManager.updateNumberDOM;

damageNumbersManager.renderNumber = () => {};
damageNumbersManager.removeNumber = () => {};
damageNumbersManager.updateNumberDOM = () => {};

// Mock layer (won't be used since renderNumber is mocked)
damageNumbersManager.setLayer({ style: { display: '' } });
damageNumbersManager.setTransform((x, y) => ({ x, y }));

// Spawn some numbers
damageNumbersManager.spawn({ x: 100, y: 100, value: 22, type: DamageNumberType.NORMAL });
damageNumbersManager.spawn({ x: 200, y: 200, value: 33, type: DamageNumberType.CRIT });
damageNumbersManager.spawn({ x: 300, y: 300, value: 1000, type: DamageNumberType.CRIT_RED });

if (damageNumbersManager.numbers.length !== 3) {
  console.error(`FAIL: Expected 3 numbers, got ${damageNumbersManager.numbers.length}`);
  process.exit(1);
}

// Simulate time passing - update until all expire
let dt = 0.016; // ~60fps
let updates = 0;
while (damageNumbersManager.numbers.length > 0 && updates < 1000) {
  damageNumbersManager.update(dt);
  updates++;
}
if (damageNumbersManager.numbers.length !== 0) {
  console.error(`FAIL: Numbers did not expire after ${updates} updates, ${damageNumbersManager.numbers.length} remaining`);
  process.exit(1);
}
console.log('PASS: Numbers spawn, animate, and expire correctly\n');

// Restore
damageNumbersManager.renderNumber = originalRenderNumber;
damageNumbersManager.removeNumber = originalRemoveNumber;
damageNumbersManager.updateNumberDOM = originalUpdateNumberDOM;

// Test 7: Verify game.js integration points exist (read file and check)
console.log('Test 7: game.js integration check');
const fs = await import('fs');
const gameJs = fs.readFileSync('src/game.js', 'utf8');

const requiredInGameJs = [
  "import { damageNumbersManager } from './combat/damage_numbers.js'",
  "damageNumbersManager.setLayer",
  "damageNumbersManager.setTransform",
  "damageNumbersManager.update(dt)",
];

for (const req of requiredInGameJs) {
  if (!gameJs.includes(req)) {
    console.error(`FAIL: game.js missing: ${req}`);
    process.exit(1);
  }
}
console.log('PASS: game.js integration complete\n');

console.log('=== ALL TESTS PASSED ===');
console.log('Damage numbers system is protected against regression.');