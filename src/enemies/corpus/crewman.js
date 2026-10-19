import BaseEnemy from '../enemy.js';
import { UNITS_PER_METER } from '../../engine/constants.js';
import PrimaryWeapon from '../../weapons/primary_weapon.js';
import MeleeWeapon from '../../weapons/melee_weapon.js';
import Grenade from '../../weapons/grenade.js';
import { scaleStatByFaction } from '../../combat/scaling.js';

// Wiki (Crewman): each Dera shot is 7 damage (75% Puncture, 15% Slash, 10% Impact), 1% status,
// and it fires almost continuously instead of in bursts.
const SHOT_DAMAGE = { impact: 0.7, puncture: 5.25, slash: 1.05 };
const SHOT_STATUS_CHANCE = 0.01;
const GRENADE_DAMAGE = 400; // Blast

// Spread in degrees: aimed fire from the open vs blind-fire over cover (reduced accuracy)
const AIM_SPREAD = [1.5, 4];
const BLIND_SPREAD = [8, 14];

// Tactic timings in seconds
const ADVANCE_SEC = [2, 4];     // shoot while closing in / kiting before choosing a new position
const FLANK_SEC = [1.5, 3];     // time allowed to reach a flank spot (firing on the move)
const COVER_RUN_SEC = [1.5, 3]; // time allowed to reach cover (firing on the move)
const COVERED_SEC = [4, 7];     // how long to stay behind cover
const PEEK_SEC = [1.5, 2.5];    // aimed fire from cover
const BLIND_SEC = [1, 2];       // blind fire from cover
const COVER_BAND_M = [3, 8];

const GRENADE_RANGE_M = [4, 22];
const GRENADE_WINDUP = 0.6;     // wiki: they peek/hesitate before throwing
const STATIONARY_SPEED = 25;    // target slower than this (units/s) counts as standing still

const rand = ([min, max]) => min + Math.random() * (max - min);

export default class Crewman extends BaseEnemy {
  constructor(x, y, options = {}) {
    super(x, y, { ...options, name: 'Crewman', faction: 'corpus' });
    const maxHp = scaleStatByFaction(90, this.lvl, 'hp', this.faction);
    const maxShield = scaleStatByFaction(120, this.lvl, 'shield', this.faction);
    this.initHealth({ maxHp, maxShield, armor: scaleStatByFaction(0, this.lvl, 'armor', this.faction) });
    this.hp = this.maxHp;

    const dera = this.equip(new PrimaryWeapon('Dera'));
    dera.damage = { ...SHOT_DAMAGE };
    dera.statusChance = SHOT_STATUS_CHANCE;
    dera.critChance = 0;
    this.setSpread(AIM_SPREAD);
    this.melee = new MeleeWeapon('Prova');
    this.secondary = null;

    this.focusSpeed = 0;
    this.lastFocus = null;
    this.tactic = { phase: 'advance', timer: rand(ADVANCE_SEC), spot: null, blind: false, subTimer: 0, resume: null };
  }

  setSpread([min, max]) {
    this.weapon.minSpread = min;
    this.weapon.maxSpread = max;
    this.weapon.currentSpread = Math.max(min, Math.min(this.weapon.currentSpread, max));
  }

  /** Smoothed speed of whoever we are shooting at; standing still makes grenades more likely. */
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

  behavior(dt, focus, projectiles, enemies) {
    const t = this.tactic;
    const dx = focus.x - this.x;
    const dy = focus.y - this.y;
    const distance = Math.hypot(dx, dy);
    this.trackFocus(dt, focus);

    if (t.phase === 'throw') return this.throwGrenade(dt, focus, projectiles, dx, dy);

    // Grenades come more often from cover and when the target stands still
    const rate = (t.phase === 'covered' ? 2 : 1) * (this.focusSpeed < STATIONARY_SPEED ? 1.5 : 1);
    this.grenadeTimer = Math.min(this.grenadeTimer + dt * rate, this.grenadeCooldown);
    const meters = distance / UNITS_PER_METER;
    if (this.grenadeTimer >= this.grenadeCooldown && meters >= GRENADE_RANGE_M[0] && meters <= GRENADE_RANGE_M[1]) {
      t.resume = t.phase;
      t.phase = 'throw';
      t.timer = GRENADE_WINDUP;
      return;
    }

    if (t.phase === 'advance') return this.advance(dt, focus, projectiles, enemies, dx, dy, distance);
    if (t.phase === 'covered') return this.covered(dt, focus, projectiles, enemies, dx, dy);
    return this.moveAndShoot(dt, focus, projectiles, enemies, dx, dy);
  }

  /** Close in or kite at preferred range while firing: shoot and run. */
  advance(dt, focus, projectiles, enemies, dx, dy, distance) {
    const t = this.tactic;
    this.navigate(dt, dx, dy, distance, enemies);
    this.shoot(dt, focus, projectiles);
    t.timer -= dt;
    // Magazine ran dry: use the reload to get somewhere safer
    if (t.timer <= 0 || this.weapon.reloading) this.relocate(focus);
  }

  /** Running to a flank spot or to cover, firing along the way. */
  moveAndShoot(dt, focus, projectiles, enemies, dx, dy) {
    const t = this.tactic;
    this.moveToSpot(t.spot, dt, enemies);
    this.rotateTowards(Math.atan2(dy, dx), dt);
    this.shoot(dt, focus, projectiles);
    t.timer -= dt;
    const arrived = t.spot && Math.hypot(t.spot.x - this.x, t.spot.y - this.y) < 14;
    if (!arrived && t.timer > 0) return;
    if (t.phase === 'cover' && arrived) this.enterCover();
    else this.startAdvance();
  }

  /** Planted behind cover: aimed fire when peeking, blind fire (reduced accuracy) in between. */
  covered(dt, focus, projectiles, enemies, dx, dy) {
    const t = this.tactic;
    const push = this.separation(enemies);
    this.applyVelocity(push.x, push.y, dt, this.acceleration);
    this.rotateTowards(Math.atan2(dy, dx), dt);
    this.shoot(dt, focus, projectiles);

    t.subTimer -= dt;
    if (t.subTimer <= 0) {
      t.blind = !t.blind;
      t.subTimer = rand(t.blind ? BLIND_SEC : PEEK_SEC);
      this.setSpread(t.blind ? BLIND_SPREAD : AIM_SPREAD);
    }
    t.timer -= dt;
    if (t.timer <= 0) this.relocate(focus);
  }

  /** Wind up, then lob a grenade at the target's current position. */
  throwGrenade(dt, focus, projectiles, dx, dy) {
    const t = this.tactic;
    this.weapon.update(dt, false);
    this.aimTime = 0;
    this.applyVelocity(0, 0, dt, this.acceleration);
    this.rotateTowards(Math.atan2(dy, dx), dt);
    t.timer -= dt;
    if (t.timer > 0) return;

    projectiles.push(new Grenade(this.x, this.y, focus.x, focus.y, { damage: GRENADE_DAMAGE, targets: [focus] }));
    this.grenadeTimer = 0;
    this.grenadeCooldown = 8 + Math.random() * 6;
    t.phase = t.resume ?? 'advance';
    if (t.phase === 'advance') t.timer = Math.max(t.timer, rand(ADVANCE_SEC));
  }

  /** Pick the next position: cover when there is some, otherwise flank or keep advancing. */
  relocate(focus) {
    const t = this.tactic;
    this.path = null;
    this.setSpread(AIM_SPREAD);
    t.blind = false;
    const cover = Math.random() < 0.7 ? this.findCover(focus, COVER_BAND_M) : null;
    if (cover) {
      t.phase = 'cover';
      t.spot = cover;
      t.timer = rand(COVER_RUN_SEC);
      return;
    }
    const flank = this.findFlankSpot(focus, COVER_BAND_M);
    if (flank && Math.random() < 0.6) {
      t.phase = 'flank';
      t.spot = flank;
      t.timer = rand(FLANK_SEC);
      return;
    }
    this.startAdvance();
  }

  startAdvance() {
    const t = this.tactic;
    t.phase = 'advance';
    t.spot = null;
    t.timer = rand(ADVANCE_SEC);
    this.path = null;
  }

  enterCover() {
    const t = this.tactic;
    t.phase = 'covered';
    t.timer = rand(COVERED_SEC);
    t.blind = false;
    t.subTimer = rand(PEEK_SEC);
    this.setSpread(AIM_SPREAD);
  }
}
