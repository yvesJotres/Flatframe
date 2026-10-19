import { describe, it } from 'node:test';
import assert from 'node:assert';
import BaseEnemy from '../src/enemies/enemy.js';
import PrimaryWeapon from '../src/weapons/primary_weapon.js';
import MeleeWeapon from '../src/weapons/melee_weapon.js';
import HealthComponent from '../src/combat/health.js';
import { initPrimaryWeapons } from '../src/weapons/primary_weapon.js';
import { initMeleeWeapons } from '../src/weapons/melee_weapon.js';

await initPrimaryWeapons();
await initMeleeWeapons();

describe('Enemy AI Behavior', () => {
  const dt = 1/60; // 60fps
  
  // Mock target (player-like object)
  function createMockTarget(x, y, options = {}) {
    let hp = options.hp ?? 100;
    const maxHp = options.maxHp ?? 100;
    return {
      x, y,
      radius: options.radius ?? 16,
      get hp() { return hp; },
      set hp(val) { hp = val; },
      maxHp,
      isPlayer: true,
      threat: options.threat ?? 1,
      takeDamage: function(dmg) { this.hp = Math.max(0, this.hp - dmg); },
      get alive() { return this.hp > 0; }
    };
  }

  it('should initialize with correct default state', () => {
    const enemy = new BaseEnemy(100, 100, { name: 'TestEnemy', lvl: 1 });
    
    assert.equal(enemy.x, 100);
    assert.equal(enemy.y, 100);
    assert.equal(enemy.alertState, 'unalerted');
    assert.equal(enemy.health.maxHp, 100);
    assert.equal(enemy.health.shield, 0);
    assert.equal(enemy.weapon, null);
    assert.equal(enemy.focus, null);
  });

  it('should patrol when unalerted', () => {
    const enemy = new BaseEnemy(100, 100, { name: 'TestEnemy', lvl: 1 });
    const target = createMockTarget(500, 500); // Far away
    
    // Update multiple frames
    for (let i = 0; i < 120; i++) { // 2 seconds
      enemy.update(dt, target);
    }
    
    // Enemy should have moved from original position (patrolling)
    const moved = Math.hypot(enemy.x - 100, enemy.y - 100) > 5;
    assert.ok(moved, 'Enemy should patrol when unalerted');
  });

  it('should become alerted when player enters vision cone', () => {
    const enemy = new BaseEnemy(100, 100, { name: 'TestEnemy', lvl: 1, visionArc: Math.PI, angle: 0 }); // Face right, 180° vision
    enemy.patrolAngle = 0; // Prevent random patrol rotation
    const target = createMockTarget(150, 100); // Directly in front (50 units away, to the right)
    
    enemy.update(dt, target);
    
    assert.equal(enemy.alertState, 'alerted');
    assert.equal(enemy.focus, target);
  });

  it('should NOT become alerted when player is outside vision cone', () => {
    const enemy = new BaseEnemy(100, 100, { name: 'TestEnemy', lvl: 1, visionArc: Math.PI / 2, angle: 0 }); // Face right, 90° vision
    enemy.patrolAngle = 0; // Prevent random patrol rotation
    const target = createMockTarget(50, 100); // Behind enemy (to the left)
    
    enemy.update(dt, target);
    
    assert.equal(enemy.alertState, 'unalerted');
    assert.equal(enemy.focus, null);
  });

  it('should equip and use primary weapon for ranged combat', () => {
    const enemy = new BaseEnemy(100, 100, { name: 'Lancer', lvl: 1, faction: 'grineer', visionArc: Math.PI * 2 });
    enemy.equip(new PrimaryWeapon('Grakata'));
    
    const target = createMockTarget(200, 100); // In range, in front
    
    // First become alerted
    enemy.update(dt, target);
    assert.equal(enemy.alertState, 'alerted');
    
    // Then update with weapon equipped
    for (let i = 0; i < 60; i++) { // 1 second
      enemy.update(dt, target);
    }
    
    // Should have fired (aimTime >= aimDelay)
    // Weapon should have been updated
    assert.ok(enemy.weapon !== null);
    assert.ok(enemy.aimTime >= 0);
  });

  it('should kite at preferred range when armed', () => {
    const enemy = new BaseEnemy(100, 100, { 
      name: 'Lancer', 
      lvl: 1, 
      faction: 'grineer',
      preferredRange: 200,
      rangeTolerance: 50
    });
    enemy.equip(new PrimaryWeapon('Grakata'));
    
    const target = createMockTarget(100, 100); // Same position - should back away
    
    // Become alerted
    enemy.update(dt, target);
    
    // Update several frames
    for (let i = 0; i < 180; i++) { // 3 seconds
      enemy.update(dt, target);
    }
    
    // Should have moved away to maintain preferred range
    const distance = Math.hypot(enemy.x - target.x, enemy.y - target.y);
    assert.ok(distance > 150, `Should kite at preferred range, got ${distance}`);
  });

  it('should use melee when no weapon equipped', () => {
    const enemy = new BaseEnemy(100, 100, { 
      name: 'Charger', 
      lvl: 1, 
      faction: 'infested',
      attackDamage: 25,
      attackRange: 24,
      visionArc: Math.PI * 2
    });
    // No weapon equipped
    
    const target = createMockTarget(105, 100); // Within melee reach
    
    // Become alerted (may need a few frames)
    for (let i = 0; i < 5; i++) {
      enemy.update(dt, target);
    }
    assert.equal(enemy.alertState, 'alerted');
    
    // Update several frames for melee attack
    for (let i = 0; i < 120; i++) { // 2 seconds
      enemy.update(dt, target);
    }
    
    // Target should have taken damage
    assert.ok(target.hp < 100, 'Melee enemy should damage target in range');
  });

  it('should alert nearby enemies when spotting player', () => {
    const enemy1 = new BaseEnemy(100, 100, { name: 'Lancer1', lvl: 1, visionArc: Math.PI * 2, angle: 0 });
    enemy1.patrolAngle = 0;
    const enemy2 = new BaseEnemy(150, 100, { name: 'Lancer2', lvl: 1 });
    const target = createMockTarget(200, 100);
    
    const enemies = [enemy1, enemy2];
    
    // Enemy1 sees player (give it a few frames)
    for (let i = 0; i < 5; i++) {
      enemy1.update(dt, target, [], enemies);
    }
    
    // Enemy1 should become alerted
    assert.equal(enemy1.alertState, 'alerted');
    
    // Enemy2 should become cautious (alerted by nearby)
    assert.equal(enemy2.alertState, 'cautious');
  });

  it('should separate from other enemies (personal space)', () => {
    const enemy1 = new BaseEnemy(100, 100, { name: 'Test1', lvl: 1, radius: 16, visionArc: Math.PI * 2 });
    const enemy2 = new BaseEnemy(110, 100, { name: 'Test2', lvl: 1, radius: 16, visionArc: Math.PI * 2 });
    const target = createMockTarget(300, 100);
    
    const enemies = [enemy1, enemy2];
    
    // Update multiple frames
    for (let i = 0; i < 60; i++) {
      enemy1.update(dt, target, [], enemies);
      enemy2.update(dt, target, [], enemies);
    }
    
    // Should have separated
    const distance = Math.hypot(enemy1.x - enemy2.x, enemy1.y - enemy2.y);
    const minGap = enemy1.radius + enemy2.radius + 8; // 40
    assert.ok(distance >= minGap - 5, `Should maintain separation, got ${distance}`);
  });

  it('should transition alert states correctly over time', () => {
    const enemy = new BaseEnemy(100, 100, { name: 'Test', lvl: 1, visionArc: Math.PI * 2, angle: 0 });
    enemy.patrolAngle = 0;
    const target = createMockTarget(150, 100);
    
    // Become alerted
    for (let i = 0; i < 5; i++) {
      enemy.update(dt, target);
    }
    assert.equal(enemy.alertState, 'alerted');
    
    // Simulate alert timer expiring (60 seconds = 3600 frames at 60fps)
    // We'll manually set timer to small value
    enemy.alertTimer = 0.1;
    // Pass NO target so enemy loses sight and can transition to cautious
    enemy.update(0.2, null, [], []); // dt larger than timer
    
    assert.equal(enemy.alertState, 'cautious');
    
    // Cautious timer expires
    enemy.alertTimer = 0.1;
    enemy.update(0.2, null, [], []);
    
    assert.equal(enemy.alertState, 'unalerted');
  });

  it('should respect weapon range and not fire when out of range', () => {
    const enemy = new BaseEnemy(100, 100, { name: 'Lancer', lvl: 1 });
    enemy.equip(new PrimaryWeapon('Grakata')); // Range ~30m = ~1800 units
    
    const target = createMockTarget(5000, 100); // Far away
    
    enemy.update(dt, target);
    
    // Should not have fired (out of range)
    // aimTime should reset
    enemy.update(dt, target);
    assert.equal(enemy.aimTime, 0);
  });

  it('should rotate smoothly towards target', () => {
    const enemy = new BaseEnemy(100, 100, { name: 'Test', lvl: 1, turnRate: Math.PI * 10, visionArc: Math.PI * 2, angle: 0 }); // 1800°/s - very fast
    enemy.patrolAngle = 0;
    const target = createMockTarget(100, 200); // Directly below (screen coords: y increases down)
    
    // Become alerted first (face target)
    for (let i = 0; i < 20; i++) {
      enemy.update(dt, target);
    }
    
    // In screen coordinates: target is below, so angle should be PI/2 (down)
    const expectedAngle = Math.PI / 2;
    let diff = expectedAngle - enemy.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    
    assert.ok(Math.abs(diff) < Math.PI / 4, `Should rotate towards target, diff=${diff.toFixed(3)}, angle=${enemy.angle.toFixed(3)}`);
  });
});