// Progression: Affinity (per-item XP), item ranks from Affinity, and Mastery Rank from mastery points.
// Affinity rules (wiki):
//   - Abilities earn Affinity equal to their base energy cost, all to the Warframe.
//   - Weapon kills split Affinity 50/50 between the Warframe and the weapon.
//   - Affinity is stored per item; selling or crafting with an item removes it.
// Item ranks (Spanish Warframe Fandom, Affinity page; not on the English wiki page we could read):
//   - Warframe/Sentinel: reaching level L from unranked takes 1000 × L² Affinity; weapons need half.
// Mastery (wiki): Mastery Rank total XP = 2,500 × rank², capped at MR 30. Each new item level adds
//   mastery points: 200 for Warframes, 100 for weapons (wiki, Affinity page).
// Rank-up tests are not built yet.

import { user } from '../user/user_data.js';

export const ITEM_MAX_RANK = 30;
export const MASTERY_MAX_RANK = 30;
export const WEAPON_KILL_WARFRAME_SHARE = 0.5;
export const MASTERY_POINTS_PER_LEVEL = { frame: 200, weapon: 100 };

// Total mastery XP needed to reach a rank
export function masteryXpForRank(rank) {
  return 2500 * rank * rank;
}

// Highest mastery rank (capped at MR 30) whose total XP is reached
export function masteryRankFromXp(xp) {
  let rank = 0;
  while (rank < MASTERY_MAX_RANK && xp >= masteryXpForRank(rank + 1)) rank += 1;
  return rank;
}

// Total Affinity needed to reach an item rank
export function affinityForItemRank(rank, kind) {
  const base = 1000 * rank * rank;
  return kind === 'weapon' ? base / 2 : base;
}

// Highest item rank (capped at 30) reached with this much Affinity
export function itemRankFromAffinity(xp, kind) {
  let rank = 0;
  while (rank < ITEM_MAX_RANK && xp >= affinityForItemRank(rank + 1, kind)) rank += 1;
  return rank;
}

// Adds Affinity to one item and returns its new total. kind is 'frame' or 'weapon'.
// Each item level gained adds mastery points, and Mastery Rank follows the total.
export function addAffinity(itemName, amount, kind) {
  if (!itemName || !(amount > 0)) return 0;
  const affinity = { ...user.get('affinity') };
  const before = itemRankFromAffinity(affinity[itemName] ?? 0, kind);
  affinity[itemName] = (affinity[itemName] ?? 0) + amount;
  const after = itemRankFromAffinity(affinity[itemName], kind);

  const gained = Math.max(0, after - before);
  const masteryPoints = user.get('masteryPoints') + gained * MASTERY_POINTS_PER_LEVEL[kind];
  user.set('affinity', affinity);
  user.set('masteryPoints', masteryPoints);
  user.set('masteryRank', masteryRankFromXp(masteryPoints));
  return affinity[itemName];
}

export function affinityOf(itemName) {
  return user.get('affinity')[itemName] ?? 0;
}

export function itemRankOf(itemName, kind) {
  return itemRankFromAffinity(affinityOf(itemName), kind);
}

// Rank and progress toward the next rank (0..1) from an item's affinity, for the Arsenal bars
export function itemProgressOf(itemName, kind) {
  const xp = affinityOf(itemName);
  const rank = itemRankFromAffinity(xp, kind);
  if (rank >= ITEM_MAX_RANK) return { rank, xp: 1 };
  const from = affinityForItemRank(rank, kind);
  const to = affinityForItemRank(rank + 1, kind);
  return { rank, xp: (xp - from) / (to - from) };
}

// Base Affinity per enemy, from each enemy's wiki infobox. Enemies not listed give no Affinity.
export const ENEMY_BASE_AFFINITY = {
  Crewman: 50,
  Lancer: 50,
  Butcher: 50,
  Trooper: 100,
  'Shield Osprey': 50,
  Charger: 50,
  Leaper: 35,
  Runner: 35,
  MOA: 50,
};

// Affinity for one kill: base × (1 + 0.1425 × √level) (Spanish Warframe Fandom, Affinity page)
export function killAffinity(enemyName, level) {
  const base = ENEMY_BASE_AFFINITY[enemyName] ?? 0;
  return base * (1 + 0.1425 * Math.sqrt(Math.max(1, level)));
}

// Awards Affinity for a kill. An ability kill (enemy.killedByAbility, set by the ability that killed it)
// goes all to the Warframe; any other kill is a weapon kill, split 50/50 with the weapon.
export function awardKillAffinity(enemy, frameName, weaponName) {
  const amount = killAffinity(enemy.name, enemy.lvl);
  if (amount <= 0) return 0;
  if (enemy.killedByAbility) addAffinity(frameName, amount, 'frame');
  else awardWeaponKillAffinity(frameName, weaponName, amount);
  return amount;
}

// An ability cast on a Warframe: all Affinity (the energy cost) goes to the Warframe
export function awardAbilityAffinity(frameName, energyCost) {
  return addAffinity(frameName, energyCost, 'frame');
}

// A kill made with a weapon: half to the Warframe, half to the weapon
export function awardWeaponKillAffinity(frameName, weaponName, amount) {
  addAffinity(frameName, amount * WEAPON_KILL_WARFRAME_SHARE, 'frame');
  addAffinity(weaponName, amount * (1 - WEAPON_KILL_WARFRAME_SHARE), 'weapon');
}
