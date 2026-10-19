import { KNOCKDOWN_SECONDS } from '../combat/stealth.js';
import { settings as settingsStore } from '../engine/settings.js';
import { reduceDamage, STATUS_EFFECT_FACTORIES } from '../combat/damage.js';
import { damageNumbersManager, getDamageNumberType, DamageNumberType } from '../combat/damage_numbers.js';
import { approach } from '../engine/movement.js';
import { UNITS_PER_METER } from '../engine/constants.js';
import HealthComponent from '../combat/health.js';
import StatusManager from '../combat/status_manager.js';
import { COLORS } from '../assets/colors.js';
import { ORCA } from '../engine/navigation/orca.js';
import { stepPatrol } from './patrol.js';
import { recordDamageDealt, recordKill } from '../missions/mission_stats.js';
import { collision } from '../engine/collision.js';
import { calculateStealthHeadshotBonus } from '../combat/critical.js';
import { drawVisualEffect, EFFECT_NAMES } from '../engine/visual_effects.js';

// Shared avoidance solver for all enemies (neighbour distance and speed come from each enemy)
const orca = new ORCA();


// Wiki (Damage): Impact staggers for 1 s; Puncture lasts 6 s per stack, 40% less damage dealt for the first stack,
// +10% per later stack, up to 80% at 5 stacks
const IMPACT_STAGGER_SECONDS = 1;
const PUNCTURE_SECONDS = 6;
const PUNCTURE_MAX_STACKS = 5;

// How far the blind shots land from the noise (units; 15 units = 1 m). Chosen so most shots miss the player.
const BLIND_AIM_ERROR = 15 * 6;
// Noise older than this is not heard (seconds). Not from the wiki.
const BLIND_HEARING_SECONDS = 2;

const COVER_SEARCH_M = [3, 7];  // default distance band (meters) to look for cover
const COVER_SAMPLE_STEP = 16;   // world units between points when checking a line for walls

export function isTargetAlive(target) {
  if (!target) return false;
  if (typeof target.alive === 'boolean') return target.alive;
  if (target.health) return !target.health.isDead;
  if (typeof target.hp === 'number') return target.hp > 0;
  return typeof target.takeDamage === 'function';
}

/** Returns true if target is within enemy's vision cone. */
export function isInVisionCone(enemy, target) {
  if (enemy.isBlinded()) return false; // a blinded enemy cannot see anything (any blind source)
  const dx = target.x - enemy.x;
  const dy = target.y - enemy.y;
  const distance = Math.hypot(dx, dy);
  // Too far away to see
  // A crouched Warframe is harder to see: its sightFactor shortens the range (jump.js)
  if (distance > SIGHT_RANGE_M * UNITS_PER_METER * (target.sightFactor ?? 1) + (target.radius ?? 0)) return false;
  if (distance === 0) return true;

  const angleToTarget = Math.atan2(dy, dx);
  let diff = angleToTarget - enemy.angle;
  // Normalize to [-PI, PI]
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (Math.abs(diff) > enemy.visionArc / 2) return false;

  // Walls and props block sight
  return !collision.raycast(enemy.x, enemy.y, target.x, target.y);
}

// Sight: within this range and not through a wall or prop (metres converted to units; the range is a placeholder)
export const SIGHT_RANGE_M = 25;

export default class BaseEnemy {
  constructor(x, y, options = {}) {
    this.x = x;
    this.y = y;
    this.name = options.name ?? 'Enemy';
    this.lvl = Math.max(1, options.lvl ?? 1);
    this.faction = options.faction ?? 'unknown';
    // Endo drop (per kill) and orb size from the wiki's enemy drop tables; unset falls back to loot.js defaults

    this.health = new HealthComponent({
      maxHp: options.maxHp ?? 100,
      maxShield: options.maxShield ?? 0,
      armor: options.armor ?? 0,
    }, false);
    this.status = new StatusManager();
    this.staggerTimer = 0; // Impact stagger (seconds left)
    this.blindTimer = 0; // Blind (seconds left): the enemy cannot see the player (see isInVisionCone)
    this.blindDuration = 0; // length of the blind it was given (seconds)
    this.stunTimer = 0; // Blind stun (seconds left): standing still, no shooting
    this.punctureTimers = []; // one timer per Puncture stack (seconds left)
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
    this.patrol = null; // the patrol loop (patrol.js), made when the enemy is unalerted; false when its room has none
    this.patrolProfile = options.patrol ?? null; // this enemy's own patrol settings (see patrol.js profileFor)
    this.patrolPoints = options.patrolPoints ?? null; // a fixed route instead of a random loop in the room

    // Alert State Machine (wiki: Unalerted -> Cautious -> Alerted)
    this.alertState = 'unalerted'; // 'unalerted' | 'cautious' | 'alerted'
    this.alertTimer = 0; // time remaining in current alert state
    this.lastDamageAngle = 0; // direction from which damage came
    this.lastSoundAngle = 0; // direction of last heard sound
    this.soundRange = options.soundRange ?? (5 * UNITS_PER_METER); // 5m stealth sound range (wiki)
    
    // Spawning penalty (wiki: 4-8 seconds after spawn, no stealth kills)
    this.spawnPenaltyTimer = options.spawnPenalty ?? (4 + Math.random() * 4); // 4-8 seconds

    this.path = null;
    this.pathUpdateTimer = 0;
    this.pathIndex = 0;

    // Enemy shield recharge (wiki: max 3s delay, scales with depletion)
    this.timeSinceShieldDamage = Infinity;

    // Cover behavior
    this.coverPoint = null;
    this.coverSearchTimer = 0;
    this.grenadeTimer = 0;
    this.grenadeCooldown = options.grenadeCooldown ?? (8 + Math.random() * 6); // 8-14s between grenades

    // Test control (the Simulacrum's PAUSE AI): the unit still takes damage and ticks its health,
    // status and shield, but does not think, move or shoot
    this.aiPaused = false;
  }
  
  initHealth(options) {
    this.health = new HealthComponent({
      maxHp: options.maxHp ?? 100,
      maxShield: options.maxShield ?? 0,
      armor: options.armor ?? 0,
    }, false);
  }
  set hp(val) { this.health.hp = val; }
  get hp() { return this.health.hp; }
  get maxHp() { return this.health.maxHp; }
  set maxHp(val) { this.health.maxHp = val; }
  get armor() { return this.health.currentArmor; }
  set armor(val) { this.health.currentArmor = val; }
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
    const wasAlive = !this.health.isDead;
    let hit = typeof damage === 'number'
      ? { total: damage, slash: 0, status: null }
      : damage;
    // Headshot: the base damage is added again (critical.js: headshot is +100%, added to the crit multiplier)
    if (hit.isWeakspot === true && hit.baseTotal) {
      hit = { ...hit, total: hit.total + hit.baseTotal * (calculateStealthHeadshotBonus(false, true) - 1) };
    }

    const oldShield = this.health.shield;
    const oldHp = this.health.hp;
    const damageTaken = this.health.takeDamage(hit, 0, hit.isWeakspot === true);
    const newShield = this.health.shield;
    const newHp = this.health.hp;

    // Reset shield recharge delay on shield damage
    if (newShield < oldShield) {
      this.timeSinceShieldDamage = 0;
    }

    // Spawn damage number
    const isShieldDamage = newShield < oldShield;
    const isCritical = hit.crit === true;
    const isWeakspot = hit.isWeakspot === true;
    const critTier = hit.critTier ?? 1;
    
    damageNumbersManager.spawn({
      x: this.x,
      y: this.y - this.radius,
      value: damageTaken > 0 ? damageTaken : hit.total,
      type: getDamageNumberType({
        isShieldDamage,
        isCritical,
        critTier,
        isWeakspot,
      }),
    });

    // Alert the enemy if they took damage and don't have a target
    if (!this.focus && damageTaken > 0) {
      this.patrolTimer = 0;
      this.transitionToCautious(sourceX, sourceY); // Cautious: search toward damage source
      if (sourceX !== null && sourceY !== null) {
        this.lastDamageAngle = Math.atan2(sourceY - this.y, sourceX - this.x);
      }
    }

    // Status effect application via Damage System factory
    if (hit.status && STATUS_EFFECT_FACTORIES[hit.status] && !this.health.isDead) {
      // Bleed uses base damage with the crit multiplier, not the falloff (wiki); other procs use the hit total
      this.status.addEffect(STATUS_EFFECT_FACTORIES[hit.status](hit.procBase ?? hit.total));
    }
    // Wiki: Impact staggers movement for 1 s; Puncture weakens for 6 s, each proc with its own duration
    if (hit.status === 'impact' && !this.health.isDead) {
      this.staggerTimer = IMPACT_STAGGER_SECONDS;
    }
    if (hit.status === 'puncture' && !this.health.isDead && this.punctureTimers.length < PUNCTURE_MAX_STACKS) {
      this.punctureTimers.push(PUNCTURE_SECONDS);
    }
    recordDamageDealt(damageTaken);
    if (wasAlive && this.health.isDead) recordKill({ melee: hit.melee === true });
    return damageTaken;
  }

  // Any blind source (Radial Blind, and later others) calls this. Keeps the longer of the two durations.
  // Wiki (Blind): blinded enemies are stunned (standing still) for a short time, drop to a non-alerted state,
  // lose their target, and then fire at noise they can hear but cannot pinpoint.
  applyBlind(duration) {
    this.blindTimer = Math.max(this.blindTimer, duration);
    this.blindDuration = Math.max(this.blindDuration, duration); // the full length, used to count the stars
    this.stunTimer = Math.max(this.stunTimer, duration); // the stun lasts the whole blind (per the design notes)
    this.alertState = 'unalerted';
    this.focus = null;
  }

  isBlinded() {
    return this.blindTimer > 0;
  }

  // Damage this enemy deals while Punctured: 1 stack = 60%, each later stack takes 10% more off, 80% less at 5 stacks
  punctureOutputMultiplier() {
    const stacks = this.punctureTimers.length;
    if (stacks === 0) return 1;
    return 1 - Math.min(0.8, 0.4 + 0.1 * (stacks - 1));
  }

  // Alert State Machine transitions
  // A shot the enemy can hear (same room, see ai_behavior.js). Unalerted enemies turn cautious and search there;
  // an enemy already cautious or alerted only learns the direction.
  hearNoise(x, y) {
    if (this.health.isDead) return;
    if (this.alertState === 'unalerted') {
      this.transitionToCautious(x, y);
    } else {
      this.lastSoundAngle = Math.atan2(y - this.y, x - this.x);
    }
  }

  transitionToCautious(sourceX = null, sourceY = null) {
    if (this.alertState === 'unalerted') {
      this.alertState = 'cautious';
      this.alertTimer = 20 + Math.random() * 10; // 20-30 seconds cautious (wiki)
      this.patrolTimer = 0;
      this.patrol = null; // a fresh loop when it is unalerted again
      if (sourceX !== null && sourceY !== null) {
        this.lastSoundAngle = Math.atan2(sourceY - this.y, sourceX - this.x);
      }
    }
  }

  transitionToAlerted() {
    if (this.alertState !== 'alerted') {
      this.alertState = 'alerted';
      this.alertTimer = 60; // 60+ seconds alerted, or until alarm reset
      this.patrolTimer = 0;
      this.patrol = null;
    }
  }

  updateAlertState(dt, hasTarget = false) {
    // Decrement spawn penalty
    if (this.spawnPenaltyTimer > 0) {
      this.spawnPenaltyTimer = Math.max(0, this.spawnPenaltyTimer - dt);
    }

    // Decrement alert timer - faster decay when no target to focus on
    if (this.alertTimer > 0) {
      const decayRate = hasTarget ? 1 : 3; // 3x faster decay without target
      this.alertTimer = Math.max(0, this.alertTimer - dt * decayRate);
    }

    // State transitions
    if (this.alertState === 'cautious' && this.alertTimer <= 0) {
      // Cautious -> Unalerted after timer expires (wiki: 20-30 seconds)
      this.alertState = 'unalerted';
    } else if (this.alertState === 'alerted' && this.alertTimer <= 0) {
      // Alerted -> Cautious (not fully unalerted) - alarms need to be reset
      this.alertState = 'cautious';
      this.alertTimer = 30; // Cautious for 30s before going unalerted
    }
  }

  // Knockdown (see combat/stealth.js for the timing). A downed enemy can be finished with a melee stab.
  knockDown(seconds = KNOCKDOWN_SECONDS) {
    if (this.health.isDead) return;
    this.downedTimer = Math.max(this.downedTimer ?? 0, seconds);
    this.velocity.x = 0;
    this.velocity.y = 0;
  }

  isDowned() {
    return (this.downedTimer ?? 0) > 0;
  }

  update(dt, target = null, projectiles = [], enemies = []) {
    if (this.health.isDead) return;

    // Update health component (shield gate timer, magnetic, etc.)
    this.health.update(dt);

    // Update alert state machine
    this.updateAlertState(dt);

    // Impact stagger and Puncture weakening run on their own timers
    this.staggerTimer = Math.max(0, this.staggerTimer - dt);
    this.blindTimer = Math.max(0, this.blindTimer - dt);
    this.stunTimer = Math.max(0, this.stunTimer - dt);
    this.punctureTimers = this.punctureTimers.map((t) => t - dt).filter((t) => t > 0);

    // Status effects processing (includes bleed)
    this.status.update(dt, this.health);

    // Enemy shield recharge (wiki: max 3s delay, scales with depleted amount)
    if (this.health.maxShield > 0 && this.health.shield < this.health.maxShield) {
      this.timeSinceShieldDamage += dt;
      // Delay scales: 0s (no damage) -> 3s (fully depleted), linear with depletion fraction
      const depletion = 1 - this.health.shield / this.health.maxShield;
      const delay = 3 * depletion;
      if (this.timeSinceShieldDamage >= delay && this.health.canRegenerateShield()) {
        // Enemy recharge rate: same base formula as player but no bonus
        const regenAmount = (15 + 0.05 * this.health.maxShield) * dt;
        this.health.shield = Math.min(this.health.maxShield, this.health.shield + regenAmount);
      }
    } else {
      this.timeSinceShieldDamage = 0;
    }

    if (this.health.isDead) return;

    if (this.aiPaused) {
      this.velocity.x = 0;
      this.velocity.y = 0;
      return;
    }

    // Knocked down: lying on the ground, no movement or attacks until it gets up (wiki: prone and vulnerable)
    if (this.downedTimer > 0) {
      this.downedTimer = Math.max(0, this.downedTimer - dt);
      this.velocity.x = 0;
      this.velocity.y = 0;
      this.focus = null;
      return;
    }

    // Target resolution
    const candidates = Array.isArray(target) ? target : [target];
    const aliveCandidates = candidates.filter(isTargetAlive);

    // Handle alert state behavior
    this.handleAlertState(dt, aliveCandidates, target, enemies);

    if (aliveCandidates.length === 0) {
      // No eligible target - handled by handleAlertState
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
    } else if (this.rushTarget) {
      // Not engaged: rush the rush target along the navmesh. The extraction is sprinted for (wiki; 1.5x is a placeholder).
      // Defense: the cryopod is the target, and enemies stop at it and strike it in melee range.
      const target = this.rushTarget;
      const dx = target.x - this.x;
      const dy = target.y - this.y;
      const d = Math.hypot(dx, dy) || 1;
      const reach = this.radius + (target.radius ?? 16) + this.attackRange;
      this.angle = Math.atan2(dy, dx);
      if (d > reach) this.moveToSpot(target, dt, enemies, this.acceleration * 1.5);
      else this.applyVelocity(0, 0, dt, this.acceleration);
      if (typeof target.takeDamage === 'function') this.meleeStrike(dt, target);
    }
  }

  handleAlertState(dt, aliveCandidates, target, enemies) {
    // Find player candidate
    const playerCandidate = aliveCandidates.find(c => c === target || c.isPlayer);
    
    if (this.alertState === 'unalerted') {
      // Unalerted: walk the patrol loop in its room (patrol.js). A room with no patrol falls back to a random wander.
      if (this.patrol) {
        stepPatrol(this, dt, this.navMesh);
      } else {
        this.patrolTimer -= dt;
        if (this.patrolTimer <= 0) {
          this.patrolTimer = 3 + Math.random() * 4;
          this.patrolAngle += (Math.random() - 0.5) * Math.PI;
        }
        const dirX = Math.cos(this.patrolAngle);
        const dirY = Math.sin(this.patrolAngle);
        this.applyVelocity(dirX * 0.5, dirY * 0.5, dt, this.acceleration * 0.5);
        this.angle = this.patrolAngle;
      }
      
      // Check for visual detection (wiki: requires visual contact to become fully alerted)
      if (playerCandidate && isInVisionCone(this, playerCandidate)) {
        this.transitionToAlerted();
        this.focus = playerCandidate;
      }
      return;
    }

    if (this.alertState === 'cautious') {
      // Cautious: search toward last known sound/damage source
      const targetAngle = this.lastSoundAngle || this.lastDamageAngle;
      this.rotateTowards(targetAngle, dt);
      this.applyVelocity(
        Math.cos(targetAngle) * 0.7, 
        Math.sin(targetAngle) * 0.7, 
        dt, 
        this.acceleration * 0.7
      );
      
      // If player enters vision cone, become fully alerted
      if (playerCandidate && isInVisionCone(this, playerCandidate)) {
        this.transitionToAlerted();
        this.focus = playerCandidate;
      }
      return;
    }

    if (this.alertState === 'alerted') {
      // Alerted: acquire player in alert range (50m wiki)
      // An alerted enemy only takes the player back as its focus when it can see the player (see update)
      
      // If no focus, move toward last known damage source (wiki: search area)
      if (!this.focus) {
        const targetAngle = this.lastDamageAngle;
        this.rotateTowards(targetAngle, dt);
        this.applyVelocity(
          Math.cos(targetAngle) * 0.7, 
          Math.sin(targetAngle) * 0.7, 
          dt, 
          this.acceleration * 0.7
        );
      }

      // Alert nearby enemies (wiki: one enemy seeing player makes others cautious)
      if (this.focus) {
        this.alertNearbyEnemies(enemies);
      }
      return;
    }
  }

  alertNearbyEnemies(enemies) {
    // Wiki: "One enemy seeing the player is enough to make the others cautious"
    const alertRange = 20 * UNITS_PER_METER; // 20m communication range
    for (const other of enemies) {
      if (!other || other === this || other.hp <= 0) continue;
      const dx = other.x - this.x;
      const dy = other.y - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist < alertRange && other.alertState === 'unalerted') {
        // The message carries where this enemy is, not where the player is: the others search there
        other.transitionToCautious(this.x, this.y);
      }
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

    // NavMesh Pathfinding
    if (this.navMesh) {
      if (this.pathUpdateTimer <= 0) {
        this.path = this.navMesh.findRoute(this.x, this.y, focus.x, focus.y);
        this.pathIndex = 0;
        this.pathUpdateTimer = 0.5;
      }
      this.pathUpdateTimer -= dt;
    }

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

    // If we have a path, use the next node as the movement target
    let targetX = dx;
    let targetY = dy;
    let targetDistance = distance;

    if (this.path && this.path.length > 0) {
      const nextNode = this.path[this.pathIndex];
      targetX = nextNode.x - this.x;
      targetY = nextNode.y - this.y;
      targetDistance = Math.hypot(targetX, targetY);
      
      // Advance path index if close to node
      if (targetDistance < 32 && this.pathIndex < this.path.length - 1) {
        this.pathIndex++;
      }
    }

    if (targetDistance > 0) {
      const dirX = targetX / targetDistance;
      const dirY = targetY / targetDistance;

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

  /** Wall lookup with a safe fallback for navmeshes that cannot answer it (treat as open ground). */
  walkable(x, y) {
    const nav = this.navMesh;
    return nav?.isWalkableAt ? nav.isWalkableAt(x, y) : true;
  }

  /** True if any sampled point on the line a-b is inside a wall. */
  lineBlocked(ax, ay, bx, by) {
    if (!this.navMesh) return false;
    const len = Math.hypot(bx - ax, by - ay);
    const steps = Math.max(1, Math.floor(len / COVER_SAMPLE_STEP));
    for (let i = 1; i < steps; i++) {
      const f = i / steps;
      if (!this.walkable(ax + (bx - ax) * f, ay + (by - ay) * f)) return true;
    }
    return false;
  }

  /** A walkable spot (default 3-7 m away) with a wall between it and the target: best place to wait. */
  findCover(focus, bandM = COVER_SEARCH_M) {
    if (!this.navMesh) return null;
    let best = null;
    let bestDist = Infinity;
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2 + Math.random() * 0.3;
      const dist = (bandM[0] + Math.random() * (bandM[1] - bandM[0])) * UNITS_PER_METER;
      const x = this.x + Math.cos(angle) * dist;
      const y = this.y + Math.sin(angle) * dist;
      if (!this.walkable(x, y)) continue;
      if (!this.lineBlocked(x, y, focus.x, focus.y)) continue;
      // Prefer spots close to where we are now (short run to cover)
      if (dist < bestDist) { bestDist = dist; best = { x, y }; }
    }
    return best;
  }

  /** Fallback when no cover exists: a point off to one side of the target so we keep moving. */
  findFlankSpot(focus, bandM = COVER_SEARCH_M) {
    const side = Math.random() < 0.5 ? 1 : -1;
    const base = Math.atan2(this.y - focus.y, this.x - focus.x) + side * (Math.PI / 2.5);
    const dist = (bandM[0] + Math.random() * (bandM[1] - bandM[0])) * UNITS_PER_METER;
    const x = focus.x + Math.cos(base) * dist;
    const y = focus.y + Math.sin(base) * dist;
    if (this.navMesh && !this.walkable(x, y)) return null;
    return { x, y };
  }

  /** Walk toward `spot`, following the navmesh path when there is one. Null `this.path` when the spot changes. */
  moveToSpot(spot, dt, enemies, rate = this.acceleration) {
    if (!spot) return this.applyVelocity(0, 0, dt, this.acceleration);
    let tx = spot.x, ty = spot.y;
    if (this.navMesh) {
      if (!this.path || this.pathIndex >= this.path.length) {
        this.path = this.navMesh.findRoute(this.x, this.y, spot.x, spot.y);
        this.pathIndex = 0;
      }
      if (this.path && this.path.length) {
        const node = this.path[Math.min(this.pathIndex, this.path.length - 1)];
        if (Math.hypot(node.x - this.x, node.y - this.y) < 24 && this.pathIndex < this.path.length - 1) this.pathIndex++;
        tx = this.path[this.pathIndex].x;
        ty = this.path[this.pathIndex].y;
      }
    }
    const ddx = tx - this.x, ddy = ty - this.y;
    const d = Math.hypot(ddx, ddy) || 1;
    const push = this.separation(enemies);
    this.applyVelocity(ddx / d + push.x * 0.5, ddy / d + push.y * 0.5, dt, rate);
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

  /**
   * How far this unit opens fire. A weapon with damage falloff (shotguns) stops at the end of
   * its falloff: past that it still hits for half damage, so firing from across the arena is not wanted.
   */
  engageRange() {
    const w = this.weapon;
    return (w.falloff?.end ?? w.range) * UNITS_PER_METER;
  }

  /** Fire once the aim delay elapses and the target is inside engage range. */
  // Wiki (Blind): the enemy hears the source of the noise but cannot pinpoint it, so it fires at a random
  // spot near the last noise and misses. Its shots do not target the player.
  blindFire(dt, target, projectiles) {
    this.weapon.update(dt, true);
    if (this.stunTimer > 0) return; // stunned: stands still and does nothing
    const noise = target.lastNoisePosition;
    if (!noise || (target.lastNoiseTime ?? Infinity) > BLIND_HEARING_SECONDS) return;
    const aim = {
      x: noise.x + (Math.random() * 2 - 1) * BLIND_AIM_ERROR,
      y: noise.y + (Math.random() * 2 - 1) * BLIND_AIM_ERROR,
    };
    this.weapon.fire(this, aim, dt, projectiles, { targets: [], color: '#ff6b6b' });
  }

  shoot(dt, target, projectiles) {
    if (!this.weapon) return;
    if (this.stunTimer > 0) {
      this.weapon.update(dt, false); // stunned: no shooting
      return;
    }
    if (this.isBlinded()) {
      this.blindFire(dt, target, projectiles);
      return;
    }

    const distance = Math.hypot(target.x - this.x, target.y - this.y);
    const inRange = distance <= this.engageRange();

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
    if (this.stunTimer > 0) return; // stunned by Blind: no melee
    const distance = Math.hypot(focus.x - this.x, focus.y - this.y);
    const reach = this.radius + (focus.radius ?? 16) + this.attackRange;

    if (distance <= reach && this.attackTimer <= 0) {
      focus.takeDamage(this.attackDamage * this.punctureOutputMultiplier());
      this.attackTimer = this.attackCooldown;
    }
  }

  applyVelocity(dirX, dirY, dt, rate) {
    const step = rate * dt;
    let wantX = dirX * this.moveSpeed;
    let wantY = dirY * this.moveSpeed;
    if (this.staggerTimer > 0 || this.stunTimer > 0) {
      wantX = 0; // staggered by Impact or stunned by Blind: cannot move
      wantY = 0;
    }

    // ORCA: adjust the wanted velocity so this enemy does not run into the others (wiki: enemies avoid each other)
    if (this.avoidNeighbors?.length) {
      const agent = { x: this.x, y: this.y, vx: wantX, vy: wantY, radius: this.radius, maxSpeed: this.moveSpeed };
      const neighbors = this.avoidNeighbors
        .filter((e) => e && e !== this && e.hp > 0)
        .map((e) => ({ x: e.x, y: e.y, vx: e.velocity?.x ?? 0, vy: e.velocity?.y ?? 0, radius: e.radius ?? 16 }));
      const safe = orca.compute(agent, neighbors, [], dt);
      wantX = safe.vx;
      wantY = safe.vy;
    }

    this.velocity.x = approach(this.velocity.x, wantX, step);
    this.velocity.y = approach(this.velocity.y, wantY, step);

    this.x += this.velocity.x * dt;
    this.y += this.velocity.y * dt;
  }

  draw(ctx) {
    if (this.hp <= 0) return;
    ctx.save();
    // Head and body, the same shapes as the hit zones (see visual_effects.js HUMANOID)
    if (this.isDowned()) {
      // Lying flat: the same figure turned 90 degrees, in full colour, with its name and health bar as usual
      drawVisualEffect(EFFECT_NAMES.CORPSE, ctx, { x: this.x, y: this.y, radius: this.radius, fade: 1, paleness: 1 });
    } else {
      drawVisualEffect(EFFECT_NAMES.HUMANOID, ctx, { x: this.x, y: this.y, radius: this.radius, color: this.color });
      drawVisualEffect(EFFECT_NAMES.FACING_ARROW, ctx, { x: this.x, y: this.y, radius: this.radius, facing: this.angle });
    }

    this.drawHealthBar(ctx, this.color);
    if (this.isBlinded()) drawVisualEffect(EFFECT_NAMES.BLIND_STARS, ctx, this);
    ctx.restore();
  }

  drawHealthBar(ctx, color = '#ff6b6b') {
    // Options: enemy health bars and enemy names can each be turned off
    const showBar = settingsStore.get('enemyHealthBars') !== false;
    const showName = settingsStore.get('enemyNames') !== false;
    if (!showBar && !showName) return;
    const barHeight = 6;
    const barY = this.y - this.radius - 14;
    if (showBar) {
    
    // Proportional track widths based on max HP + max Shield (like player HUD)
    const totalMax = this.maxHp + this.health.maxShield;
    const healthTrackWidth = totalMax > 0 ? (this.maxHp / totalMax) * (this.radius * 3) : this.radius * 3;
    const shieldTrackWidth = totalMax > 0 ? (this.health.maxShield / totalMax) * (this.radius * 3) : 0;
    const barWidth = healthTrackWidth + shieldTrackWidth;
    const barX = this.x - barWidth / 2;
    const healthBarX = barX;
    const shieldBarX = barX + healthTrackWidth;

    // Background tracks
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(healthBarX, barY, healthTrackWidth, barHeight);
    if (shieldTrackWidth > 0) {
      ctx.fillRect(shieldBarX, barY, shieldTrackWidth, barHeight);
    }

    // Check for armored state (enemy shield gate is NOT total invulnerability - 5% leak)
    const hasArmor = this.health.hasArmor;

    // Health fill (fills from left, depletes from right)
    const hpPercent = this.maxHp > 0 ? this.hp / this.maxHp : 0;
    const hpFillWidth = healthTrackWidth * hpPercent;
    const hpFillX = healthBarX;
    
    if (hasArmor) {
      ctx.fillStyle = COLORS.ARMOR;
    } else {
      ctx.fillStyle = COLORS.HEALTH;
    }
    ctx.fillRect(hpFillX, barY, hpFillWidth, barHeight);

    // Shield fill (fills from left, depletes from right)
    if (this.health.maxShield > 0 && this.health.shield > 0) {
      const shieldPercent = this.health.shield / this.health.maxShield;
      const shieldFillWidth = shieldTrackWidth * shieldPercent;
      const shieldFillX = shieldBarX;

      ctx.fillStyle = COLORS.SHIELDS;
      ctx.fillRect(shieldFillX, barY, shieldFillWidth, barHeight);
    }
    }

    // Name + level
    if (!showName) return;
    ctx.fillStyle = '#fff';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${this.name} Lv.${this.lvl}`, this.x, barY - 4);
  }
}
