import BaseEnemy from '../../enemy_base.js';

export default class Charger extends BaseEnemy {
  constructor(x, y, options = {}) {
    super(x, y, { ...options, name: 'Charger', faction: 'infested' });
    this.maxHp = 300 + (this.lvl - 1) * 60;
    this.hp = this.maxHp;
    this.armor = 50;
  }
}
