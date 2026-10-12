import BaseEnemy from '../enemy.js';
import { scaleStatByFaction } from '../../combat/scaling.js';

export default class Charger extends BaseEnemy {
  constructor(x, y, options = {}) {
    super(x, y, { endoDropChance: 0.005691, endoAmount: 15, ...options, name: 'Charger', faction: 'infested' });
    const maxHp = scaleStatByFaction(300, this.lvl, 'hp', this.faction);
    this.initHealth({ maxHp, armor: scaleStatByFaction(50, this.lvl, 'armor', this.faction) });
    this.hp = this.maxHp;
  }
}
