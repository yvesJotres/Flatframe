export function playerDamageReduction(armor = 0) {
  return armor / (armor + 300);
}

export function enemyDamageReduction(armor = 0) {
  const cappedArmor = Math.min(2700, Math.max(0, armor));
  return 0.9 * Math.sqrt(cappedArmor / 2700);
}

export function reduceDamage(damage, armor = 0, isPlayer = false) {
  const reduction = isPlayer ? playerDamageReduction(armor) : enemyDamageReduction(armor);
  return damage * (1 - reduction);
}

// 2. Status Effect Definitions
// Maps status key to a factory function that returns the effect config
export const STATUS_EFFECT_FACTORIES = {
  slash: (totalDamage) => ({
    remaining: 7,
    interval: 0.85,
    timer: 0,
    tickDamage: totalDamage * 0.35,
  }),
  // Future statuses (heat, toxin, etc.) go here:
  // heat: (damage) => ({ ... }),
};
