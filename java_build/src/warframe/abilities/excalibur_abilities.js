// Excalibur's abilities 2-4. Rank 0 values from the repo's warframe data
// (src/data/warframes/chunks/warframes-tenno.json); see the notes in the PR
// for which values were checked against the wiki and which are still open.
// Visuals are placeholders. Blind and the Exalted Blade's waves are not
// wired into enemy AI yet: only their state is tracked.

import { awardAbilityAffinity } from '../../progression/progression.js';
import { recordAffinity } from '../../missions/mission_stats.js';
import { UNITS_PER_METER } from '../../engine/constants.js';
import { collision } from '../../engine/collision.js';
import { isWallAt } from '../../engine/navigation/walls.js';
import { drawEnergyArc, drawEnergyBlade, drawEnergyRibbon, drawEnergyRing } from '../../engine/energy_visuals.js';

export const RADIAL_BLIND = {
  key: '2',
  energyCost: 50,
  radius: 8 * UNITS_PER_METER, // 120 units (wiki: 8 m)
  duration: 7,                 // seconds (wiki: 7 s)
};

export const RADIAL_JAVELIN = {
  key: '3',
  energyCost: 75,
  radius: 15 * UNITS_PER_METER, // 225 units
  damage: 500,                  // wiki: 500 per javelin, split across Impact, Puncture and Slash
};

// The Exalted Blade as an Arsenal weapon (wiki: normal attack 250 total, split 15% Impact, 15% Puncture, 70% Slash;
// crit 15% at 2x; status 15%; attack range 2.8 m). It is the melee weapon while summoned.
export const EXALTED_BLADE_WEAPON = {
  name: 'Exalted Blade',
  range: 2.8,
  attack: {
    damage: { impact: 37.5, puncture: 37.5, slash: 175 },
    critChance: 0.15,
    critMultiplier: 2,
    statusChance: 0.15,
    fireRate: 1,
  },
};
export const EXALTED_WAVE_COOLDOWN = 0.6; // seconds between energy waves (placeholder)

export const EXALTED_BLADE = {
  key: '4',
  energyCost: 25,
  drainPerSecond: 2.5,          // wiki: 2.5 energy per second while active
  damage: 100,                  // wiki: 100 per normal attack
};

// The total damage of an attack, across its types
function totalDamage(weapon) {
  return Object.values(weapon.attack.damage).reduce((sum, v) => sum + v, 0);
}

function enemiesWithin(x, y, radius, enemies) {
  return enemies.filter(e => e && e.hp > 0 && Math.hypot(e.x - x, e.y - y) <= radius + (e.radius || 0));
}

// Spends energy and returns true if the cast went off
function spend(player, cost) {
  if (player.energy < cost) return false;
  player.energy -= cost;
  recordAffinity(awardAbilityAffinity('Excalibur', cost)); // Affinity = energy cost, all to the Warframe (wiki)
  return true;
}

// Blinds every enemy in range for the duration (the enemy's own blind state, see Enemy.applyBlind)
export function castRadialBlind(player, enemies) {
  if (!spend(player, RADIAL_BLIND.energyCost)) return false;
  for (const enemy of enemiesWithin(player.x, player.y, RADIAL_BLIND.radius, enemies)) {
    enemy.applyBlind(RADIAL_BLIND.duration);
  }
  return true;
}

export function castRadialJavelin(player, enemies) {
  if (!spend(player, RADIAL_JAVELIN.energyCost)) return false;
  const targets = enemiesWithin(player.x, player.y, RADIAL_JAVELIN.radius, enemies);
  for (const enemy of targets) {
    enemy.takeDamage(RADIAL_JAVELIN.damage, player.x, player.y);
    if (enemy.hp <= 0) enemy.killedByAbility = true; // Affinity from an ability kill goes to the Warframe only
  }
  player.javelinFx?.spawn(player, targets); // the energy javelins that impale them (excalibur_abilities.js)
  return true;
}

// Channelled ability: press 4 to summon, press again (or run out of energy) to dismiss
export class ExaltedBlade {
  constructor() {
    this.active = false;
    this.cooldown = 0;   // seconds until the next energy wave
    this.waves = [];     // energy waves in flight (excalibur_abilities.js)
  }

  // A melee attack of the summoned blade sends an energy wave along the aim (wiki: normal attacks emit one)
  fireWave(player) {
    if (!this.active || this.cooldown > 0) return;
    this.cooldown = EXALTED_WAVE_COOLDOWN;
    this.waves.push(new EnergyWave(player.x, player.y, player.angle, totalDamage(EXALTED_BLADE_WEAPON)));
  }

  updateWaves(dt, enemies) {
    for (const w of this.waves) w.update(dt, enemies);
    this.waves = this.waves.filter((w) => w.active);
  }

  drawWaves(ctx) {
    for (const w of this.waves) w.draw(ctx);
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
    this.cooldown = Math.max(0, this.cooldown - dt);
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

// ---- RADIAL JAVELIN VISUAL (energy swords that impale the enemies in its radius) ----
// The Radial Javelin visual (wiki: Excalibur summons energy swords that impale the enemies in its radius).
// One energy sword per enemy hit: it starts at the centre of Excalibur and radiates out to impale its enemy, sticks
// there for a moment, then fades. The damage is dealt by excalibur_abilities.js when the ability is cast; this only
// draws it. The look is shared (engine/energy_visuals.js). Placeholders: the flight and stick times and the length.

export const JAVELIN_FX = {
  perTarget: 1,        // energy swords that impale each enemy
  length: 80,          // units: the length of one sword
  flightSeconds: 0.18, // time to fly from the centre into the enemy
  stickSeconds: 0.7,   // time it stays in the enemy before fading
  fadeSeconds: 0.25,   // the last part of that time it fades out
  burstSeconds: 0.35,  // the ring burst that radiates out from the centre
};

export class JavelinVolley {
  constructor() {
    this.javelins = [];
    this.bursts = [];
  }

  // Launch swords at each target (enemies within the ability's radius)
  spawn(player, targets) {
    if (!targets.length) return;
    this.bursts.push({ x: player.x, y: player.y, age: 0 });
    for (const target of targets) {
      for (let i = 0; i < JAVELIN_FX.perTarget; i++) {
        this.javelins.push({
          target,
          // jitter where on the enemy it lands, so the swords spread over its body
          offsetX: (Math.random() - 0.5) * (target.radius ?? 16),
          offsetY: (Math.random() - 0.5) * (target.radius ?? 16),
          startX: player.x, // from the centre of Excalibur
          startY: player.y,
          age: 0,
        });
      }
    }
  }

  update(dt) {
    const total = JAVELIN_FX.flightSeconds + JAVELIN_FX.stickSeconds;
    for (const j of this.javelins) j.age += dt;
    this.javelins = this.javelins.filter((j) => j.age < total);
    for (const b of this.bursts) b.age += dt;
    this.bursts = this.bursts.filter((b) => b.age < JAVELIN_FX.burstSeconds);
  }

  draw(ctx) {
    if (!this.javelins.length && !this.bursts.length) return;
    ctx.save();
    for (const b of this.bursts) {
      const t = b.age / JAVELIN_FX.burstSeconds;
      drawEnergyRing(ctx, b.x, b.y, 20 + t * 110, 1 - t); // radiates out from the centre
    }
    for (const j of this.javelins) this.drawJavelin(ctx, j);
    ctx.restore();
  }

  drawJavelin(ctx, j) {
    const { flightSeconds, stickSeconds, fadeSeconds, length } = JAVELIN_FX;
    // Where it hits: the enemy's current position plus its jitter (the enemy may be dead and still lying there)
    const tx = j.target.x + j.offsetX;
    const ty = j.target.y + j.offsetY;
    const flying = j.age < flightSeconds;
    const p = flying ? easeOut(j.age / flightSeconds) : 1;
    const tipX = j.startX + (tx - j.startX) * p;
    const tipY = j.startY + (ty - j.startY) * p;
    const angle = Math.atan2(ty - j.startY, tx - j.startX);
    const dx = Math.cos(angle), dy = Math.sin(angle);
    // While it sticks, the blade reaches into the enemy: the tip sits a little past the hit point
    const depth = flying ? 0 : (j.target.radius ?? 16) * 0.4;
    const fadeStart = flightSeconds + stickSeconds - fadeSeconds;
    const alpha = j.age > fadeStart ? Math.max(0, 1 - (j.age - fadeStart) / fadeSeconds) : 1;

    // The blade points along the flight: rotate to it, then draw it with its tip at the hit point
    const x1 = tipX + dx * depth, y1 = tipY + dy * depth;
    ctx.save();
    ctx.translate(x1, y1);
    ctx.rotate(angle);
    ctx.globalAlpha = alpha;
    drawEnergyBlade(ctx, -length, 0, length - 8);
    ctx.restore();
  }
}

function easeOut(t) {
  const c = Math.min(1, Math.max(0, t));
  return 1 - (1 - c) * (1 - c);
}

// ---- EXALTED BLADE ENERGY WAVE ----
// The Exalted Blade's energy wave (wiki: https://wiki.warframe.com/w/Exalted_Blade). A melee attack of the summoned
// blade sends a wave that flies at 30 m/s, 3 m wide, with the attack's damage. The damage falls off linearly from full
// at the blade to nothing at the wave's range, and each enemy the wave passes takes 20% off the rest and shortens its
// range by 15 m. A wave stops at walls. Placeholders: the 70 m range (the wiki's stat block; its text says 75 m), the
// cooldown between waves, and the look.

export const ENERGY_WAVE = {
  speed: 30 * UNITS_PER_METER,        // wiki: 30 m/s
  halfWidth: 1.5 * UNITS_PER_METER,   // wiki: 3 m wide
  range: 70 * UNITS_PER_METER,        // wiki: 70 m
  hitLoss: 0.2,                       // wiki: 20% of the damage lost per enemy passed
  hitRangeLoss: 15 * UNITS_PER_METER, // wiki: 15 m of range lost per enemy passed
};

// Distance from point (px, py) to the segment (x0, y0)-(x1, y1)

export class EnergyWave {
  constructor(x, y, angle, damage) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.dirX = Math.cos(angle);
    this.dirY = Math.sin(angle);
    this.damage = damage;
    this.travelled = 0;
    this.maxDistance = ENERGY_WAVE.range;
    this.hits = 0;
    this.struck = new Set(); // each enemy is passed once
    this.active = true;
  }

  // Fraction of the damage left at the wave's current distance (100% at the blade, 0% at the range)
  falloff() {
    return Math.max(0, 1 - this.travelled / this.maxDistance);
  }

  update(dt, enemies) {
    if (!this.active) return;
    const step = Math.min(ENERGY_WAVE.speed * dt, this.maxDistance - this.travelled);
    const x0 = this.x, y0 = this.y;
    const x1 = x0 + this.dirX * step, y1 = y0 + this.dirY * step;
    if (collision.raycast(x0, y0, x1, y1)) { // walls stop the wave
      this.active = false;
      return;
    }
    for (const enemy of enemies) {
      if (!enemy || !(enemy.hp > 0) || this.struck.has(enemy)) continue;
      const reach = ENERGY_WAVE.halfWidth + (enemy.radius ?? 16);
      if (distanceToSegment(enemy.x, enemy.y, x0, y0, x1, y1) > reach) continue;
      const dmg = this.damage * this.falloff() * Math.pow(1 - ENERGY_WAVE.hitLoss, this.hits);
      enemy.takeDamage(dmg, x0, y0);
      this.struck.add(enemy);
      this.hits++;
      this.maxDistance -= ENERGY_WAVE.hitRangeLoss;
    }
    this.x = x1;
    this.y = y1;
    this.travelled += step;
    if (this.travelled >= this.maxDistance) this.active = false;
  }

  draw(ctx) {
    const fade = this.falloff();
    if (fade <= 0) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    // A crescent across the wave's width, bowed forward in the direction it flies
    drawEnergyArc(ctx, -30, 0, ENERGY_WAVE.halfWidth * 2.2, 0.9, { alpha: Math.min(1, fade * 1.5) });
    ctx.restore();
  }
}

// ---- SLASH DASH TRAIL (blue trail of a Slash Dash with the Exalted Blade) ----
// The blue trail of a Slash Dash made with the Exalted Blade summoned: the path the Warframe has cut, drawn as a ribbon
// that fades from the newest point back to the oldest. The look is shared (engine/energy_visuals.js).
// Placeholders: how long it lasts and how wide it is.


export const DASH_TRAIL = {
  seconds: 0.45,       // how long each point stays visible
  maxWidth: 14,        // units: the ribbon is widest at the newest point
  spacing: 6,          // units: a new point is recorded at least this far from the last one
};

export class DashTrail {
  constructor() {
    this.points = []; // { x, y, age }, oldest first
  }

  // Records the Warframe's position while it dashes
  record(x, y) {
    const last = this.points[this.points.length - 1];
    if (last && Math.hypot(x - last.x, y - last.y) < DASH_TRAIL.spacing) return;
    this.points.push({ x, y, age: 0 });
  }

  update(dt) {
    for (const p of this.points) p.age += dt;
    this.points = this.points.filter((p) => p.age < DASH_TRAIL.seconds);
  }

  draw(ctx) {
    // Newer points are brighter and wider (life 1 = just laid down)
    drawEnergyRibbon(ctx, this.points.map((p) => ({ x: p.x, y: p.y, life: 1 - p.age / DASH_TRAIL.seconds })), DASH_TRAIL.maxWidth);
  }
}

// ---- SLASH DASH (ability 1) ----
// Excalibur's Slash Dash (ability 1). Wiki (rank 0):
//   - Initial target range 20 m: the dash locks onto an enemy in the aim direction within that range.
//   - Initial dash speed 36 m/s; locked-on dash speed 75 m/s.
//   - Chain range 7 m: after each strike the dash moves to the nearest enemy within 7 m.
//   - With no target, the dash goes straight for its range and damages enemies its path crosses.
// Each enemy is struck once per dash. Damage is not a fixed wiki number: it scales with Exalted Blade's
// damage, so it is still a placeholder.

export const SLASH_DASH = {
  key: '1',
  energyCost: 25,
  damage: 100, // base damage per strike: Exalted Blade's damage at rank 0 (wiki)
  comboStep: 0.25, // wiki: +25% damage per combo step
  comboMax: 2.75,  // wiki: up to 2.75× damage
  range: 20 * UNITS_PER_METER, // 300 units: initial target range and straight-dash distance
  speed: 36 * UNITS_PER_METER, // 540 units/s: initial dash speed
  lockedSpeed: 75 * UNITS_PER_METER, // 1125 units/s: dash speed while locked on a target
  chainRange: 7 * UNITS_PER_METER, // 105 units: how far the dash chains to the next enemy
  aimCone: Math.PI / 3, // initial target must be within 60° of the aim direction
};

// Shortest distance from point (px, py) to the segment (ax, ay)-(bx, by)
export function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

export class SlashDash {
  constructor() {
    this.active = false;
    this.travelled = 0;
    this.dirX = 0;
    this.dirY = 0;
    this.hitEnemies = new Set();
    this.target = null;
    this.searched = false;
  }

  canActivate(player) {
    return !this.active && player.energy >= SLASH_DASH.energyCost;
  }

  // Spends energy and starts the dash toward `angle`. Returns false if it can't start.
  activate(player, angle) {
    if (!this.canActivate(player)) return false;
    player.energy -= SLASH_DASH.energyCost;
    this.active = true;
    this.travelled = 0;
    this.dirX = Math.cos(angle);
    this.dirY = Math.sin(angle);
    this.hitEnemies.clear();
    this.target = null;
    this.searched = false;
    return true;
  }

  // Nearest living enemy not yet struck within maxDist. With an aim direction, only enemies inside the aim cone.
  nearestTarget(player, enemies, maxDist, aimX = null, aimY = null) {
    let best = null;
    let bestDist = Infinity;
    for (const enemy of enemies) {
      if (!enemy || enemy.hp <= 0 || this.hitEnemies.has(enemy)) continue;
      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      const dist = Math.hypot(dx, dy);
      if (dist > maxDist + (enemy.radius || 0)) continue;
      if (aimX !== null) {
        const delta = Math.atan2(dy, dx) - Math.atan2(aimY, aimX);
        const angleOff = Math.abs(Math.atan2(Math.sin(delta), Math.cos(delta)));
        if (angleOff > SLASH_DASH.aimCone) continue;
      }
      if (dist < bestDist) {
        bestDist = dist;
        best = enemy;
      }
    }
    return best;
  }

  // Damage per strike: the base, times the combo bonus (+25% per combo step, capped at 2.75×).
  // The combo step is the melee combo's multiplier tier (1 at the start), which is an assumption.
  strikeDamage(player) {
    const tier = player.meleeWeapon?.getComboMultiplier?.() ?? 1;
    const bonus = Math.min(SLASH_DASH.comboMax, 1 + SLASH_DASH.comboStep * (tier - 1));
    return SLASH_DASH.damage * bonus;
  }

  // Strikes an enemy once: Exalted Blade damage, and Affinity goes to the Warframe if it kills
  strike(enemy, player) {
    this.hitEnemies.add(enemy);
    enemy.takeDamage(this.strikeDamage(player), player.x, player.y);
    if (enemy.hp <= 0) enemy.killedByAbility = true; // Affinity from an ability kill goes to the Warframe only
  }

  // Moves the player for this frame, locking onto and chaining between enemies
  update(dt, player, enemies) {
    if (!this.active) return;

    // First frame: lock onto the nearest enemy in the aim direction, if any
    if (!this.searched) {
      this.searched = true;
      this.target = this.nearestTarget(player, enemies, SLASH_DASH.range, this.dirX, this.dirY);
    }

    if (this.target) {
      const target = this.target;
      if (target.hp <= 0 || this.hitEnemies.has(target)) {
        this.target = this.nearestTarget(player, enemies, SLASH_DASH.chainRange);
        if (!this.target) this.stop(player);
        return;
      }
      const dx = target.x - player.x;
      const dy = target.y - player.y;
      const dist = Math.hypot(dx, dy);
      const reach = player.radius + (target.radius || 0);
      if (dist <= reach) {
        this.strike(target, player);
        this.target = this.nearestTarget(player, enemies, SLASH_DASH.chainRange);
        if (!this.target) this.stop(player);
        return;
      }
      const step = Math.min(SLASH_DASH.lockedSpeed * dt, dist - reach);
      this.dirX = dx / dist;
      this.dirY = dy / dist;
      if (isWallAt(player.x + this.dirX * step, player.y + this.dirY * step)) {
        this.stop(player); // a wall is in the way: the dash cannot go through it
        return;
      }
      player.x += this.dirX * step;
      player.y += this.dirY * step;
      player.velocity.x = this.dirX * SLASH_DASH.lockedSpeed;
      player.velocity.y = this.dirY * SLASH_DASH.lockedSpeed;
      return;
    }

    // No target: straight dash, striking enemies the path passes through
    const step = Math.min(SLASH_DASH.speed * dt, SLASH_DASH.range - this.travelled);
    const startX = player.x;
    const startY = player.y;
    if (isWallAt(startX + this.dirX * step, startY + this.dirY * step)) {
      this.stop(player); // a wall is in the way: the dash cannot go through it
      return;
    }
    player.x += this.dirX * step;
    player.y += this.dirY * step;
    this.travelled += step;
    player.velocity.x = this.dirX * SLASH_DASH.speed;
    player.velocity.y = this.dirY * SLASH_DASH.speed;

    for (const enemy of enemies) {
      if (!enemy || enemy.hp <= 0 || this.hitEnemies.has(enemy)) continue;
      const reach = player.radius + (enemy.radius || 0);
      if (distanceToSegment(enemy.x, enemy.y, startX, startY, player.x, player.y) > reach) continue;
      this.strike(enemy, player);
    }

    if (this.travelled >= SLASH_DASH.range) this.stop(player);
  }

  // Ends the dash and hands movement back to WASD, keeping the dash's speed so it eases out
  stop(player) {
    this.active = false;
    this.target = null;
    player.velocity.x = this.dirX * player.moveSpeed;
    player.velocity.y = this.dirY * player.moveSpeed;
  }
}
