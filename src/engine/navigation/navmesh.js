import { GRID_SIZE } from '../constants.js';

/**
 * NavMesh Cell - represents a walkable area in the navigation mesh
 */
export class NavCell {
  constructor(x, y, size) {
    this.x = x;           // world X (center)
    this.y = y;           // world Y (center)
    this.size = size;     // cell size (diameter)
    this.halfSize = size / 2;
    this.neighbors = [];  // connected cells
    this.walkable = true;
    this.cost = 1;        // traversal cost multiplier
  }

  contains(x, y) {
    return x >= this.x - this.halfSize && x <= this.x + this.halfSize &&
           y >= this.y - this.halfSize && y <= this.y + this.halfSize;
  }

  distanceTo(other) {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    return Math.hypot(dx, dy);
  }
}

/**
 * Navigation Mesh - grid-based with A* pathfinding
 */
export class NavMesh {
  constructor(tilemap, options = {}) {
    this.tilemap = tilemap;
    this.cellSize = options.cellSize || GRID_SIZE * 2; // 2m cells (30px)
    this.cells = [];
    this.cellMap = new Map(); // spatial hash: "gx,gy" -> cell
    this.width = 0;
    this.height = 0;
    this.worldOriginX = 0;
    this.worldOriginY = 0;
    
    this.build(options);
  }

  build(options = {}) {
    if (!this.tilemap || !this.tilemap.layers?.walls?.length) {
      // No walls - create open grid based on provided bounds or canvas
      const width = options.width || (typeof window !== 'undefined' && window.gameCanvas ? window.gameCanvas.width : 1600);
      const height = options.height || (typeof window !== 'undefined' && window.gameCanvas ? window.gameCanvas.height : 1200);
      this.width = Math.ceil(width / this.cellSize);
      this.height = Math.ceil(height / this.cellSize);
      this.worldOriginX = 0;
      this.worldOriginY = 0;
      this.createOpenGrid();
      return;
    }

    // Find world bounds from walls
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const wall of this.tilemap.layers.walls) {
      minX = Math.min(minX, wall.x);
      minY = Math.min(minY, wall.y);
      maxX = Math.max(maxX, wall.x + this.tilemap.tileSize);
      maxY = Math.max(maxY, wall.y + this.tilemap.tileSize);
    }

    // Add padding
    const padding = this.cellSize * 2;
    minX -= padding; minY -= padding;
    maxX += padding; maxY += padding;

    this.width = Math.ceil((maxX - minX) / this.cellSize);
    this.height = Math.ceil((maxY - minY) / this.cellSize);
    const originX = minX;
    const originY = minY;
    this.worldOriginX = originX;
    this.worldOriginY = originY;

    // Create grid of cells
    for (let gy = 0; gy < this.height; gy++) {
      for (let gx = 0; gx < this.width; gx++) {
        const cx = originX + gx * this.cellSize + this.cellSize / 2;
        const cy = originY + gy * this.cellSize + this.cellSize / 2;
        const cell = new NavCell(cx, cy, this.cellSize);
        this.cells.push(cell);
        this.cellMap.set(`${gx},${gy}`, cell);
      }
    }

    // Mark cells blocked by walls
    for (const wall of this.tilemap.layers.walls) {
      const wx = wall.x;
      const wy = wall.y;
      const ws = this.tilemap.tileSize;
      
      // Check all cells overlapping this wall
      const startGX = Math.floor((wx - originX) / this.cellSize);
      const startGY = Math.floor((wy - originY) / this.cellSize);
      const endGX = Math.floor((wx + ws - originX) / this.cellSize);
      const endGY = Math.floor((wy + ws - originY) / this.cellSize);

      for (let gy = startGY; gy <= endGY; gy++) {
        for (let gx = startGX; gx <= endGX; gx++) {
          const key = `${gx},${gy}`;
          const cell = this.cellMap.get(key);
          if (cell) {
            // Check if cell center is inside wall bounds
            if (cell.x >= wx && cell.x <= wx + ws && cell.y >= wy && cell.y <= wy + ws) {
              cell.walkable = false;
            }
          }
        }
      }
    }

    // Build neighbor connections (8-directional)
    const dirs = [
      [1, 0], [-1, 0], [0, 1], [0, -1],  // cardinal
      [1, 1], [1, -1], [-1, 1], [-1, -1] // diagonal
    ];

    for (const cell of this.cells) {
      if (!cell.walkable) continue;
      
      // Find cell's grid coordinates
      const gx = Math.round((cell.x - originX) / this.cellSize);
      const gy = Math.round((cell.y - originY) / this.cellSize);

      for (const [dx, dy] of dirs) {
        const nx = gx + dx;
        const ny = gy + dy;
        const neighbor = this.cellMap.get(`${nx},${ny}`);
        
        if (neighbor && neighbor.walkable) {
          // For diagonal, check corner cutting
          if (dx !== 0 && dy !== 0) {
            const n1 = this.cellMap.get(`${gx + dx},${gy}`);
            const n2 = this.cellMap.get(`${gx},${gy + dy}`);
            if ((n1 && !n1.walkable) || (n2 && !n2.walkable)) {
              continue; // Don't cut corners
            }
            cell.neighbors.push({ cell: neighbor, cost: 1.414 }); // sqrt(2)
          } else {
            cell.neighbors.push({ cell: neighbor, cost: 1.0 });
          }
        }
      }
    }

    this.originX = originX;
    this.originY = originY;
  }

  createOpenGrid() {
      const width = this.width;
      const height = this.height;
      const cellSize = this.cellSize;
      const originX = this.worldOriginX || 0;
      const originY = this.worldOriginY || 0;

      for (let gy = 0; gy < height; gy++) {
        for (let gx = 0; gx < width; gx++) {
          const cx = originX + gx * cellSize + cellSize / 2;
          const cy = originY + gy * cellSize + cellSize / 2;
          const cell = new NavCell(cx, cy, cellSize);
          this.cells.push(cell);
          this.cellMap.set(`${gx},${gy}`, cell);
        }
      }

      // Connect all neighbors
      const dirs = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
      for (const cell of this.cells) {
        const gx = Math.round((cell.x - originX) / cellSize);
        const gy = Math.round((cell.y - originY) / cellSize);
      
        for (const [dx, dy] of dirs) {
          const neighbor = this.cellMap.get(`${gx + dx},${gy + dy}`);
          if (neighbor) {
            cell.neighbors.push({ cell: neighbor, cost: dx !== 0 && dy !== 0 ? 1.414 : 1.0 });
          }
        }
      }
      this.originX = originX;
      this.originY = originY;
    }

  /**
   * Get the nearest walkable cell to a world position
   */
  /** True when the world point is inside a walkable cell (walls and outside the map are not). */
  isWalkableAt(x, y) {
    const gx = Math.floor((x - this.worldOriginX) / this.cellSize);
    const gy = Math.floor((y - this.worldOriginY) / this.cellSize);
    return !!this.cellMap.get(`${gx},${gy}`)?.walkable;
  }

  getNearestCell(x, y) {
    let best = null;
    let bestDist = Infinity;
    
    for (const cell of this.cells) {
      if (!cell.walkable) continue;
      const dist = Math.hypot(cell.x - x, cell.y - y);
      if (dist < bestDist) {
        bestDist = dist;
        best = cell;
      }
    }
    return best;
  }

  /**
   * A* pathfinding from start position to goal position
   * Returns array of world positions {x, y} or null if no path
   */
  findPath(startX, startY, goalX, goalY) {
    const startCell = this.getNearestCell(startX, startY);
    const goalCell = this.getNearestCell(goalX, goalY);
    
    if (!startCell || !goalCell || !startCell.walkable || !goalCell.walkable) {
      return null;
    }

    if (startCell === goalCell) {
      return [{ x: goalX, y: goalY }];
    }

    // A* open/closed sets
    const openSet = new Map(); // cell -> { f, g, h, parent }
    const closedSet = new Map(); // cell -> { f, g, h, parent }
    
    // Heuristic: Euclidean distance
    const heuristic = (a, b) => a.distanceTo(b);
    
    openSet.set(startCell, {
      f: heuristic(startCell, goalCell),
      g: 0,
      h: heuristic(startCell, goalCell),
      parent: null
    });

    while (openSet.size > 0) {
      // Find node with lowest f
      let current = null;
      let lowestF = Infinity;
      for (const [cell, data] of openSet) {
        if (data.f < lowestF) {
          lowestF = data.f;
          current = cell;
        }
      }

      if (current === goalCell) {
              // Reconstruct path
              const path = [];
              let node = current;
              let nodeData = openSet.get(node) || closedSet.get(node);
              while (nodeData.parent) {
                path.unshift({ x: node.x, y: node.y });
                node = nodeData.parent;
                nodeData = openSet.get(node) || closedSet.get(node);
              }
              path.unshift({ x: startCell.x, y: startCell.y });
              path.push({ x: goalX, y: goalY }); // Exact goal position
              return path;
            }

            const currentData0 = openSet.get(current);
            openSet.delete(current);
            closedSet.set(current, currentData0);

            const currentData = closedSet.get(current) || { g: 0 };
      const currentG = currentData.g;

      for (const { cell: neighbor, cost } of current.neighbors) {
        if (closedSet.has(neighbor)) continue;

        const tentativeG = currentG + cost * neighbor.cost;
        const existing = openSet.get(neighbor);
        
        if (!existing || tentativeG < existing.g) {
          const h = heuristic(neighbor, goalCell);
          openSet.set(neighbor, {
            f: tentativeG + h,
            g: tentativeG,
            h,
            parent: current
          });
        }
      }
    }

    return null; // No path found
  }

  /**
   * Debug rendering
   */
  draw(ctx, camera) {
    if (!this.cells.length) return;
    
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.1)';
    ctx.lineWidth = 1 / (camera?.zoom || 1);
    
    for (const cell of this.cells) {
      if (!cell.walkable) continue;
      
      const sx = (cell.x - cell.halfSize - camera.x) * camera.zoom;
      const sy = (cell.y - cell.halfSize - camera.y) * camera.zoom;
      const ss = cell.size * camera.zoom;
      
      ctx.strokeRect(sx, sy, ss, ss);
    }
    ctx.restore();
  }
}