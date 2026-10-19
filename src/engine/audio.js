// Back-compat audio facade. Existing call sites keep using
//   audioManager.init()          (first user gesture, from game.js)
//   audioManager.play(name, vol) (from weapons etc.)
// while the real work happens in the shared soundLibrary
// (src/engine/sound_library.js) — file loading, category buses,
// volume mixing and procedural fallbacks.

import { soundLibrary } from './sound_library.js';
import { SOUND_MANIFEST } from '../assets/sounds/manifest.js';
import { createGunshot, createParry, createCountdownTick, GUNSHOT_PROFILES } from './procedural_sounds.js';
import { createUiHover, createUiSelect, createUiBack } from './ui_sounds.js';

export class AudioManager {
  constructor() {
    this.library = soundLibrary;
    this.library.registerMany(SOUND_MANIFEST);
    this.library.registerProcedural('gunshot', (ctx) => createGunshot(ctx, GUNSHOT_PROFILES.default));
    this.library.registerProcedural('braton_fire', (ctx) => createGunshot(ctx, GUNSHOT_PROFILES.braton));
    this.library.registerProcedural('ui_parry', createParry);
    // Sci-fi menu sounds (see ui_sounds.js)
    this.library.register('ui_hover', { category: 'ui', volume: 0.4 });
    this.library.register('ui_select', { category: 'ui', volume: 0.5 });
    this.library.register('ui_back', { category: 'ui', volume: 0.4 });
    this.library.registerProcedural('ui_hover', createUiHover);
    this.library.registerProcedural('ui_select', createUiSelect);
    this.library.registerProcedural('ui_back', createUiBack);
    // No file: generated on first play, on the UI bus.
    this.library.register('countdown_tick', { category: 'ui', volume: 0.6 });
    this.library.registerProcedural('countdown_tick', createCountdownTick);
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
