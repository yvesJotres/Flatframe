import BaseEnemy from '../base.js';
import { UNITS_PER_METER } from '../../../../../core/constants.js';
import PrimaryWeapon from '../../../../../weapons/primary_weapon.js';
import { scaleStat } from '../../../../../core/scaling.js';

export default class Trooper extends BaseEnemy {
  constructor(x, y, options = {}) {
    super(x, y, { ...options, name: 'Trooper', faction: 'grineer' });
    this.maxHp = scaleStat(200, this.lvl, 0.015);
    this.hp = this.maxHp;
    this.armor = scaleStat(250, this.lvl, 0.005);
    this.weapon = new PrimaryWeapon('Braton');
  }
}
