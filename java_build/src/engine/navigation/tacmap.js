// The three navigation layers of a generated mission (wiki: "Understanding Level Structure"):
//   - NavMesh: fine cells that enemies walk on, inside a room (navmesh.js).
//   - TacMap: a rough corridor graph. Its nodes are room centres and doorway portals; enemies plan a route between
//     rooms through it, then walk each leg on the NavMesh.
//   - Level Blocks: one block per room, with a portal at each doorway. The TacMap is built from them.
// Placeholders: the TacMap nodes are the room centres and the doorway portals only (the wiki gives no node count rule).

const DIR_STEP = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
const OPPOSITE = { n: 's', s: 'n', e: 'w', w: 'e' };

// Level blocks from the generated rooms: { index, rect, role, portals: [{ dir, x, y }] }. A portal sits on the middle of
// the doorway on the room's wall.
export function buildLevelBlocks(rooms = []) {
  return rooms.map((room, index) => {
    const r = room.rect;
    const portals = room.doors.map((dir) => {
      const [dx, dy] = DIR_STEP[dir];
      const x = dx > 0 ? r.x + r.w : dx < 0 ? r.x : r.x + r.w / 2;
      const y = dy > 0 ? r.y + r.h : dy < 0 ? r.y : r.y + r.h / 2;
      return { dir, x, y };
    });
    return { index, rect: r, role: room.role, portals };
  });
}

export class TacMap {
  // blocks: the level blocks (buildLevelBlocks); rooms are linked through their portals
  constructor(blocks, rooms) {
    this.blocks = blocks;
    this.rooms = rooms;
    this.nodes = new Map(); // id -> { id, x, y, links: Map<id, cost> }
    for (const block of blocks) {
      const c = this.addNode(`c${block.index}`, block.rect.x + block.rect.w / 2, block.rect.y + block.rect.h / 2);
      for (const portal of block.portals) {
        const p = this.addNode(`p${block.index}${portal.dir}`, portal.x, portal.y);
        this.link(c, p);
      }
    }
    // A doorway joins the portal on each side: room a's east portal to room b's west portal, and so on
    for (const block of blocks) {
      for (const portal of block.portals) {
        const [dx, dy] = DIR_STEP[portal.dir];
        const other = blocks.find((b) => b.rect.x === block.rect.x + dx * block.rect.w && b.rect.y === block.rect.y + dy * block.rect.h);
        if (!other) continue;
        const mine = this.nodes.get(`p${block.index}${portal.dir}`);
        const theirs = this.nodes.get(`p${other.index}${OPPOSITE[portal.dir]}`);
        if (mine && theirs) this.link(mine, theirs);
      }
    }
  }

  addNode(id, x, y) {
    const node = { id, x, y, links: new Map() };
    this.nodes.set(id, node);
    return node;
  }

  link(a, b) {
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    a.links.set(b.id, d);
    b.links.set(a.id, d);
  }

  // The level block containing (x, y), or null
  blockAt(x, y) {
    return this.blocks.find((b) => x >= b.rect.x && x < b.rect.x + b.rect.w && y >= b.rect.y && y < b.rect.y + b.rect.h) ?? null;
  }

  // Route between two points as a list of waypoints (portals and room centres), shortest first. Returns [] when the
  // points are in the same block, outside every block, or not connected.
  route(fromX, fromY, toX, toY) {
    const from = this.blockAt(fromX, fromY), to = this.blockAt(toX, toY);
    if (!from || !to || from === to) return [];
    const start = `c${from.index}`, goal = `c${to.index}`;
    const dist = new Map([[start, 0]]);
    const prev = new Map();
    const open = new Set([start]);
    const done = new Set();
    while (open.size) {
      let cur = null;
      for (const id of open) if (cur === null || dist.get(id) < dist.get(cur)) cur = id;
      open.delete(cur);
      if (cur === goal) break;
      done.add(cur);
      for (const [next, cost] of this.nodes.get(cur).links) {
        if (done.has(next)) continue;
        const d = dist.get(cur) + cost;
        if (d < (dist.get(next) ?? Infinity)) { dist.set(next, d); prev.set(next, cur); open.add(next); }
      }
    }
    if (!prev.has(goal)) return [];
    const ids = [goal];
    while (prev.has(ids[0])) ids.unshift(prev.get(ids[0]));
    // Keep the waypoints, not the start room's own centre
    return ids.slice(1).map((id) => ({ x: this.nodes.get(id).x, y: this.nodes.get(id).y }));
  }
}
