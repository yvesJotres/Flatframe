// Damage 3.0 armor reduction and on-hit status effects.
import { StatusEffectConfigs, StatusType } from './status_effects.js';

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

// Status effects the game currently applies on hit, built from the shared
// configs in status_effects.js (the single source for status numbers).
const slash = StatusEffectConfigs[StatusType.SLASH];

export const STATUS_EFFECT_FACTORIES = {
  slash: (totalDamage) => ({
    remaining: Math.round(slash.baseDuration / slash.tickInterval),
    interval: slash.tickInterval,
    timer: 0,
    tickDamage: totalDamage * slash.tickDamageRatio,
    config: { bypassesArmor: slash.bypassesArmor, bypassesShields: slash.bypassesShields },
  }),
};
