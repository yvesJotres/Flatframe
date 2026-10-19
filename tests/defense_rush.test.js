import { test } from 'node:test';
import assert from 'node:assert/strict';
import BaseEnemy from '../src/enemies/enemy.js';

test('an enemy with nothing to fight walks to the cryopod and strikes it', () => {
  const pod = { x: 0, y: 0, radius: 34, hp: 4000, damage: 0, takeDamage(d) { this.damage += d; } };
  const enemy = new BaseEnemy(300, 0, {});
  enemy.attackDamage = 25;
  enemy.attackCooldown = 1;
  enemy.rushTarget = pod;
  for (let i = 0; i < 60 * 12 && pod.damage === 0; i++) enemy.update(1 / 60, pod, [], []);
  assert.ok(pod.damage > 0, 'the pod was struck');
  const dist = Math.hypot(enemy.x - pod.x, enemy.y - pod.y);
  assert.ok(dist < 120, `the enemy stopped at the pod (distance ${dist})`);
});
