/**
 * Critical hit mechanics.
 */
export const CRITICAL_CHANCE_BASE = 0.1;
export const CRITICAL_DAMAGE_BASE = 1.5;

export function calculateCriticalDamage(damage, weapon = {}) {
  const isCritical = Math.random() < (weapon.criticalChance ?? CRITICAL_CHANCE_BASE);
  if (isCritical) {
    return damage * (weapon.criticalDamage ?? CRITICAL_DAMAGE_BASE);
  }
  return damage;
}
