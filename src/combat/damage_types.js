/**
 * Warframe Damage 3.0 — Damage Types & Faction Vulnerabilities
 * Source: https://wiki.warframe.com/w/Damage
 */

// Physical damage types
export const PhysicalDamageType = {
  IMPACT: 'impact',
  PUNCTURE: 'puncture',
  SLASH: 'slash',
};

// Elemental damage types
export const ElementalDamageType = {
  HEAT: 'heat',
  COLD: 'cold',
  ELECTRICITY: 'electricity',
  TOXIN: 'toxin',
};

// Combined (secondary) elements
export const CombinedDamageType = {
  BLAST: 'blast',           // Heat + Cold
  CORROSIVE: 'corrosive',   // Electricity + Toxin
  GAS: 'gas',               // Heat + Toxin
  MAGNETIC: 'magnetic',     // Cold + Electricity
  RADIATION: 'radiation',   // Heat + Electricity
  VIRAL: 'viral',           // Cold + Toxin
};

// Void / special
export const SpecialDamageType = {
  VOID: 'void',
  TAU: 'tau',
  TRUE: 'true',             // Bypasses all DR (e.g., Slash bleed)
};

export const AllDamageTypes = {
  ...PhysicalDamageType,
  ...ElementalDamageType,
  ...CombinedDamageType,
  ...SpecialDamageType,
};

/**
 * Damage 3.0 Faction Vulnerability/Resistance Table
 * + = vulnerability (x1.5), - = resistance (x0.5), blank = neutral (x1.0)
 * Values are multipliers applied to BASE damage of that type vs that faction.
 * Source: Warframe Wiki Damage 3.0 "Default Faction Vulnerabilities" table.
 */
// Only non-neutral entries are listed; anything missing is x1.0.
// Values transcribed from ref/extracted/Damage - WARFRAME Wiki.txt (Update 36.0 table).
const V = 1.5; // vulnerable (+)
const R = 0.5; // resistant (-)
const NEUTRAL = Object.fromEntries(Object.values(AllDamageTypes).filter(t => t !== 'true').map(t => [t, 1.0]));
const faction = (mods) => ({ ...NEUTRAL, ...mods });

export const FactionDamageModifiers = {
  // Grineer: vulnerable to Impact and Corrosive, no resistances
  grineer: faction({ impact: V, corrosive: V }),
  kuva_grineer: faction({ impact: V, corrosive: V, heat: R }),
  // Corpus: vulnerable to Puncture and Magnetic
  corpus: faction({ puncture: V, magnetic: V }),
  corpus_amalgam: faction({ electricity: V, magnetic: V, blast: R }),
  // Infested: vulnerable to Slash and Heat
  infested: faction({ slash: V, heat: V }),
  infested_deimos: faction({ blast: V, gas: V, viral: R }),
  orokin: faction({ puncture: V, viral: V, radiation: R }),
  sentient: faction({ cold: V, radiation: V, corrosive: R }),
  narmer: faction({ slash: V, toxin: V, magnetic: R }),
};

/**
 * Get damage multiplier for a damage type vs a faction.
 * Returns 1.0 (neutral) if not specified.
 */
export function getFactionDamageMultiplier(faction, damageType) {
  const table = FactionDamageModifiers[faction];
  if (!table) return 1.0;
  const mult = table[damageType];
  return mult !== undefined ? mult : 1.0;
}

/**
 * Combine elemental damage types into secondary elements.
 * Returns array of resulting damage types (order matters for status priority).
 */
export function combineElements(types) {
  const has = new Set(types);
  const combined = [];

  if (has.has(ElementalDamageType.HEAT) && has.has(ElementalDamageType.COLD)) {
    combined.push(CombinedDamageType.BLAST);
  }
  if (has.has(ElementalDamageType.ELECTRICITY) && has.has(ElementalDamageType.TOXIN)) {
    combined.push(CombinedDamageType.CORROSIVE);
  }
  if (has.has(ElementalDamageType.HEAT) && has.has(ElementalDamageType.TOXIN)) {
    combined.push(CombinedDamageType.GAS);
  }
  if (has.has(ElementalDamageType.COLD) && has.has(ElementalDamageType.ELECTRICITY)) {
    combined.push(CombinedDamageType.MAGNETIC);
  }
  if (has.has(ElementalDamageType.HEAT) && has.has(ElementalDamageType.ELECTRICITY)) {
    combined.push(CombinedDamageType.RADIATION);
  }
  if (has.has(ElementalDamageType.COLD) && has.has(ElementalDamageType.TOXIN)) {
    combined.push(CombinedDamageType.VIRAL);
  }

  return combined;
}