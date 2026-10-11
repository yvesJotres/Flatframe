// Back-compat audio facade. Existing call sites keep using
//   audioManager.init()          (first user gesture, from game.js)
//   audioManager.play(name, vol) (from weapons etc.)
// while the real work happens in the shared soundLibrary
// (src/core/sound_library.js) — file loading, category buses,
// volume mixing and procedural fallbacks.

import { soundLibrary } from './sound_library.js';
import { SOUND_MANIFEST } from '../assets/sounds/manifest.js';

// Procedural gunshot (kept until a real file is added to the manifest).
// Registered lazily so play() can generate it on first use.
function createGunshot(ctx) {
  const sampleRate = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, sampleRate * 0.08, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const noise = (Math.random() * 2 - 1);
    const decay = Math.exp(-i / (sampleRate * 0.012));
    data[i] = noise * decay * 0.4;
  }
  return buffer;
}

// Procedural parry sound - metallic 'ting'
function createParry(ctx) {
  const sampleRate = ctx.sampleRate;
  const duration = 0.15;
  const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / sampleRate;
    const freq = 2000 + 1500 * Math.exp(-t * 30); // descending pitch
    const tone = Math.sin(2 * Math.PI * freq * t);
    const decay = Math.exp(-t * 15);
    data[i] = tone * decay * 0.3;
  }
  return buffer;
}

export class AudioManager {
  constructor() {
    this.library = soundLibrary;
    this.library.registerMany(SOUND_MANIFEST);
    this.library.registerProcedural('gunshot', createGunshot);
    this.library.registerProcedural('ui_parry', createParry);
    this.loadPromise = null;
  }

  init() {
    if (!this.library.init()) return false;
    // Kick off manifest loading once; missing files only warn.
    if (!this.loadPromise) {
      this.loadPromise = this.library.load();
    }
    return true;
  }

  // Resolves once init() has run and every manifest file finished loading
  // (missing files resolve too — they're recorded as `missing`). Use before
  // playing file-based sounds that must not be dropped, e.g. music.
  ready() {
    if (!this.init()) return Promise.resolve();
    return this.loadPromise;
  }

  // play('gunshot', 0.35)                — legacy: name + volume number
  // play('launcher_music', { volume: 0.4, loop: true, pan: -0.5, rate: 1.1 })
  play(name, volume = 0.3, opts = {}) {
    if (typeof volume === 'object' && volume !== null) {
      opts = volume;
      volume = opts.volume ?? 0.3;
    }
    return this.library.play(name, { ...opts, volume });
  }

  setVolume(bus, value) {
    this.library.setVolume(bus, value);
  }

  setMuted(muted) {
    this.library.setMuted(muted);
  }
}

export const audioManager = new AudioManager();
