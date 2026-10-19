// Auto-play for touch: the game picks the nearest live enemy in range and the
// touch controls aim and fire at it. Pure functions only, so tests can drive them directly.
import { UNITS_PER_METER } from './constants.js';

export const AUTO_PLAY_RANGE = 25 * UNITS_PER_METER; // 375 units, a placeholder until weapon ranges are used

// Nearest enemy with hp > 0 within `range` of `from` (world units), or null.
// Only enemies that have spotted the player (alerted) are shot. Unalerted and cautious enemies are left alone,
// so they can be finished quietly with a stealth melee finisher (wiki: unalerted enemies take x8 stealth melee).
export function findAutoPlayTarget(from, enemies, range = AUTO_PLAY_RANGE) {
  if (!from || !enemies) return null;
  let best = null;
  let bestDist = range;
  for (const enemy of enemies) {
    if (!enemy || !(enemy.hp > 0)) continue;
    if (enemy.alertState !== undefined && enemy.alertState !== 'alerted') continue;
    const dist = Math.hypot(enemy.x - from.x, enemy.y - from.y);
    if (dist <= bestDist) {
      best = enemy;
      bestDist = dist;
    }
  }
  return best;
}

// Screen point `distance` pixels from `origin` in the direction of `target`
export function autoPlayAimPoint(origin, from, target, distance) {
  const dx = target.x - from.x;
  const dy = target.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: origin.x + (dx / len) * distance, y: origin.y + (dy / len) * distance };
}
