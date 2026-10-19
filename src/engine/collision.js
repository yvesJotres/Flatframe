// Collision for missions: wall tiles and solid props (lockers, containers) that block walkers and bullets.
// One shared world (`collision`) is filled when a mission starts and read by the player, enemies, projectiles,
// abilities and the spawner, so they can never disagree about where a wall is.
//   - walls are tiles on a grid (tileSize px), given by their top-left corners
//   - solids are rectangles { x, y, w, h } (top-left corner), added and removed one by one
// Circles (units) are pushed out of whatever they overlap; segments (bullets) stop at the first thing they hit.

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Where a segment first enters an axis-aligned box, as a fraction 0..1 along the segment, or null
function segmentBox(x0, y0, x1, y1, box) {
  let tMin = 0;
  let tMax = 1;
  const axes = [
    [x0, x1 - x0, box.x, box.x + box.w],
    [y0, y1 - y0, box.y, box.y + box.h],
  ];
  for (const [start, delta, lo, hi] of axes) {
    if (delta === 0) {
      if (start < lo || start > hi) return null;
      continue;
    }
    const t1 = (lo - start) / delta;
    const t2 = (hi - start) / delta;
    tMin = Math.max(tMin, Math.min(t1, t2));
    tMax = Math.min(tMax, Math.max(t1, t2));
    if (tMin > tMax) return null;
  }
  return tMin;
}

export class CollisionWorld {
  constructor() {
    this.clear();
  }

  clear() {
    this.tileSize = 0;
    this.tiles = new Set();
    this.solids = [];
  }

  // Walls: tiles given by their top-left pixel corners (multiples of tileSize)
  setTiles(tileSize, wallPositions = []) {
    this.tileSize = tileSize;
    this.tiles = new Set();
    for (const w of wallPositions) this.tiles.add(`${Math.floor(w.x / tileSize + 1e-6)},${Math.floor(w.y / tileSize + 1e-6)}`);
  }

  addSolid(rect) {
    this.solids.push(rect);
    return rect;
  }

  removeSolid(rect) {
    const i = this.solids.indexOf(rect);
    if (i >= 0) this.solids.splice(i, 1);
  }

  hasTile(gx, gy) {
    return this.tiles.has(`${gx},${gy}`);
  }

  // True when a point is inside a wall tile or a solid
  isSolidAt(x, y) {
    if (this.tileSize && this.hasTile(Math.floor(x / this.tileSize), Math.floor(y / this.tileSize))) return true;
    return this.solids.some((s) => x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h);
  }

  // Boxes a circle at (x, y) with this radius might touch
  boxesNear(x, y, radius) {
    const boxes = [];
    const ts = this.tileSize;
    if (ts) {
      const g0x = Math.floor((x - radius) / ts), g1x = Math.floor((x + radius) / ts);
      const g0y = Math.floor((y - radius) / ts), g1y = Math.floor((y + radius) / ts);
      for (let gx = g0x; gx <= g1x; gx++) {
        for (let gy = g0y; gy <= g1y; gy++) {
          if (this.hasTile(gx, gy)) boxes.push({ x: gx * ts, y: gy * ts, w: ts, h: ts, gx, gy });
        }
      }
    }
    for (const s of this.solids) {
      if (x + radius >= s.x && x - radius <= s.x + s.w && y + radius >= s.y && y - radius <= s.y + s.h) boxes.push(s);
    }
    return boxes;
  }

  // Pushes a unit (anything with x, y and radius) out of walls and solids. Returns true if it had to move.
  resolveCircle(entity, radius = entity.radius ?? 16) {
    if (!this.tileSize && !this.solids.length) return false;
    let moved = false;
    for (let pass = 0; pass < 4; pass++) {
      let pushed = false;
      const ts = this.tileSize;
      const ex = ts ? Math.floor(entity.x / ts) : 0;
      const ey = ts ? Math.floor(entity.y / ts) : 0;
      for (const box of this.boxesNear(entity.x, entity.y, radius)) {
        const cx = clamp(entity.x, box.x, box.x + box.w);
        const cy = clamp(entity.y, box.y, box.y + box.h);
        const dx = entity.x - cx;
        const dy = entity.y - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 >= radius * radius) continue;
        // A corner shared by two wall tiles is not a real corner: the flat wall in front handles it
        if (box.gx !== undefined && box.gx !== ex && box.gy !== ey && (this.hasTile(box.gx, ey) || this.hasTile(ex, box.gy))) continue;
        if (d2 > 1e-9) {
          const d = Math.sqrt(d2);
          const push = radius - d;
          entity.x += (dx / d) * push;
          entity.y += (dy / d) * push;
        } else {
          // The centre is inside the box: leave through the nearest side
          const left = entity.x - box.x, right = box.x + box.w - entity.x;
          const top = entity.y - box.y, bottom = box.y + box.h - entity.y;
          const m = Math.min(left, right, top, bottom);
          if (m === left) entity.x = box.x - radius;
          else if (m === right) entity.x = box.x + box.w + radius;
          else if (m === top) entity.y = box.y - radius;
          else entity.y = box.y + box.h + radius;
        }
        pushed = moved = true;
      }
      if (!pushed) break;
    }
    return moved;
  }

  // The first wall or solid a segment meets: { x, y, t } with t the fraction along the segment, or null
  raycast(x0, y0, x1, y1) {
    if (x0 === x1 && y0 === y1) return null;
    if (this.isSolidAt(x0, y0)) return { x: x0, y: y0, t: 0 };
    let best = null;
    const ts = this.tileSize;
    if (ts && this.tiles.size) {
      const dx = x1 - x0, dy = y1 - y0;
      let gx = Math.floor(x0 / ts), gy = Math.floor(y0 / ts);
      const stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1;
      const tDeltaX = dx !== 0 ? Math.abs(ts / dx) : Infinity;
      const tDeltaY = dy !== 0 ? Math.abs(ts / dy) : Infinity;
      let tMaxX = dx !== 0 ? (dx > 0 ? (gx + 1) * ts - x0 : x0 - gx * ts) / Math.abs(dx) : Infinity;
      let tMaxY = dy !== 0 ? (dy > 0 ? (gy + 1) * ts - y0 : y0 - gy * ts) / Math.abs(dy) : Infinity;
      for (let guard = 0; guard < 10000; guard++) {
        let t;
        if (tMaxX < tMaxY) { gx += stepX; t = tMaxX; tMaxX += tDeltaX; } else { gy += stepY; t = tMaxY; tMaxY += tDeltaY; }
        if (t > 1) break;
        if (this.hasTile(gx, gy)) {
          best = { x: x0 + dx * t, y: y0 + dy * t, t };
          break;
        }
      }
    }
    for (const s of this.solids) {
      const t = segmentBox(x0, y0, x1, y1, s);
      if (t !== null && (!best || t < best.t)) best = { x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t, t };
    }
    return best;
  }
}

export const collision = new CollisionWorld();
