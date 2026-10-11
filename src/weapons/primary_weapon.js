import Weapon from './weapon.js';
import { dataLoader } from '../data/data_loader.js';
import { adaptWeapon } from '../data/weapon_adapter.js';

// Filled in place (not reassigned) so modules that captured this object early, like the Arsenal, see the data
const PRIMARY_WEAPONS = {};
let initialized = false;

export async function initPrimaryWeapons() {
  if (initialized) return PRIMARY_WEAPONS;
  const weapons = await dataLoader.getByChunk('weapons', 'primary-rifle');
  Object.assign(PRIMARY_WEAPONS, Object.fromEntries(weapons.map(w => [w.name, adaptWeapon(w)])));
  initialized = true;
  return PRIMARY_WEAPONS;
}

export const DEFAULT_PRIMARY = 'Braton';
export { PRIMARY_WEAPONS };

export default class PrimaryWeapon extends Weapon {
  constructor(name = DEFAULT_PRIMARY) {
    if (!initialized) throw new Error('Call initPrimaryWeapons() before creating PrimaryWeapon');
    const stats = PRIMARY_WEAPONS[name];
    if (!stats) throw new Error(`Unknown primary weapon: ${name}`);
    super(stats);
    this.category = 'primary';
  }
}
