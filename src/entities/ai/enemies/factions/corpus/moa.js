import BaseEnemy from '../base.js';

export default class MOA extends BaseEnemy {
  constructor(x, y, options = {}) {
    super(x, y, { ...options, name: 'MOA', faction: 'corpus' });
    this.maxHp = 250 + (this.lvl - 1) * 50;
    this.hp = this.maxHp;
    this.armor = 100;
  }
}
