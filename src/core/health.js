/**
 * Manages HP, Shields, and Armor for any entity.
 */
import { reduceDamage } from './damage.js';

export default class HealthComponent {
  constructor(stats, isPlayer = false) {
    this.maxHp = stats.maxHp ?? 100;
    this.hp = this.maxHp;
    this.maxShield = stats.maxShield ?? 0;
    this.shield = this.maxShield;
    this.armor = stats.armor ?? 0;
    this.isPlayer = isPlayer;
  }

  // Shield Gating (Player only)
  shieldGateTimer = 0;
  lastMaxShieldAtBreak = 0;

  takeDamage(hit, mitigation = 0) {
    const raw = typeof hit === 'number' ? hit : hit.total;
    let remaining = raw * (1 - mitigation);

    // Apply shield gate logic
    if (this.shieldGateTimer > 0) {
      // In invulnerability period, ignore all damage
      return 0;
    }

    // Shield absorption
    const wasShieldFull = this.shield >= this.maxShield;
    const absorbed = Math.min(this.shield, remaining);
    this.shield -= absorbed;
    remaining -= absorbed;

    // Trigger gate
    if (absorbed > 0 && this.shield <= 0) {
      this.lastMaxShieldAtBreak = wasShieldFull ? this.maxShield : 0; 
      this.shieldGateTimer = wasShieldFull ? 1.3 : 0.3;
      this.shield = 0;
      // If we broke the shield, return 0 damage dealt to health
      return 0;
    }

    // Health reduction
    const toHealth = remaining > 0 ? reduceDamage(remaining, this.armor, this.isPlayer) : 0;
    this.hp = Math.max(0, this.hp - toHealth);

    return toHealth;
  }

  update(dt) {
    if (this.shieldGateTimer > 0) {
      this.shieldGateTimer = Math.max(0, this.shieldGateTimer - dt);
    }
  }

  restoreShield(amount) {
    this.shield = Math.min(this.maxShield, this.shield + amount);
    // Restoration immediately ends shield gate
    this.shieldGateTimer = 0;
  }

  get isDead() {
    return this.hp <= 0;
  }
}
