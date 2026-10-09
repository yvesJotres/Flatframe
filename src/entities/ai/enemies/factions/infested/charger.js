import BaseEnemy from '../../base.js';
import { scaleStatByFaction } from '../../../../../core/scaling.js';

export default class Charger extends BaseEnemy {
  constructor(x, y, options = {}) {
    super(x, y, { ...options, name: 'Charger', faction: 'infested' });
    const maxHp = scaleStatByFaction(300, this.lvl, 'hp', this.faction);
    this.initHealth({ maxHp, armor: scaleStatByFaction(50, this.lvl, 'armor', this.faction) });
    this.hp = this.maxHp;
  }
}
