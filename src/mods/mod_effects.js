/**
 * Combat effects of the basic mods, applied to weapons and the Warframe.
 *
 * Values are from the Warframe wiki:
 *   Serration       +15% per rank, rank 0 to 10 (+165% at max). Primary weapons, shotguns excluded.
 *   Hornet Strike   +20% per rank, rank 0 to 10 (+220% at max). Secondary weapons.
 *   Pressure Point  +20% per rank, rank 0 to 5 (+120% at max). Melee weapons.
 *   Vitality        +9% at rank 0, +100% Max Health at rank 10. Warframe.
 *                   Ranks 1 to 9 are NOT confirmed: they are interpolated linearly here.
 */

// bonus(rank) gives the fractional bonus at that rank (0.15 = +15%)
export const MOD_EFFECTS = {
  Serration: {
    target: 'primary',
    maxRank: 10,
    bonus: rank => 0.15 * (rank + 1),
  },
  'Hornet Strike': {
    target: 'secondary',
    maxRank: 10,
    bonus: rank => 0.2 * (rank + 1),
  },
  'Pressure Point': {
    target: 'melee',
    maxRank: 5,
    bonus: rank => 0.2 * (rank + 1),
  },
  Vitality: {
    target: 'health',
    maxRank: 10,
    bonus: rank => 0.09 + (1 - 0.09) * (rank / 10),
  },
};

// The bonus one equipped mod gives. Each mod counts once, even if several copies are in the slots.
function modBonus(mods, name) {
  const mod = (mods ?? []).find(m => m?.name === name);
  if (!mod) return 0;
  const rank = Math.min(mod.currentRank ?? 0, MOD_EFFECTS[name].maxRank);
  return MOD_EFFECTS[name].bonus(rank);
}

// Damage multiplier for a weapon of `category` ('primary' | 'secondary' | 'melee').
// `isShotgun` excludes Serration, as the wiki says it does not apply to shotguns.
export function weaponDamageMultiplier(mods, category, isShotgun = false) {
  for (const [name, effect] of Object.entries(MOD_EFFECTS)) {
    if (effect.target !== category) continue;
    if (name === 'Serration' && isShotgun) continue;
    return 1 + modBonus(mods, name);
  }
  return 1;
}

// Max Health multiplier for the Warframe (Vitality)
export function healthMultiplier(mods) {
  return 1 + modBonus(mods, 'Vitality');
}
