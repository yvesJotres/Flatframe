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

  takeDamage(hit, mitigation = 0) {
    const raw = typeof hit === 'number' ? hit : hit.total;
    let remaining = raw * (1 - mitigation);

    // Shield absorption
    const absorbed = Math.min(this.shield, remaining);
    this.shield -= absorbed;
    remaining -= absorbed;

    // Health reduction
    const toHealth = reduceDamage(remaining, this.armor, this.isPlayer);
    this.hp = Math.max(0, this.hp - toHealth);

    return toHealth;
  }

  get isDead() {
    return this.hp <= 0;
  }
}
