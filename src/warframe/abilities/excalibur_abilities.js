// Excalibur's abilities 2-4. Rank 0 values from the repo's warframe data
// (src/data/warframes/chunks/warframes-tenno.json); see the notes in the PR
// for which values were checked against the wiki and which are still open.
// Visuals are placeholders. Blind and the Exalted Blade's waves are not
// wired into enemy AI yet: only their state is tracked.
import { UNITS_PER_METER } from '../../engine/constants.js';

export const RADIAL_BLIND = {
  key: '2',
  energyCost: 50,
  radius: 10 * UNITS_PER_METER, // 150 units
  duration: 10,                 // seconds
};

export const RADIAL_JAVELIN = {
  key: '3',
  energyCost: 75,
  radius: 15 * UNITS_PER_METER, // 225 units
  damage: 800,
};

export const EXALTED_BLADE = {
  key: '4',
  energyCost: 25,
  drainPerSecond: 25,
  damage: 200,
};

function enemiesWithin(x, y, radius, enemies) {
  return enemies.filter(e => e && e.hp > 0 && Math.hypot(e.x - x, e.y - y) <= radius + (e.radius || 0));
}

// Spends energy and returns true if the cast went off
function spend(player, cost) {
  if (player.energy < cost) return false;
  player.energy -= cost;
  return true;
}

// Blinds every enemy in range for the duration (AI does not read blindTimer yet)
export function castRadialBlind(player, enemies) {
  if (!spend(player, RADIAL_BLIND.energyCost)) return false;
  for (const enemy of enemiesWithin(player.x, player.y, RADIAL_BLIND.radius, enemies)) {
    enemy.blindTimer = RADIAL_BLIND.duration;
  }
  return true;
}

export function castRadialJavelin(player, enemies) {
  if (!spend(player, RADIAL_JAVELIN.energyCost)) return false;
  for (const enemy of enemiesWithin(player.x, player.y, RADIAL_JAVELIN.radius, enemies)) {
    enemy.takeDamage(RADIAL_JAVELIN.damage, player.x, player.y);
  }
  return true;
}

// Channelled ability: press 4 to summon, press again (or run out of energy) to dismiss
export class ExaltedBlade {
  constructor() {
    this.active = false;
  }

  toggle(player) {
    if (this.active) {
      this.active = false;
      return true;
    }
    if (!spend(player, EXALTED_BLADE.energyCost)) return false;
    this.active = true;
    return true;
  }

  update(dt, player) {
    if (!this.active) return;
    const drain = EXALTED_BLADE.drainPerSecond * dt;
    if (player.energy < drain) {
      player.energy = 0;
      this.active = false;
      return;
    }
    player.energy -= drain;
  }
}
