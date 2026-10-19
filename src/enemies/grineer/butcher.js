import BaseEnemy from '../enemy.js';
import { scaleStatByFaction } from '../../combat/scaling.js';
import { MELEE_WEAPONS } from '../../weapons/melee_weapon.js';
import { UNITS_PER_METER } from '../../engine/constants.js';

export default class Butcher extends BaseEnemy {
  constructor(x, y, options = {}) {
    super(x, y, { ...options, name: 'Butcher', faction: 'grineer' });
    // Wiki (Butcher, base level 1): 50 health, 200 armor
    const maxHp = scaleStatByFaction(50, this.lvl, 'hp', this.faction);
    this.initHealth({ maxHp, armor: scaleStatByFaction(200, this.lvl, 'armor', this.faction) });
    this.hp = this.maxHp;

    // Melee: the Cleaver's normal attack sets the swing damage, rate and reach
    const cleaver = (MELEE_WEAPONS.Cleaver ?? (() => { throw new Error('Call initMeleeWeapons() before creating a Butcher'); })()).attack;
    this.attackDamage = Object.values(cleaver.damage).reduce((sum, value) => sum + value, 0);
    this.attackCooldown = 1 / cleaver.fireRate;
    this.attackRange = cleaver.range * UNITS_PER_METER;
  }
}
