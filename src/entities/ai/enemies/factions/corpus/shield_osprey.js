import BaseEnemy from '../../base.js';

export default class ShieldOsprey extends BaseEnemy {
  constructor(x, y, options = {}) {
    super(x, y, { ...options, name: 'Shield Osprey', faction: 'corpus' });
    this.maxHp = 120 + (this.lvl - 1) * 20;
    this.hp = this.maxHp;
    this.armor = 50;
  }
}
