import BaseEnemy from '../enemy.js';
import PrimaryWeapon from '../../weapons/primary_weapon.js';
import Grenade from '../../weapons/grenade.js';
import { scaleStatByFaction } from '../../combat/scaling.js';
import { UNITS_PER_METER } from '../../engine/constants.js';

const ENEMY_WEAPON = 'Grakata';

// Burst cycle: fire a short burst, then move to a new spot (ideally cover) before firing again
const BURST_SHOTS = [4, 7];          // shots per burst
const REPOSITION_SEC = [1.2, 2.2];   // time allowed to get to the next spot
const PAUSE_SEC = [0.6, 1.4];        // wait after arriving before the next burst

// Wiki: from cover they sometimes blind-fire, with suffered accuracy
const BLIND_CHANCE = 0.35;           // share of bursts fired blind from cover
const BLIND_SPREAD_MULT = 3;         // widens the weapon's max spread while blind

// Wiki: they occasionally throw grenades, more often from cover and at a target that stands still
const GRENADE_RANGE_M = [4, 22];
const GRENADE_WINDUP = 0.6;          // hesitate before throwing
const STATIONARY_SPEED = 25;         // target slower than this (units/s) counts as standing still

const rand = ([min, max]) => min + Math.random() * (max - min);

export default class Lancer extends BaseEnemy {
  constructor(x, y, options = {}) {
    super(x, y, { name: 'Lancer', faction: 'grineer', ...options });
        // Base 100 health and 100 armor. Armor is floored at 200 once scaled (see scaleStatByFaction),
        // which is why the mission value is 200 at level 1
        const maxHp = scaleStatByFaction(100, this.lvl, 'hp', this.faction);
        this.initHealth({ maxHp, armor: scaleStatByFaction(100, this.lvl, 'armor', this.faction) });
    this.hp = this.maxHp;

    // Spawning penalty: enemies that just spawned can't be stealth killed for 4-8 seconds (wiki)
    this.spawnPenaltyTimer = 4 + Math.random() * 4;
    this.isNewlySpawned = true;

    // Kiting rifleman with burst fire and cover; see behavior() below.
    // Subclasses (Trooper) pass their own weapon instance
    this.equip(options.weapon ?? new PrimaryWeapon(ENEMY_WEAPON));
    // First sighting: move to a spot (cover if any) right away instead of standing still
    this.tactic = { phase: 'reposition', timer: rand(REPOSITION_SEC), shotsLeft: 0, spot: null, inCover: false, blind: false, lastShot: 0, resume: null };
    this.focusSpeed = 0;
    this.lastFocus = null;
  }

  behavior(dt, focus, projectiles, enemies) {
    if (!this.weapon) return super.behavior(dt, focus, projectiles, enemies);
    const t = this.tactic;
    const dx = focus.x - this.x;
    const dy = focus.y - this.y;
    const distance = Math.hypot(dx, dy);
    const inRange = distance <= this.engageRange();

    this.trackFocus(dt, focus);
    if (t.phase === 'throw') return this.throwGrenade(dt, focus, projectiles, dx, dy);

    // Grenades come more often from cover and when the target stands still
    const rate = (t.inCover ? 2 : 1) * (this.focusSpeed < STATIONARY_SPEED ? 1.5 : 1);
    this.grenadeTimer = Math.min(this.grenadeTimer + dt * rate, this.grenadeCooldown);
    const meters = distance / UNITS_PER_METER;
    if (t.phase !== 'burst' && this.grenadeTimer >= this.grenadeCooldown && meters >= GRENADE_RANGE_M[0] && meters <= GRENADE_RANGE_M[1]) {
      t.resume = t.phase;
      t.phase = 'throw';
      t.timer = GRENADE_WINDUP;
      return;
    }

    if (t.phase === 'burst') {
      // Count shots by watching the weapon's fire timestamp
      if (this.weapon.lastFireTime !== t.lastShot) {
        t.lastShot = this.weapon.lastFireTime;
        t.shotsLeft -= 1;
      }
      this.face(dt, dx, dy);
      this.shoot(dt, focus, projectiles);
      if (t.shotsLeft <= 0 || !inRange) this.startReposition(focus);
      this.separate(dt, enemies, 0);
      return;
    }

    // Not firing: release the trigger so the next burst starts clean
    this.weapon.update(dt, false);
    this.aimTime = 0;

    if (t.phase === 'reposition') {
      if (!t.spot) this.chooseSpot(focus);
      t.timer -= dt;
      this.moveToSpot(t.spot, dt, enemies);
      this.face(dt, dx, dy);
      if (t.timer <= 0 || (t.spot && Math.hypot(t.spot.x - this.x, t.spot.y - this.y) < 14)) {
        t.phase = 'pause';
        t.timer = rand(PAUSE_SEC);
        this.applyVelocity(0, 0, dt, this.acceleration);
      }
      return;
    }

    // pause: stand still in the chosen spot, then burst again
    t.timer -= dt;
    this.applyVelocity(0, 0, dt, this.acceleration);
    this.face(dt, dx, dy);
    if (t.timer <= 0) {
      t.phase = 'burst';
      t.shotsLeft = Math.round(rand(BURST_SHOTS));
      t.lastShot = this.weapon.lastFireTime;
      // From cover, some bursts are fired blind (wider spread)
      t.blind = t.inCover && Math.random() < BLIND_CHANCE;
      this.setSpreadMultiplier(t.blind ? BLIND_SPREAD_MULT : 1);
    }
  }

  /** Cover if there is any nearby, otherwise a flank spot. */
  chooseSpot(focus) {
    const t = this.tactic;
    const cover = this.findCover(focus);
    t.spot = cover ?? this.findFlankSpot(focus);
    t.inCover = !!cover;
  }

  startReposition(focus) {
    const t = this.tactic;
    t.phase = 'reposition';
    t.timer = rand(REPOSITION_SEC);
    this.chooseSpot(focus);
    this.setSpreadMultiplier(1);
    this.path = null;
  }

  /** Wind up, then lob a grenade at the target's current position, then go back to what it was doing. */
  throwGrenade(dt, focus, projectiles, dx, dy) {
    const t = this.tactic;
    this.weapon.update(dt, false);
    this.aimTime = 0;
    this.applyVelocity(0, 0, dt, this.acceleration);
    this.rotateTowards(Math.atan2(dy, dx), dt);
    t.timer -= dt;
    if (t.timer > 0) return;

    projectiles.push(new Grenade(this.x, this.y, focus.x, focus.y, { targets: [focus] }));
    this.grenadeTimer = 0;
    this.grenadeCooldown = 8 + Math.random() * 6;
    if (t.resume === 'pause') {
      t.phase = 'pause';
      t.timer = rand(PAUSE_SEC);
    } else {
      t.phase = 'reposition';
      t.timer = rand(REPOSITION_SEC);
    }
  }

  /** Smoothed speed of whoever we are shooting at, for the grenade rate. */
  trackFocus(dt, focus) {
    if (this.lastFocus === focus && dt > 0) {
      const speed = Math.hypot(focus.x - this.lastFocusX, focus.y - this.lastFocusY) / dt;
      this.focusSpeed += (speed - this.focusSpeed) * Math.min(1, dt * 3);
    } else {
      this.focusSpeed = 0;
    }
    this.lastFocus = focus;
    this.lastFocusX = focus.x;
    this.lastFocusY = focus.y;
  }

  /** Scales the weapon's max spread from its data (1 = normal). */
  setSpreadMultiplier(mult) {
    const base = this.weapon.attack.maxSpread;
    this.weapon.maxSpread = base * mult;
  }

  face(dt, dx, dy) {
    this.rotateTowards(Math.atan2(dy, dx), dt);
  }

  separate(dt, enemies) {
    const push = this.separation(enemies);
    if (push.x || push.y) this.applyVelocity(push.x, push.y, dt, this.acceleration * 0.5);
    else this.applyVelocity(0, 0, dt, this.acceleration);
  }
}
