import PrimaryWeapon from '../weapons/primary_weapon.js';
import SecondaryWeapon from '../weapons/secondary_weapon.js';
import MeleeWeapon from '../weapons/melee_weapon.js';
import { reduceDamage } from '../core/damage.js';
import { approach } from '../core/movement.js';
import { audioManager } from '../core/audio.js';
import HealthComponent from '../core/health.js';
import StatusManager from '../core/status.js';
import { WeaponSwitchHandler } from '../core/weapon_switch_handler.js';

export default class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.velocity = { x: 0, y: 0 };
    this.radius = 16;

    // Movement tuning (px/s and px/s²)
    this.moveSpeed = 400;
    this.acceleration = 3600;
    this.deceleration = 4800;

    // Parkour
    this.bulletJumpSpeed = 1200;
    this.bulletJumpCooldown = 0.3;
    this.bulletJumpTimer = 0;
    this.isBulletJumping = false;
    this.bulletJumpDirection = { x: 0, y: 0 };
    this.bulletJumpVisualTimer = 0;

    this.angle = 0;

    // Excalibur stats (Rank 30)
    this.healthComponent = new HealthComponent({
      maxHp: 370,
      maxShield: 370,
      armor: 240,
    }, true);
    this.status = new StatusManager();
    this.maxEnergy = 150;
    this.energy = this.maxEnergy;

    this.shieldRegenDelay = 3;
    this.shieldRegenRate = 0.15;
    this.timeSinceDamage = Infinity;
    this.alive = true;

    this.primaryWeapon = new PrimaryWeapon();
    this.isBleedingOut = false;
    this.awaitingRevive = false;
    this.bleedoutTimer = 0;
    this.revivesRemaining = 4;
    this.reviveHoldTime = 0;
    this.downedX = 0;
    this.downedY = 0;
    this.awaitingPulse = 0;
    this.secondaryWeapon = new SecondaryWeapon();
    this.meleeWeapon = new MeleeWeapon();
    this.currentWeapon = this.primaryWeapon;
    this.lastRangedWeapon = this.primaryWeapon;
    this.lastShotTime = 0;
    this.lastMeleeTime = 0;
    this.meleeSwingTimer = 0;
    this.meleeSwingType = 'normal'; // 'normal' | 'heavy'
    this.meleeSwingHits = [];
    this.lungeTarget = null;
    this.lungeTimer = 0;
        this.weaponSwitchHandler = new WeaponSwitchHandler(this);
  }

  // Backward compatibility getters/setters
  get maxHealth() { return this.healthComponent.maxHp; }
  set maxHealth(val) { this.healthComponent.maxHp = val; }
  get health() { return this.healthComponent.hp; }
  set health(val) { this.healthComponent.hp = val; }
  get maxShield() { return this.healthComponent.maxShield; }
  set maxShield(val) { this.healthComponent.maxShield = val; }
  get shield() { return this.healthComponent.shield; }
  set shield(val) { this.healthComponent.shield = val; }
  get armor() { return this.healthComponent.armor; }
  set armor(val) { this.healthComponent.armor = val; }

  update(dt, input, projectiles = [], enemies = []) {
    this.healthComponent.update(dt);

    if (!this.alive) return;
    if (this.isBleedingOut) {
      if (!this.awaitingRevive) {
        this.bleedoutTimer -= dt;
      }

      // Hold X for 2s to self-revive — available during the countdown and
      // after it expires ("can't be revived by others" state).
      if (input.isKeyDown('x')) {
        this.reviveHoldTime += dt;
        if (this.reviveHoldTime >= 2.0 && this.revivesRemaining > 0) {
          this.revivesRemaining--;
          this.isBleedingOut = false;
          this.awaitingRevive = false;
          this.health = this.maxHealth;
          this.shield = this.maxShield;
          this.reviveHoldTime = 0;
          this.timeSinceDamage = 0;
          return;
        }
      } else {
        this.reviveHoldTime = 0;
      }

      // No revives left while downed = dead.
      if (this.revivesRemaining <= 0) {
        this.alive = false;
        this.isBleedingOut = false;
        return;
      }

      // Countdown over: body is gone, only the X marker remains. Nothing
      // but the self-revive input works from here.
      if (this.bleedoutTimer <= 0) {
        if (!this.awaitingRevive) {
          this.awaitingRevive = true;
          this.downedX = this.x;
          this.downedY = this.y;
          this.velocity.x = 0;
          this.velocity.y = 0;
        }
        this.awaitingPulse += dt;
        return;
      }

      // Downed but body intact: aim and fire the secondary only —
      // no primary, no melee, no weapon swapping.
      if (this.currentWeapon !== this.secondaryWeapon) {
        this.currentWeapon = this.secondaryWeapon;
      }
      this.angle = Math.atan2(input.mouse.y - this.y, input.mouse.x - this.x);
      const firing = input.mouse.down;
      this.secondaryWeapon.update(dt, firing);
      this.primaryWeapon.update(dt, false); // keep reload timers honest
      if (firing) this.secondaryWeapon.fire(this, input.mouse, dt, projectiles);
      if (input.isKeyPressed('r')) this.secondaryWeapon.startReload();
      if (this.meleeSwingTimer > 0) this.meleeSwingTimer -= dt;
      return;
    }
    // 1. Movement (WASD)
    let dirX = 0;
    let dirY = 0;
    if (input.isKeyDown('w')) dirY -= 1;
    if (input.isKeyDown('s')) dirY += 1;
    if (input.isKeyDown('a')) dirX -= 1;
    if (input.isKeyDown('d')) dirX += 1;

    const moving = dirX !== 0 || dirY !== 0;
    if (moving) {
      const len = Math.hypot(dirX, dirY);
      dirX /= len;
      dirY /= len;
    }

    const rate = (moving ? this.acceleration : this.deceleration) * dt;
    this.velocity.x = approach(this.velocity.x, dirX * this.moveSpeed, rate);
    this.velocity.y = approach(this.velocity.y, dirY * this.moveSpeed, rate);

    this.x += this.velocity.x * dt;
    this.y += this.velocity.y * dt;

    // Bullet Jump cooldown
    if (this.bulletJumpTimer > 0) this.bulletJumpTimer -= dt;

    // Bullet Jump (Ctrl + Space) - directional dash in aim direction
    if (input.isKeyDown('control') && input.isKeyPressed('space') && this.bulletJumpTimer <= 0) {
      this.bulletJumpTimer = this.bulletJumpCooldown;
      this.bulletJumpVisualTimer = 0.15; // visual effect duration
      this.bulletJumpDirection.x = Math.cos(this.angle);
      this.bulletJumpDirection.y = Math.sin(this.angle);
      this.velocity.x = this.bulletJumpDirection.x * this.bulletJumpSpeed;
      this.velocity.y = this.bulletJumpDirection.y * this.bulletJumpSpeed;
      this.isBulletJumping = true;
      audioManager.play('swordSlash1', 0.4); // placeholder sound
    }

    // Bullet Jump visual timer
    if (this.bulletJumpVisualTimer > 0) this.bulletJumpVisualTimer -= dt;
    // Reset isBulletJumping when velocity drops below threshold
    if (this.isBulletJumping && Math.hypot(this.velocity.x, this.velocity.y) < this.moveSpeed * 1.5) {
      this.isBulletJumping = false;
    }

    // 2. Shields recharge
    this.timeSinceDamage += dt;
    if (this.timeSinceDamage >= this.shieldRegenDelay) {
      this.shield = Math.min(
        this.maxShield,
        this.shield + this.maxShield * this.shieldRegenRate * dt
      );
    }

    // 3. Aim toward mouse
    this.angle = Math.atan2(input.mouse.y - this.y, input.mouse.x - this.x);
    this.handleWeapons(dt, input, projectiles, enemies);

  }

  handleWeapons(dt, input, projectiles, enemies) {
    if (this.lungeTarget) {
      if (this.lungeTarget.hp <= 0 || Math.hypot(this.lungeTarget.x - this.x, this.lungeTarget.y - this.y) < 10) {
        this.lungeTarget = null;
        this.lungeTimer = 0;
      } else {
        const angle = Math.atan2(this.lungeTarget.y - this.y, this.lungeTarget.x - this.x);
        this.velocity.x = Math.cos(angle) * 1200;
        this.velocity.y = Math.sin(angle) * 1200;
        this.lungeTimer -= dt;
        if (this.lungeTimer <= 0) {
            this.meleeWeapon.melee(this, enemies);
            this.lungeTarget = null;
        }
        return;
      }
    }
    const firing = input.mouse.down;
    const heavyClick = input.mouse.middleDown;
    this.primaryWeapon.update(dt, firing && this.currentWeapon === this.primaryWeapon);
    this.secondaryWeapon.update(dt, firing && this.currentWeapon === this.secondaryWeapon);

    const isMeleeEquipped = this.currentWeapon === this.meleeWeapon;

    // Parry state management (right-click hold while melee equipped)
    if (isMeleeEquipped && input.mouse.rightDown) {
      if (!this.meleeWeapon.isParrying) {
        this.meleeWeapon.startParry();
      }
    } else if (this.meleeWeapon.isParrying) {
      if (this.meleeWeapon.checkPerfectParry()) {
        // Perfect parry window still active - grant free heavy attack opportunity
        this.meleeWeapon.perfectParryReady = true;
      }
      this.meleeWeapon.stopParry();

    // Auto-swing: if melee equipped, not parrying, no lunge active, and target in reach+arc
    if (isMeleeEquipped && !this.meleeWeapon.isParrying && !this.lungeTarget) {
      const targetInfo = this.meleeWeapon.findBestTarget(this, enemies, halfArc);
      if (targetInfo.target) {
        const hits = this.meleeWeapon.melee(this, enemies);
        if (hits) {
          this.meleeSwingTimer = 0.15;
          this.meleeSwingHits = hits.map(e => ({ angle: Math.atan2(e.y - this.y, e.x - this.x), distance: Math.hypot(e.x - this.x, e.y - this.y) }));
        }
      }
    }

    // Lunge trigger: manual swing (click/E) with no target in reach, but one just outside
    const meleeInput = (input.isKeyPressed('e')) || (firing && isMeleeEquipped);
    if (meleeInput && isMeleeEquipped && !this.meleeWeapon.isParrying && !this.lungeTarget) {
      const halfArc = this.meleeWeapon.arc / 2;
      const targetInfo = this.meleeWeapon.findBestTarget(this, enemies, halfArc);
      if (!targetInfo.target) {
        const reach = this.meleeWeapon.range * 8;
        let best = { target: null, distance: Infinity };
        for (const enemy of enemies) {
          if (!enemy || enemy.hp <= 0) continue;
          const dx = enemy.x - this.x;
          const dy = enemy.y - this.y;
          const dist = Math.hypot(dx, dy);
          if (dist > reach + (enemy.radius || 0) + 60) continue;
          if (dist < best.distance) {
            best = { target: enemy, distance: dist };
          }
        }
        if (best.target) {
          this.lungeTarget = best.target;
          this.lungeTimer = 0.2;
          return;
        }
      }
    }
    }

    // 4. Normal melee swing (left click) or shooting
    if (firing) {
      if (isMeleeEquipped) {
        const hits = this.meleeWeapon.melee(this, enemies);
        if (hits) { // null = still on cooldown; [] = a whiff that still swings
          this.meleeSwingTimer = 0.15;
          this.meleeSwingHits = hits.map(e => ({ angle: Math.atan2(e.y - this.y, e.x - this.x), distance: Math.hypot(e.x - this.x, e.y - this.y) }));
          this.meleeSwingType = 'normal';
        }
      } else {
        this.currentWeapon.fire(this, input.mouse, dt, projectiles);
      }
    }

    // Heavy attack (middle click while melee equipped)
    if (heavyClick && isMeleeEquipped) {
      const hits = this.meleeWeapon.heavyAttack(this, enemies);
      if (hits) {
        this.meleeSwingTimer = 0.25;
        this.meleeSwingHits = hits.map(e => ({ angle: Math.atan2(e.y - this.y, e.x - this.x), distance: Math.hypot(e.x - this.x, e.y - this.y) }));
        this.meleeSwingType = 'heavy';
      }
    }

    if (input.isKeyPressed('r')) this.currentWeapon.startReload();

    // 5. Quick Melee (E) - works regardless of current weapon
    this.meleeWeapon.update(dt);
    if (input.isKeyPressed('e')) {
      const hits = this.meleeWeapon.melee(this, enemies);
      if (hits) {
        this.meleeSwingTimer = 0.15;
        this.meleeSwingHits = hits.map(e => ({ angle: Math.atan2(e.y - this.y, e.x - this.x), distance: Math.hypot(e.x - this.x, e.y - this.y) }));
        this.meleeSwingType = 'normal';
      }
    }

    if (this.meleeSwingTimer > 0) {
      this.meleeSwingTimer -= dt;
    }

    // 6. Weapon switching (1, 2, F)
    if (input.isKeyDown('1')) {
      this.primaryWeapon.triggerHeld = false;
      this.currentWeapon = this.primaryWeapon;
      this.lastRangedWeapon = this.primaryWeapon;
    }
    if (input.isKeyDown('2')) {
      this.secondaryWeapon.triggerHeld = false;
      this.currentWeapon = this.secondaryWeapon;
      this.lastRangedWeapon = this.secondaryWeapon;
    }

    this.weaponSwitchHandler.handleInput(input, dt, audioManager);
  }

  takeDamage(damage) {
    if (this.isBleedingOut) return 0; // downed players are ignored by enemies

    let mitigation = 0;
    // Parry damage reduction (90% reduction while parrying)
    if (this.currentWeapon === this.meleeWeapon && this.meleeWeapon.isParrying) {
      mitigation = this.meleeWeapon.parryDamageReduction; // 90% reduction
      // Perfect parry: stagger attacker, grant free heavy
      if (this.meleeWeapon.checkPerfectParry()) {
        this.meleeWeapon.perfectParryReady = true;
        audioManager.play('ui_parry', 0.6);
      }
    }

    const toHealth = this.healthComponent.takeDamage(damage, mitigation);
    this.timeSinceDamage = 0;

    if (this.healthComponent.isDead) {
      if (!this.isBleedingOut && this.revivesRemaining > 0) {
        this.isBleedingOut = true;
        this.awaitingRevive = false;
        this.bleedoutTimer = 20;
        this.healthComponent.hp = 1;
        this.currentWeapon = this.secondaryWeapon;
        this.velocity.x = 0;
        this.velocity.y = 0;
        return toHealth;
      } else {
        this.alive = false;
        this.isBleedingOut = false;
      }
    }
    return toHealth;
  }

  draw(ctx) {
    if (this.awaitingRevive) {
      // Body is gone — leave a pulsing X at the downed position.
      const pulse = 0.55 + 0.45 * Math.sin(this.awaitingPulse * 4);
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.strokeStyle = `rgba(255, 80, 80, ${pulse})`;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-10, -10);
      ctx.lineTo(10, 10);
      ctx.moveTo(10, -10);
      ctx.lineTo(-10, 10);
      ctx.stroke();
      ctx.fillStyle = `rgba(255, 255, 255, ${pulse})`;
      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('HOLD X TO SELF-REVIVE', 0, 30);
      ctx.restore();
      return;
    }
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    // Player ship / frame icon
    ctx.fillStyle = '#4ade80';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(-12, -12);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-12, 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Persistent melee attack arc shadow (telegraph) when melee is equipped
    if (this.currentWeapon === this.meleeWeapon && this.meleeSwingTimer === 0) {
      const weapon = this.meleeWeapon;
      const reach = weapon.range * 8;
      const halfArc = (weapon.attack.arc ?? 120) * Math.PI / 180 / 2;

      ctx.strokeStyle = "rgba(255, 200, 100, 0.12)";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, reach, -halfArc, halfArc);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Melee swing arc
    if (this.meleeSwingTimer > 0) {
      const weapon = this.meleeWeapon;
      const reach = weapon.range * 8;
      const halfArc = (this.meleeSwingType === 'heavy' ? (weapon.heavyAttackData?.arc ?? 140) : (weapon.attack.arc ?? 120)) * Math.PI / 180 / 2;
      const duration = this.meleeSwingType === 'heavy' ? 0.25 : 0.15;
      const progress = 1 - this.meleeSwingTimer / duration;
      
      ctx.strokeStyle = this.meleeSwingType === 'heavy' 
        ? `rgba(255, 100, 50, ${0.9 * (1 - progress)})` // orange-red for heavy
        : `rgba(255, 200, 100, ${0.8 * (1 - progress)})`;
      ctx.lineWidth = this.meleeSwingType === 'heavy' ? 6 : 4;
      ctx.lineCap = 'round';
      
      ctx.beginPath();
      ctx.arc(0, 0, reach * 0.3 + reach * 0.7 * progress, -halfArc, halfArc);
      ctx.stroke();
      
      // Hit sparks
      ctx.fillStyle = `rgba(255, 220, 150, ${1 - progress})`;
      for (const hit of this.meleeSwingHits) {
        const localAngle = hit.angle - this.angle;
        const dist = Math.min(hit.distance, reach) * (0.5 + progress * 0.5);
        ctx.beginPath();
        ctx.arc(Math.cos(localAngle) * dist, Math.sin(localAngle) * dist, 3 + progress * 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Parry visualization (blue-white shield arc in front)
    if (this.currentWeapon === this.meleeWeapon && this.meleeWeapon.isParrying) {
      const parryProgress = (performance.now() - this.meleeWeapon.parryStartTime) / (this.meleeWeapon.parryWindow * 1000);
      const parryArc = Math.PI / 2; // 90° front arc
      const parryRadius = 35 + Math.sin(performance.now() * 0.01) * 3; // pulsing
      
      ctx.strokeStyle = parryProgress < 1 
        ? `rgba(100, 200, 255, ${0.8 * (1 - parryProgress)})` // blue while in window
        : `rgba(255, 100, 100, 0.5)`; // red flash when window expires
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, parryRadius, -parryArc / 2, parryArc / 2);
      ctx.stroke();
      
      // Perfect parry indicator (white flash at center)
      if (parryProgress < 0.5) {
        ctx.fillStyle = `rgba(255, 255, 255, ${0.6 * (1 - parryProgress * 2)})`;
        ctx.beginPath();
        ctx.arc(0, 0, 15 * (1 - parryProgress * 2), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Bullet Jump visual effect (directional energy trail)
    if (this.bulletJumpVisualTimer > 0) {
      const progress = 1 - this.bulletJumpVisualTimer / 0.15;
      const trailLength = 40 * progress;
      const alpha = 0.8 * (1 - progress);

      ctx.save();
      // Rotate to bullet jump direction
      const bjAngle = Math.atan2(this.bulletJumpDirection.y, this.bulletJumpDirection.x);
      ctx.rotate(bjAngle - this.angle);

      // Energy trail
      ctx.strokeStyle = `rgba(100, 200, 255, ${alpha})`;
      ctx.lineWidth = 8 * (1 - progress);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-trailLength, 0);
      ctx.lineTo(0, 0);
      ctx.stroke();

      // Glow at origin
      ctx.fillStyle = `rgba(100, 200, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(0, 0, 12 * (1 - progress), 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    ctx.restore();
  }
}

