import BaseEnemy from '../../base.js';
import { scaleStatByFaction } from '../../../../../core/scaling.js';

export default class Runner extends BaseEnemy {
  constructor(x, y, options = {}) {
    super(x, y, { ...options, name: 'Runner', faction: 'infested' });
    const maxHp = scaleStatByFaction(100, this.lvl, 'hp', this.faction);
    this.initHealth({ maxHp, armor: scaleStatByFaction(0, this.lvl, 'armor', this.faction) });
    this.hp = this.maxHp;
  }
}
