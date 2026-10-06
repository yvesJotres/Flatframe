// Enemy scaling formulas based on Warframe's model.
// Base values are modified by level to determine final stats.

export const BASE_LEVEL = 1;

/**
 * Calculates a scaled stat based on the base value and level.
 * Formula: Stat = Base * (1 + (Level - 1)^2 * ScalingFactor)
 * 
 * Note: Warframe uses complex curves. For a 2D shooter, we use a simpler
 * exponential growth model that feels similar.
 */
export function scaleStat(baseValue, level, scalingFactor = 0.015) {
  if (level <= BASE_LEVEL) return baseValue;
  const growth = Math.pow(level - BASE_LEVEL, 2) * scalingFactor;
  return Math.round(baseValue * (1 + growth));
}

// Example usage in Lancer.js:
// this.maxHp = scaleStat(100, this.lvl, 0.015);
// this.armor = scaleStat(200, this.lvl, 0.005);
