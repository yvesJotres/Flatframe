// Excalibur's Slash Dash (ability 1): a fast charge in the aim direction that
// damages each enemy the path passes through, once per dash.
// Numbers are the rank 0 values from the wiki; speed is a placeholder to tune.
import { UNITS_PER_METER } from '../../engine/constants.js';

export const SLASH_DASH = {
  key: '1',
  energyCost: 25,
  damage: 200,
  range: 20 * UNITS_PER_METER, // 300 units
  speed: 1200,                 // units/s
};

// Shortest distance from point (px, py) to the segment (ax, ay)-(bx, by)
export function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

export default class SlashDash {
  constructor() {
    this.active = false;
    this.travelled = 0;
    this.dirX = 0;
    this.dirY = 0;
    this.hitEnemies = new Set();
  }

  canActivate(player) {
    return !this.active && player.energy >= SLASH_DASH.energyCost;
  }

  // Spends energy and starts the dash toward `angle`. Returns false if it can't start.
  activate(player, angle) {
    if (!this.canActivate(player)) return false;
    player.energy -= SLASH_DASH.energyCost;
    this.active = true;
    this.travelled = 0;
    this.dirX = Math.cos(angle);
    this.dirY = Math.sin(angle);
    this.hitEnemies.clear();
    return true;
  }

  // Moves the player for this frame and damages enemies the step passes through
  update(dt, player, enemies) {
    if (!this.active) return;

    const step = Math.min(SLASH_DASH.speed * dt, SLASH_DASH.range - this.travelled);
    const startX = player.x;
    const startY = player.y;
    player.x += this.dirX * step;
    player.y += this.dirY * step;
    this.travelled += step;
    player.velocity.x = this.dirX * SLASH_DASH.speed;
    player.velocity.y = this.dirY * SLASH_DASH.speed;

    for (const enemy of enemies) {
      if (!enemy || enemy.hp <= 0 || this.hitEnemies.has(enemy)) continue;
      const reach = player.radius + (enemy.radius || 0);
      if (distanceToSegment(enemy.x, enemy.y, startX, startY, player.x, player.y) > reach) continue;
      this.hitEnemies.add(enemy);
      enemy.takeDamage(SLASH_DASH.damage, startX, startY);
    }

    if (this.travelled >= SLASH_DASH.range) this.stop(player);
  }

  // Ends the dash and hands movement back to WASD, keeping the dash's speed so it eases out
  stop(player) {
    this.active = false;
    player.velocity.x = this.dirX * player.moveSpeed;
    player.velocity.y = this.dirY * player.moveSpeed;
  }
}
