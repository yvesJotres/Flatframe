/**
 * Player currencies: balances, spending and saving. Each player's balances belong to their own profile.
 * Only the foundation for now: no prices, shops or income yet.
 * Balances are saved in localStorage under the profile ID, so they survive a reload. Every read and write is
 * guarded, so blocked or broken storage falls back to empty balances in memory.
 */

import { user } from '../user/user_data.js';
import { CURRENCY_DEFS, formatAmount } from './currencies.js';

export const CURRENCIES = Object.keys(CURRENCY_DEFS);

// What a new player starts with, from the currency definitions (50 Platinum, nothing else)
export const DEFAULT_BALANCES = Object.fromEntries(CURRENCIES.map(c => [c, CURRENCY_DEFS[c].start]));

const STORAGE_PREFIX = 'flatframe.wallet.v1.';

export class Wallet {
  constructor(profileId, balances = {}) {
    this.profileId = profileId;
    this.balances = { ...DEFAULT_BALANCES, ...balances };
    this.listeners = new Set();
  }

  get(currency) {
    if (!CURRENCIES.includes(currency)) throw new Error(`Unknown currency: ${currency}`);
    return this.balances[currency];
  }

  // Display text for a balance, such as "250,000" (Credits show at most 999,999,999)
  format(currency) {
    return formatAmount(currency, this.get(currency));
  }

  // costs: { credits: 500, platinum: 2 }
  canAfford(costs) {
    return Object.entries(costs).every(([currency, amount]) => this.get(currency) >= amount);
  }

  add(currency, amount) {
    if (!Number.isInteger(amount) || amount <= 0) throw new Error(`Amount must be a positive whole number: ${amount}`);
    this.get(currency); // validates the currency name
    this.balances[currency] += amount;
    this.changed([{ currency, delta: amount }]);
  }

  // Takes every cost or nothing. Returns false when the player can't afford it.
  spend(costs) {
    for (const [currency, amount] of Object.entries(costs)) {
      this.get(currency); // validates the currency name
      if (!Number.isInteger(amount) || amount < 0) throw new Error(`Cost must be a whole number, zero or more: ${amount}`);
    }
    if (!this.canAfford(costs)) return false;
    const changes = [];
    for (const [currency, amount] of Object.entries(costs)) {
      this.balances[currency] -= amount;
      if (amount > 0) changes.push({ currency, delta: -amount });
    }
    this.changed(changes);
    return true;
  }

  // Runs fn(balances, changes) whenever the balances change. changes lists { currency, delta } for each one that moved.
  // Returns an unsubscribe function.
  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  changed(changes = []) {
    this.save();
    for (const fn of this.listeners) fn(this.balances, changes);
  }

  save() {
    try {
      globalThis.localStorage?.setItem(STORAGE_PREFIX + this.profileId, JSON.stringify(this.balances));
    } catch {
      // Storage unavailable (private window, blocked site data): the balances stay in memory only
    }
  }

  // Switches this wallet to another user's balances (used when the active user changes)
  switchProfile(profileId) {
    this.profileId = profileId;
    this.balances = Wallet.load(profileId).balances;
    this.changed([]); // refreshes the screen without a pop-up
  }

  // Loads one profile's balances. Missing or broken data gives empty balances.
  static load(profileId) {
    try {
      const saved = JSON.parse(globalThis.localStorage?.getItem(STORAGE_PREFIX + profileId) ?? 'null');
      if (!saved || typeof saved !== 'object') return new Wallet(profileId);
      // Keep only known currencies with non-negative whole numbers
      const clean = {};
      for (const c of CURRENCIES) {
        const v = saved[c];
        if (Number.isInteger(v) && v >= 0) clean[c] = v;
      }
      return new Wallet(profileId, clean);
    } catch {
      return new Wallet(profileId);
    }
  }
}

// The wallet belongs to the player whose ID is in the user data (src/user/user_data.js)
export const wallet = Wallet.load(user.id);
