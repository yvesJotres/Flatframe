import { UNITS_PER_METER } from '../engine/constants.js';

const FLIGHT_SPEED = 360;      // world units per second while thrown
const MIN_DAMAGE_FRACTION = 0.25; // damage left at the very edge of the blast

function isAlive(target) {
  if (!target) return false;
  if (typeof target.alive === 'boolean') return target.alive;
  if (typeof target.hp === 'number') return target.hp > 0;
  return typeof target.takeDamage === 'function';
}

/**
 * Thrown explosive. Lands at the aim point, then detonates after `fuse` seconds
 * (the pulsing ring shows the blast zone so the player can run). It lives in the
 * shared projectiles array, so it only needs update/draw/active.
 */
export default class Grenade {
  constructor(x, y, targetX, targetY, options = {}) {
    this.x = x;
    this.y = y;
    this.targetX = targetX;
    this.targetY = targetY;
    this.damage = options.damage ?? 400;
    this.blastRadius = (options.blastRadiusM ?? 4) * UNITS_PER_METER;
    this.fuse = options.fuse ?? 1.4;
    this.targets = options.targets ?? [];
    this.active = true;
    this.exploded = false;
    this.age = 0;
    this.explosionTimer = 0;
    this.radius = 5;
  }

  update(dt) {
    if (!this.active) return;

    if (this.exploded) {
      this.explosionTimer -= dt;
      if (this.explosionTimer <= 0) this.active = false;
      return;
    }

    this.age += dt;
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.hypot(dx, dy);
    const step = FLIGHT_SPEED * dt;
    if (dist > step) {
      this.x += (dx / dist) * step;
      this.y += (dy / dist) * step;
    } else {
      this.x = this.targetX;
      this.y = this.targetY;
    }

    if (this.age >= this.fuse) this.explode();
  }

  explode() {
    this.exploded = true;
    this.explosionTimer = 0.25;
    for (const target of this.targets) {
      if (!isAlive(target)) continue;
      const dist = Math.hypot(target.x - this.x, target.y - this.y);
      const reach = this.blastRadius + (target.radius ?? 16);
      if (dist > reach) continue;
      const falloff = 1 - (1 - MIN_DAMAGE_FRACTION) * (dist / reach);
      target.takeDamage(this.damage * falloff, this.x, this.y);
    }
  }

  draw(ctx) {
    ctx.save();
    if (this.exploded) {
      const alpha = Math.max(0, this.explosionTimer / 0.25);
      ctx.fillStyle = `rgba(255, 170, 60, ${0.5 * alpha})`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.blastRadius, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const pulse = 0.5 + 0.5 * Math.sin(this.age * 18);
      ctx.strokeStyle = `rgba(255, 90, 60, ${0.35 + 0.4 * pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.targetX, this.targetY, this.blastRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffb347';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
