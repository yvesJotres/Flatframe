import BaseEnemy from '../enemy.js';
import { UNITS_PER_METER } from '../../engine/constants.js';
import PrimaryWeapon from '../../weapons/primary_weapon.js';
import MeleeWeapon from '../../weapons/melee_weapon.js';
import { scaleStatByFaction } from '../../combat/scaling.js';

export default class Crewman extends BaseEnemy {
  constructor(x, y, options = {}) {
    super(x, y, { ...options, name: 'Crewman', faction: 'corpus' });
    const maxHp = scaleStatByFaction(90, this.lvl, 'hp', this.faction);
    const maxShield = scaleStatByFaction(120, this.lvl, 'shield', this.faction);
    this.initHealth({ maxHp, maxShield, armor: scaleStatByFaction(0, this.lvl, 'armor', this.faction) });
    this.hp = this.maxHp;
    
    this.primary = new PrimaryWeapon('Dera');
    this.melee = new MeleeWeapon('Prova');
    this.secondary = null;
  }
}
