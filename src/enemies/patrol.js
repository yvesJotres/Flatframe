// Patrols for unalerted enemies: each one walks a loop of waypoints inside its room, following the navmesh. At each
// waypoint it stops and looks around (sweeping its facing, so its vision cone sweeps too) before moving on.
// Settings can come from three places, most specific last: the defaults (PATROL), the mission (setPatrolProfile),
// and the enemy itself (enemy.patrolProfile, or enemy.patrolPoints for a fixed route).
// Placeholders: the wiki gives no patrol routes, so every number here is chosen for this game.

export const PATROL = {
  waypointCount: 3,       // waypoints per loop
  minSpacing: 150,        // units (10 m) between waypoints, so the loop covers the room
  arriveRadius: 20,       // units: close enough to a waypoint to count as reached
  speedFactor: 0.5,       // share of the enemy's speed while patrolling
  pauseMin: 2,            // seconds stood still at each waypoint
  pauseMax: 4,
  lookArc: Math.PI / 3,   // the look-around sweeps this far either side of the heading it arrived with
  lookSpeed: 1.2,         // radians per second of the sweep
  sampleTries: 80,
};

// Mission-level overrides (game.js sets them when a mission starts; null clears them)
let missionProfile = {};
export function setPatrolProfile(profile) {
  missionProfile = profile ?? {};
}

// The settings an enemy patrols with: defaults, then the mission, then the enemy's own
export function profileFor(enemy) {
  return { ...PATROL, ...missionProfile, ...(enemy.patrolProfile ?? {}) };
}

const randBetween = (rand, lo, hi) => lo + rand() * (hi - lo);

// A patrol loop for an enemy in `room` (a pixel rectangle). Returns null when no walkable waypoints can be found.
export function createPatrol(enemy, room, navMesh, rand = Math.random) {
  const profile = profileFor(enemy);
  // A fixed route the level or enemy authored
  if (Array.isArray(enemy.patrolPoints) && enemy.patrolPoints.length >= 2) {
    return newLoop(enemy.patrolPoints.map((p) => ({ x: p.x, y: p.y })), profile);
  }
  if (!room || !navMesh?.isWalkableAt) return null;
  const points = [];
  for (let tries = 0; tries < profile.sampleTries && points.length < profile.waypointCount; tries++) {
    const x = randBetween(rand, room.x, room.x + room.w);
    const y = randBetween(rand, room.y, room.y + room.h);
    if (!navMesh.isWalkableAt(x, y)) continue;
    const last = points[points.length - 1] ?? { x: enemy.x, y: enemy.y };
    if (points.length && Math.hypot(x - last.x, y - last.y) < profile.minSpacing) continue;
    points.push({ x, y });
  }
  if (points.length < 2) return null; // a loop needs at least two points
  return newLoop(points, profile);
}

function newLoop(points, profile) {
  return { points, profile, index: 0, pause: 0, look: 0, heading: 0, path: null, pathIndex: 0 };
}

// One frame of patrolling for an unalerted enemy with a patrol. Moves and turns the enemy.
export function stepPatrol(enemy, dt, navMesh) {
  const p = enemy.patrol;
  const prof = p.profile ?? profileFor(enemy);
  if (p.pause > 0) {
    // Stood at a waypoint: look around, sweeping the facing either side of the heading it arrived with
    p.pause -= dt;
    p.look += dt;
    enemy.angle = p.heading + Math.sin(p.look * prof.lookSpeed) * prof.lookArc;
    enemy.applyVelocity(0, 0, dt, enemy.acceleration * prof.speedFactor);
    return;
  }
  const goal = p.points[p.index];
  if (Math.hypot(goal.x - enemy.x, goal.y - enemy.y) < prof.arriveRadius) {
    p.index = (p.index + 1) % p.points.length;
    p.pause = randBetween(Math.random, prof.pauseMin, prof.pauseMax);
    p.look = 0;
    p.heading = enemy.angle;
    p.path = null;
    return;
  }
  // Follow the navmesh path to the goal; no path (unreachable) skips this waypoint
  if (!p.path || p.pathIndex >= p.path.length) {
    p.path = navMesh ? navMesh.findPath(enemy.x, enemy.y, goal.x, goal.y) : null;
    p.pathIndex = 0;
    if (!p.path || !p.path.length) {
      p.index = (p.index + 1) % p.points.length;
      return;
    }
  }
  const node = p.path[Math.min(p.pathIndex, p.path.length - 1)];
  if (Math.hypot(node.x - enemy.x, node.y - enemy.y) < 24 && p.pathIndex < p.path.length - 1) p.pathIndex++;
  const target = p.path[p.pathIndex];
  const dx = target.x - enemy.x, dy = target.y - enemy.y;
  const d = Math.hypot(dx, dy) || 1;
  enemy.angle = Math.atan2(dy, dx); // the enemy faces where it walks
  enemy.applyVelocity((dx / d) * prof.speedFactor, (dy / d) * prof.speedFactor, dt, enemy.acceleration * prof.speedFactor);
}
