import Weapon from './weapon.js';
import { BRATON } from './data/braton.js';
import { GRAKATA } from './data/grakata.js';

export const PRIMARY_WEAPONS = {
  [BRATON.name]: BRATON,
  [GRAKATA.name]: GRAKATA,
};

export const DEFAULT_PRIMARY = BRATON.name;

export default class PrimaryWeapon extends Weapon {
  constructor(name = DEFAULT_PRIMARY) {
    const stats = PRIMARY_WEAPONS[name];
    if (!stats) throw new Error(`Unknown primary weapon: ${name}`);
    super(stats);
    this.category = 'primary';
  }
}
