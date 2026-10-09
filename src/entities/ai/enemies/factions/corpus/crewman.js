import BaseEnemy from '../base.js';
import { UNITS_PER_METER } from '../../../../../core/constants.js';
import PrimaryWeapon from '../../../../../weapons/primary_weapon.js';
import { scaleStatByFaction } from '../../../../../core/scaling.js';

export default class Crewman extends BaseEnemy {
  constructor(x, y, options = {}) {
    super(x, y, { ...options, name: 'Crewman', faction: 'corpus' });
    const maxHp = scaleStatByFaction(80, this.lvl, 'hp', this.faction);
    this.initHealth({ maxHp, armor: scaleStatByFaction(50, this.lvl, 'armor', this.faction) });
    this.hp = this.maxHp;
    this.weapon = new PrimaryWeapon('Lato');
  }
}
