// Lockers and storage containers: the lootable props in a mission (wiki: https://wiki.warframe.com/w/Locker and
// https://wiki.warframe.com/w/Container). They are solid, so they block movement and bullets like a wall.
//
// Lockers (wiki): green ones open when you interact, red ones are locked (they need the Master Thief mod, a Kubrow with
// Scavenge, or the Master Key mod: none exist here yet), black ones are permanently locked.
// Containers (wiki): breakable. A common one holds 0-3 of credits, ammo, an energy or health orb, a region resource.
//   Region Resource chance is 18.97% per roll; Uncommon rolls twice, Rare three times, Reinforced four times.
//   Rare and Reinforced usually hold 80 Endo. Reinforced "require more damage to break than any other container".
// Placeholders (the wiki gives no numbers): the hit points, the credit amounts, the shares between item types,
// how many items a locker holds, and the rolls for Rare and Reinforced contents.

import LootDrop, { LOOT_TYPES } from './loot.js';
import { REGION_RESOURCES, CURRENT_REGION } from '../enemies/drop_tables.js';

// Names shown above containers, like an enemy's name above its health bar (lockers have no name)
export const LOOTABLE_NAMES = {
  container: { common: 'Container', uncommon: 'Container', rare: 'Container', reinforced: 'Container' }, // kind shows by colour
};

export const INTERACT_RANGE = 70;             // px from the edge of a locker that the player can use it
export const REGION_RESOURCE_CHANCE = 0.1897; // wiki: per roll, common Grineer container
export const ENDO_ORB = 80;                   // wiki: Rare and Reinforced containers usually hold 80 Endo

// Placeholders: hit points by container kind (only the order is from the wiki: Reinforced takes the most damage)
export const CONTAINER_HP = { common: 30, uncommon: 40, rare: 60, reinforced: 150 };
// Wiki: Uncommon rolls resources twice, Rare three times, Reinforced four times
export const RESOURCE_ROLLS = { common: 1, uncommon: 2, rare: 3, reinforced: 4 };
// How many items a container holds (wiki: common 0-3, uncommon 1-3; rare and reinforced are placeholders)
const ITEM_ROLLS = { common: [0, 3], uncommon: [1, 3], rare: [3, 3], reinforced: [4, 4] };
// What an item can be, and its share (placeholder: the wiki lists the types without shares)
const ITEM_WEIGHTS = [
  [LOOT_TYPES.CREDITS, 0.25],
  [LOOT_TYPES.PRIMARY_AMMO, 0.2],
  [LOOT_TYPES.SECONDARY_AMMO, 0.2],
  [LOOT_TYPES.ENERGY, 0.15],
  [LOOT_TYPES.HEALTH, 0.2],
];
// Credit trinket sizes (placeholder), by container kind: [min, max]
const CREDIT_RANGE = { common: [20, 60], uncommon: [40, 100], rare: [150, 400], reinforced: [400, 1000] };
const LOCKER_ITEMS = [1, 3]; // placeholder: the wiki gives no locker contents

const randInt = (rand, lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));

function pickItem(rand) {
  const total = ITEM_WEIGHTS.reduce((s, [, w]) => s + w, 0);
  let roll = rand() * total;
  for (const [type, w] of ITEM_WEIGHTS) {
    roll -= w;
    if (roll <= 0) return type;
  }
  return ITEM_WEIGHTS[0][0];
}

// The loot a container or locker gives: an array of LootDrop at (x, y)
export function rollLootableDrops(kind, x, y, rand = Math.random, { locker = false } = {}) {
  const spot = () => [x + (rand() - 0.5) * 40, y + (rand() - 0.5) * 40];
  const drops = [];
  const [lo, hi] = locker ? LOCKER_ITEMS : ITEM_ROLLS[kind];
  const credits = CREDIT_RANGE[locker ? 'common' : kind];
  for (let i = 0, n = randInt(rand, lo, hi); i < n; i++) {
    const type = pickItem(rand);
    const amount = type === LOOT_TYPES.CREDITS ? randInt(rand, credits[0], credits[1]) : 1;
    drops.push(new LootDrop(...spot(), type, amount));
  }
  const resourceRolls = locker ? 1 : RESOURCE_ROLLS[kind];
  const options = REGION_RESOURCES[CURRENT_REGION];
  for (let i = 0; i < resourceRolls; i++) {
    if (rand() >= REGION_RESOURCE_CHANCE) continue;
    const drop = new LootDrop(...spot(), LOOT_TYPES.RESOURCE, 1);
    drop.currency = options[Math.floor(rand() * options.length)];
    drops.push(drop);
  }
  if (!locker && (kind === 'rare' || kind === 'reinforced')) drops.push(new LootDrop(...spot(), LOOT_TYPES.ENDO, ENDO_ORB));
  return drops;
}

// Does the segment (x0,y0)-(x1,y1) touch the rectangle, grown by pad on every side? (Liang-Barsky clipping)
export function segmentTouchesRect(x0, y0, x1, y1, rect, pad = 0) {
  const minX = rect.x - pad, maxX = rect.x + rect.w + pad;
  const minY = rect.y - pad, maxY = rect.y + rect.h + pad;
  const dx = x1 - x0, dy = y1 - y0;
  let t0 = 0, t1 = 1;
  const clips = [[-dx, x0 - minX], [dx, maxX - x0], [-dy, y0 - minY], [dy, maxY - y0]];
  for (const [p, q] of clips) {
    if (p === 0) { if (q < 0) return false; continue; }
    const t = q / p;
    if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
    else { if (t < t0) return false; if (t < t1) t1 = t; }
  }
  return true;
}

// A breakable storage container. It has hit points like an enemy so bullets and melee can hurt it.
export class Container {
  constructor(entity) {
    this.id = entity.id;
    this.type = 'container';
    this.kind = entity.kind;
    this.rect = { x: entity.x, y: entity.y, w: entity.w, h: entity.h };
    this.x = entity.x + entity.w / 2;
    this.y = entity.y + entity.h / 2;
    this.radius = entity.w / 2;
    this.name = LOOTABLE_NAMES.container[entity.kind] ?? LOOTABLE_NAMES.container.common;
    this.maxHp = CONTAINER_HP[entity.kind] ?? CONTAINER_HP.common;
    this.hp = this.maxHp;
    this.flash = 0;                 // seconds of hit flash left
    this.isBreakable = true;
  }

  takeDamage(hit) {
    const damage = typeof hit === 'number' ? hit : hit.total ?? 0;
    this.hp -= damage;
    this.flash = 0.1;
    return damage;
  }

  // A shot hits the whole box: any part of its path that touches the container (see segmentTouchesRect)
  touchedBy(x0, y0, x1, y1, pad = 0) {
    return segmentTouchesRect(x0, y0, x1, y1, this.rect, pad);
  }

  applyBlind() {} // abilities that reach every target call this; a container ignores it

  get broken() {
    return this.hp <= 0;
  }

  update(dt) {
    this.flash = Math.max(0, this.flash - dt);
  }

  drops(rand = Math.random) {
    return rollLootableDrops(this.kind, this.x, this.y, rand);
  }
}

// A storage locker: green opens on interact, red is locked, black never opens.
export class Locker {
  constructor(entity) {
    this.id = entity.id;
    this.type = 'locker';
    this.kind = entity.kind;
    this.facing = entity.facing;
    this.rect = { x: entity.x, y: entity.y, w: entity.w, h: entity.h };
    this.x = entity.x + entity.w / 2;
    this.y = entity.y + entity.h / 2;
    this.opened = false;
    this.isBreakable = false;
  }

  // How far a point is from the locker's edge (0 when inside it)
  distanceTo(px, py) {
    const r = this.rect;
    const dx = Math.max(r.x - px, 0, px - (r.x + r.w));
    const dy = Math.max(r.y - py, 0, py - (r.y + r.h));
    return Math.hypot(dx, dy);
  }

  inRange(player) {
    return this.distanceTo(player.x, player.y) <= INTERACT_RANGE;
  }

  // What the prompt says: null for a locker nobody can use any more or ever
  prompt() {
    if (this.kind === 'black' || this.opened) return null;
    return this.kind === 'red' ? 'LOCKED' : '[X] OPEN';
  }

  // Interact: a green locker opens once and gives its loot. Returns { opened, drops, locked }.
  interact(rand = Math.random) {
    if (this.kind === 'green' && !this.opened) {
      this.opened = true;
      return { opened: true, locked: false, drops: rollLootableDrops('common', this.x, this.y, rand, { locker: true }) };
    }
    return { opened: false, locked: this.kind !== 'green', drops: [] };
  }
}

// Builds the lootables from a map's entities. Returns { lockers, containers, pads }.
// A gate across a doorway. Gates cannot be used: each opens by itself while the Warframe is near it, and closes again
// a few seconds after the Warframe leaves. A closed gate is solid: it blocks walking, bullets and enemy sight.
export const GATE = {
  openRange: 96,  // units (about 6 m): the Warframe this close opens it
  holdSeconds: 2, // seconds it stays open after the Warframe leaves (placeholder)
};

export class Gate {
  constructor(entity) {
    this.id = entity.id;
    this.type = 'gate';
    this.orientation = entity.orientation;
    this.rect = { x: entity.x, y: entity.y, w: entity.w, h: entity.h };
    this.x = entity.x + entity.w / 2;
    this.y = entity.y + entity.h / 2;
    this.open = false; // gates start closed
    this.hold = 0;     // seconds of open left after the Warframe leaves
  }

  distanceTo(px, py) {
    const r = this.rect;
    const dx = Math.max(r.x - px, 0, px - (r.x + r.w));
    const dy = Math.max(r.y - py, 0, py - (r.y + r.h));
    return Math.hypot(dx, dy);
  }

  // Called every frame. Returns whether the gate should be open now.
  update(dt, player) {
    if (this.distanceTo(player.x, player.y) <= GATE.openRange) this.hold = GATE.holdSeconds;
    else this.hold = Math.max(0, this.hold - dt);
    return this.hold > 0;
  }
}

export function buildLootables(entities = []) {
  const lockers = [], containers = [], pads = [], gates = [];
  for (const e of entities) {
    if (e.type === 'locker') lockers.push(new Locker(e));
    else if (e.type === 'container') containers.push(new Container(e));
    else if (e.type === 'pad') pads.push(e);
    else if (e.type === 'gate') gates.push(new Gate(e));
  }
  return { lockers, containers, pads, gates };
}

// The nearest locker the player can use now (and that has a prompt), or null
export function nearestUsableLocker(lockers, player) {
  let best = null;
  let bestDist = Infinity;
  for (const l of lockers) {
    if (!l.prompt() || !l.inRange(player)) continue;
    const d = l.distanceTo(player.x, player.y);
    if (d < bestDist) { best = l; bestDist = d; }
  }
  return best;
}
