import { test } from 'node:test';
import assert from 'node:assert/strict';
import HealthComponent from '../src/combat/health.js';

function gateDuration(maxShield) {
  if (maxShield < 53) return maxShield / 180 + 1/3;
  if (maxShield <= 1150) return Math.pow(maxShield / 350, 0.65) + 1/3;
  return 2.5;
}

test('shield gating: full shield break triggers scaled invulnerability', () => {
  const h = new HealthComponent({ maxHp: 100, maxShield: 100 }, true); // isPlayer = true
  // Break full shield: player shields have 50% DR, so need 200 raw to break 100 shield
  h.takeDamage(200);
  assert.equal(h.shield, 0);
  // Wiki formula: (100/350)^0.65 + 1/3 ≈ 0.78s
  const expected = gateDuration(100);
  assert.ok(Math.abs(h.shieldGateTimer - expected) < 0.02, `expected ~${expected.toFixed(2)}s, got ${h.shieldGateTimer}`);
  
  // Follow-up hit within gate
  h.takeDamage(50);
  assert.equal(h.hp, 100, 'hp protected during gate');
  
  // Expire gate
  h.update(h.shieldGateTimer + 0.01);
  h.takeDamage(50);
  assert.ok(h.hp < 100, 'hp took damage after gate expired');
});

test('shield gating: partial shield break uses same scaling', () => {
  const h = new HealthComponent({ maxHp: 100, maxShield: 100 }, true);
  h.takeDamage(50); // shield now 75 (50 * 0.5 DR = 25 shield dmg)
  assert.equal(h.shield, 75);
  
  // Break partial shield: need 150 raw to break 75 shield (75/0.5 = 150)
  h.takeDamage(150);
  const expected = gateDuration(100);
  assert.ok(Math.abs(h.shieldGateTimer - expected) < 0.02, `expected ~${expected.toFixed(2)}s, got ${h.shieldGateTimer}`);
});

test('shield restoration immediately ends gate', () => {
  const h = new HealthComponent({ maxHp: 100, maxShield: 100 }, true);
  h.takeDamage(200); // break shield
  const gateDurationBefore = h.shieldGateTimer;
  assert.ok(gateDurationBefore > 0, `gate should be active, got ${gateDurationBefore}`);
  
  h.restoreShield(10);
  assert.equal(h.shieldGateTimer, 0);
});
