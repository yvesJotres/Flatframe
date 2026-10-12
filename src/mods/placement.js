/**
 * Where a mod can go in a configuration.
 *
 * Slot kinds (Warframes only; weapons have normal slots):
 *   aura    the top-left slot. Accepts only Aura mods.
 *   exilus  the top-right slot. Accepts only Exilus mods.
 *   normal  every other slot. Accepts any mod except Aura mods.
 */
export const SLOT_KINDS = { AURA: 'aura', EXILUS: 'exilus', NORMAL: 'normal' };

// Warframe slots are numbered 0 to 9 in the grid: 0 = aura, 1 = exilus, the rest are normal.
// Weapons have no aura or exilus slot, so every weapon slot is normal.
export function slotKind(slotId, index) {
  if (slotId !== 'warframe') return SLOT_KINDS.NORMAL;
  if (index === 0) return SLOT_KINDS.AURA;
  if (index === 1) return SLOT_KINDS.EXILUS;
  return SLOT_KINDS.NORMAL;
}

// Mod capacity grows linearly with rank: 1 at rank 0, 30 at max rank (30)
export const MAX_RANK = 30;
export function capacityForRank(rank) {
  const r = Math.min(MAX_RANK, Math.max(0, rank));
  return Math.floor(1 + (29 * r) / MAX_RANK);
}

export function canPlace(mod, kind) {
  if (kind === SLOT_KINDS.AURA) return mod.isAura === true;
  if (kind === SLOT_KINDS.EXILUS) return mod.isExilus === true;
  return mod.isAura !== true; // normal slot: Exilus mods are allowed here, Aura mods are not
}
