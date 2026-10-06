import BaseEnemy from '../../enemy_base.js';

export default class Butcher extends BaseEnemy {
  constructor(x, y, options = {}) {
    super(x, y, { ...options, name: 'Butcher', faction: 'grineer' });
    this.maxHp = 150 + (this.lvl - 1) * 30;
    this.hp = this.maxHp;
    this.armor = 100;
  }
}
