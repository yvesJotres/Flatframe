// Enemy scaling formulas based on Warframe's model.
// Base values are modified by level to determine final stats.

export const BASE_LEVEL = 1;

// Wiki-accurate faction scaling parameters
// formula: 1 + coeff * (level - 1)^exponent
export const FACTION_SCALING = {
  grineer: { hp: { coeff: 0.015, exponent: 2.12 }, armor: { coeff: 0.005, exponent: 2.12 } },
  corpus: { hp: { coeff: 0.015, exponent: 2.12 }, armor: { coeff: 0.005, exponent: 2.12 } },
  infested: { hp: { coeff: 0.0225, exponent: 2.12 }, armor: { coeff: 0.005, exponent: 2.12 } },
  corrupted: { hp: { coeff: 0.015, exponent: 2.1 }, armor: { coeff: 0.005, exponent: 2.1 } },
  murmur: { hp: { coeff: 0.015, exponent: 2.0 }, armor: { coeff: 0.005, exponent: 2.0 } },
  sentient: { hp: { coeff: 0.015, exponent: 2.0 }, armor: { coeff: 0.005, exponent: 2.0 } },
  anarchs: { hp: { coeff: 0.015, exponent: 2.0 }, armor: { coeff: 0.005, exponent: 2.0 } },
  unaffiliated: { hp: { coeff: 0.015, exponent: 2.0 }, armor: { coeff: 0.005, exponent: 2.0 } },
  techrot: { hp: { coeff: 0.02, exponent: 2.12 }, armor: { coeff: 0.005, exponent: 2.12 } },
  scaldra: { hp: { coeff: 0.015, exponent: 2.12 }, armor: { coeff: 0.005, exponent: 2.12 } },
};

/**
 * Calculates a scaled stat based on the base value and level.
 * Wiki formulas: 1 + coeff * (level - 1)^exponent
 */
export function scaleStat(baseValue, level, coeff = 0.015, exponent = 2.12) {
  if (level <= BASE_LEVEL) return baseValue;
  const growth = coeff * Math.pow(level - BASE_LEVEL, exponent);
  return Math.round(baseValue * (1 + growth));
}

/**
 * Scales a stat using faction-specific wiki parameters.
 * @param {number} baseValue - Base stat value
 * @param {number} level - Enemy level
 * @param {string} statType - 'hp' or 'armor'
 * @param {string} faction - Faction key from FACTION_SCALING
 */
export function scaleStatByFaction(baseValue, level, statType, faction) {
  const params = FACTION_SCALING[faction]?.[statType] ?? FACTION_SCALING.grineer[statType];
  return scaleStat(baseValue, level, params.coeff, params.exponent);
}

// Example usage in Lancer.js:
// this.maxHp = scaleStat(100, this.lvl, 0.015);
// this.armor = scaleStat(200, this.lvl, 0.005);
