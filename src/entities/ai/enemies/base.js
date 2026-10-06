import { reduceDamage, STATUS_EFFECT_FACTORIES } from '../../../core/damage.js';
import { approach } from '../../../core/movement.js';
import { UNITS_PER_METER } from '../../../core/constants.js';
import HealthComponent from '../../../core/health.js';
import StatusManager from '../../../core/status.js';

export function isTargetAlive(target) {
  if (!target) return false;
  if (typeof target.alive === 'boolean') return target.alive;
  if (target.health) return !target.health.isDead;
  if (typeof target.hp === 'number') return target.hp > 0;
  return typeof target.takeDamage === 'function';
}

/** Returns true if target is within enemy's vision cone. */
export function isInVisionCone(enemy, target) {
  const dx = target.x - enemy.x;
  const dy = target.y - enemy.y;
  const distance = Math.hypot(dx, dy);
  if (distance === 0) return true;

  const angleToTarget = Math.atan2(dy, dx);
  let diff = angleToTarget - enemy.angle;
  // Normalize to [-PI, PI]
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;

  return Math.abs(diff) <= enemy.visionArc / 2;
}

export default class BaseEnemy {
  constructor(x, y, options = {}) {
    this.x = x;
    this.y = y;
    this.name = options.name ?? 'Enemy';
    this.lvl = Math.max(1, options.lvl ?? 1);
    this.faction = options.faction ?? 'unknown';

    this.health = new HealthComponent({
      maxHp: options.maxHp ?? 100,
      armor: options.armor ?? 0,
    }, false);
    this.status = new StatusManager();
    this.radius = options.radius ?? 16;

    this.velocity = { x: 0, y: 0 };
    this.moveSpeed = options.moveSpeed ?? 150;
    this.acceleration = options.acceleration ?? 900;
    this.deceleration = options.deceleration ?? 1200;
    this.angle = 0;

    // AI Perception
    this.visionArc = options.visionArc ?? (Math.PI * 2 / 3); // 120° default (60° each side)
    this.turnRate = options.turnRate ?? 4.0; // radians per second
    this.aimTolerance = options.aimTolerance ?? 0.2; // ~11° tolerance to fire

    // Combat defaults
    this.color = options.color ?? '#e5484d';
    this.weapon = null;
    this.preferredRange = options.preferredRange ?? (220 + Math.random() * 160);
    this.rangeTolerance = options.rangeTolerance ?? 70;
    this.strafeDirection = Math.random() < 0.5 ? -1 : 1;
    this.strafeTimer = 1 + Math.random() * 2;
    this.aimTime = 0;
    this.aimDelay = options.aimDelay ?? 0.35;

    this.attackDamage = options.attackDamage ?? 25;
    this.attackCooldown = options.attackCooldown ?? 1;
    this.attackRange = options.attackRange ?? 24;
    this.attackTimer = 0;

    this.focus = null;
    this.patrolAngle = Math.random() * Math.PI * 2;
    this.patrolTimer = 2 + Math.random() * 3;
    this.alertTimer = 0; // seconds enemy stays alerted after taking damage
    this.lastDamageAngle = 0; // direction from which damage came

  }
  
  // Backward compatibility getters
  get hp() { return this.health.hp; }
  set hp(val) { this.health.hp = val; }
  get maxHp() { return this.health.maxHp; }
  set maxHp(val) { this.health.maxHp = val; }
  get armor() { return this.health.armor; }
  set armor(val) { this.health.armor = val; }
  /**
   * Hands a weapon to the unit. Enemy ammo never runs out, so the reserve is
   * infinite — otherwise a unit would go silent after one magazine.
   */
  equip(weapon) {
    this.weapon = weapon;
    this.weapon.ammoReserve = Infinity;
    return this.weapon;
  }


  takeDamage(damage, sourceX = null, sourceY = null) {
    const hit = typeof damage === 'number'
      ? { total: damage, slash: 0, status: null }
      : damage;

    const damageTaken = this.health.takeDamage(hit, 0);

    // Alert the enemy if they took damage and don't have a target
    if (!this.focus && damageTaken > 0) {
      this.patrolTimer = 0; 
      this.alertTimer = 3; // 3 seconds of alert state
      if (sourceX !== null && sourceY !== null) {
        this.lastDamageAngle = Math.atan2(sourceY - this.y, sourceX - this.x);
      }
    }

    // Status effect application via Damage System factory
    if (hit.status && STATUS_EFFECT_FACTORIES[hit.status] && !this.health.isDead) {
      this.status.addEffect(STATUS_EFFECT_FACTORIES[hit.status](hit.total));
    }
    return damageTaken;
  }

  update(dt, target = null, projectiles = [], enemies = []) {
    if (this.health.isDead) return;

    // Status effects processing (includes bleed)
    this.status.update(dt, this.health);

    if (this.health.isDead) return;

    // Target resolution
    const candidates = Array.isArray(target) ? target : [target];
    const aliveCandidates = candidates.filter(isTargetAlive);

    if (aliveCandidates.length === 0) {
      // No eligible target
      this.alertTimer = Math.max(0, this.alertTimer - dt);
      
      if (this.alertTimer > 0) {
        // Alerted: turn and move toward last known damage source
        const targetAngle = this.lastDamageAngle;
        this.rotateTowards(targetAngle, dt);
        this.applyVelocity(
          Math.cos(targetAngle) * 0.7, 
          Math.sin(targetAngle) * 0.7, 
          dt, 
          this.acceleration * 0.7
        );
        return;
      }
      
      // No target, not alerted: patrol
      this.patrolTimer -= dt;
      if (this.patrolTimer <= 0) {
        this.patrolTimer = 3 + Math.random() * 4;
        this.patrolAngle += (Math.random() - 0.5) * Math.PI;
      }
      const dirX = Math.cos(this.patrolAngle);
      const dirY = Math.sin(this.patrolAngle);
      this.applyVelocity(dirX * 0.5, dirY * 0.5, dt, this.acceleration * 0.5);
      this.angle = this.patrolAngle;
      return;
    }

    const currentFocusAlive = this.focus && isTargetAlive(this.focus);
    // Keep focus if alive and still in vision cone (with some persistence)
    if (currentFocusAlive && isInVisionCone(this, this.focus)) {
      // Keep current focus
    } else {
      // Find new focus only from candidates in vision cone
      const visibleCandidates = aliveCandidates.filter(c => isInVisionCone(this, c));
      if (visibleCandidates.length > 0) {
        this.focus = visibleCandidates.reduce((best, candidate) => {
          if (!best) return candidate;
          const bestThreat = best.threat ?? 1;
          const candidateThreat = candidate.threat ?? 1;
          const bestDist = Math.hypot(best.x - this.x, best.y - this.y) / bestThreat;
          const candidateDist = Math.hypot(candidate.x - this.x, candidate.y - this.y) / candidateThreat;
          return candidateDist < bestDist ? candidate : best;
        }, null);
      } else {
        this.focus = null; // Lost sight of all targets
      }
    }

    if (this.focus) {
      this.behavior(dt, this.focus, projectiles, enemies);
    }
  }

  /**
   * Default AI. Units with a weapon kite at their preferred range and shoot;
   * unarmed units charge and swing when they close the gap. Subclasses can
   * still override this for bespoke behaviour.
   */
  behavior(dt, focus, projectiles, enemies) {
    const dx = focus.x - this.x;
    const dy = focus.y - this.y;
    const distance = Math.hypot(dx, dy);

    if (this.weapon) {
      this.navigate(dt, dx, dy, distance, enemies);
      this.shoot(dt, focus, projectiles);
    } else {
      this.charge(dt, dx, dy, distance, enemies);
      this.meleeStrike(dt, focus);
    }
  }

  /**
   * Kiting movement: close in when beyond preferredRange, back off when too
   * near, strafe perpendicular, and never crowd allies.
   */
  navigate(dt, dx, dy, distance, enemies) {
    let moveX = 0;
    let moveY = 0;

    if (distance > 0) {
      const dirX = dx / distance;
      const dirY = dy / distance;

      if (distance > this.preferredRange + this.rangeTolerance) {
        moveX += dirX;
        moveY += dirY;
      } else if (distance < this.preferredRange - this.rangeTolerance) {
        moveX -= dirX;
        moveY -= dirY;
      }

      this.strafeTimer -= dt;
      if (this.strafeTimer <= 0) {
        this.strafeDirection = -this.strafeDirection;
        this.strafeTimer = 1.5 + Math.random() * 2;
      }

      moveX += -dirY * this.strafeDirection * 0.7;
      moveY += dirX * this.strafeDirection * 0.7;
    }

    const push = this.separation(enemies);
    moveX += push.x;
    moveY += push.y;

    const magnitude = Math.hypot(moveX, moveY);
    if (magnitude > 1) {
      moveX /= magnitude;
      moveY /= magnitude;
    }

    this.applyVelocity(moveX, moveY, dt, this.acceleration);
    // Smoothly rotate to face target
    const targetAngle = Math.atan2(dy, dx);
    this.rotateTowards(targetAngle, dt);
  }

  /** Smoothly rotate towards a target angle. */
  rotateTowards(targetAngle, dt) {
    let diff = targetAngle - this.angle;
    // Normalize to [-PI, PI]
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    const maxTurn = this.turnRate * dt;
    if (Math.abs(diff) <= maxTurn) {
      this.angle = targetAngle;
      return true; // Aligned
    }
    this.angle += diff > 0 ? maxTurn : -maxTurn;
    return false; // Still turning
  }

  /** Shared personal-space push so a pack does not collapse into one blob. */
  separation(enemies) {
    let pushX = 0;
    let pushY = 0;

    for (const other of enemies) {
      if (!other || other === this || other.hp <= 0) continue;
      const offsetX = this.x - other.x;
      const offsetY = this.y - other.y;
      const gap = Math.hypot(offsetX, offsetY);
      const minGap = this.radius + (other.radius ?? 16) + 8;

      if (gap > 0 && gap < minGap) {
        const push = (minGap - gap) / minGap;
        pushX += (offsetX / gap) * push;
        pushY += (offsetY / gap) * push;
      }
    }

    return { x: pushX, y: pushY };
  }

  /** Fire once the aim delay elapses and the target is inside weapon range. */
  shoot(dt, target, projectiles) {
    if (!this.weapon) return;

    const distance = Math.hypot(target.x - this.x, target.y - this.y);
    const inRange = distance <= this.weapon.range * UNITS_PER_METER;

    this.weapon.update(dt, inRange);
    if (!inRange) {
      this.aimTime = 0;
      return;
    }

    // Check if facing target within aim tolerance
    const angleToTarget = Math.atan2(target.y - this.y, target.x - this.x);
    let diff = angleToTarget - this.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    if (Math.abs(diff) > this.aimTolerance) {
      this.aimTime = 0; // Reset aim if not facing target
      return;
    }

    this.aimTime += dt;
    if (this.aimTime < this.aimDelay) return;

    this.weapon.fire(this, target, dt, projectiles, {
      targets: [target],
      color: '#ff6b6b',
    });
  }

  /** Straight-line pursuit used by melee units. */
  charge(dt, dx, dy, distance, enemies) {
    let moveX = 0;
    let moveY = 0;

    if (distance > 0) {
      moveX = dx / distance;
      moveY = dy / distance;
    }

    const push = this.separation(enemies);
    moveX += push.x;
    moveY += push.y;

    const magnitude = Math.hypot(moveX, moveY);
    if (magnitude > 1) {
      moveX /= magnitude;
      moveY /= magnitude;
    }

    this.applyVelocity(moveX, moveY, dt, this.acceleration);
    // Smoothly rotate to face target
    if (distance > 0) {
      const targetAngle = Math.atan2(dy, dx);
      this.rotateTowards(targetAngle, dt);
    }
  }

  /**
   * Swing when the target is within reach. `focus` may be the player or a
   * mission objective — both expose takeDamage().
   */
  meleeStrike(dt, focus) {
    this.attackTimer -= dt;
    const distance = Math.hypot(focus.x - this.x, focus.y - this.y);
    const reach = this.radius + (focus.radius ?? 16) + this.attackRange;

    if (distance <= reach && this.attackTimer <= 0) {
      focus.takeDamage(this.attackDamage);
      this.attackTimer = this.attackCooldown;
    }
  }

  applyVelocity(dirX, dirY, dt, rate) {
    const step = rate * dt;
    this.velocity.x = approach(this.velocity.x, dirX * this.moveSpeed, step);
    this.velocity.y = approach(this.velocity.y, dirY * this.moveSpeed, step);

    this.x += this.velocity.x * dt;
    this.y += this.velocity.y * dt;
  }

  draw(ctx) {
    if (this.hp <= 0) return;
    ctx.save();
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();

    // Facing pip so players can read which way a unit is pointing.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(
      this.x + Math.cos(this.angle) * (this.radius + 10),
      this.y + Math.sin(this.angle) * (this.radius + 10)
    );
    ctx.stroke();

    this.drawHealthBar(ctx, this.color);
    ctx.restore();
  }

  drawHealthBar(ctx, color = '#ff6b6b') {
    const barWidth = this.radius * 2.5;
    const barHeight = 5;
    const barY = this.y - this.radius - 16;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(this.x - barWidth / 2, barY, barWidth, barHeight);
    ctx.fillStyle = color;
    ctx.fillRect(
      this.x - barWidth / 2,
      barY,
      barWidth * (this.hp / this.maxHp),
      barHeight
    );

    ctx.fillStyle = '#fff';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${this.name} Lv.${this.lvl}`, this.x, barY - 6);
  }
}
