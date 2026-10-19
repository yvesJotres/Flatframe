// Shared wall check for anything that moves in a mission (player, abilities, enemies, spawner).
// It reads the shared collision world (src/engine/collision.js), so every system agrees where the walls are.
// Outside a mission nothing is loaded, so nothing counts as a wall.
import { collision } from '../collision.js';

export function isWallAt(x, y) {
  return collision.isSolidAt(x, y);
}
