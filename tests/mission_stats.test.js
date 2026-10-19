import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resetMissionStats, missionStats, recordKill, recordDamageDealt, recordDamageReceived, recordLoot, recordAffinity } from '../src/missions/mission_stats.js';
import BaseEnemy from '../src/enemies/enemy.js';

test('the results statistics add up and reset for each mission', () => {
  resetMissionStats();
  recordKill();
  recordKill({ melee: true });
  recordDamageDealt(120);
  recordDamageReceived(30);
  recordLoot('credits', 50);
  recordLoot('credits', 25);
  recordAffinity(40);
  const s = missionStats();
  assert.equal(s.kills, 2);
  assert.equal(s.meleeKills, 1);
  assert.equal(s.damageDealt, 120);
  assert.equal(s.damageReceived, 30);
  assert.equal(s.loot.credits, 75);
  assert.equal(s.affinity, 40);
  resetMissionStats();
  assert.equal(missionStats().kills, 0);
});

test('an enemy killed by a melee hit counts as a melee kill, and damage dealt is recorded', () => {
  resetMissionStats();
  const enemy = new BaseEnemy(0, 0, {});
  enemy.takeDamage({ total: 5, slash: 0, status: null, melee: true });
  assert.equal(missionStats().damageDealt > 0, true);
  assert.equal(missionStats().kills, 0, 'not dead yet');
  enemy.takeDamage({ total: 100000, slash: 0, status: null, melee: true });
  const s = missionStats();
  assert.equal(s.kills, 1);
  assert.equal(s.meleeKills, 1);
});
