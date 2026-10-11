import BaseEnemy from '../enemy.js';
import { scaleStatByFaction } from '../../combat/scaling.js';

export default class MOA extends BaseEnemy {
  constructor(x, y, options = {}) {
    super(x, y, { ...options, name: 'MOA', faction: 'corpus' });
    const maxHp = scaleStatByFaction(250, this.lvl, 'hp', this.faction);
    this.initHealth({ maxHp, armor: scaleStatByFaction(100, this.lvl, 'armor', this.faction) });
    this.hp = this.maxHp;
  }
}
