/**
 * Manages HP, Shields, and Armor for any entity.
 */
import { reduceDamage } from './damage.js';

export const SHIELD_DR_PLAYER = 0.5; // 50% damage reduction on shields for player

export default class HealthComponent {
  constructor(stats, isPlayer = false) {
    this.maxHp = stats.maxHp ?? 100;
    this.hp = this.maxHp;
    this.maxShield = stats.maxShield ?? 0;
    this.shield = this.maxShield;
    this.baseArmor = stats.armor ?? 0;
    this.currentArmor = this.baseArmor;
    this.isPlayer = isPlayer;

    // Shield Gating
    this.shieldGateTimer = 0;
    this.maxShieldSinceLastGate = this.maxShield; // Track max shields replenished since last gate
    this.shieldGateInvulnerable = false; // True during gate invulnerability
    this.shieldGateMultiplier = 1.0; // For Protea/etc.
    this.fixedGateDuration = null; // For Catalyzing Shields / Dragon Key
    this.isHildryn = false; // Hildryn support

    // Status effects affecting shields
    this.magneticTimer = 0; // Magnetic status prevents shield regen
  }

  /**
   * Calculate shield gate invulnerability duration
   */
  calculateGateDuration(maxShield) {
    // Override: Catalyzing Shields or Decaying Dragon Key
    if (this.fixedGateDuration !== null) return this.fixedGateDuration;

    // Override: Hildryn
    if (this.isHildryn) return 3.5;

    let base;
    if (maxShield < 53) {
      base = maxShield / 180 + 1 / 3;
    } else if (maxShield <= 1150) {
      base = Math.pow(maxShield / 350, 0.65) + 1 / 3;
    } else {
      base = 2.5;
    }

    return base * this.shieldGateMultiplier;
  }

  /**
   * takeDamage(hit, mitigation = 0, isWeakspot = false, bypassGate = false)
   */
  takeDamage(hit, mitigation = 0, isWeakspot = false, bypassGate = false) {
    const raw = typeof hit === 'number' ? hit : hit.total;
    let remaining = raw * (1 - mitigation);

    // During shield gate invulnerability - ignore damage unless bypassed
    if (this.shieldGateTimer > 0 && !bypassGate) {
      if (this.isPlayer) {
        return 0; // Player: full invulnerability
      } else if (!isWeakspot) {
        // Enemy: 5% damage leaks through (if not weakspot)
        remaining = remaining * 0.05;
      }
      // If weakspot, gate is ignored
    }

    // Toxin bypasses shields entirely (goes straight to health)
    const toxinDamage = (typeof hit === 'object' && hit.toxin) ? hit.toxin : 0;
    if (toxinDamage > 0) {
      const toHealth = reduceDamage(toxinDamage, this.currentArmor, this.isPlayer);
      this.hp = Math.max(0, this.hp - toHealth);
      // Toxin doesn't affect shields, continue with remaining non-toxin damage
      remaining -= toxinDamage;
    }

    // Magnetic status: increases damage to shields, prevents regen
    const magneticDamage = (typeof hit === 'object' && hit.magnetic) ? hit.magnetic : 0;
    if (magneticDamage > 0) {
      this.magneticTimer = 6; // 6s magnetic duration
    }

    // Shield damage reduction: 50% for player shields
    let shieldDR = 0;
    if (this.isPlayer && this.shield > 0) {
      shieldDR = SHIELD_DR_PLAYER; // 50% DR on shields
    }

    // Shield absorption (with DR applied)
    const effectiveRemaining = remaining * (1 - shieldDR);
    const absorbed = Math.min(this.shield, effectiveRemaining);
    this.shield -= absorbed;
    remaining -= absorbed / (1 - shieldDR); // Convert back to pre-DR damage for health calc

    // Trigger shield gate when shield fully depleted
    if (absorbed > 0 && this.shield <= 0) {
      if (this.isPlayer) {
        // Player: invulnerability scales with max shields replenished since last gate
        this.shieldGateTimer = this.calculateGateDuration(this.maxShieldSinceLastGate);
        this.shieldGateInvulnerable = true;
      } else {
        // Enemy: fixed 0.1s gate (only if not weakspot)
        if (!isWeakspot) this.shieldGateTimer = 0.1;
      }
      this.shield = 0;
      return 0;
    }

    // Health reduction (only if shields didn't absorb everything)
    const toHealth = remaining > 0 ? reduceDamage(remaining, this.currentArmor, this.isPlayer) : 0;
    this.hp = Math.max(0, this.hp - toHealth);

    return toHealth;
  }

  update(dt) {
    if (this.shieldGateTimer > 0) {
      this.shieldGateTimer = Math.max(0, this.shieldGateTimer - dt);
      if (this.shieldGateTimer <= 0) {
        this.shieldGateInvulnerable = false;
        // After gate ends, reset tracking for next gate
        this.maxShieldSinceLastGate = 0;
      }
    }

    // Magnetic status prevents shield regeneration
    if (this.magneticTimer > 0) {
      this.magneticTimer = Math.max(0, this.magneticTimer - dt);
    }
  }

  canRegenerateShield() {
    return this.magneticTimer <= 0 && !this.shieldGateInvulnerable;
  }

  restoreShield(amount) {
    // Magnetic prevents shield restoration
    if (this.magneticTimer > 0) return;
    
    this.shield = Math.min(this.maxShield, this.shield + amount);
    // Update max shield replenished since last gate
    if (this.shield > this.maxShieldSinceLastGate) {
      this.maxShieldSinceLastGate = this.shield;
    }
    // Restoring ANY amount of shields during invulnerability immediately ends it
    if (this.shieldGateInvulnerable) {
      this.shieldGateTimer = 0;
      this.shieldGateInvulnerable = false;
    }
  }

  // Scaling armor for enemies (formula proxy: base * (1 + level^1.75 / 200))
    scaleArmor(level) {
      if (this.isPlayer) return; // Player armor doesn't level-scale
      const baseLevel = 1; // Assuming enemies start at level 1
      const factor = Math.pow(Math.max(0, level - baseLevel), 1.75) / 200;
      const scaled = Math.floor(this.baseArmor * (1 + factor));
      // Wiki: enemies whose level-scaled armor would be less than 200 have initial armor set to min cap 200
      this.currentArmor = Math.max(200, scaled);
    }

  get hasArmor() {
    return this.currentArmor > 0;
  }

  get isDead() {
    return this.hp <= 0;
  }

  get isInvulnerable() {
    return this.shieldGateTimer > 0 || this.shieldGateInvulnerable;
  }
}
