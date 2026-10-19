/**
 * Where a mod can go, what it costs, and what it does to a configuration (wiki: Mod, Mod Capacity).
 *
 * Slot kinds:
 *   aura    the Warframe's top-left slot. Accepts only Aura mods.
 *   exilus  the top-right slot of a Warframe, or the single extra slot of a weapon. Accepts any mod except Aura.
 *   normal  every other slot. Accepts any mod except Aura mods.
 */
export const SLOT_KINDS = { AURA: 'aura', EXILUS: 'exilus', NORMAL: 'normal' };

// Warframe slots are 0 to 9: 0 = aura, 1 = exilus, the rest normal.
// Weapons are 0 to 7 normal, and slot 8 is their exilus slot.
export function slotKind(slotId, index) {
  if (slotId === 'warframe') {
    if (index === 0) return SLOT_KINDS.AURA;
    if (index === 1) return SLOT_KINDS.EXILUS;
    return SLOT_KINDS.NORMAL;
  }
  return index === 8 ? SLOT_KINDS.EXILUS : SLOT_KINDS.NORMAL;
}

// Polarity of each slot. The wiki gives a polarity for each slot; the game has no slot polarity data yet,
// so every slot is unpolarised and matching or non-matching drain does not apply until that data exists.
export function slotPolarity() {
  return null;
}

// Wiki: minimum capacity is 15, plus 1 for every 2 Mastery Ranks
export function capacityForMastery(masteryRank) {
  return 15 + Math.floor(Math.max(0, masteryRank) / 2);
}

export function canPlace(mod, kind) {
  if (kind === SLOT_KINDS.AURA) return mod.isAura === true;
  return mod.isAura !== true; // normal and exilus slots: Aura mods are not allowed
}

// Wiki: non-matching polarity adds a quarter of the drain, with these steps
function nonMatchingBonus(drain) {
  if (drain <= 1) return 0;
  if (drain <= 5) return 1;
  if (drain <= 9) return 2;
  if (drain <= 13) return 3;
  return 4;
}

// Wiki: matching polarity halves the drain (rounded up); non-matching adds a quarter of it
export function polarisedDrain(drain, mod, slot) {
  if (!slot || !mod?.polarity) return drain;
  if (mod.polarity === slot) return Math.ceil(drain / 2);
  return drain + nonMatchingBonus(drain);
}

// A mod's base drain at its current rank: the base drain, plus 1 for each rank
export function baseDrain(mod) {
  return (mod?.baseDrain ?? 0) + (mod?.currentRank ?? 0);
}

// The drain a mod uses in a given slot (polarity applied)
export function modDrain(mod, slot = null) {
  return polarisedDrain(baseDrain(mod), mod, slot);
}

// Capacity used by the mods in a config. slotOf(index) gives each slot's polarity.
export function usedCapacity(mods = [], slotOf = () => null) {
  return mods.reduce((sum, mod, index) => (mod ? sum + modDrain(mod, slotOf(index)) : sum), 0);
}

// A mod can't be installed twice on the same item (wiki)
export function isDuplicate(mods, mod) {
  return mods.some((m) => m && m.uniqueName === mod.uniqueName);
}

// Fusion: raising a Common mod from rank 0 costs 10 Endo, and each later rank costs double. null at max rank.
// The other rarities' costs are not in the data yet, so they use the Common values.
export function fusionEndoCost(mod) {
  const max = mod?.maxRank ?? 10;
  const rank = mod?.currentRank ?? 0;
  if (rank >= max) return null;
  return 10 * 2 ** rank;
}

// The effect text of a mod at its current rank, one line per stat (e.g. "+9% Health")
export function modEffectLines(mod) {
  if (!mod?.levelStats?.length) return [];
  const rank = Math.min(Math.max(mod.currentRank ?? 0, 0), mod.levelStats.length - 1);
  return mod.levelStats[rank].stats ?? [];
}

// Wiki fusion tables: total cost to reach each rank from rank 0 (Common). Other rarities multiply by these.
const FUSION_ENDO = [0, 10, 30, 70, 150, 310, 630, 1270, 2550, 5110, 10230];
const FUSION_CREDITS = [0, 483, 1449, 3381, 7245, 14973, 30429, 61341, 123165, 246813, 494109];
const RARITY_MULTIPLIER = { common: 1, uncommon: 2, rare: 3, legendary: 4 };

// Endo and Credits to fuse a mod from one rank to another. Unknown rarities count as Common.
export function fusionCost(rarity, from, to) {
  const k = RARITY_MULTIPLIER[String(rarity ?? '').toLowerCase()] ?? 1;
  if (to <= from) return { endo: 0, credits: 0 };
  return {
    endo: k * (FUSION_ENDO[to] - FUSION_ENDO[from]),
    credits: k * (FUSION_CREDITS[to] - FUSION_CREDITS[from]),
  };
}
