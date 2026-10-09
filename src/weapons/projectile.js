function isAlive(target) {
  if (!target) return false;
  if (typeof target.hp === 'number') return target.hp > 0;
  if (typeof target.alive === 'boolean') return target.alive;
  return typeof target.takeDamage === 'function';
}

export default class Projectile {
  constructor(x, y, directionX, directionY, damage, options = {}) {
    this.x = typeof x === 'number' ? x : 0;
    this.y = typeof y === 'number' ? y : 0;
    this.startX = this.x;
    this.startY = this.y;

    directionX = typeof directionX === 'number' ? directionX : 1;
    directionY = typeof directionY === 'number' ? directionY : 0;

    const len = Math.hypot(directionX, directionY) || 1;
    this.directionX = directionX / len;
    this.directionY = directionY / len;

    this.hit = typeof damage === 'number'
      ? {
          total: damage,
          impact: damage,
          puncture: 0,
          slash: 0,
          heat: 0,
          crit: false,
          status: null,
        }
      : damage;

    this.damage = this.hit.total;
    this.speed = options.speed ?? 700;
    this.maxDistance = options.maxDistance ?? 2000;
    this.distanceTravelled = 0;
    this.punchThrough = options.punchThrough ?? 0;
    this.active = true;
    this.radius = this.hit.crit ? 5 : 4;
    this.isHitscan = this.speed >= 10000;
    this.targets = options.targets ?? null;
    this.color = options.color ?? (this.hit.crit ? '#fff3bf' : '#ffd166');
    this.hitscanTimer = 0;
    this.hitscanDuration = 0.08; // seconds to show hitscan tracer
  }

  update(dt, defaultTargets = []) {
    if (!this.active) return;

    const targets = this.targets ?? defaultTargets;
    const remaining = this.maxDistance - this.distanceTravelled;
    const stepDistance = Math.min(this.speed * dt, remaining);

    if (stepDistance <= 0) {
      this.active = false;
      return;
    }

    const moveX = this.directionX * stepDistance;
    const moveY = this.directionY * stepDistance;
    const nextX = this.x + moveX;
    const nextY = this.y + moveY;
    const segmentLengthSq = moveX * moveX + moveY * moveY;

    // Check collision at start position (in case projectile spawns inside target)
    for (const target of targets) {
      if (!isAlive(target)) continue;
      const startOffsetX = target.x - this.x;
      const startOffsetY = target.y - this.y;
      const hitRadius = this.radius + (target.radius ?? 16);
      if (startOffsetX * startOffsetX + startOffsetY * startOffsetY <= hitRadius * hitRadius) {
              // Check for weakspot/headshot
              const isWeakspot = target.weakspotRadius
                ? (startOffsetX * startOffsetX + startOffsetY * startOffsetY <= target.weakspotRadius * target.weakspotRadius)
                : false;
              target.takeDamage(this.hit, this.hit.sourceX, this.hit.sourceY, isWeakspot);
        if (this.punchThrough > 0) {
          this.punchThrough -= 1;
        } else {
          this.active = false;
          return;
        }
      }
    }

    if (segmentLengthSq > 0) {
      for (const target of targets) {
        if (!isAlive(target)) continue;

        const offsetX = target.x - this.x;
        const offsetY = target.y - this.y;
        const projection = Math.max(
          0,
          Math.min(1, (offsetX * moveX + offsetY * moveY) / segmentLengthSq)
        );
        const closestX = this.x + projection * moveX;
        const closestY = this.y + projection * moveY;
        const hitRadius = this.radius + (target.radius ?? 16);
        const diffX = target.x - closestX;
        const diffY = target.y - closestY;

        if (diffX * diffX + diffY * diffY <= hitRadius * hitRadius) {
                  // Check for weakspot/headshot
                  const isWeakspot = target.weakspotRadius
                    ? (diffX * diffX + diffY * diffY <= target.weakspotRadius * target.weakspotRadius)
                    : false;
                  target.takeDamage(this.hit, this.hit.sourceX, this.hit.sourceY, isWeakspot);

          if (this.punchThrough > 0) {
            this.punchThrough -= 1;
          } else {
            this.x = closestX;
            this.y = closestY;
            if (this.isHitscan) {
              this.hitscanTimer = this.hitscanDuration;
            } else {
              this.active = false;
            }
            return;
          }
        }
      }
    }

    this.x = nextX;
    this.y = nextY;
    this.distanceTravelled += stepDistance;

    // Check collision at end position (catch tunneling where segment missed but end is inside)
    for (const target of targets) {
      if (!isAlive(target)) continue;
      const endOffsetX = target.x - this.x;
      const endOffsetY = target.y - this.y;
      const hitRadius = this.radius + (target.radius ?? 16);
      if (endOffsetX * endOffsetX + endOffsetY * endOffsetY <= hitRadius * hitRadius) {
              // Check for weakspot/headshot
              const isWeakspot = target.weakspotRadius
                ? (endOffsetX * endOffsetX + endOffsetY * endOffsetY <= target.weakspotRadius * target.weakspotRadius)
                : false;
              target.takeDamage(this.hit, this.hit.sourceX, this.hit.sourceY, isWeakspot);
        if (this.punchThrough > 0) {
          this.punchThrough -= 1;
        } else {
          this.active = false;
          return;
        }
      }
    }

    if (this.distanceTravelled >= this.maxDistance) {
      this.active = false;
    } else if (this.isHitscan) {
      // Hitscan projectiles update once to hit target, then persist visually
      this.hitscanTimer -= dt;
      if (this.hitscanTimer <= 0) {
        this.active = false;
      }
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.fillStyle = this.color;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.radius;

    if (this.isHitscan) {
      // Draw fading tracer line
      const alpha = Math.max(0, this.hitscanTimer / this.hitscanDuration);
      ctx.strokeStyle = this.color.replace(')', `, ${alpha})`).replace('rgb', 'rgba').replace('#', '');
      // Handle hex color for fading
      if (this.color.startsWith('#')) {
        const r = parseInt(this.color.slice(1, 3), 16);
        const g = parseInt(this.color.slice(3, 5), 16);
        const b = parseInt(this.color.slice(5, 7), 16);
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      } else if (this.color.startsWith('rgba') || this.color.startsWith('rgb')) {
        ctx.strokeStyle = this.color.replace(/[\d.]+\)$/, `${alpha})`);
      }
      ctx.beginPath();
      ctx.moveTo(this.startX, this.startY);
      ctx.lineTo(this.x, this.y);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
