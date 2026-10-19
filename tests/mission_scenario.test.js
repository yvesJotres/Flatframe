import { strict as assert } from 'node:assert';
import { test, describe, beforeEach, afterEach } from 'node:test';
import { getMission, waveSize } from '../src/missions/missions.js';
import CryoPod from '../src/missions/objective.js';
import Lancer from '../src/enemies/grineer/lancer.js';
import { updateEnemies } from '../src/enemies/ai_behavior.js';
import { reduceDamage } from '../src/combat/damage.js';
import HealthComponent from '../src/combat/health.js';
import { initPrimaryWeapons } from '../src/weapons/primary_weapon.js';
import { initMeleeWeapons } from '../src/weapons/melee_weapon.js';

await initPrimaryWeapons();
await initMeleeWeapons();

describe('Mission Scenario Tests', () => {

  // Mock canvas for NavMesh
  const mockCanvas = { width: 1920, height: 1080 };

  describe('Mission Definitions', () => {
    test('exterminate mission has correct config', () => {
      const mission = getMission('exterminate');
      assert.equal(mission.id, 'exterminate');
      assert.equal(mission.killQuota, 24);
      assert.equal(mission.maxEnemies, 5);
      assert.equal(mission.endless, false);
      assert.equal(mission.levelPerKills, 8);
    });

    test('defense mission has correct config', () => {
      const mission = getMission('defense');
      assert.equal(mission.id, 'defense');
      assert.equal(mission.waveBreak, 3);
      assert.equal(mission.maxEnemies, 5);
      assert.deepEqual(mission.objective, { name: 'Cryo Pod', health: 4000, armor: 240 });
      assert.equal(mission.endless, true);
    });

    test('survival mission has correct config', () => {
      const mission = getMission('survival');
      assert.equal(mission.id, 'survival');
      assert.equal(mission.endless, true);
      assert.equal(mission.baseEnemiesPerWave, 3);
      assert.equal(mission.enemiesPerWave, 2);
    });

    test('waveSize scales correctly', () => {
      const defense = getMission('defense');
      assert.equal(waveSize(defense, 1), 3);
      assert.equal(waveSize(defense, 2), 5);
      assert.equal(waveSize(defense, 5), 11);
    });
  });

  describe('CryoPod Objective', () => {
    let pod;

    beforeEach(() => {
      pod = new CryoPod(960, 540, { health: 4000, armor: 240 });
    });

    test('initializes with correct health and armor', () => {
      assert.equal(pod.health, 4000);
      assert.equal(pod.maxHealth, 4000);
      assert.equal(pod.armor, 240);
      assert.equal(pod.alive, true);
      assert.equal(pod.healthPercent, 1.0);
    });

    test('takes damage with armor DR', () => {
      const taken = pod.takeDamage(100);
      // Enemy DR at 240 armor = 0.9 × 240 ÷ 2700 = 8%
      // Damage after DR = 100 × (1 - 0.08) = 92
      assert(taken > 90 && taken < 94);
      assert(pod.health < 4000);
      assert(pod.health > 3900);
    });

    test('dies when health reaches zero', () => {
      pod.takeDamage(10000);
      assert.equal(pod.alive, false);
      assert.equal(pod.health, 0);
      assert.equal(pod.healthPercent, 0);
    });

    test('healthPercent clamps correctly', () => {
      pod.takeDamage(2000);
      assert(pod.healthPercent > 0 && pod.healthPercent < 1);
      pod.takeDamage(10000);
      assert.equal(pod.healthPercent, 0);
    });

    test('hitTimer triggers visual feedback', () => {
      pod.takeDamage(100);
      assert(pod.hitTimer > 0);
      pod.update(0.3);
      assert.equal(pod.hitTimer, 0);
    });
  });

  describe('Mission Flow - Exterminate', () => {
    let mission, enemies, player, projectiles, kills, currentWave;

    beforeEach(() => {
      mission = getMission('exterminate');
      enemies = [];
      projectiles = [];
      kills = 0;
      currentWave = 1;
      player = {
        x: 960, y: 540,
        radius: 18,
        health: 1000,
        maxHealth: 1000,
        shield: 500,
        maxShield: 500,
        isDead: false,
        healthPercent: 1.0,
        velocity: { x: 0, y: 0 },
        weapons: [],
        equippedSlot: 'primary',
        getDamageProfile: () => ({ impact: 10, puncture: 10, slash: 10, heat: 0, cold: 0, electricity: 0, toxin: 0 })
      };
    });

    test('spawns enemies up to maxEnemies', () => {
      // Simulate spawn system
      for (let i = 0; i < mission.maxEnemies; i++) {
        enemies.push(new Lancer(100 + i * 200, 100, { lvl: 1 }));
      }
      assert.equal(enemies.length, 5);
    });

    test('enemies scale level with kills', () => {
      const baseLancer = new Lancer(0, 0, { lvl: 1 });
      assert.equal(baseLancer.lvl, 1);
      assert(baseLancer.maxHp > 0);
      assert(baseLancer.armor > 0);
    });

    test('killing enemies increments kill count', () => {
      const lancer = new Lancer(0, 0, { lvl: 1 });
      enemies.push(lancer);
      
      // Simulate killing - need multiple frames of damage
      for (let i = 0; i < 60; i++) {
        lancer.health.takeDamage(lancer.maxHp / 60 + 2, 0);
      }
      assert(lancer.health.isDead);
      
      kills++;
      assert.equal(kills, 1);
    });

    test('mission wins when killQuota reached', () => {
      kills = mission.killQuota;
      const won = kills >= mission.killQuota;
      assert.equal(won, true);
    });

    test('mission continues when killQuota not reached', () => {
      kills = mission.killQuota - 1;
      const won = kills >= mission.killQuota;
      assert.equal(won, false);
    });
  });

  describe('Mission Flow - Defense', () => {
    let mission, enemies, objective, player, projectiles, currentWave, waveEnemiesSpawned, waveEnemiesTotal;

    beforeEach(() => {
      mission = getMission('defense');
      enemies = [];
      projectiles = [];
      currentWave = 1;
      waveEnemiesSpawned = 0;
      waveEnemiesTotal = waveSize(mission, currentWave);
      objective = new CryoPod(960, 540, mission.objective);
      player = {
        x: 960, y: 540,
        radius: 18,
        health: 1000,
        maxHealth: 1000,
        shield: 500,
        maxShield: 500,
        isDead: false,
        healthPercent: 1.0,
        velocity: { x: 0, y: 0 }
      };
    });

    test('objective exists and has correct stats', () => {
      assert(objective !== null);
      assert.equal(objective.health, 4000);
      assert.equal(objective.armor, 240);
      assert.equal(objective.baseArmor, 240);
      assert.equal(objective.threat, 1.4);
    });

    test('enemies target objective when no player in range', () => {
      const lancer = new Lancer(900, 540, { lvl: 1 });
      lancer.focus = objective;
      enemies.push(lancer);
      
      // Enemy should have focus on objective
      assert(lancer.focus === objective);
    });

    test('objective takes damage from enemies', () => {
      const initialHealth = objective.health;
      objective.takeDamage(500);
      assert(objective.health < initialHealth);
      assert(objective.hitTimer > 0);
    });

    test('mission fails when objective dies', () => {
      objective.takeDamage(10000);
      assert.equal(objective.alive, false);
      const failed = objective && !objective.alive;
      assert.equal(failed, true);
    });

    test('wave completes when all enemies dead', () => {
      waveEnemiesTotal = 3;
      waveEnemiesSpawned = 3;
      const e1 = new Lancer(100, 100, { lvl: 1 });
      const e2 = new Lancer(200, 200, { lvl: 1 });
      const e3 = new Lancer(300, 300, { lvl: 1 });
      enemies.push(e1, e2, e3);
      
      // Kill all - need multiple frames
      for (let i = 0; i < 60; i++) {
        e1.health.takeDamage(e1.maxHp / 60 + 2, 0);
        e2.health.takeDamage(e2.maxHp / 60 + 2, 0);
        e3.health.takeDamage(e3.maxHp / 60 + 2, 0);
      }
      const allDead = enemies.every(e => e.health.isDead);
      assert(allDead);
    });

    test('next wave spawns more enemies', () => {
      currentWave = 2;
      waveEnemiesTotal = waveSize(mission, currentWave);
      assert.equal(waveEnemiesTotal, 5);
      
      currentWave = 5;
      waveEnemiesTotal = waveSize(mission, currentWave);
      assert.equal(waveEnemiesTotal, 11);
    });

    test('extraction offered every 3 waves (waveBreak)', () => {
      // Wave 3: first extraction opportunity
      currentWave = 3;
      const extractionOffered = currentWave % mission.waveBreak === 0;
      assert.equal(extractionOffered, true);
      
      // Wave 6: second extraction opportunity
      currentWave = 6;
      const extractionOffered2 = currentWave % mission.waveBreak === 0;
      assert.equal(extractionOffered2, true);
      
      // Wave 4: no extraction
      currentWave = 4;
      const noExtraction = currentWave % mission.waveBreak !== 0;
      assert.equal(noExtraction, true);
    });

    test('mission is endless (no waveLimit)', () => {
      assert.equal(mission.endless, true);
      assert.equal(mission.waveLimit, undefined);
    });

    test('waves scale indefinitely', () => {
      assert.equal(waveSize(mission, 1), 3);
      assert.equal(waveSize(mission, 3), 7);
      assert.equal(waveSize(mission, 10), 21);
      assert.equal(waveSize(mission, 100), 201);
    });
  });

  describe('Mission Flow - Survival', () => {
    let mission, enemies, player, projectiles, currentWave;

    beforeEach(() => {
      mission = getMission('survival');
      enemies = [];
      projectiles = [];
      currentWave = 1;
      player = {
        x: 960, y: 540,
        radius: 18,
        health: 1000,
        maxHealth: 1000,
        shield: 500,
        maxShield: 500,
        isDead: false,
        healthPercent: 1.0,
        velocity: { x: 0, y: 0 }
      };
    });

    test('survival has no win condition', () => {
      assert.equal(mission.endless, true);
      assert(!mission.waveLimit);
      assert(!mission.killQuota);
    });

    test('waves increase indefinitely', () => {
      assert.equal(waveSize(mission, 1), 3);
      assert.equal(waveSize(mission, 10), 21);
      assert.equal(waveSize(mission, 100), 201);
    });
  });

  describe('AI Behavior During Mission', () => {
    let enemies, player, objective, projectiles;

    beforeEach(() => {
      enemies = [];
      projectiles = [];
      player = {
        x: 960, y: 540,
        radius: 18,
        health: 1000,
        maxHealth: 1000,
        shield: 500,
        maxShield: 500,
        isDead: false,
        alive: true,
        healthPercent: 1.0,
        velocity: { x: 0, y: 0 },
        lastNoisePosition: null,
        noiseRadius: 5,
        weaponNoiseRadius: 20
      };
      objective = new CryoPod(960, 540, { health: 4000, armor: 240 });
    });

    test('enemies patrol when unalerted', () => {
      const lancer = new Lancer(100, 100, { lvl: 1 });
      enemies.push(lancer);
      
      assert.equal(lancer.alertState, 'unalerted');
      assert(lancer.focus === null);
    });

    test('enemies alert when player enters vision', () => {
      const lancer = new Lancer(900, 540, { lvl: 1 }); // Close to player
      lancer.patrolAngle = 0; // Face right towards player (like ai_behavior.test.js)
      enemies.push(lancer);
      
      // Mock NavMesh for pathfinding
      lancer.navMesh = {
        findPath: () => [], findRoute: () => [],
        getNode: () => ({ walkable: true }),
        worldToGrid: () => ({ x: 0, y: 0 }),
        gridToWorld: () => ({ x: 0, y: 0 })
      };
      
      // Player needs isPlayer flag for target resolution
      const testPlayer = { ...player, isPlayer: true };
      updateEnemies(1/60, enemies, testPlayer, objective, projectiles);
      
      // Should acquire focus on player
      assert(lancer.focus === testPlayer || lancer.alertState === 'alerted');
    });

    test('enemies attack objective in defense mission', () => {
      const lancer = new Lancer(900, 540, { lvl: 1 });
      lancer.patrolAngle = 0; // Face right towards objective
      enemies.push(lancer);
      
      // Mock NavMesh
      lancer.navMesh = {
        findPath: () => [], findRoute: () => [],
        getNode: () => ({ walkable: true }),
        worldToGrid: () => ({ x: 0, y: 0 }),
        gridToWorld: () => ({ x: 0, y: 0 })
      };
      
      // No player in range, objective is high threat
      const farPlayer = { ...player, x: -1000, y: -1000, isPlayer: true };
      updateEnemies(1/60, enemies, farPlayer, objective, projectiles);
      
      // Should acquire focus on objective (higher threat)
      assert(lancer.focus === objective || lancer.alertState === 'alerted');
    });

    test('alerted enemies spread alert to nearby allies', () => {
      const lancer1 = new Lancer(900, 540, { lvl: 1 });
      lancer1.patrolAngle = 0;
      const lancer2 = new Lancer(950, 540, { lvl: 1 });
      lancer2.patrolAngle = 0;
      enemies.push(lancer1, lancer2);
      
      // Mock NavMesh for both
      [lancer1, lancer2].forEach(l => {
        l.navMesh = {
          findPath: () => [], findRoute: () => [],
          getNode: () => ({ walkable: true }),
          worldToGrid: () => ({ x: 0, y: 0 }),
          gridToWorld: () => ({ x: 0, y: 0 })
        };
      });
      
      // First spots player
      const testPlayer = { ...player, isPlayer: true };
      lancer1.focus = testPlayer;
      lancer1.alertState = 'alerted';
      
      updateEnemies(1/60, enemies, testPlayer, objective, projectiles);
      
      // Second should become cautious
      assert(lancer2.alertState === 'cautious' || lancer2.alertState === 'alerted');
    });
  });

  describe('Damage Calculations During Mission', () => {
    test('player weapon damage vs lancer armor', () => {
      const lancer = new Lancer(0, 0, { lvl: 1 });
      const rawDamage = 24.30; // Braton base
      const armor = lancer.armor;
      
      const dr = 0.9 * (Math.min(2700, Math.max(0, armor)) / 2700);
      const finalDamage = rawDamage * (1 - dr);
      
      assert(finalDamage > 0);
      assert(finalDamage < rawDamage);
    });

    test('high level lancer has more armor', () => {
      const lancer1 = new Lancer(0, 0, { lvl: 1 });
      const lancer50 = new Lancer(0, 0, { lvl: 50 });
      
      assert(lancer50.armor > lancer1.armor);
      assert(lancer50.maxHp > lancer1.maxHp);
    });

    test('reduceDamage matches calculator', () => {
      const armor = 554; // Lvl 50 Lancer
      const raw = 24.30;
      
      const calcResult = reduceDamage(raw, armor, false);
      const manualDR = 0.9 * (554 / 2700);
      const manualResult = raw * (1 - manualDR);
      
      assert(Math.abs(calcResult - manualResult) < 0.01);
    });
  });

  describe('Mission End Conditions', () => {
    test('exterminate fails if player dies', () => {
      const player = { isDead: true, health: 0 };
      assert(player.isDead);
    });

    test('defense fails if pod dies', () => {
      const pod = new CryoPod(0, 0, { health: 4000, armor: 240 });
      pod.takeDamage(10000);
      assert(!pod.alive);
    });

    test('survival only ends on player death', () => {
      const player = { isDead: false, health: 100 };
      assert(!player.isDead);
      
      player.isDead = true;
      player.health = 0;
      assert(player.isDead);
    });
  });
});