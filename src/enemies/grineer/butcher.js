import BaseEnemy from '../enemy.js';
import { scaleStatByFaction } from '../../combat/scaling.js';

export default class Butcher extends BaseEnemy {
  constructor(x, y, options = {}) {
    super(x, y, { ...options, name: 'Butcher', faction: 'grineer' });
    const maxHp = scaleStatByFaction(150, this.lvl, 'hp', this.faction);
    this.initHealth({ maxHp, armor: scaleStatByFaction(100, this.lvl, 'armor', this.faction) });
    this.hp = this.maxHp;
  }
}
