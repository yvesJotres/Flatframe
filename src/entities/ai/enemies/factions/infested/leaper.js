import BaseEnemy from '../../base.js';
import { scaleStatByFaction } from '../../../../../core/scaling.js';

export default class Leaper extends BaseEnemy {
  constructor(x, y, options = {}) {
    super(x, y, { ...options, name: 'Leaper', faction: 'infested' });
    const maxHp = scaleStatByFaction(150, this.lvl, 'hp', this.faction);
    this.initHealth({ maxHp, armor: scaleStatByFaction(20, this.lvl, 'armor', this.faction) });
    this.hp = this.maxHp;
  }
}
