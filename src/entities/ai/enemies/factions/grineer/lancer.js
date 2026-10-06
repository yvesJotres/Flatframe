import BaseEnemy from '../../base.js';
import PrimaryWeapon from '../../../../../weapons/primary_weapon.js';
import { scaleStat } from '../../../../../core/scaling.js';

const ENEMY_WEAPON = 'Grakata';

export default class Lancer extends BaseEnemy {
  constructor(x, y, options = {}) {
    super(x, y, { ...options, name: 'Lancer', faction: 'grineer' });
    this.maxHp = scaleStat(100, this.lvl, 0.015);
    this.hp = this.maxHp;
    this.armor = scaleStat(200, this.lvl, 0.005);

    // Kiting rifleman — behavior comes from BaseEnemy.
    this.equip(new PrimaryWeapon(options.weapon ?? ENEMY_WEAPON));
  }
}
