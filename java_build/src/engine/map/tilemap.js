import { Tile } from './tile.js';

export class TileMap {
  constructor(data) {
    this.tileSize = data.tileSize || 64;
    this.layers = data.layers || {}; // e.g., { floor: [...], walls: [...] }
  }

  draw(ctx, camera = { x: 0, y: 0 }) {
    // Basic tile rendering
    for (const [layerName, tiles] of Object.entries(this.layers)) {
      tiles.forEach(t => {
        const tile = new Tile(t.x, t.y, this.tileSize, layerName === 'walls' ? 'wall' : 'floor');
        tile.draw(ctx);
      });
    }
  }
}
