/**
 * Warframe Critical Hit System
 * Source: wiki Damage page, Critical Hits section
 */

export const CritTier = {
  NONE: 0,
  YELLOW: 1,    // Normal crit (yellow)
  ORANGE: 2,    // Big crit (orange) - 2.0x+
  RED: 3,       // Super crit (red) - 3.0x+
};

/**
 * Calculate critical hit chance after mods.
 * baseCritChance: weapon base (e.g., 0.05 = 5%)
 * critChanceMods: sum of all +crit chance mods (e.g., Point Strike = 1.5)
 * Returns final crit chance as decimal (capped at 1.0 for non-red-crit weapons)
 */
export function calculateCritChance(baseCritChance, critChanceMods = 0) {
  return Math.min(1, baseCritChance * (1 + critChanceMods));
}

/**
 * Calculate critical multiplier for a given tier.
 * baseCritMultiplier: weapon base (e.g., 1.5x, 2.0x, 2.5x)
 * critDamageMods: sum of all +crit damage mods (e.g., Vital Sense = 1.2)
 */
export function calculateCritMultiplier(baseCritMultiplier, critDamageMods = 0) {
  return baseCritMultiplier * (1 + critDamageMods);
}

/**
 * Determine crit tier from final multiplier.
 * Warframe thresholds: 1.0-1.99 = yellow, 2.0-2.99 = orange, 3.0+ = red
 */
export function getCritTier(finalMultiplier) {
  if (finalMultiplier >= 3.0) return CritTier.RED;
  if (finalMultiplier >= 2.0) return CritTier.ORANGE;
  if (finalMultiplier > 1.0) return CritTier.YELLOW;
  return CritTier.NONE;
}

/**
 * Roll for critical hit and return { isCrit, tier, multiplier }.
 * Handles red crit overflow (multiplier >= 3.0 can proc additional red crits).
 */
export function rollCrit(baseCritChance, baseCritMultiplier, critChanceMods = 0, critDamageMods = 0) {
  const chance = calculateCritChance(baseCritChance, critChanceMods);
  const mult = calculateCritMultiplier(baseCritMultiplier, critDamageMods);
  
  if (Math.random() > chance) {
    return { isCrit: false, tier: CritTier.NONE, multiplier: 1.0 };
  }
  
  const tier = getCritTier(mult);
  return { isCrit: true, tier, multiplier: mult };
}

/**
 * Stealth/Headshot damage bonus (additive with crit).
 * Warframe: Stealth = 2x, Headshot = 2x, both = 4x (additive, not multiplicative with crit).
 * This returns the additive bonus multiplier (1.0 = no bonus, 2.0 = +100%).
 */
export function calculateStealthHeadshotBonus(isStealth, isHeadshot) {
  let bonus = 1.0;
  if (isStealth) bonus += 1.0;    // +100%
  if (isHeadshot) bonus += 1.0;   // +100%
  return bonus;
}

/**
 * Apply critical and stealth/headshot multipliers to base damage.
 * Crit and stealth/headshot are ADDITIVE in Warframe (not multiplicative).
 * Total = base * (critMult + stealthHeadshotBonus - 1)
 */
export function applyCritAndPrecision(baseDamage, critResult, stealthHeadshotBonus = 1.0) {
  if (!critResult.isCrit) {
    return baseDamage * stealthHeadshotBonus;
  }
  // Additive: critMult + precisionBonus - 1
  const totalMult = critResult.multiplier + stealthHeadshotBonus - 1;
  return baseDamage * totalMult;
}