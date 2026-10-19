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

export { WARFRAMES };
