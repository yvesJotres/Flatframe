/**
 * Data Loader for Warframe-style category chunks
 * Loads index first (tiny), then lazy-loads chunks by category via fetch
 */

const isNode = typeof window === 'undefined' && typeof process !== 'undefined' && !!process.versions?.node;

// Browser: fetch from the dev server. Node (tests): read from disk relative to this module.
async function readJson(relPath) {
  if (isNode) {
    const { readFile } = await import('node:fs/promises');
    const url = new URL(`.${relPath.slice('/src/data'.length)}`, import.meta.url);
    return JSON.parse(await readFile(url, 'utf8'));
  }
  const response = await fetch(relPath);
  if (!response.ok) throw new Error(`${response.status}`);
  return response.json();
}

class DataLoader {
  constructor() {
    this.index = null;
    this.chunkCache = new Map();
    this.basePath = '/src/data';
  }

  async loadIndex() {
    if (this.index) return this.index;
    try {
      this.index = await readJson(`${this.basePath}/index.json`);
    } catch (err) {
      throw new Error(`[dataLoader] Failed to load index: ${err.message}`);
    }
    return this.index;
  }

  async loadChunk(type, chunkName) {
    const key = `${type}/${chunkName}`;
    if (this.chunkCache.has(key)) return this.chunkCache.get(key);

    let chunk;
    try {
      chunk = await readJson(`${this.basePath}/${type}/chunks/${chunkName}.json`);
    } catch (err) {
      throw new Error(`[dataLoader] Failed to load chunk ${key}: ${err.message}`);
    }
    this.chunkCache.set(key, chunk);
    return chunk;
  }

  // Get all items of a type (loads all chunks - use sparingly)
  async getAll(type) {
    const index = await this.loadIndex();
    const entries = index[type];
    if (!entries) throw new Error(`[dataLoader] Unknown data type: ${type}`);
    const chunks = new Set(entries.map(item => item.chunk));
    const all = [];
    for (const chunk of chunks) {
      const data = await this.loadChunk(type, chunk);
      all.push(...data);
    }
    return all;
  }

  // Get items by category chunk (what UI uses)
  async getByChunk(type, chunkName) {
    return this.loadChunk(type, chunkName);
  }

  // Search/filter using index only (no chunk loads)
  async search(type, filter) {
    const index = await this.loadIndex();
    const entries = index[type];
    if (!entries) throw new Error(`[dataLoader] Unknown data type: ${type}`);
    return entries.filter(item => {
      if (filter.name && !item.name.toLowerCase().includes(filter.name.toLowerCase())) return false;
      if (filter.type && item.type !== filter.type) return false;
      if (filter.masteryReq !== undefined && item.masteryReq > filter.masteryReq) return false;
      if (filter.tags && filter.tags.length && !filter.tags.some(t => (item.tags ?? []).includes(t))) return false;
      if (filter.chunk && item.chunk !== filter.chunk) return false;
      if (filter.category && item.category !== filter.category) return false;
      if (filter.rarity && item.rarity !== filter.rarity) return false;
      if (filter.compatName && item.compatName !== filter.compatName) return false;
      return true;
    });
  }

  // Get single item by name (loads its chunk)
  async getItem(type, name) {
    const index = await this.loadIndex();
    const entry = index[type].find(i => i.name === name);
    if (!entry) return null;
    const chunk = await this.loadChunk(type, entry.chunk);
    return chunk.find(item => item.name === name);
  }

  // Get available chunks for a type (for UI tabs)
  getChunks(type) {
    if (!this.index) return [];
    const chunks = new Set(this.index[type].map(item => item.chunk));
    return Array.from(chunks).sort();
  }
}

export const dataLoader = new DataLoader();
export default DataLoader;