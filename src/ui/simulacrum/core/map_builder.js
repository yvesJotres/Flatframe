import SimulacrumConsole from '../entities/simulacrum_console.js';
import { Wall } from '../entities/wall.js';

export class MapBuilder {
  static build(mapData, sceneEntities) {
    // Clear and build static environment
    sceneEntities.length = 0;

    // Add Walls
    mapData.walls.forEach(w => {
      sceneEntities.push(new Wall(w.x, w.y, w.width, w.height));
    });

    // Add Console
    sceneEntities.push(new SimulacrumConsole(mapData.console.x, mapData.console.y));
    
    return {
      playerStart: mapData.playerStart,
      spawns: mapData.spawns
    };
  }
}
