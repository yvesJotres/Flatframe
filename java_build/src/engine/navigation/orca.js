/**
 * ORCA (Optimal Reciprocal Collision Avoidance) for 2D
 * Based on: https://gamma.cs.unc.edu/ORCA/
 * Simplified for game use - computes avoidance velocity for an agent
 */

export class ORCA {
  constructor(options = {}) {
    this.agentRadius = options.agentRadius || 16;
    this.neighborDist = options.neighborDist || 100;
    this.maxNeighbors = options.maxNeighbors || 10;
    this.timeHorizon = options.timeHorizon || 2.0;
    this.timeHorizonObst = options.timeHorizonObst || 1.0;
    this.maxSpeed = options.maxSpeed || 150;
  }

  /**
   * Compute avoidance velocity for an agent given nearby agents and obstacles
   * @param {Object} agent - { x, y, vx, vy, radius, maxSpeed }
   * @param {Array} neighbors - Array of { x, y, vx, vy, radius }
   * @param {Array} obstacles - Array of { x, y, radius } (static obstacles)
   * @param {number} dt - Time step
   * @returns {Object} { vx, vy } - new velocity (avoidance + preferred)
   */
  compute(agent, neighbors, obstacles, dt) {
    const candidateVel = { x: agent.vx, y: agent.vy };
    const planeConstraints = [];

    // Agent-agent constraints
    for (const other of neighbors) {
      if (other === agent) continue;
      
      const dx = other.x - agent.x;
      const dy = other.y - agent.y;
      const distSq = dx * dx + dy * dy;
      const combinedRadius = agent.radius + other.radius;
      const combinedRadiusSq = combinedRadius * combinedRadius;

      if (distSq > this.neighborDist * this.neighborDist) continue;
      if (distSq === 0) continue;

      const dist = Math.sqrt(distSq);
      const invDist = 1 / dist;

      // Relative velocity
      const rvx = agent.vx - other.vx;
      const rvy = agent.vy - other.vy;

      // Relative position
      const rpx = dx * invDist;
      const rpy = dy * invDist;

      // Dot product of relative velocity and relative position
      const dot = rvx * rpx + rvy * rpy;

      if (dot < 0 && distSq < combinedRadiusSq) {
        // Collision - project onto the boundary
        const u = dot * invDist;
        planeConstraints.push({
          nx: rpx,
          ny: rpy,
          dist: u
        });
      } else if (distSq < combinedRadiusSq) {
        // Overlapping - push apart
        const overlap = combinedRadius - dist;
        planeConstraints.push({
          nx: rpx,
          ny: rpy,
          dist: overlap * 0.5
        });
      } else if (dot < 0) {
        // Will collide in future - ORCA half-plane
        const timeToCollision = (dist - combinedRadius) / -dot;
        if (timeToCollision < this.timeHorizon) {
          const u = dot + (combinedRadius / timeToCollision);
          planeConstraints.push({
            nx: rpx,
            ny: rpy,
            dist: u
          });
        }
      }
    }

    // Static obstacle constraints
    for (const obs of obstacles) {
      const dx = obs.x - agent.x;
      const dy = obs.y - agent.y;
      const distSq = dx * dx + dy * dy;
      const combinedRadius = agent.radius + obs.radius;
      const combinedRadiusSq = combinedRadius * combinedRadius;

      if (distSq >= combinedRadiusSq) continue;
      if (distSq === 0) continue;

      const dist = Math.sqrt(distSq);
      const invDist = 1 / dist;
      const rpx = dx * invDist;
      const rpy = dy * invDist;

      const overlap = combinedRadius - dist;
      planeConstraints.push({
        nx: rpx,
        ny: rpy,
        dist: overlap * 0.5
      });
    }

    // Linear programming to find optimal velocity
    // Simplified: project preferred velocity onto feasible region
    let bestVX = candidateVel.x;
    let bestVY = candidateVel.y;
    let bestDist = Infinity;

    // Check if current velocity is valid
    if (this.isValid(bestVX, bestVY, planeConstraints, agent.maxSpeed)) {
      return { vx: bestVX, vy: bestVY };
    }

    // Try velocities along constraint boundaries
    for (const c of planeConstraints) {
      // Project preferred velocity onto constraint boundary
      const dot = candidateVel.x * c.nx + candidateVel.y * c.ny;
      const projX = candidateVel.x - c.nx * (dot - c.dist);
      const projY = candidateVel.y - c.ny * (dot - c.dist);
      
      // Clamp to max speed
      const speed = Math.hypot(projX, projY);
      let finalX = projX, finalY = projY;
      if (speed > agent.maxSpeed) {
        const scale = agent.maxSpeed / speed;
        finalX *= scale;
        finalY *= scale;
      }

      if (this.isValid(finalX, finalY, planeConstraints, agent.maxSpeed)) {
        const dist = Math.hypot(finalX - candidateVel.x, finalY - candidateVel.y);
        if (dist < bestDist) {
          bestDist = dist;
          bestVX = finalX;
          bestVY = finalY;
        }
      }
    }

    // If still no valid velocity, try zero velocity
    if (!this.isValid(bestVX, bestVY, planeConstraints, agent.maxSpeed)) {
      if (this.isValid(0, 0, planeConstraints, agent.maxSpeed)) {
        return { vx: 0, vy: 0 };
      }
      // Last resort: move directly away from closest obstacle
      for (const c of planeConstraints) {
        const testX = -c.nx * agent.maxSpeed;
        const testY = -c.ny * agent.maxSpeed;
        if (this.isValid(testX, testY, planeConstraints, agent.maxSpeed)) {
          return { vx: testX, vy: testY };
        }
      }
    }

    return { vx: bestVX, vy: bestVY };
  }

  isValid(vx, vy, constraints, maxSpeed) {
    const speed = Math.hypot(vx, vy);
    if (speed > maxSpeed + 0.01) return false;

    for (const c of constraints) {
      const dot = vx * c.nx + vy * c.ny;
      if (dot < c.dist - 0.01) return false;
    }
    return true;
  }
}

/**
 * Simple spatial grid for efficient neighbor queries
 */
export class SpatialGrid {
  constructor(cellSize = 100) {
    this.cellSize = cellSize;
    this.grid = new Map();
  }

  clear() {
    this.grid.clear();
  }

  getKey(x, y) {
    const gx = Math.floor(x / this.cellSize);
    const gy = Math.floor(y / this.cellSize);
    return `${gx},${gy}`;
  }

  insert(entity) {
    const key = this.getKey(entity.x, entity.y);
    if (!this.grid.has(key)) this.grid.set(key, []);
    this.grid.get(key).push(entity);
  }

  getNeighbors(entity, radius) {
    const results = [];
    const minGX = Math.floor((entity.x - radius) / this.cellSize);
    const maxGX = Math.floor((entity.x + radius) / this.cellSize);
    const minGY = Math.floor((entity.y - radius) / this.cellSize);
    const maxGY = Math.floor((entity.y + radius) / this.cellSize);

    for (let gx = minGX; gx <= maxGX; gx++) {
      for (let gy = minGY; gy <= maxGY; gy++) {
        const cell = this.grid.get(`${gx},${gy}`);
        if (cell) {
          for (const other of cell) {
            if (other !== entity) {
              const dx = other.x - entity.x;
              const dy = other.y - entity.y;
              if (dx * dx + dy * dy <= radius * radius) {
                results.push(other);
              }
            }
          }
        }
      }
    }
    return results;
  }
}