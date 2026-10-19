/**
 * Selling rules, from the Warframe wiki's Credits page.
 * Rules only: there is no inventory yet, and the page gives no sale prices.
 */

// Kinds of item a player can sell for Credits (via the Equipment menu)
export const SELLABLE_KINDS = [
  'mod', 'weapon', 'warframe', 'sentinel', 'bossSigil', 'titanExtractor', 'blueprint',
];

// Kinds that cannot be sold. Most resources are in this group.
export const UNSELLABLE_KINDS = ['resource', 'appearance', 'voidKey', 'lens'];

// Investments an item loses when sold, even if it is built again. Mastery earned from Affinity is kept.
export const INVESTMENTS_LOST_ON_SALE = [
  'reactorOrCatalyst', // Orokin Reactor / Orokin Catalyst
  'formaPolarities',   // polarities added or changed with Forma
  'exilusAdapter',     // attached Exilus Warframe or Weapon Adapter
  'focusLens',         // Lenses used to gain Focus points
];

export function canSell(kind) {
  return SELLABLE_KINDS.includes(kind);
}
