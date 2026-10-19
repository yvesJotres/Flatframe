/**
 * Orokin Catalyst and Orokin Reactor, from the Warframe wiki.
 *   Catalyst: doubles a weapon's mod capacity.
 *   Reactor:  doubles a Warframe's mod capacity.
 * Each can be applied to one item only, and cannot be removed once installed.
 * Both cost 20 Platinum on the Market. They can't be sold.
 *
 * Foundation only: the owned count is kept in memory for now, and there is no
 * Market screen yet. Install and buy both check the rules, so the UI can call them directly.
 */
import { wallet as playerWallet } from './wallet.js';
import { capacityForMastery } from '../mods/placement.js';

export const UPGRADES = {
  catalyst: { name: 'Orokin Catalyst', appliesTo: 'weapon', price: { platinum: 20 }, capacityMultiplier: 2 },
  reactor: { name: 'Orokin Reactor', appliesTo: 'warframe', price: { platinum: 20 }, capacityMultiplier: 2 },
};

export class ItemUpgrades {
  constructor(wallet = playerWallet) {
    this.wallet = wallet;
    this.owned = { catalyst: 0, reactor: 0 };   // unused copies the player holds
    this.installed = new Map();                  // item name -> Set of upgrade ids
  }

  // Buy one copy with Platinum. Returns false when the player can't pay.
  buy(upgradeId) {
    const def = UPGRADES[upgradeId];
    if (!def) throw new Error(`Unknown upgrade: ${upgradeId}`);
    if (!this.wallet.spend(def.price)) return false;
    this.owned[upgradeId]++;
    return true;
  }

  // Put one owned copy onto an item. kind is 'weapon' or 'warframe' (the item's type).
  install(itemName, upgradeId, kind) {
    const def = UPGRADES[upgradeId];
    if (!def) throw new Error(`Unknown upgrade: ${upgradeId}`);
    if (def.appliesTo !== kind) return false;             // Catalyst on weapons, Reactor on Warframes
    if (this.owned[upgradeId] <= 0) return false;         // need a copy first
    const set = this.installed.get(itemName) ?? new Set();
    if (set.has(upgradeId)) return false;                 // only once per item
    set.add(upgradeId);
    this.installed.set(itemName, set);
    this.owned[upgradeId]--;
    return true;
  }

  has(itemName, upgradeId) {
    return this.installed.get(itemName)?.has(upgradeId) ?? false;
  }

  // Mod capacity for an item at its rank, with installed Catalyst or Reactor doubling it
  capacity(itemName, masteryRank) {
    let cap = capacityForMastery(masteryRank);
    for (const [id, def] of Object.entries(UPGRADES)) {
      if (this.has(itemName, id)) cap *= def.capacityMultiplier;
    }
    return cap;
  }
}

export const itemUpgrades = new ItemUpgrades();
