import { dataLoader } from '../data/data_loader.js';

// Filled in place (not reassigned) so modules that captured this object early, like the Arsenal, see the data
const WARFRAMES = {};
let initialized = false;

export async function initWarframes() {
  if (initialized) return WARFRAMES;
  const frames = await dataLoader.getAll('warframes');
  Object.assign(WARFRAMES, Object.fromEntries(frames.map(f => [f.name, f])));
  initialized = true;
  return WARFRAMES;
}

export const DEFAULT_WARFRAME = 'Excalibur';

// Rank the player's frame is treated as, and its stats at that rank.
// Keep in sync with the hardcoded values in Player (src/warframe/player.js).
export const FRAME_RANK = 30;
export const RANKED_FRAME_STATS = {
  Excalibur: { health: 370, shield: 370, armor: 240, energy: 150 },
};

export { WARFRAMES };
