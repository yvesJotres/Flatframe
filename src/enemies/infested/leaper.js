import BaseEnemy from '../enemy.js';
import { scaleStatByFaction } from '../../combat/scaling.js';

export default class Leaper extends BaseEnemy {
  constructor(x, y, options = {}) {
    super(x, y, { endoDropChance: 0.011382, endoAmount: 15, ...options, name: 'Leaper', faction: 'infested' });
    const maxHp = scaleStatByFaction(150, this.lvl, 'hp', this.faction);
    this.initHealth({ maxHp, armor: scaleStatByFaction(20, this.lvl, 'armor', this.faction) });
    this.hp = this.maxHp;
  }
}
