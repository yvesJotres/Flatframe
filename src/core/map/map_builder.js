import { TileMap } from './tilemap.js';

export class MapBuilder {
  static build(mapData, sceneEntities) {
    // Clear and build static environment
    sceneEntities.length = 0;

    // Create TileMap
    const tileMap = new TileMap(mapData.tiles);
    
    // Add walls as physical objects for collision (if required later)
    // or keep them just for rendering within the TileMap
    
    return {
      tileMap,
      playerStart: mapData.playerStart,
      spawns: mapData.spawns,
      entities: mapData.entities || []
    };
  }
}
