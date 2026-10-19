import Lancer from './lancer.js';
import PrimaryWeapon from '../../weapons/primary_weapon.js';
import { scaleStatByFaction } from '../../combat/scaling.js';

// Trooper: the shotgun version of the Lancer. Same burst-and-cover behaviour, with a Sobek
// (its damage falloff ends at 30 m, so it stops firing there; see engageRange in enemy.js)
export default class Trooper extends Lancer {
  constructor(x, y, options = {}) {
    super(x, y, { name: 'Trooper', weapon: new PrimaryWeapon('Sobek'), ...options });
    // Base 120 health and 150 armor (fits the wiki's 208 at level 13 and 216 at level 14).
    // Armor shows 200 at low levels because of the armor floor in scaleStatByFaction
    const maxHp = scaleStatByFaction(120, this.lvl, 'hp', this.faction);
    this.initHealth({ maxHp, armor: scaleStatByFaction(150, this.lvl, 'armor', this.faction) });
    this.hp = this.maxHp;
  }
}
