// Loads weapon stats for tests from the same JSON data the game uses,
// in the { name, attacks: { normal: { damage, ... } } } shape the tests expect.
import { dataLoader } from '../../src/data/data_loader.js';

export async function loadWeapon(name) {
  const wf = await dataLoader.getItem('weapons', name);
  if (!wf) throw new Error(`No weapon data for ${name}`);
  const attack = wf.attacks?.find(a => a.name === 'Normal') ?? wf.attacks?.[0] ?? {};
  return {
    name: wf.name,
    attacks: {
      normal: {
        damage: attack.damage ?? {},
        critChance: (attack.crit_chance ?? 0) / 100,
        critMultiplier: attack.crit_mult ?? 1,
        statusChance: (attack.status_chance ?? 0) / 100,
        fireRate: attack.speed,
      },
    },
  };
}
