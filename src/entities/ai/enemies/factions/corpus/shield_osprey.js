import BaseEnemy from '../../base.js';
import { scaleStatByFaction } from '../../../../../core/scaling.js';

export default class ShieldOsprey extends BaseEnemy {
  constructor(x, y, options = {}) {
    super(x, y, { ...options, name: 'Shield Osprey', faction: 'corpus' });
    const maxHp = scaleStatByFaction(120, this.lvl, 'hp', this.faction);
    this.initHealth({ maxHp, armor: scaleStatByFaction(50, this.lvl, 'armor', this.faction) });
    this.hp = this.maxHp;
  }
}
