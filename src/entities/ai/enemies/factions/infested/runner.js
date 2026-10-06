import BaseEnemy from '../base.js';

export default class Runner extends BaseEnemy {
  constructor(x, y, options = {}) {
    super(x, y, { ...options, name: 'Runner', faction: 'infested' });
    this.maxHp = 100 + (this.lvl - 1) * 20;
    this.hp = this.maxHp;
    this.armor = 0;
  }
}
