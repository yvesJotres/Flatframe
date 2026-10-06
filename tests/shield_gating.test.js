import { test } from 'node:test';
import assert from 'node:assert/strict';
import HealthComponent from '../src/core/health.js';

test('shield gating: full shield break triggers 1.3s invulnerability', () => {
  const h = new HealthComponent({ maxHp: 100, maxShield: 100 });
  // Break full shield
  h.takeDamage(150);
  assert.equal(h.shield, 0);
  assert.equal(h.shieldGateTimer, 1.3);
  
  // Follow-up hit within gate
  h.takeDamage(50);
  assert.equal(h.hp, 100, 'hp protected during gate');
  
  // Expire gate
  h.update(1.3);
  h.takeDamage(50);
  assert.ok(h.hp < 100, 'hp took damage after gate expired');
});

test('shield gating: partial shield break triggers 0.3s invulnerability', () => {
  const h = new HealthComponent({ maxHp: 100, maxShield: 100 });
  h.takeDamage(50); // shield now 50
  assert.equal(h.shield, 50);
  
  // Break partial shield
  h.takeDamage(100);
  assert.equal(h.shieldGateTimer, 0.3);
});

test('shield restoration immediately ends gate', () => {
  const h = new HealthComponent({ maxHp: 100, maxShield: 100 });
  h.takeDamage(150);
  assert.equal(h.shieldGateTimer, 1.3);
  
  h.restoreShield(10);
  assert.equal(h.shieldGateTimer, 0);
});
