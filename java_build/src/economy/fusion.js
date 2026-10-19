/**
 * Mod fusion: spends Endo and Credits to raise a mod one rank.
 * The costs come from the mod itself (Mod.getEndoToNextRank / getCreditsToNextRank).
 */
import { wallet as playerWallet } from './wallet.js';

export function fusionCost(mod) {
  return { endo: mod.getEndoToNextRank(), credits: mod.getCreditsToNextRank() };
}

// Returns true when the mod went up a rank. Takes both costs or nothing.
export function fuseMod(mod, wallet = playerWallet) {
  if (mod.currentRank >= mod.maxRank) return false;
  const cost = fusionCost(mod);
  if (!wallet.spend(cost)) return false;
  return mod.rankUp(cost.endo, cost.credits);
}
