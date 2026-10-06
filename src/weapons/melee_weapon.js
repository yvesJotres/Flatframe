import Weapon from './weapon.js';
import { SKANA } from './data/skana.js';
import { audioManager } from '../core/audio.js';
import { UNITS_PER_METER, DEFAULT_MELEE_COOLDOWN_MS, COMBO_RESET_MS, PARRY_WINDOW_SEC } from '../core/constants.js';

export const MELEE_WEAPONS = {
  [SKANA.name]: SKANA,
};

export const DEFAULT_MELEE = SKANA.name;

export default class MeleeWeapon extends Weapon {
  constructor(name = DEFAULT_MELEE) {
    const stats = MELEE_WEAPONS[name];
    if (!stats) throw new Error('Unknown melee weapon: ' + name);
    super(stats);
    this.category = 'melee';
    this.arc = ((this.attack.arc ?? 90) * Math.PI) / 180;
    this.heavyAttackData = stats.attacks?.heavy ?? null;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.lastMeleeTime = 0;
    // Parry state
    this.isParrying = false;
    this.parryStartTime = 0;
    this.parryWindow = PARRY_WINDOW_SEC; // seconds for perfect parry
    this.parryDamageReduction = 0.9; // 90% damage reduction
  }

  // Parry methods
  startParry() {
    this.isParrying = true;
    this.parryStartTime = performance.now();
  }

  stopParry() {
    this.isParrying = false;
  }

  checkPerfectParry() {
    return this.isParrying && (performance.now() - this.parryStartTime) < this.parryWindow * 1000;
  }

  findBestTarget(player, enemies, halfArc) {
    const reach = this.range * 8;
    let best = { target: null, distance: Infinity, angle: 0 };
    for (const enemy of enemies) {
      if (!enemy || enemy.hp <= 0) continue;
      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      const dist = Math.hypot(dx, dy);
      if (dist > reach + (enemy.radius || 0)) continue;
      const enemyAngle = Math.atan2(dy, dx);
      const delta = Math.atan2(Math.sin(enemyAngle - player.angle), Math.cos(enemyAngle - player.angle));
      if (Math.abs(delta) > halfArc) continue;
      if (dist < best.distance) {
        best = { target: enemy, distance: dist, angle: enemyAngle };
      }
    }
    return best;
  }

  fire() {}

  getComboMultiplier() {
    return 1 + Math.floor(this.comboCount / 20) * 0.25;
  }

  /**
   * Swing the melee weapon in an arc in front of the player.
   * Returns an array of struck enemies on a real swing (possibly empty —
   * a whiff), or null when the swing was gated by the cooldown.
   */
  melee(player, enemies = []) {
    const now = performance.now();
    if (now - this.lastMeleeTime < (this.meleeCooldown / this.getComboMultiplier())) return null;

    if (this.comboTimer > 0 && now - this.lastMeleeTime > COMBO_RESET_MS) {
      this.comboCount = 0;
    }
    
    this.lastMeleeTime = now;
    this.comboTimer = COMBO_RESET_MS;
    const swingSound = Math.random() < 0.5 ? 'melee_swing1' : 'melee_swing2';
    audioManager.play(swingSound, 0.7);

    const reach = this.range * UNITS_PER_METER;
    const halfArc = this.arc / 2;
    const comboMult = this.getComboMultiplier();
    const struck = [];
    let bestTarget = null;
    let bestDist = Infinity;

    // Single pass: find all valid targets, track closest for auto-aim, apply damage
    for (const enemy of enemies) {
      if (!enemy || enemy.hp <= 0) continue;

      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      const distance = Math.hypot(dx, dy);
      if (distance > reach + (enemy.radius ?? 0)) continue;

      const enemyAngle = Math.atan2(dy, dx);
      const delta = Math.atan2(Math.sin(enemyAngle - player.angle), Math.cos(enemyAngle - player.angle));
      if (Math.abs(delta) > halfArc) continue;

      // Valid target - track closest for auto-aim
      if (distance < bestDist) {
        bestDist = distance;
        bestTarget = enemy;
      }

      // Apply damage
      const hit = this.rollHit();
      hit.total *= comboMult;
      enemy.takeDamage(hit, player.x, player.y);
      struck.push(enemy);
    }

    // Auto-aim toward closest target
    if (bestTarget) {
      player.angle = Math.atan2(bestTarget.y - player.y, bestTarget.x - player.x);
    }

    if (struck.length > 0) {
      this.comboCount += struck.length;
    }

    return struck;
  }

  update(dt) {
    super.update(dt);
    if (this.comboTimer > 0) {
      this.comboTimer -= dt * 1000;
      if (this.comboTimer <= 0) this.comboCount = 0;
    }
  }

  /**
   * Heavy attack: consumes current combo multiplier for massive burst,
   * resets combo count to 0, plays heavy_attack sound.
   * Gated by wind-up / heavy cooldown (defaults to 0.6s or attack.windUp).
   */
  heavyAttack(player, enemies = []) {
    const now = performance.now();
    const windUp = (this.heavyAttackData?.windUp ?? 0.6) * 1000;
    if (now - this.lastMeleeTime < windUp) return null;

    this.lastMeleeTime = now;
    this.comboTimer = 0;
    audioManager.play('heavy_attack', 0.85);

    const heavyStats = this.heavyAttackData ?? this.attack;
    const range = heavyStats.range ?? this.range;
    const reach = range * UNITS_PER_METER;
    const arc = (((heavyStats.arc ?? 140) * Math.PI) / 180);
    const halfArc = arc / 2;
    const multiplier = this.getComboMultiplier();
    const struck = [];
    let bestTarget = null;
    let bestDist = Infinity;

    // Base damage for heavy (from heavy def, or 2x normal base)
    const heavyBase = heavyStats.damage
      ? Object.values(heavyStats.damage).reduce((sum, v) => sum + v, 0)
      : this.totalDamage * 2;

    // Single pass: find all valid targets, track closest for auto-aim, apply damage
    for (const enemy of enemies) {
      if (!enemy || enemy.hp <= 0) continue;

      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      const distance = Math.hypot(dx, dy);
      if (distance > reach + (enemy.radius ?? 0)) continue;

      const enemyAngle = Math.atan2(dy, dx);
      const delta = Math.atan2(Math.sin(enemyAngle - player.angle), Math.cos(enemyAngle - player.angle));
      if (Math.abs(delta) > halfArc) continue;

      // Valid target - track closest for auto-aim
      if (distance < bestDist) {
        bestDist = distance;
        bestTarget = enemy;
      }

      // Heavy attack: base damage * combo multiplier, with critical rolls
      const crit = Math.random() < (heavyStats.critChance ?? this.critChance);
      const critMult = crit ? (heavyStats.critMultiplier ?? this.critMultiplier) : 1;
      const total = heavyBase * multiplier * critMult;

      const hit = {
        impact: (heavyStats.damage?.impact ?? 0) * multiplier * critMult,
        puncture: (heavyStats.damage?.puncture ?? 0) * multiplier * critMult,
        slash: (heavyStats.damage?.slash ?? heavyBase) * multiplier * critMult,
        heat: 0,
        total,
        crit,
        status: Math.random() < (heavyStats.statusChance ?? this.statusChance) ? 'slash' : null,
        isHeavy: true,
      };

      enemy.takeDamage(hit);
      struck.push(enemy);
    }

    // Auto-aim toward closest target
    if (bestTarget) {
      player.angle = Math.atan2(bestTarget.y - player.y, bestTarget.x - player.x);
    }

    // Heavy attack consumes ALL combo counter
    this.comboCount = 0;
    return struck;
  }

  /**
   * Draw the persistent attack arc telegraph (dashed) when melee is equipped and idle.
   */
  drawTelegraph(ctx, playerAngle) {
    const reach = this.range * UNITS_PER_METER;
    const halfArc = this.arc / 2;

    ctx.save();
    ctx.rotate(playerAngle);
    ctx.strokeStyle = 'rgba(255, 200, 100, 0.12)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.arc(0, 0, reach, -halfArc, halfArc);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  /**
   * Draw the sweeping swing animation.
   */
  drawSwing(ctx, playerAngle, swingType, swingTimer, swingHits) {
    const reach = this.range * UNITS_PER_METER;
    const arcDeg = swingType === 'heavy' ? (this.heavyAttackData?.arc ?? 140) : (this.attack.arc ?? 120);
    const halfArc = (arcDeg * Math.PI / 180) / 2;
    const duration = swingType === 'heavy' ? 0.25 : 0.15;
    const progress = 1 - swingTimer / duration;

    ctx.save();
    ctx.rotate(playerAngle);

    ctx.strokeStyle = swingType === 'heavy'
      ? `rgba(255, 100, 50, ${0.9 * (1 - progress)})`
      : `rgba(255, 200, 100, ${0.8 * (1 - progress)})`;
    ctx.lineWidth = swingType === 'heavy' ? 6 : 4;
    ctx.lineCap = 'round';

    const startAngle = -halfArc + (halfArc * 2) * (progress * 0.5);
    const endAngle = -halfArc + (halfArc * 2) * (0.5 + progress * 0.5);
    ctx.beginPath();
    ctx.arc(0, 0, reach, startAngle, endAngle);
    ctx.stroke();

    ctx.fillStyle = `rgba(255, 220, 150, ${1 - progress})`;
    for (const hit of swingHits) {
      const localAngle = hit.angle - playerAngle;
      const dist = Math.min(hit.distance, reach) * (0.5 + progress * 0.5);
      ctx.beginPath();
      ctx.arc(Math.cos(localAngle) * dist, Math.sin(localAngle) * dist, 3 + progress * 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * Draw the parry visualization.
   */
  drawParry(ctx, playerAngle) {
    if (!this.isParrying) return;

    const parryProgress = (performance.now() - this.parryStartTime) / (this.parryWindow * 1000);
    const parryArc = Math.PI / 2;
    const parryRadius = 35 + Math.sin(performance.now() * 0.01) * 3;

    ctx.save();
    ctx.rotate(playerAngle);
    ctx.strokeStyle = parryProgress < 1
      ? `rgba(100, 200, 255, ${0.8 * (1 - parryProgress)})`
      : `rgba(255, 100, 100, 0.5)`;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, parryRadius, -parryArc / 2, parryArc / 2);
    ctx.stroke();

    if (parryProgress < 0.5) {
      ctx.fillStyle = `rgba(255, 255, 255, ${0.6 * (1 - parryProgress * 2)})`;
      ctx.beginPath();
      ctx.arc(0, 0, 15 * (1 - parryProgress * 2), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
