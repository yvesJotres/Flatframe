// Enemy levels for wave missions (Defense). Each star-chart node has a level range (wiki: "1-6" for Lith, and so on).
// An enemy spawns at a random level inside that range, and the top of the range it can reach rises slowly with the
// waves. Placeholder: the wiki gives no formula for how the level rises inside a Defense mission.

// "1-6" -> { lo: 1, hi: 6 }; null when the text is not a range
export function parseLevelRange(text) {
  const m = /^\s*(\d+)\s*-\s*(\d+)\s*$/.exec(text ?? '');
  if (!m) return null;
  const lo = Number(m[1]), hi = Number(m[2]);
  return { lo: Math.min(lo, hi), hi: Math.max(lo, hi) };
}

// The level of one enemy spawned in `wave` (1 = the first wave). The top rises one level every two waves, never past hi.
export function enemyLevelForWave(range, wave, rand = Math.random) {
  const top = Math.min(range.hi, range.lo + Math.floor((Math.max(1, wave) - 1) / 2));
  return range.lo + Math.floor(rand() * (top - range.lo + 1));
}
