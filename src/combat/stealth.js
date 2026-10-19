// Stealth melee and finishers (wiki: https://wiki.warframe.com/w/Stealth and https://wiki.warframe.com/w/Finisher).
// A melee hit on an enemy that cannot detect the player (unalerted, or blinded) is a stealth attack: it uses the
// finisher animation, deals true damage (armour ignored), and gets the stealth damage bonus.
//   - Stealth damage bonus: +100% unranked, +700% at rank 30, linear in between (so 2x unranked, 8x at rank 30)
//   - The player is invulnerable for the length of the finisher animation
//   - A stealth kill makes unaware enemies within 5 m cautious for about 20 seconds
// Placeholders: the finisher animation length and the cautious time (the wiki gives animation speeds, not seconds).

export const STEALTH = {
  finisherSeconds: 0.4,     // placeholder: how long the player is invulnerable during the finisher animation
  cautiousRadiusM: 5,       // wiki: enemies within 5 m of a stealth kill become cautious
  maxRank: 30,
};

// Damage multiplier for a stealth attack with a weapon of this rank (1 + the bonus): 2x unranked, 8x at rank 30
export function stealthMultiplier(rank = 0) {
  const r = Math.max(0, Math.min(STEALTH.maxRank, rank));
  return 1 + (1 + 6 * (r / STEALTH.maxRank));
}

// Can this enemy be stealth attacked right now? Unalerted enemies and blinded enemies cannot detect the player.
export function isStealthTarget(enemy) {
  if (!enemy) return false;
  if (typeof enemy.isBlinded === 'function' && enemy.isBlinded()) return true;
  return enemy.alertState === 'unalerted';
}

// The hit of a stealth attack: the weapon's hit, multiplied, with true damage (armour ignored)
export function applyStealthHit(hit, rank = 0) {
  const m = stealthMultiplier(rank);
  return { ...hit, total: hit.total * m, trueDamage: true, finisher: true, stealth: true };
}

// After a stealth kill: unaware enemies near the dead one become cautious and search there
export function alertAfterStealthKill(dead, enemies = []) {
  const radius = STEALTH.cautiousRadiusM * 15; // 15 units per metre
  for (const other of enemies) {
    if (!other || other === dead || !(other.hp > 0)) continue;
    if (Math.hypot(other.x - dead.x, other.y - dead.y) > radius) continue;
    if (other.alertState === 'unalerted') other.transitionToCautious(dead.x, dead.y);
  }
}

// Finishers on a knocked-down enemy (wiki: Ground Finisher). The Exalted Blade notes give ground finishers 400% of the
// normal attack's damage; that multiplier is used here. The finisher damage is fully converted to true damage.
export const GROUND_FINISHER_MULTIPLIER = 4;

export function applyFinisherHit(hit) {
  return { ...hit, total: hit.total * GROUND_FINISHER_MULTIPLIER, trueDamage: true, finisher: true };
}

// How long a knocked-down enemy stays down, in seconds. Placeholder: the wiki gives no duration.
export const KNOCKDOWN_SECONDS = 8;

// Auto attacks (auto-swing, auto-fire) only target enemies that have spotted the player and are not blinded
export function canAutoAttack(enemy) {
  if (!enemy) return false;
  if (typeof enemy.isBlinded === 'function' && enemy.isBlinded()) return false;
  return enemy.alertState === 'alerted';
}
