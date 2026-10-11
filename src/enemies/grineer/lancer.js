import BaseEnemy from '../enemy.js';
import PrimaryWeapon from '../../weapons/primary_weapon.js';
import { scaleStatByFaction } from '../../combat/scaling.js';
import { UNITS_PER_METER } from '../../engine/constants.js';

const ENEMY_WEAPON = 'Grakata';

// Burst cycle: fire a short burst, then move to a new spot (ideally cover) before firing again
const BURST_SHOTS = [4, 7];          // shots per burst
const REPOSITION_SEC = [1.2, 2.2];   // time allowed to get to the next spot
const PAUSE_SEC = [0.6, 1.4];        // wait after arriving before the next burst
const COVER_SEARCH_M = [3, 7];       // distance band (meters) to look for cover
const SAMPLE_STEP = 16;              // world units between points when checking a line for walls

const rand = ([min, max]) => min + Math.random() * (max - min);

export default class Lancer extends BaseEnemy {
  constructor(x, y, options = {}) {
    super(x, y, { ...options, name: 'Lancer', faction: 'grineer' });
        const maxHp = scaleStatByFaction(100, this.lvl, 'hp', this.faction);
        this.initHealth({ maxHp, armor: scaleStatByFaction(100, this.lvl, 'armor', this.faction) });
    this.hp = this.maxHp;

    // Spawning penalty: enemies that just spawned can't be stealth killed for 4-8 seconds (wiki)
    this.spawnPenaltyTimer = 4 + Math.random() * 4;
    this.isNewlySpawned = true;

    // Kiting rifleman with burst fire and cover; see behavior() below.
    this.equip(new PrimaryWeapon(options.weapon ?? ENEMY_WEAPON));
    // First sighting: move to a spot (cover if any) right away instead of standing still
    this.tactic = { phase: 'reposition', timer: rand(REPOSITION_SEC), shotsLeft: 0, spot: null, lastShot: 0 };
  }

  behavior(dt, focus, projectiles, enemies) {
    if (!this.weapon) return super.behavior(dt, focus, projectiles, enemies);
    const t = this.tactic;
    const dx = focus.x - this.x;
    const dy = focus.y - this.y;
    const distance = Math.hypot(dx, dy);
    const inRange = distance <= this.weapon.range * UNITS_PER_METER;

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
      if (!t.spot) t.spot = this.findCover(focus) ?? this.findFlankSpot(focus);
      t.timer -= dt;
      this.moveAlong(dt, enemies);
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
    }
  }

  startReposition(focus) {
    const t = this.tactic;
    t.phase = 'reposition';
    t.timer = rand(REPOSITION_SEC);
    t.spot = this.findCover(focus) ?? this.findFlankSpot(focus);
    this.path = null;
  }

  /** Wall lookup with a safe fallback for navmeshes that cannot answer it (treat as open ground). */
  walkable(x, y) {
    const nav = this.navMesh;
    return nav?.isWalkableAt ? nav.isWalkableAt(x, y) : true;
  }

  /** A walkable spot 3-7 m away with a wall between it and the target: best place to wait. */
  findCover(focus) {
    const nav = this.navMesh;
    if (!nav) return null;
    let best = null;
    let bestScore = Infinity;
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2 + Math.random() * 0.3;
      const dist = rand(COVER_SEARCH_M) * UNITS_PER_METER;
      const x = this.x + Math.cos(angle) * dist;
      const y = this.y + Math.sin(angle) * dist;
      if (!this.walkable(x, y)) continue;
      if (!this.lineBlocked(x, y, focus.x, focus.y)) continue;
      // Prefer spots close to where we are now (short run to cover)
      const score = dist;
      if (score < bestScore) { bestScore = score; best = { x, y }; }
    }
    return best;
  }

  /** Fallback when no cover exists: a point off to one side so we keep moving. */
  findFlankSpot(focus) {
    const nav = this.navMesh;
    const side = Math.random() < 0.5 ? 1 : -1;
    const base = Math.atan2(this.y - focus.y, this.x - focus.x) + side * (Math.PI / 2.5);
    const dist = rand(COVER_SEARCH_M) * UNITS_PER_METER;
    const x = focus.x + Math.cos(base) * dist;
    const y = focus.y + Math.sin(base) * dist;
    if (nav && !this.walkable(x, y)) return null;
    return { x, y };
  }

  /** True if any sampled point on the line a-b is inside a wall. */
  lineBlocked(ax, ay, bx, by) {
    const nav = this.navMesh;
    if (!nav) return false;
    const len = Math.hypot(bx - ax, by - ay);
    const steps = Math.max(1, Math.floor(len / SAMPLE_STEP));
    for (let i = 1; i < steps; i++) {
      const f = i / steps;
      if (!this.walkable(ax + (bx - ax) * f, ay + (by - ay) * f)) return true;
    }
    return false;
  }

  /** Walk toward the reposition spot, following the navmesh path when there is one. */
  moveAlong(dt, enemies) {
    const t = this.tactic;
    if (!t.spot) return this.applyVelocity(0, 0, dt, this.acceleration);
    let tx = t.spot.x, ty = t.spot.y;
    if (this.navMesh) {
      if (!this.path || this.pathIndex >= this.path.length) {
        this.path = this.navMesh.findPath(this.x, this.y, t.spot.x, t.spot.y);
        this.pathIndex = 0;
      }
      if (this.path && this.path.length) {
        const node = this.path[Math.min(this.pathIndex, this.path.length - 1)];
        if (Math.hypot(node.x - this.x, node.y - this.y) < 24 && this.pathIndex < this.path.length - 1) this.pathIndex++;
        tx = this.path[this.pathIndex].x;
        ty = this.path[this.pathIndex].y;
      }
    }
    const ddx = tx - this.x, ddy = ty - this.y;
    const d = Math.hypot(ddx, ddy) || 1;
    const push = this.separation(enemies);
    this.applyVelocity(ddx / d + push.x * 0.5, ddy / d + push.y * 0.5, dt, this.acceleration);
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
