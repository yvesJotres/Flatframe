/**
 * Player settings: definitions, defaults, persistence (localStorage) and change events.
 * Every setting listed here is wired to the game in applySettings() (game.js), so the
 * Settings screen only shows options that actually do something.
 */

const STORAGE_KEY = 'flatframe.settings.v1';

// type: 'slider' (min..max, step, format) | 'toggle' | 'choice' (options)
export const SETTING_SECTIONS = [
  {
    id: 'audio', label: 'AUDIO',
    items: [
      { key: 'masterVolume', label: 'Master Volume', type: 'slider', min: 0, max: 1, step: 0.05, default: 0.8, format: 'percent' },
      { key: 'musicVolume', label: 'Music', type: 'slider', min: 0, max: 1, step: 0.05, default: 0.7, format: 'percent', preview: 'music' },
      { key: 'sfxVolume', label: 'Sound Effects', type: 'slider', min: 0, max: 1, step: 0.05, default: 0.9, format: 'percent', preview: 'sfx' },
      { key: 'uiVolume', label: 'Interface', type: 'slider', min: 0, max: 1, step: 0.05, default: 0.8, format: 'percent', preview: 'ui' },
      { key: 'ambienceVolume', label: 'Ambience', type: 'slider', min: 0, max: 1, step: 0.05, default: 0.6, format: 'percent' },
      { key: 'muteAll', label: 'Mute All', type: 'toggle', default: false },
      { key: 'muteInBackground', label: 'Mute When In Background', type: 'toggle', default: true },
    ],
  },
  {
    id: 'interface', label: 'INTERFACE',
    items: [
      { key: 'damageNumbers', label: 'Damage Numbers', type: 'choice', options: ['Enhanced', 'Legacy', 'Off'], default: 'Enhanced' },
      { key: 'damageNumberScale', label: 'Damage Number Size', type: 'slider', min: 0.5, max: 2, step: 0.1, default: 1, format: 'percent' },
      { key: 'damageNumberOpacity', label: 'Damage Number Opacity', type: 'slider', min: 0.2, max: 1, step: 0.05, default: 1, format: 'percent' },
      { key: 'compactDamageNumbers', label: 'Compact Numbers (12.3k)', type: 'toggle', default: false },
      { key: 'hudOpacity', label: 'HUD Opacity', type: 'slider', min: 0.3, max: 1, step: 0.05, default: 1, format: 'percent' },
      { key: 'showDebugInfo', label: 'Show Position Read-out', type: 'toggle', default: true },
    ],
  },
  {
    id: 'controls', label: 'CONTROLS',
    items: [
      { key: 'touchControls', label: 'Touch Controls', type: 'choice', options: ['Auto', 'On', 'Off'], default: 'Auto', note: 'Takes effect after reload' },
      { key: 'touchOpacity', label: 'Touch Controls Opacity', type: 'slider', min: 0.2, max: 1, step: 0.05, default: 0.8, format: 'percent' },
      { key: 'touchSize', label: 'Touch Controls Size', type: 'slider', min: 0.7, max: 1.4, step: 0.05, default: 1, format: 'percent' },
    ],
  },
];

const ITEMS = SETTING_SECTIONS.flatMap(s => s.items);
export const DEFAULT_SETTINGS = Object.fromEntries(ITEMS.map(i => [i.key, i.default]));

function load() {
  try {
    const saved = JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY) ?? '{}');
    // Keep only known keys with the right type, so old or broken saves can't break the game
    const clean = {};
    for (const item of ITEMS) {
      const v = saved[item.key];
      if (item.type === 'slider' && typeof v === 'number') clean[item.key] = Math.min(item.max, Math.max(item.min, v));
      else if (item.type === 'toggle' && typeof v === 'boolean') clean[item.key] = v;
      else if (item.type === 'choice' && item.options.includes(v)) clean[item.key] = v;
    }
    return { ...DEFAULT_SETTINGS, ...clean };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

class SettingsStore {
  constructor() {
    this.values = load();
    this.listeners = new Set();
  }

  get(key) {
    return this.values[key];
  }

  set(key, value) {
    if (this.values[key] === value) return;
    this.values[key] = value;
    this.save();
    for (const fn of this.listeners) fn(this.values, key);
  }

  reset(sectionId) {
    const section = SETTING_SECTIONS.find(s => s.id === sectionId);
    for (const item of section?.items ?? ITEMS) this.values[item.key] = item.default;
    this.save();
    for (const fn of this.listeners) fn(this.values, null);
  }

  save() {
    try { globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(this.values)); } catch { /* private mode etc. */ }
  }

  /** Calls fn(values) now and on every change. */
  subscribe(fn) {
    this.listeners.add(fn);
    fn(this.values, null);
    return () => this.listeners.delete(fn);
  }
}

export const settings = new SettingsStore();
