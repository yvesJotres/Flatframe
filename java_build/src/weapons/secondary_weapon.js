import Weapon from './weapon.js';
import { dataLoader } from '../data/data_loader.js';
import { adaptWeapon } from '../data/weapon_adapter.js';

// Filled in place (not reassigned) so modules that captured this object early, like the Arsenal, see the data
const SECONDARY_WEAPONS = {};
let initialized = false;

export async function initSecondaryWeapons() {
  if (initialized) return SECONDARY_WEAPONS;
  const weapons = await dataLoader.getByChunk('weapons', 'secondary-pistol');
  Object.assign(SECONDARY_WEAPONS, Object.fromEntries(weapons.map(w => [w.name, adaptWeapon(w)])));
  initialized = true;
  return SECONDARY_WEAPONS;
}

export const DEFAULT_SECONDARY = 'Lato';
export { SECONDARY_WEAPONS };

export default class SecondaryWeapon extends Weapon {
  constructor(name = DEFAULT_SECONDARY) {
    if (!initialized) throw new Error('Call initSecondaryWeapons() before creating SecondaryWeapon');
    const stats = SECONDARY_WEAPONS[name];
    if (!stats) throw new Error(`Unknown secondary weapon: ${name}`);
    super(stats);
    this.category = 'secondary';
  }
}
