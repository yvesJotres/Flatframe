import Weapon from './weapon.js';
import { LATO } from './data/lato.js';

export const SECONDARY_WEAPONS = {
  [LATO.name]: LATO,
};

export const DEFAULT_SECONDARY = LATO.name;

export default class SecondaryWeapon extends Weapon {
  constructor(name = DEFAULT_SECONDARY) {
    const stats = SECONDARY_WEAPONS[name];
    if (!stats) throw new Error(`Unknown secondary weapon: ${name}`);
    super(stats);
    this.category = 'secondary';
  }
}
