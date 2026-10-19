// The Defense arena (wiki: "Defense"): one large open floor with the objective in the middle and the enemies coming in
// from every direction. Built on the same tile grid as the generated rooms, so the navmesh and the TacMap work on it.
// Layout: a ring of wall around the edge, four blocks of cover around the middle, and spawn points along the inside of
// the edge, so enemies arrive from all sides. Placeholders: the arena size and the cover layout (the wiki gives no
// numbers for either).
import { TILE_SIZE } from './tile_generator.js';

export const ARENA = { cols: 16, rows: 12 }; // tiles, walls included (about 100 m x 77 m)

export function generateArenaMap() {
  const { cols, rows } = ARENA;
  const walls = [];
  const wallAt = new Set();
  const addWall = (i, j) => {
    if (wallAt.has(`${i},${j}`)) return;
    wallAt.add(`${i},${j}`);
    walls.push({ x: i * TILE_SIZE, y: j * TILE_SIZE });
  };
  // The outer ring
  for (let i = 0; i < cols; i++) { addWall(i, 0); addWall(i, rows - 1); }
  for (let j = 0; j < rows; j++) { addWall(0, j); addWall(cols - 1, j); }
  // Cover: 2 x 2 blocks, four in the corners of the inner field and four on the edges, leaving the middle and the lanes open
  const cover = [[3, 3], [cols - 5, 3], [3, rows - 5], [cols - 5, rows - 5], [Math.floor(cols / 2) - 1, 3], [Math.floor(cols / 2) - 1, rows - 5], [3, Math.floor(rows / 2) - 1], [cols - 5, Math.floor(rows / 2) - 1]];
  for (const [ci, cj] of cover) {
    for (let di = 0; di < 2; di++) for (let dj = 0; dj < 2; dj++) addWall(ci + di, cj + dj);
  }
  // Spawn points: the inside of the edge all round (two tiles in from the wall), away from the cover
  const spawnPoints = [];
  for (let i = 1; i < cols - 1; i++) {
    for (let j = 1; j < rows - 1; j++) {
      const edge = i <= 2 || i >= cols - 3 || j <= 2 || j >= rows - 3;
      if (!edge || wallAt.has(`${i},${j}`)) continue;
      spawnPoints.push({ x: i * TILE_SIZE + TILE_SIZE / 2, y: j * TILE_SIZE + TILE_SIZE / 2, room: 'arena' });
    }
  }
  const bounds = { width: cols * TILE_SIZE, height: rows * TILE_SIZE };
  const centre = { x: (cols / 2) * TILE_SIZE, y: (rows / 2) * TILE_SIZE };
  return {
    generated: true,
    arena: true,
    bounds,
    tiles: { tileSize: TILE_SIZE, layers: { floor: [], walls } },
    playerStart: { x: centre.x, y: (rows - 3) * TILE_SIZE + TILE_SIZE / 2 }, // at the bottom, clear of the cover
    entities: [],
    spawnPoints,
    objectiveSpot: centre, // the cryopod in the middle
    // One room: the whole arena. Used for hearing (every enemy hears shots in the arena) and patrols
    rooms: [{ x: 0, y: 0, role: 'arena', doors: [], rect: { x: 0, y: 0, w: bounds.width, h: bounds.height } }],
  };
}
