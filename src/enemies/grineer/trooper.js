import BaseEnemy from '../enemy.js';
import { UNITS_PER_METER } from '../../engine/constants.js';
import PrimaryWeapon from '../../weapons/primary_weapon.js';
import { scaleStatByFaction } from '../../combat/scaling.js';

export default class Trooper extends BaseEnemy {
  constructor(x, y, options = {}) {
    super(x, y, { ...options, name: 'Trooper', faction: 'grineer' });
    const maxHp = scaleStatByFaction(200, this.lvl, 'hp', this.faction);
    this.initHealth({ maxHp, armor: scaleStatByFaction(250, this.lvl, 'armor', this.faction) });
    this.hp = this.maxHp;
    this.weapon = new PrimaryWeapon('Braton');
  }
}
