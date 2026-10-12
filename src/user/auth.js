/**
 * Login for the accounts on this browser: passwords, sign in, sign out and the signed-in session.
 * Passwords are never stored in plain text. Each one is salted and hashed with PBKDF2 (SHA-256).
 *
 * Limit: accounts live in this browser's storage, so this stops casual switching but is not a server-side login.
 */
import { readStore, writeStore } from './user_data.js';
import { switchUser, activeUserId } from './accounts.js';

const SESSION_KEY = 'flatframe.session.v1';
// "Stay signed in" keeps the session in localStorage; otherwise it lives in sessionStorage and ends with the tab
const storages = () => [globalThis.localStorage, globalThis.sessionStorage].filter(Boolean);
const ITERATIONS = 100000;
export const MIN_PASSWORD_LENGTH = 4;

const toB64 = (bytes) => btoa(String.fromCharCode(...bytes));
const fromB64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

async function hashPassword(password, saltB64) {
  const salt = saltB64 ? fromB64(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' }, key, 256);
  return { salt: toB64(salt), hash: toB64(new Uint8Array(bits)) };
}

function setPasswordFor(id, password) {
  return hashPassword(password).then((auth) => {
    const store = readStore();
    store.profiles[id] = { ...store.profiles[id], auth: { ...auth, iterations: ITERATIONS } };
    writeStore(store);
  });
}

function checkPasswordLength(password) {
  if (String(password ?? '').length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  return null;
}

// Signs in to an account. An account created before passwords existed sets its password on the first sign-in.
export async function signIn(id, password, { skipCheck = false, remember = true } = {}) {
  const store = readStore();
  const profile = store.profiles[id];
  if (!profile) return { ok: false, error: 'No such user' };
  if (!skipCheck) {
    if (!profile.auth) {
      const bad = checkPasswordLength(password);
      if (bad) return { ok: false, error: `Set a password first: ${bad.toLowerCase()}` };
      await setPasswordFor(id, password);
    } else {
      const again = await hashPassword(String(password ?? ''), profile.auth.salt);
      if (again.hash !== profile.auth.hash) return { ok: false, error: 'Wrong password' };
    }
  }
  signOut();
  try {
    (remember ? globalThis.localStorage : globalThis.sessionStorage)?.setItem(SESSION_KEY, JSON.stringify({ id }));
  } catch {
    // Storage unavailable: the session lasts until the page reloads
  }
  switchUser(id);
  return { ok: true, id };
}

export function signOut() {
  for (const storage of storages()) {
    try {
      storage.removeItem(SESSION_KEY);
    } catch {
      // ignore
    }
  }
}

// The signed-in user's ID, or null when nobody is signed in
export function signedInId() {
  for (const storage of storages()) {
    try {
      const session = JSON.parse(storage.getItem(SESSION_KEY) ?? 'null');
      if (session && readStore().profiles[session.id]) return session.id;
    } catch {
      // broken session: treat as signed out
    }
  }
  return null;
}

export function isSignedIn() {
  return signedInId() !== null;
}

// The active user, if signed in
export function currentUserId() {
  return signedInId() ?? activeUserId();
}
