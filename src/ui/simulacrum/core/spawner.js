import { ENTITY_REGISTRY } from '../../../entities/registry.js';

export class SimulacrumSpawner {
  async spawn(faction, type, x, y, level = 1) {
    const path = ENTITY_REGISTRY[faction]?.[type];
    if (!path) {
      console.warn(`[Spawner] No entity found for ${faction}/${type}`);
      return null;
    }

    try {
      const module = await import(path);
      return new module.default(x, y, { lvl: level });
    } catch (err) {
      console.error(`[Spawner] Failed to load entity at ${path}:`, err);
      return null;
    }
  }

  list() {
    return Object.entries(ENTITY_REGISTRY).map(([faction, types]) => ({
      faction,
      types: Object.keys(types)
    }));
  }
}
