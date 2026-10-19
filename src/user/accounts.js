/**
 * User accounts on this browser: list, create and switch.
 * Switching changes both the active user's data and their wallet, so the rest of the game sees the new player at once.
 */
import { readStore, writeStore, user, DEFAULT_FIELDS, MAX_NAME_LENGTH } from './user_data.js';
import { wallet } from '../economy/wallet.js';

const switchListeners = new Set();

export function onUserSwitch(fn) {
  switchListeners.add(fn);
  return () => switchListeners.delete(fn);
}

export function listUsers() {
  const store = readStore();
  return Object.entries(store.profiles).map(([id, fields]) => ({
    id,
    displayName: fields.displayName ?? DEFAULT_FIELDS.displayName,
    active: id === user.id,
  }));
}

export function activeUserId() {
  return user.id;
}

// Returns { ok: true, id } or { ok: false, error }
export function createUser(displayName) {
  const name = String(displayName ?? '').trim();
  if (!name) return { ok: false, error: 'Enter a name first' };
  if (name.length > MAX_NAME_LENGTH) return { ok: false, error: `Names can be up to ${MAX_NAME_LENGTH} characters` };
  const id = globalThis.crypto?.randomUUID?.() ?? `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const store = readStore();
  store.profiles[id] = { ...DEFAULT_FIELDS, displayName: name };
  writeStore(store);
  return { ok: true, id };
}

export const ADMIN_NAME = 'Admin';

// The admin account has no extra powers; it is created once and sets its password on first sign-in.
export function ensureAdminUser() {
  if (!adminUserId()) createUser(ADMIN_NAME);
}

export function userIdByName(name) {
  const wanted = String(name ?? '').trim().toLowerCase();
  if (!wanted) return null;
  const store = readStore();
  return Object.keys(store.profiles).find((id) => String(store.profiles[id].displayName ?? '').toLowerCase() === wanted) ?? null;
}

export function adminUserId() {
  const store = readStore();
  return Object.keys(store.profiles).find((id) => store.profiles[id].displayName === ADMIN_NAME) ?? null;
}

// Makes another user the active one. Returns false when there is no such user.
export function switchUser(id) {
  const store = readStore();
  if (!store.profiles[id]) return false;
  user.reloadFrom(id);
  wallet.switchProfile(id);
  for (const fn of switchListeners) fn(id);
  return true;
}
