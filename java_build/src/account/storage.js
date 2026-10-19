// Crash-safe save on this device. Two slots are written alternately: a new save never overwrites the last good one,
// and a save is only reported as done after it is read back and its checksum matches.
const SLOTS = ['flatframe.save.a', 'flatframe.save.b'];
const VERSION = 1;

const sections = new Map(); // name -> { collect(): object, apply(data): void }

export function registerSaveSection(name, handlers) {
  sections.set(name, handlers);
}

// FNV-1a over the JSON text: enough to catch a torn or corrupted write
function checksum(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function readSlot(key) {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    if (!raw) return null;
    const slot = JSON.parse(raw);
    if (slot?.version !== VERSION || typeof slot.payload !== 'string') return null;
    if (checksum(slot.payload) !== slot.checksum) return null; // torn or corrupted
    return { seq: slot.seq, data: JSON.parse(slot.payload) };
  } catch {
    return null;
  }
}

// The newest slot that passes its checksum, or null on a first run
export function loadSave() {
  const valid = SLOTS.map(readSlot).filter(Boolean);
  if (!valid.length) return null;
  return valid.reduce((a, b) => (b.seq > a.seq ? b : a));
}

let lastSeq = 0;

// Writes the current state. Returns true only when the slot reads back intact.
export function writeSave() {
  const data = {};
  for (const [name, handlers] of sections) data[name] = handlers.collect();
  const payload = JSON.stringify(data);
  const seq = Math.max(lastSeq, loadSave()?.seq ?? 0) + 1;
  const key = SLOTS[seq % 2];
  try {
    globalThis.localStorage.setItem(key, JSON.stringify({ version: VERSION, seq, checksum: checksum(payload), payload }));
  } catch {
    return false; // storage full or blocked: the previous slot still holds the last good save
  }
  const check = readSlot(key);
  if (!check || check.seq !== seq) return false;
  lastSeq = seq;
  return true;
}

// Gives each registered section its saved data. Missing sections keep their defaults.
export function applySave() {
  const save = loadSave();
  if (!save) return false;
  lastSeq = save.seq;
  for (const [name, handlers] of sections) {
    if (save.data[name] !== undefined) handlers.apply(save.data[name]);
  }
  return true;
}

// Saves when the page is hidden or closed, and on a timer, so progress is not lost if the game is closed
export function installAutoSave(intervalMs = 30000) {
  const save = () => writeSave();
  setInterval(save, intervalMs);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(); });
  window.addEventListener('pagehide', save);
}
