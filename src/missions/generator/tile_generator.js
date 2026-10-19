// Procedural mission map from room tiles, following the wiki's Tile Set rules (https://wiki.warframe.com/w/Tile_Set):
//   - tiles (rooms) connect through doors, and the layout is a tree: no circular paths, branches end in dead ends
//   - each tile has a role: Start, Connector (hallway), Intermediate (large combat room), Objective, Dead end, Exit
//   - dead-end rooms usually hold storage containers and lockers
// The output has the same shape as the hand-made maps in src/missions/maps, plus entities (lockers, containers,
// pads), spawn points and the rooms. Tile and room sizes are our own choices: the wiki does not publish them.
// Where the wiki gives no numbers (how many lockers, how often each locker kind appears) the values below are
// placeholders, marked as such.

export const TILE_SIZE = 96;      // units (15 units = 1 m): a tile is 6.4 m, so a room is about 45 m x 32 m
export const ROOM_W = 7;          // tiles across a room (walls included)
export const ROOM_H = 5;          // tiles down a room (walls included)
const MID_X = Math.floor(ROOM_W / 2);
const MID_Y = Math.floor(ROOM_H / 2);

export const ROOM_ROLES = ['start', 'connector', 'intermediate', 'objective', 'dead end', 'exit'];

// Gates across some doorways: the chance a doorway gets one, and how thick the bar is (units)
const GATE_CHANCE = 0.5;   // placeholder: the wiki gives no gate rule for this game
const GATE_THICKNESS = 8;

const DIRS = {
  n: { dx: 0, dy: -1, opposite: 's' },
  s: { dx: 0, dy: 1, opposite: 'n' },
  e: { dx: 1, dy: 0, opposite: 'w' },
  w: { dx: -1, dy: 0, opposite: 'e' },
};

// Sizes of the props (px)
export const LOCKER_SIZE = { long: 64, deep: 44 };   // a locker is 64 along the wall and 44 deep
export const CONTAINER_SIZE = 56;

// Placeholder shares (the wiki gives neither): how often each locker kind appears, and how often a container is rarer
// A dead locker (black, never opens) is rare. Placeholder: the wiki does not give a share.
const DEAD_LOCKER_CHANCE = 0.05;
// Wiki (Container): Rare 2% and Reinforced 0.5% of containers. Uncommon's share is a placeholder.
const CONTAINER_KINDS = [['reinforced', 0.005], ['rare', 0.02], ['uncommon', 0.2]];

// Seeded random so the same seed always gives the same map (mulberry32)
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const key = (gx, gy) => `${gx},${gy}`;

// Builds the room tree. Returns [{ gx, gy, role, doors: Set<'n'|'s'|'e'|'w'>, parent, depth }]
export function buildRoomTree({ roomCount = 8, seed = 1 } = {}) {
  const rand = seededRandom(seed);
  const rooms = [];
  const byKey = new Map();
  const add = (gx, gy, parent, dir) => {
    const room = { gx, gy, role: 'connector', doors: new Set(), parent, depth: parent ? parent.depth + 1 : 0 };
    rooms.push(room);
    byKey.set(key(gx, gy), room);
    if (parent) {
      parent.doors.add(dir);
      room.doors.add(DIRS[dir].opposite);
    }
    return room;
  };

  add(0, 0, null, null).role = 'start';

  let guard = 0;
  while (rooms.length < roomCount && guard++ < roomCount * 50) {
    const parent = rooms[Math.floor(rand() * rooms.length)];
    const options = Object.keys(DIRS).filter((d) => {
      const nx = parent.gx + DIRS[d].dx;
      const ny = parent.gy + DIRS[d].dy;
      return !byKey.has(key(nx, ny)) && !parent.doors.has(d);
    });
    if (!options.length) continue;
    const dir = options[Math.floor(rand() * options.length)];
    add(parent.gx + DIRS[dir].dx, parent.gy + DIRS[dir].dy, parent, dir);
  }

  assignRoles(rooms, rand);
  return rooms;
}

// Leaves are the candidate dead ends. The deepest leaves become the objective and the exit,
// and the rest of the leaves are dead ends. Other rooms are hallways (connectors) or combat rooms (intermediate).
function assignRoles(rooms, rand) {
  const leaves = rooms.filter((r) => r.role !== 'start' && r.doors.size === 1);
  leaves.sort((a, b) => b.depth - a.depth);
  if (leaves[0]) leaves[0].role = 'objective';
  if (leaves[1]) leaves[1].role = 'exit';
  for (const leaf of leaves.slice(2)) leaf.role = 'dead end';
  // The spawn room: the deepest room that is not the start, the objective or the exit. Enemies only come from it.
  const spawnRoom = rooms
    .filter((r) => !['start', 'objective', 'exit'].includes(r.role))
    .sort((a, b) => b.depth - a.depth)[0];
  if (spawnRoom) spawnRoom.role = 'spawn';
  for (const room of rooms) {
    if (room.role === 'connector' && room.doors.size > 1) {
      room.role = rand() < 0.4 ? 'intermediate' : 'connector';
    }
  }
}

// ---- Room templates -------------------------------------------------------------------------------------------
// Cells are [i, j] inside a room (0..ROOM_W-1, 0..ROOM_H-1). The outer ring is wall, with a one-tile door gap in the
// middle of each side that has a door. The middle row and column of the interior (the "cross") are always kept free,
// so every door of a room reaches every other door.

const isCross = (i, j) => i === MID_X || j === MID_Y;

function interiorCells() {
  const cells = [];
  for (let j = 1; j < ROOM_H - 1; j++) for (let i = 1; i < ROOM_W - 1; i++) cells.push([i, j]);
  return cells;
}

// Extra wall cells inside a room, by role
// The room shapes of the wiki's tile set (see the tile set image). Each shape is wall cells inside a 7 x 5 room. The cross
// stays open in every shape, so every door of a room reaches every other door, and rooms never overlap (the grid).
//   start:        a notch cut out of three corners
//   connector:    a hallway, only the cross is open (a T or a bend through its doors)
//   intermediate: a big combat room with a block of two cells on one side and a column of single cells on the other
//   objective:    an octagon (corners cut) with four pillars
//   spawn:        a small chamber in the middle, with the cross running out to its doors
const SHAPE_CELLS = {
  start: [[1, 1], [1, ROOM_H - 2], [ROOM_W - 2, ROOM_H - 2]],
  intermediate: [[1, 1], [2, 1], [1, ROOM_H - 2], [2, ROOM_H - 2], [ROOM_W - 2, 1], [ROOM_W - 2, ROOM_H - 2]],
  objective: [[1, 1], [ROOM_W - 2, 1], [1, ROOM_H - 2], [ROOM_W - 2, ROOM_H - 2], [2, 1], [ROOM_W - 3, 1], [2, ROOM_H - 2], [ROOM_W - 3, ROOM_H - 2]],
};

function templateWalls(role) {
  if (role === 'connector') return interiorCells().filter(([i, j]) => !isCross(i, j));
  if (role === 'spawn') return interiorCells().filter(([i, j]) => !isCross(i, j) && !(i >= 2 && i <= ROOM_W - 3 && j >= 1 && j <= ROOM_H - 2));
  return SHAPE_CELLS[role] ?? [];
}

function borderCells(room) {
  const cells = [];
  for (let j = 0; j < ROOM_H; j++) {
    for (let i = 0; i < ROOM_W; i++) {
      if (!(i === 0 || j === 0 || i === ROOM_W - 1 || j === ROOM_H - 1)) continue;
      const gap =
        (i === 0 && j === MID_Y && room.doors.has('w')) ||
        (i === ROOM_W - 1 && j === MID_Y && room.doors.has('e')) ||
        (j === 0 && i === MID_X && room.doors.has('n')) ||
        (j === ROOM_H - 1 && i === MID_X && room.doors.has('s'));
      if (!gap) cells.push([i, j]);
    }
  }
  return cells;
}

function shuffle(list, rand) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const k = Math.floor(rand() * (i + 1));
    [a[i], a[k]] = [a[k], a[i]];
  }
  return a;
}

function pickKind(table, rand, fallback) {
  const roll = rand();
  let acc = 0;
  for (const [kind, share] of table) {
    acc += share;
    if (roll < acc) return kind;
  }
  return fallback;
}

// A locker flush against the wall on `facing`'s opposite side, facing into the room. Returns a rect (top-left corner).
function lockerRect(originX, originY, i, j, facing) {
  const T = TILE_SIZE, { long, deep } = LOCKER_SIZE;
  const cx = originX + i * T, cy = originY + j * T;
  if (facing === 'n') return { x: cx + (T - long) / 2, y: cy + T - deep, w: long, h: deep };   // on the south wall
  if (facing === 's') return { x: cx + (T - long) / 2, y: cy, w: long, h: deep };               // on the north wall
  if (facing === 'e') return { x: cx, y: cy + (T - long) / 2, w: deep, h: long };               // on the west wall
  return { x: cx + T - deep, y: cy + (T - long) / 2, w: deep, h: long };                        // on the east wall
}

function containerRect(originX, originY, i, j) {
  const T = TILE_SIZE;
  return { x: originX + i * T + (T - CONTAINER_SIZE) / 2, y: originY + j * T + (T - CONTAINER_SIZE) / 2, w: CONTAINER_SIZE, h: CONTAINER_SIZE };
}

const CORNERS = [[1, 1], [ROOM_W - 2, 1], [1, ROOM_H - 2], [ROOM_W - 2, ROOM_H - 2]];

// Props for a room: lockers and containers in dead ends (wiki), a few containers in combat rooms,
// and a marker pad in the objective and exit rooms. Returns { entities, usedCells }.
function roomProps(room, originX, originY, rand, nextId) {
  const entities = [];
  const used = new Set();
  const T = TILE_SIZE;

  if (room.role === 'objective' || room.role === 'exit') {
    entities.push({ id: nextId('pad'), type: 'pad', role: room.role === 'exit' ? 'exit' : 'objective', x: originX + MID_X * T + T / 2, y: originY + MID_Y * T + T / 2 });
    used.add(key(MID_X, MID_Y));
  }

  if (room.role === 'dead end') {
    const door = [...room.doors][0];
    // A row of four lockers along the wall opposite the door, side by side (how they usually appear in the game).
    // Each is green or red at random; a dead locker (black) is rare. The row covers the whole wall, so the
    // containers go to the corners left over.
    const facing = door; // the lockers stand on the wall opposite the door and face the door, into the room
    const LOCKER_ROW = 4;
    // The row fits the interior of the wall, with a small margin at each end and even gaps between lockers
    const interior = ((facing === 'n' || facing === 's') ? ROOM_W : ROOM_H) - 2;
    const span = interior * TILE_SIZE;
    const margin = 8;
    const PITCH = LOCKER_SIZE.long + (span - 2 * margin - LOCKER_ROW * LOCKER_SIZE.long) / (LOCKER_ROW - 1);
    const rowStart = TILE_SIZE + margin;                      // the first interior tile, inside the margin
    for (let k = 0; k < LOCKER_ROW; k++) {
      const along = rowStart + k * PITCH;
      let r;
      if (facing === 'n') r = { x: originX + along, y: originY + (ROOM_H - 1) * TILE_SIZE - LOCKER_SIZE.deep, w: LOCKER_SIZE.long, h: LOCKER_SIZE.deep };
      else if (facing === 's') r = { x: originX + along, y: originY + TILE_SIZE, w: LOCKER_SIZE.long, h: LOCKER_SIZE.deep };
      else if (facing === 'e') r = { x: originX + TILE_SIZE, y: originY + along, w: LOCKER_SIZE.deep, h: LOCKER_SIZE.long };
      else r = { x: originX + (ROOM_W - 1) * TILE_SIZE - LOCKER_SIZE.deep, y: originY + along, w: LOCKER_SIZE.deep, h: LOCKER_SIZE.long };
      const kind = rand() < DEAD_LOCKER_CHANCE ? 'black' : (rand() < 0.5 ? 'green' : 'red');
      entities.push({ id: nextId('locker'), type: 'locker', kind, facing, ...r });
    }
    // The row takes the interior cells along that wall
    for (let t = 1; t < (facing === 'n' || facing === 's' ? ROOM_W : ROOM_H) - 1; t++) {
      const [i, j] = facing === 'n' ? [t, ROOM_H - 2] : facing === 's' ? [t, 1] : facing === 'e' ? [1, t] : [ROOM_W - 2, t];
      used.add(key(i, j));
    }
    const containerCount = 2 + Math.floor(rand() * 2);                   // storage containers fill the corners
    for (const [i, j] of shuffle(CORNERS, rand).filter(([ci, cj]) => !used.has(key(ci, cj))).slice(0, containerCount)) {
      const r = containerRect(originX, originY, i, j);
      entities.push({ id: nextId('container'), type: 'container', kind: pickKind(CONTAINER_KINDS, rand, 'common'), ...r });
      used.add(key(i, j));
    }
  } else if (room.role === 'intermediate') {
    // Containers sit beside the shape's walls, never in them and never in front of a door
    // The free cells beside the block and the column of the intermediate shape (never a wall, never the cross)
    const shapeWalls = new Set(templateWalls(room.role).map(([i, j]) => key(i, j)));
    const spots = [[ROOM_W - 3, 1], [ROOM_W - 3, ROOM_H - 2]].filter(([i, j]) => !isCross(i, j) && !shapeWalls.has(key(i, j)));
    for (const [i, j] of shuffle(spots, rand).slice(0, 2)) {
      if (rand() < 0.5) continue;
      const r = containerRect(originX, originY, i, j);
      entities.push({ id: nextId('container'), type: 'container', kind: pickKind(CONTAINER_KINDS, rand, 'common'), ...r });
      used.add(key(i, j));
    }
  }
  return { entities, used };
}

// ---- The map --------------------------------------------------------------------------------------------------

function generateOnce(options) {
  const rooms = buildRoomTree(options);
  const rand = seededRandom((options.seed ?? 1) * 7919 + 13); // props use their own stream, so the layout stays the same
  const minX = Math.min(...rooms.map((r) => r.gx));
  const minY = Math.min(...rooms.map((r) => r.gy));
  const maxX = Math.max(...rooms.map((r) => r.gx));
  const maxY = Math.max(...rooms.map((r) => r.gy));
  const roomPxW = ROOM_W * TILE_SIZE;
  const roomPxH = ROOM_H * TILE_SIZE;

  let counter = 0;
  const nextId = (prefix) => `${prefix}${counter++}`;
  const walls = [];
  const entities = [];
  const spawnPoints = [];

  for (const room of rooms) {
    const originX = (room.gx - minX) * roomPxW;
    const originY = (room.gy - minY) * roomPxH;
    for (const [i, j] of [...borderCells(room), ...templateWalls(room.role)]) {
      walls.push({ x: originX + i * TILE_SIZE, y: originY + j * TILE_SIZE });
    }
    const props = roomProps(room, originX, originY, rand, nextId);
    entities.push(...props.entities);
    room.cellOrigin = { x: originX, y: originY };

    // Enemies may spawn on free floor in every room except the start room
    if (room.role === 'spawn') {
      const blocked = new Set(templateWalls(room.role).map(([i, j]) => key(i, j)));
      for (const [i, j] of interiorCells()) {
        if (blocked.has(key(i, j)) || props.used.has(key(i, j))) continue;
        spawnPoints.push({ x: originX + i * TILE_SIZE + TILE_SIZE / 2, y: originY + j * TILE_SIZE + TILE_SIZE / 2, room: room.role });
      }
    }
  }

  // A gate closes each doorway it gets (east and south only, so each doorway is handled once). It is a thin bar across
  // the opening, closed until a player opens it (see pickups/lootable.js Gate).
  const gateRand = seededRandom((options.seed ?? 1) * 104729 + 7);
  for (const room of rooms) {
    for (const dir of ['e', 's']) {
      if (!room.doors.has(dir)) continue;
      const other = rooms.find((r) => r.gx === room.gx + DIRS[dir].dx && r.gy === room.gy + DIRS[dir].dy);
      // Doorways of the spawn room always have a gate, so the enemies stay in until the Warframe comes close
      const forced = room.role === 'spawn' || other.role === 'spawn';
      if (!other || (!forced && gateRand() >= GATE_CHANCE)) continue;
      const o = room.cellOrigin;
      const bar = dir === 'e'
        ? { x: o.x + ROOM_W * TILE_SIZE - GATE_THICKNESS / 2, y: o.y + MID_Y * TILE_SIZE, w: GATE_THICKNESS, h: TILE_SIZE, orientation: 'v' }
        : { x: o.x + MID_X * TILE_SIZE, y: o.y + ROOM_H * TILE_SIZE - GATE_THICKNESS / 2, w: TILE_SIZE, h: GATE_THICKNESS, orientation: 'h' };
      entities.push({ id: nextId('gate'), type: 'gate', ...bar });
    }
  }

  const start = rooms.find((r) => r.role === 'start');
  // The objective room's pad: where a Defense objective (the cryo pod) stands
  const objectivePad = entities.find((e) => e.type === 'pad' && e.role === 'objective');
  return {
    generated: true,
    objectiveSpot: objectivePad ? { x: objectivePad.x, y: objectivePad.y } : null,
    bounds: { width: (maxX - minX + 1) * roomPxW, height: (maxY - minY + 1) * roomPxH },
    tiles: { tileSize: TILE_SIZE, layers: { floor: [], walls } },
    playerStart: {
      x: start.cellOrigin.x + MID_X * TILE_SIZE + TILE_SIZE / 2,
      y: start.cellOrigin.y + MID_Y * TILE_SIZE + TILE_SIZE / 2,
    },
    entities,
    spawnPoints,
    rooms: rooms.map((r) => ({
      x: r.gx - minX, y: r.gy - minY, role: r.role, doors: [...r.doors],
      rect: { x: r.cellOrigin.x, y: r.cellOrigin.y, w: ROOM_W * TILE_SIZE, h: ROOM_H * TILE_SIZE }, // pixels, for hearing
    })),
  };
}

// Checks a map: every room and prop is reachable from the start on foot, nothing sits in a wall or on another prop,
// and the player starts on open floor. Returns a list of problems (empty when the map is good).
export function validateMap(map) {
  const problems = [];
  const T = map.tiles.tileSize;
  const wallSet = new Set(map.tiles.layers.walls.map((w) => key(Math.round(w.x / T), Math.round(w.y / T))));
  const gw = Math.round(map.bounds.width / T), gh = Math.round(map.bounds.height / T);
  const cellOf = (x, y) => [Math.floor(x / T), Math.floor(y / T)];

  // Flood fill over floor tiles from the player's tile
  const [sx, sy] = cellOf(map.playerStart.x, map.playerStart.y);
  if (wallSet.has(key(sx, sy))) problems.push('player starts inside a wall');
  const reached = new Set([key(sx, sy)]);
  const queue = [[sx, sy]];
  while (queue.length) {
    const [x, y] = queue.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
      const k = key(nx, ny);
      if (wallSet.has(k) || reached.has(k)) continue;
      reached.add(k);
      queue.push([nx, ny]);
    }
  }

  for (const room of map.rooms) {
    const [cx, cy] = [room.x * ROOM_W + MID_X, room.y * ROOM_H + MID_Y];
    if (!reached.has(key(cx, cy))) problems.push(`room ${room.role} at ${room.x},${room.y} is not reachable`);
  }

  const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const props = map.entities.filter((e) => e.w);
  for (const e of map.entities) {
    const [ex, ey] = e.w ? cellOf(e.x + e.w / 2, e.y + e.h / 2) : cellOf(e.x, e.y);
    if (wallSet.has(key(ex, ey))) problems.push(`${e.type} ${e.id} sits in a wall`);
    if (!reached.has(key(ex, ey))) problems.push(`${e.type} ${e.id} is not reachable`);
    if (e.type === 'locker') {
      // The tile in front of a locker must be open floor that can be reached
      const d = DIRS[e.facing];
      if (!reached.has(key(ex + d.dx, ey + d.dy))) problems.push(`locker ${e.id} has no open floor in front of it`);
    }
  }
  for (let a = 0; a < props.length; a++) {
    for (let b = a + 1; b < props.length; b++) if (overlaps(props[a], props[b])) problems.push(`${props[a].id} overlaps ${props[b].id}`);
  }
  for (const p of map.spawnPoints) {
    const [px, py] = cellOf(p.x, p.y);
    if (wallSet.has(key(px, py)) || !reached.has(key(px, py))) problems.push('a spawn point is not on reachable floor');
    if (props.some((e) => p.x >= e.x && p.x <= e.x + e.w && p.y >= e.y && p.y <= e.y + e.h)) problems.push('a spawn point is inside a prop');
  }
  if (!map.spawnPoints.length) problems.push('no spawn points');
  return problems;
}

// Full mission map. Tries the seed and the next ones until the map passes validateMap (it should on the first try).
export function generateMissionMap(options = {}) {
  const seed = options.seed ?? 1;
  let map = null;
  for (let attempt = 0; attempt < 20; attempt++) {
    map = generateOnce({ ...options, seed: seed + attempt });
    map.seed = seed + attempt;
    if (validateMap(map).length === 0) return map;
  }
  return map;
}
