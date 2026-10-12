// Enemy scaling formulas based on Warframe's Enemy Level Scaling (Damage 3.0 wiki).
// Uses dual-curve interpolation: f1 (lower) for levels 1-70, f2 (upper) for 85+,
// with smoothstep transition between levels 70-80 (ref: Health/Shield/Armor pages).

export const BASE_LEVEL = 1;
export const TRANSITION_START = 70;
export const TRANSITION_END = 80;

// Universal armor scaling (wiki: Enemy Level Scaling page - same for all factions)
export const ARMOR_SCALING = {
  f1: { coeff: 0.005, exponent: 1.75 },
  f2: { coeff: 0.4, exponent: 0.75 }
};

// Dual-curve scaling parameters per faction (HP and Shield), transcribed from
// ref/extracted/Health - WARFRAME Wiki.txt and Shield - WARFRAME Wiki.txt.
const c = (coeff, exponent) => ({ coeff, exponent });
const HP_GRINEER = { f1: c(0.015, 2.12), f2: c(10.7332, 0.72) };       // Grineer, Scaldra
const HP_MISC = { f1: c(0.015, 2), f2: c(10.7332, 0.5) };              // Murmur, Sentient, Anarchs, Unaffiliated
const SH_GRINEER = { f1: c(0.02, 1.75), f2: c(1.6, 0.75) };            // Grineer, Sentient (default for unlisted)
export const FACTION_SCALING = {
  grineer: { hp: HP_GRINEER, shield: SH_GRINEER },
  scaldra: { hp: HP_GRINEER, shield: SH_GRINEER },
  corpus: { hp: { f1: c(0.015, 2.12), f2: c(13.4165, 0.55) }, shield: { f1: c(0.02, 1.76), f2: c(2, 0.76) } },
  infested: { hp: { f1: c(0.0225, 2.12), f2: c(16.0998, 0.72) }, shield: SH_GRINEER },
  corrupted: { hp: { f1: c(0.015, 2.1), f2: c(10.7332, 0.685) }, shield: { f1: c(0.02, 1.75), f2: c(2, 0.75) } },
  murmur: { hp: HP_MISC, shield: SH_GRINEER },
  sentient: { hp: HP_MISC, shield: SH_GRINEER },
  anarchs: { hp: HP_MISC, shield: SH_GRINEER },
  unaffiliated: { hp: HP_MISC, shield: SH_GRINEER },
  techrot: { hp: { f1: c(0.02, 2.12), f2: c(15.0998, 0.7) }, shield: { f1: c(0.02, 1.76), f2: c(3.5, 0.76) } },
};

/**
 * Single curve: 1 + coeff * (level - 1)^exponent
 */
function curve(baseValue, level, coeff, exponent) {
  if (level <= BASE_LEVEL) return baseValue;
  const growth = coeff * Math.pow(level - BASE_LEVEL, exponent);
  return baseValue * (1 + growth);
}

/**
 * Smoothstep interpolation (wiki: t * t * (3 - 2 * t))
 */
function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

/**
 * Dual-curve interpolation (wiki accurate):
 * - levels 1-70: use f1 (lower curve)
 * - levels 80+: use f2 (upper curve) 
 * - levels 70-80: smoothstep interpolation between f1 and f2
 */
function dualCurve(baseValue, level, f1, f2, round = Math.round) {
  const v1 = curve(baseValue, level, f1.coeff, f1.exponent);
  // Wiki (Health, Shield, Armor): the 70-80 transition is on the level difference from base level
  const position = level - BASE_LEVEL;

  if (position <= TRANSITION_START) {
    return round(v1);
  }
  
  const v2 = curve(baseValue, level, f2.coeff, f2.exponent);
  
  if (position >= TRANSITION_END) {
    return round(v2);
  }

  // Smoothstep interpolation between f1 and f2 in transition zone (70-80)
  const t = (position - TRANSITION_START) / (TRANSITION_END - TRANSITION_START);
  const s = smoothstep(t);
  return round(v1 * (1 - s) + v2 * s);
}

/**
 * Calculates a scaled stat based on the base value and level.
 * Wiki formulas use dual-curve interpolation.
 */
export function scaleStat(baseValue, level, f1, f2, round = Math.round) {
  if (!f2) {
    // Backward compat: single curve
    if (level <= BASE_LEVEL) return baseValue;
    const growth = f1.coeff * Math.pow(level - BASE_LEVEL, f1.exponent);
    return Math.round(baseValue * (1 + growth));
  }
  return dualCurve(baseValue, level, f1, f2, round);
}

/**
 * Scales a stat using faction-specific wiki parameters with dual-curve.
 * Armor uses universal scaling (same for all factions).
 * @param {number} baseValue - Base stat value
 * @param {number} level - Enemy level
 * @param {string} statType - 'hp', 'armor', or 'shield'
 * @param {string} faction - Faction key from FACTION_SCALING
 */
export function scaleStatByFaction(baseValue, level, statType, faction) {
  if (statType === 'armor') {
    if (baseValue <= 0) return 0;
    // Ref (Armor page): level-scaled initial armor is clamped to 200..2700. The wiki's armor values
    // are rounded down (checked against the Trooper calculator for levels 13-80)
    return Math.min(2700, Math.max(200, scaleStat(baseValue, level, ARMOR_SCALING.f1, ARMOR_SCALING.f2, Math.floor)));
  }
  const params = FACTION_SCALING[faction]?.[statType] ?? FACTION_SCALING.grineer[statType];
  return scaleStat(baseValue, level, params.f1, params.f2);
}

// Example usage in Lancer.js:
// this.maxHp = scaleStatByFaction(100, this.lvl, 'hp', this.faction);
// this.armor = scaleStatByFaction(200, this.lvl, 'armor', this.faction);
