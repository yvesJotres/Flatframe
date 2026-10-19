import { audioManager } from '../engine/audio.js';
import Projectile from './projectile.js';
import { weaponModBonuses } from '../mods/mod_effects.js';

import { UNITS_PER_METER, HITSCAN_SPEED, SPREAD_RECOVERY_DEG_PER_SEC } from '../engine/constants.js';

function totalDamage(damage = {}) {
  return Object.values(damage).reduce((sum, value) => sum + value, 0);
}

// Damage falloff: full damage up to `start` metres, a linear drop to `minMultiplier` at `end`, then flat.
// Weapons without falloff data always return 1.
export function falloffMultiplier(falloff, distanceMeters) {
  if (!falloff) return 1;
  const { start, end, minMultiplier } = falloff;
  if (distanceMeters <= start) return 1;
  if (distanceMeters >= end) return minMultiplier;
  const t = (distanceMeters - start) / (end - start);
  return 1 - (1 - minMultiplier) * t;
}

// Wiki: the whole part of multishot is always fired, and the fraction is the chance of one extra projectile
// (2.8 fires 2 projectiles, with an 80% chance of a third). At least one projectile always fires.
export function rollPelletCount(multishot, rand = Math.random) {
  const whole = Math.max(1, Math.floor(multishot));
  const fraction = multishot - Math.floor(multishot);
  return whole + (fraction > 0 && rand() < fraction ? 1 : 0);
}

function rotateDirection(x, y, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: x * cos - y * sin, y: x * sin + y * cos };
}

export default class Weapon {
  constructor(stats) {
    this.stats = stats;
    this.name = stats.name;
    this.magazine = stats.magazine;
    this.ammo = stats.magazine;
    this.ammoMax = stats.ammoMax ?? stats.magazine;
    this.ammoReserve = this.ammoMax;
    this.ammoPickup = stats.ammoPickup ?? 0;
    this.reloadSpeed = stats.reload;
    this.meleeCooldown = (stats.meleeCooldown ?? 1) * 1000;
    this.lastFireTime = 0;
    this.fireAccumulator = 0;
    this.triggerHeld = false;
    this.reloading = false;
    this.reloadRemaining = 0;
    this.setAttack(stats.attacks?.normal ?? stats.attack ?? stats);
  }

  setAttack(attack) {
    this.attack = attack;
    this.fireRate = attack.fireRate;
    this.damage = { ...attack.damage };
    this.ammoCost = attack.ammoCost ?? 1;
    this.multishot = attack.multishot ?? 1;
    this.punchThrough = attack.punchThrough ?? 0;
    this.range = attack.range ?? 300;
    this.minSpread = attack.minSpread ?? 0;
    this.maxSpread = attack.maxSpread ?? this.minSpread;
    this.critChance = attack.critChance ?? 0;
    this.critMultiplier = attack.critMultiplier ?? 1;
    this.falloff = attack.falloff ?? null; // { start, end, minMultiplier } in meters, see falloffMultiplier()
    this.statusChance = attack.statusChance ?? 0;
    this.shotType = attack.shotType ?? 'projectile';
    this.currentSpread = this.minSpread;
  }

  get totalDamage() {
    return totalDamage(this.damage);
  }

  // Equipped mods add percent bonuses on top of the base stats, e.g. Serration +165% is x2.65 damage
  applyMods(mods = [], category) {
    const b = weaponModBonuses(mods, category);
    const pct = (value) => 1 + value / 100;
    for (const key of Object.keys(this.damage)) this.damage[key] *= pct(b.damage);
    this.critChance += b.critChance / 100;
    this.critMultiplier *= pct(b.critDamage);
    this.statusChance += b.statusChance / 100;
    this.fireRate *= pct(b.fireRate);
    this.reloadSpeed /= pct(b.reloadSpeed);
    const oldMagazine = this.magazine;
    this.magazine = Math.round(oldMagazine * pct(b.magazine));
    if (this.ammo === oldMagazine) this.ammo = this.magazine; // a full magazine stays full
  }

  update(dt, firing = false) {
    if (!firing) {
      this.triggerHeld = false;
      this.fireAccumulator = 0;
    }

    this.currentSpread = Math.max(
      this.minSpread,
      this.currentSpread - SPREAD_RECOVERY_DEG_PER_SEC * dt
    );

    if (!this.reloading) return;
    this.reloadRemaining -= dt;
    if (this.reloadRemaining > 0) return;

    const needed = this.magazine - this.ammo;
    const loaded = Math.min(needed, this.ammoReserve);
    this.ammo += loaded;
    this.ammoReserve -= loaded;
    this.reloading = false;
    this.reloadRemaining = 0;
  }

  fire(player, target, dt, projectiles = [], options = {}) {
    if (this.reloading) return;

    const interval = 1 / this.fireRate;
    if (!this.triggerHeld) {
      this.triggerHeld = true;
      this.fireAccumulator = interval;
    }
    this.fireAccumulator += dt;
    if (this.fireAccumulator < interval) return;
    this.fireAccumulator -= interval;

    if (this.ammo < this.ammoCost) {
      this.startReload();
      return;
    }

    const aimX = target.x - player.x;
    const aimY = target.y - player.y;
    const aimDistance = Math.hypot(aimX, aimY);
    if (aimDistance === 0) return;

    this.ammo -= this.ammoCost;
    this.lastFireTime = performance.now();
    audioManager.play(this.stats.sound ?? 'gunshot', 0.35);

    const baseX = aimX / aimDistance;
    const baseY = aimY / aimDistance;
    const pellets = rollPelletCount(this.multishot);
    const maxDistance = this.range * UNITS_PER_METER;
    const speed = this.shotType === 'hit-scan' ? HITSCAN_SPEED : 5000;
    const muzzleOffset = 20;

    for (let i = 0; i < pellets; i++) {
      const spreadSign = Math.random() < 0.5 ? -1 : 1;
      const spreadRad = ((this.currentSpread * Math.PI) / 180) * Math.random() * spreadSign;
      const direction = rotateDirection(baseX, baseY, spreadRad);
      const hit = this.rollHit(aimDistance / UNITS_PER_METER);
      hit.sourceX = player.x;
      hit.sourceY = player.y;

      projectiles.push(
        new Projectile(
          player.x + direction.x * muzzleOffset,
          player.y + direction.y * muzzleOffset,
          direction.x,
          direction.y,
          hit,
          {
            speed,
            maxDistance,
            punchThrough: this.punchThrough,
            targets: options.targets,
            color: options.color,
          }
        )
      );
    }

    this.currentSpread = Math.min(
      this.maxSpread,
      this.currentSpread + (this.maxSpread - this.minSpread) * 0.2
    );
  }

  rollHit(distanceMeters = 0) {
    const crit = Math.random() < this.critChance;
    const multiplier = (crit ? this.critMultiplier : 1) * falloffMultiplier(this.falloff, distanceMeters);
    const impact = (this.damage.impact ?? 0) * multiplier;
    const puncture = (this.damage.puncture ?? 0) * multiplier;
    const slash = (this.damage.slash ?? 0) * multiplier;
    const heat = (this.damage.heat ?? 0) * multiplier;
    const total = impact + puncture + slash + heat;
    const baseTotal = totalDamage(this.damage);

    let status = null;
    if (baseTotal > 0 && Math.random() < this.statusChance) {
      const roll = Math.random() * baseTotal;
      const impactShare = this.damage.impact ?? 0;
      const punctureShare = this.damage.puncture ?? 0;
      const slashShare = this.damage.slash ?? 0;
      if (roll < impactShare) status = 'impact';
      else if (roll < impactShare + punctureShare) status = 'puncture';
      else if (roll < impactShare + punctureShare + slashShare) status = 'slash';
      else status = 'heat';
    }

    // Bleed (wiki): each tick uses the base damage with the critical multiplier on crit hits (Additional Multipliers),
    // and ignores the falloff and the physical/elemental bonuses
    const procBase = baseTotal * (crit ? this.critMultiplier : 1);
    return { impact, puncture, slash, heat, total, baseTotal, procBase, crit, status };
  }

  startReload() {
    if (this.reloading || this.ammo >= this.magazine || this.ammoReserve <= 0) return;
    this.reloading = true;
    this.reloadRemaining = this.reloadSpeed;
    audioManager.play(this.stats.reloadSound ?? 'reload', 0.7);
  }
}
