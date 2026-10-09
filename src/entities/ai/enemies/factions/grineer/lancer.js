import BaseEnemy from '../../base.js';
import PrimaryWeapon from '../../../../../weapons/primary_weapon.js';
import { scaleStatByFaction } from '../../../../../core/scaling.js';

const ENEMY_WEAPON = 'Grakata';

export default class Lancer extends BaseEnemy {
  constructor(x, y, options = {}) {
    super(x, y, { ...options, name: 'Lancer', faction: 'grineer' });
    const maxHp = scaleStatByFaction(100, this.lvl, 'hp', this.faction);
    this.initHealth({ maxHp, armor: scaleStatByFaction(200, this.lvl, 'armor', this.faction) });
    this.hp = this.maxHp;

    // Spawning penalty: enemies that just spawned can't be stealth killed for 4-8 seconds (wiki)
    this.spawnPenaltyTimer = 4 + Math.random() * 4;
    this.isNewlySpawned = true;

    // Kiting rifleman — behavior comes from BaseEnemy.
    this.equip(new PrimaryWeapon(options.weapon ?? ENEMY_WEAPON));
  }
}
