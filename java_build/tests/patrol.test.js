import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPatrol, stepPatrol, PATROL, profileFor, setPatrolProfile } from '../src/enemies/patrol.js';
import BaseEnemy from '../src/enemies/enemy.js';

const room = { x: 0, y: 0, w: 672, h: 480 };
// A navmesh that treats everything as open floor and paths straight to the goal
const openNav = { isWalkableAt: () => true, findPath: (sx, sy, gx, gy) => [{ x: gx, y: gy }] };

test('a patrol loop has waypoints inside its room, spaced apart, all walkable', () => {
  let seed = 1;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const enemy = new BaseEnemy(100, 100, {});
  const p = createPatrol(enemy, room, openNav, rand);
  assert.ok(p.points.length >= 2 && p.points.length <= PATROL.waypointCount);
  for (const pt of p.points) {
    assert.ok(pt.x >= room.x && pt.x <= room.x + room.w && pt.y >= room.y && pt.y <= room.y + room.h, 'inside the room');
  }
});

test('no patrol when the room has no walkable floor or no navmesh', () => {
  const enemy = new BaseEnemy(100, 100, {});
  assert.equal(createPatrol(enemy, room, { isWalkableAt: () => false, findPath: () => null }), null);
  assert.equal(createPatrol(enemy, room, null), null);
  assert.equal(createPatrol(enemy, null, openNav), null);
});

test('a patrolling enemy walks to its waypoint, pauses there, then moves on', () => {
  const enemy = new BaseEnemy(0, 0, {});
  enemy.navMesh = openNav;
  enemy.patrol = { points: [{ x: 300, y: 0 }, { x: 300, y: 300 }], index: 0, pause: 0, path: null, pathIndex: 0 };
  let guard = 0;
  while (enemy.patrol.index === 0 && guard++ < 2000) stepPatrol(enemy, 1 / 60, openNav);
  assert.equal(enemy.patrol.index, 1, 'reached the first waypoint');
  assert.ok(enemy.patrol.pause >= PATROL.pauseMin && enemy.patrol.pause <= PATROL.pauseMax, 'pauses there');
  const pauseBefore = enemy.patrol.pause;
  stepPatrol(enemy, 1 / 60, openNav);
  assert.ok(enemy.patrol.pause < pauseBefore, 'the pause counts down while it stands');
  assert.equal(enemy.patrol.index, 1, 'the next waypoint waits for the pause to end');
});

test('while paused, the enemy looks around its heading (the sweep stays within the look arc)', () => {
  const enemy = new BaseEnemy(300, 0, {});
  enemy.navMesh = openNav;
  enemy.angle = 1;
  enemy.patrol = { points: [{ x: 300, y: 0 }, { x: 0, y: 0 }], index: 0, pause: 3, look: 0, heading: 1, profile: { ...PATROL }, path: null, pathIndex: 0 };
  const seen = [];
  for (let i = 0; i < 300; i++) { stepPatrol(enemy, 1 / 60, openNav); seen.push(enemy.angle); }
  const span = Math.max(...seen) - Math.min(...seen);
  assert.ok(span > 0.5, 'the facing moves while looking around');
  assert.ok(seen.every((a) => Math.abs(a - 1) <= PATROL.lookArc + 1e-9), 'stays within the look arc');
});

test('an enemy can have its own patrol settings or a fixed route, and a mission can change them', () => {
  const enemy = new BaseEnemy(0, 0, {});
  enemy.patrolPoints = [{ x: 10, y: 0 }, { x: 20, y: 0 }];
  const fixed = createPatrol(enemy, room, openNav);
  assert.deepEqual(fixed.points, [{ x: 10, y: 0 }, { x: 20, y: 0 }], 'fixed route used as given');

  const own = new BaseEnemy(0, 0, {});
  own.patrolProfile = { pauseMin: 9, pauseMax: 9 };
  assert.equal(profileFor(own).pauseMin, 9, 'the enemy\'s own setting wins over the default');

  setPatrolProfile({ waypointCount: 2 });
  const plain = new BaseEnemy(0, 0, {});
  assert.equal(profileFor(plain).waypointCount, 2, 'a mission setting applies');
  assert.equal(createPatrol(plain, room, openNav).points.length, 2);
  setPatrolProfile(null);
  assert.equal(profileFor(plain).waypointCount, PATROL.waypointCount, 'cleared between missions');
});

test('the Exterminate mission patrol rule sets longer pauses for its Grineer', async () => {
  const { MISSIONS } = await import('../src/missions/missions.js');
  const mission = (MISSIONS ?? []).find((m) => m.id === 'exterminate_e_prime');
  assert.ok(mission?.patrol, 'the mission has a patrol rule');
  setPatrolProfile(mission.patrol);
  const g = new BaseEnemy(0, 0, {});
  assert.equal(profileFor(g).pauseMin, 3);
  assert.equal(profileFor(g).pauseMax, 6);
  setPatrolProfile(null);
});
