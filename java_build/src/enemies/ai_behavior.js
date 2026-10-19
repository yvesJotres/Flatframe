/**
 * AI Behavior System
 * Handles enemy AI updates, target resolution, and behavior execution.
 */
import { isInVisionCone } from './enemy.js';
import { createPatrol } from './patrol.js';

// Rooms of the current mission (pixel rectangles), set by game.js. Enemies hear shots only in their own room.
let hearingRooms = null;
export function setHearingRooms(rects) {
  hearingRooms = rects && rects.length ? rects : null;
}

// The pixel rectangle of the room at (x, y); outside every room (a corridor), the nearest room. null with no rooms.
export function roomRectAt(x, y) {
  if (!hearingRooms) return null;
  const i = roomIndexAt(x, y);
  if (i >= 0) return hearingRooms[i];
  let best = null, bestDist = Infinity;
  for (const r of hearingRooms) {
    const dx = Math.max(r.x - x, 0, x - (r.x + r.w));
    const dy = Math.max(r.y - y, 0, y - (r.y + r.h));
    const d = Math.hypot(dx, dy);
    if (d < bestDist) { best = r; bestDist = d; }
  }
  return best;
}

function roomIndexAt(x, y) {
  if (!hearingRooms) return -1;
  return hearingRooms.findIndex((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
}

let lastHeardShot = 0;

// Bodies lying on the map (set by game.js). An unalerted enemy that sees one becomes alerted (wiki-style alarm).
let bodies = [];
export function setBodies(list) {
  bodies = list ?? [];
}

export function updateEnemies(dt, enemies, player, objective, projectiles) {
  for (const enemy of enemies) {
    if (!enemy || enemy.hp <= 0 || enemy.alertState !== 'unalerted') continue;
    // A patrol loop inside its room, made once per unalerted stretch (false when the room offers none: a wander instead)
    if (enemy.patrol == null) enemy.patrol = createPatrol(enemy, roomRectAt(enemy.x, enemy.y), enemy.navMesh) ?? false;
    const seen = bodies.find((b) => isInVisionCone(enemy, b));
    if (seen) {
      enemy.transitionToAlerted();
      enemy.focus = null;
      enemy.lastDamageAngle = Math.atan2(seen.y - enemy.y, seen.x - enemy.x);
    }
  }

  // A shot from the player: enemies in the same room as the shot hear it
  if (player && player.noiseSerial && player.noiseSerial !== lastHeardShot && player.lastNoisePosition) {
    lastHeardShot = player.noiseSerial;
    const { x, y } = player.lastNoisePosition;
    const room = roomIndexAt(x, y);
    if (room >= 0) {
      for (const enemy of enemies) {
        if (enemy && enemy.hp > 0 && roomIndexAt(enemy.x, enemy.y) === room) enemy.hearNoise(x, y);
      }
    }
  }

  // Build target list: player (if alive) and objective (if alive)
  const targets = [];
  if (player && player.alive && !player.isBleedingOut) targets.push(player);
  if (objective && objective.alive) targets.push(objective);

  // Update each enemy
  for (const enemy of enemies) {
    if (enemy.update && enemy.hp > 0) {
      enemy.avoidNeighbors = enemies; // ORCA avoidance reads the other enemies (see Enemy.applyVelocity)
      enemy.update(dt, targets, projectiles, enemies);
    }
  }
}

export function getValidTargets(player, objective) {
  const targets = [];
  if (player && player.alive && !player.isBleedingOut) targets.push(player);
  if (objective && objective.alive) targets.push(objective);
  return targets;
}