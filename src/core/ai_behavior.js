/**
 * AI Behavior System
 * Handles enemy AI updates, target resolution, and behavior execution.
 */

export function updateEnemies(dt, enemies, player, objective, projectiles) {
  // Build target list: player (if alive) and objective (if alive)
  const targets = [];
  if (player && player.alive && !player.isBleedingOut) targets.push(player);
  if (objective && objective.alive) targets.push(objective);

  // Update each enemy
  for (const enemy of enemies) {
    if (enemy.update && enemy.hp > 0) {
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