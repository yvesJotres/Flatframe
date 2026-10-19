/**
 * Player accounts stored in this browser. Each account (user) has its own ID, display name and mastery rank.
 * The active user is the one the game is playing as. Their wallet is switched with them (see accounts.js).
 * Saved in localStorage. Every read and write is guarded, so blocked storage falls back to memory.
 */

const STORE_KEY = 'flatframe.users.v2';
const LEGACY_KEY = 'flatframe.user.v1'; // single profile from before user accounts existed

// Fields a user can have, with the value a new user starts with
// completedNodes: star-chart nodes this user has won, as "Planet:Node" keys
// unlockedPlanets: planets open on the star chart
// loadout: equipped item per slot, e.g. { primary: 'Braton' }
// squad: matchmaking mode and invited members (see src/ui/squad.js)
export const DEFAULT_FIELDS = {
  displayName: 'Tenno',
  masteryRank: 0,
  completedNodes: [],
  unlockedPlanets: ['Earth'],
  loadout: {},
  squad: { mode: 'public', invited: [] },
  affinity: {}, // Affinity per item name, earned by playing with it (see src/progression/progression.js)
  masteryPoints: 0, // total mastery points from item levels; masteryRank is derived from this
};
export const MAX_NAME_LENGTH = 16;

function newId() {
  return globalThis.crypto?.randomUUID?.() ?? `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function cleanFields(saved = {}) {
  const clean = {};
  if (typeof saved.displayName === 'string' && saved.displayName.trim()) clean.displayName = saved.displayName.slice(0, MAX_NAME_LENGTH);
  if (Number.isInteger(saved.masteryRank) && saved.masteryRank >= 0) clean.masteryRank = saved.masteryRank;
  if (Array.isArray(saved.completedNodes)) clean.completedNodes = [...new Set(saved.completedNodes.filter((k) => typeof k === 'string'))];
  if (Array.isArray(saved.unlockedPlanets)) clean.unlockedPlanets = saved.unlockedPlanets.filter((p) => typeof p === 'string');
  if (saved.loadout && typeof saved.loadout === 'object') {
    clean.loadout = Object.fromEntries(Object.entries(saved.loadout).filter(([slot, item]) => typeof slot === 'string' && typeof item === 'string'));
  }
  if (Number.isFinite(saved.masteryPoints) && saved.masteryPoints >= 0) clean.masteryPoints = saved.masteryPoints;
  if (saved.affinity && typeof saved.affinity === 'object') {
    clean.affinity = Object.fromEntries(Object.entries(saved.affinity).filter(([name, xp]) => typeof name === 'string' && Number.isFinite(xp) && xp >= 0));
  }
  if (saved.squad && typeof saved.squad === 'object') {
    clean.squad = {
      mode: typeof saved.squad.mode === 'string' ? saved.squad.mode : 'public',
      invited: Array.isArray(saved.squad.invited) ? saved.squad.invited.filter((m) => m && typeof m.id === 'string' && typeof m.name === 'string') : [],
    };
  }
  return { ...DEFAULT_FIELDS, ...clean };
}

// { activeId, profiles: { [id]: fields } }
export function readStore() {
  try {
    const s = JSON.parse(globalThis.localStorage?.getItem(STORE_KEY) ?? 'null');
    if (s && typeof s.profiles === 'object' && s.profiles !== null && Object.keys(s.profiles).length) return s;
  } catch {
    // fall through to the migration / new store below
  }
  // First visit with accounts, or a broken store: bring over the old single profile if there is one
  let legacy = null;
  try {
    legacy = JSON.parse(globalThis.localStorage?.getItem(LEGACY_KEY) ?? 'null');
  } catch {
    legacy = null;
  }
  const id = typeof legacy?.id === 'string' ? legacy.id : newId();
  const store = { activeId: id, profiles: { [id]: cleanFields(legacy?.fields) } };
  writeStore(store);
  return store;
}

export function writeStore(store) {
  try {
    globalThis.localStorage?.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    // Storage unavailable: the accounts stay in memory only
  }
}

export class UserData {
  constructor(id, fields = {}) {
    this.id = id;
    this.fields = cleanFields(fields);
    this.listeners = new Set();
  }

  get(field) {
    if (!(field in DEFAULT_FIELDS)) throw new Error(`Unknown user field: ${field}`);
    return this.fields[field];
  }

  set(field, value) {
    this.get(field); // validates the field name
    this.fields[field] = value;
    this.changed();
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  changed() {
    const store = readStore();
    store.profiles[this.id] = { ...store.profiles[this.id], ...this.fields }; // keeps the password data (auth)
    writeStore(store);
    for (const fn of this.listeners) fn(this.fields);
  }

  // Makes this object the given user, loaded from storage
  reloadFrom(id) {
    const store = readStore();
    this.id = id;
    this.fields = cleanFields(store.profiles[id]);
    store.activeId = id;
    writeStore(store);
    for (const fn of this.listeners) fn(this.fields);
  }
}

// The active user, loaded from storage (created on the first visit)
function loadActive() {
  const store = readStore();
  const id = store.profiles[store.activeId] ? store.activeId : Object.keys(store.profiles)[0];
  return new UserData(id, store.profiles[id]);
}

export const user = loadActive();
