/**
 * Mod effects on weapons. Wiki rank text such as "+165% Damage" becomes a percent bonus on the weapon's base stats.
 * Each rank's text is the total at that rank (Serration rank 2 is +30%, not +15% + +30%), so only that rank is read.
 */

// Wiki stat name -> bonus key used by weaponModBonuses()
const STAT_RULES = [
  [/^Damage$/i, 'damage'],
  [/^Critical Chance$/i, 'critChance'],
  [/^Critical Damage$/i, 'critDamage'],
  [/^Status Chance$/i, 'statusChance'],
  [/^(Fire Rate|Attack Speed)$/i, 'fireRate'],
  [/^Reload Speed$/i, 'reloadSpeed'],
  [/^Magazine Capacity$/i, 'magazine'],
];

// Mod compatName (wiki "Primary", "Secondary", "Melee") -> weapon category used by the game
const COMPAT = { primary: 'primary', secondary: 'secondary', melee: 'melee' };

const PERCENT_LINE = /^([+-]?\d+(?:\.\d+)?)%\s+(.+)$/;

export function parseModStat(text) {
  const match = PERCENT_LINE.exec(String(text).trim());
  if (!match) return null;
  const rule = STAT_RULES.find(([pattern]) => pattern.test(match[2].trim()));
  return rule ? { key: rule[1], percent: parseFloat(match[1]) } : null;
}

export function emptyModBonuses() {
  return { damage: 0, critChance: 0, critDamage: 0, statusChance: 0, fireRate: 0, reloadSpeed: 0, magazine: 0 };
}

// Sum of the percent bonuses from the mods that fit one weapon category (rank 0 mods add nothing)
export function weaponModBonuses(mods = [], category) {
  const totals = emptyModBonuses();
  for (const mod of mods) {
    if (!mod?.levelStats?.length || COMPAT[mod.compatName?.toLowerCase()] !== category) continue;
    const rank = Math.min(mod.currentRank ?? 0, mod.levelStats.length);
    if (rank < 1) continue;
    for (const line of mod.levelStats[rank - 1].stats ?? []) {
      const parsed = parseModStat(line);
      if (parsed) totals[parsed.key] += parsed.percent;
    }
  }
  return totals;
}

// Health, shield and armor bonuses from equipped Warframe mods. Wiki: an unranked mod gives its first level's bonus.
export function frameModBonuses(mods = []) {
  const totals = { health: 0, shield: 0, armor: 0 };
  for (const mod of mods) {
    if (!mod?.levelStats?.length || mod.compatName?.toLowerCase() !== 'warframe') continue;
    const rank = Math.min(Math.max(mod.currentRank ?? 0, 0), mod.levelStats.length - 1);
    for (const line of mod.levelStats[rank].stats ?? []) {
      const match = /^\+?(\d+(?:\.\d+)?)%\s+(Health|Shields?|Armor)$/i.exec(String(line).trim());
      if (!match) continue;
      const word = match[2].toLowerCase();
      const key = word.startsWith('health') ? 'health' : word.startsWith('shield') ? 'shield' : 'armor';
      totals[key] += parseFloat(match[1]);
    }
  }
  return totals;
}
