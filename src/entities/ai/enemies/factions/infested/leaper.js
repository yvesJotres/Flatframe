import BaseEnemy from '../base.js';

export default class Leaper extends BaseEnemy {
  constructor(x, y, options = {}) {
    super(x, y, { ...options, name: 'Leaper', faction: 'infested' });
    this.maxHp = 150 + (this.lvl - 1) * 30;
    this.hp = this.maxHp;
    this.armor = 20;
  }
}
