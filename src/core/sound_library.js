// Sound library — file-based + procedurally generated sounds over Web Audio.
//
// Design:
//  * Sounds are declared once (see src/assets/sounds/manifest.js) or
//    procedurally generated as fallbacks (e.g. 'gunshot').
//  * Each sound belongs to a category ("bus": sfx, ui, music, ambience...)
//    so volumes can be mixed independently via setVolume(category, v).
//  * Loading is forgiving: a missing/broken file is logged once and the
//    sound degrades to silence (or its procedural fallback) instead of
//    breaking the game.
//  * Fully Node-safe: init() is a no-op outside the browser so test
//    suites can import modules that touch the library.

export class SoundLibrary {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.buses = new Map(); // category -> GainNode
    this.entries = new Map(); // name -> { src, category, volume, rate }
    this.buffers = new Map(); // name -> AudioBuffer
    this.procedural = new Map(); // name -> (ctx) => AudioBuffer | null
    this.missing = new Set(); // names whose files failed to load
    this.unknown = new Set(); // names played that were never registered
    this.volumes = { master: 1 };
    this.muted = false;
    this.loaded = false;
  }

  // ---- registration -------------------------------------------------

  register(name, def = {}) {
    this.entries.set(name, {
      src: def.src ?? def.file ?? null,
      category: def.category ?? 'sfx',
      volume: def.volume ?? 1,
      // Optional playback-rate variation: [min, max] rolls a random pitch
      // per shot so repeated sounds don't machine-gun identically.
      rate: def.rate ?? null,
    });
    return this;
  }

  registerMany(manifest = {}) {
    for (const [name, def] of Object.entries(manifest)) this.register(name, def);
    return this;
  }

  registerProcedural(name, generator) {
    this.procedural.set(name, generator);
    return this;
  }

  has(name) {
    return this.entries.has(name) || this.buffers.has(name) || this.procedural.has(name);
  }

  // ---- lifecycle ----------------------------------------------------

  init() {
    if (typeof window === 'undefined') return false;
    if (!this.ctx) {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return false;
      this.ctx = new AudioCtor();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.applyMasterGain();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  }

  // Fetches + decodes every registered file. Never throws; failures are
  // recorded in `missing` and warned once per sound.
  async load() {
    if (!this.init()) return this;
    const jobs = [];
    for (const [name, def] of this.entries) {
      if (def.src) jobs.push(this.loadOne(name, def.src));
    }
    await Promise.allSettled(jobs);
    this.loaded = true;
    return this;
  }

  async loadOne(name, src) {
    try {
      const response = await fetch(src);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.arrayBuffer();
      const buffer = await this.ctx.decodeAudioData(data);
      this.buffers.set(name, buffer);
    } catch (err) {
      this.missing.add(name);
      console.warn(`[SoundLibrary] could not load "${name}" (${src}): ${err.message}`);
    }
  }

  // ---- mixing -------------------------------------------------------

  setVolume(bus, value) {
    const v = Math.max(0, Math.min(1, value));
    this.volumes[bus] = v;
    if (bus === 'master') {
      this.applyMasterGain();
    } else if (this.buses.has(bus)) {
      this.buses.get(bus).gain.value = v;
    }
    return this;
  }

  setMuted(muted) {
    this.muted = !!muted;
    this.applyMasterGain();
    return this;
  }

  applyMasterGain() {
    if (this.master) this.master.gain.value = this.muted ? 0 : (this.volumes.master ?? 1);
  }

  getBus(category) {
    if (!this.ctx) return null;
    if (this.buses.has(category)) return this.buses.get(category);
    const bus = this.ctx.createGain();
    bus.gain.value = this.volumes[category] ?? 1;
    bus.connect(this.master);
    this.buses.set(category, bus);
    return bus;
  }


  // ---- playback -----------------------------------------------------

  // Returns { source, stop() } or null (Node, unknown sound, load failure).
  // opts: { volume, rate, pan, loop }
  play(name, opts = {}) {
    if (!this.init()) return null;

    let buffer = this.buffers.get(name);
    if (!buffer) {
      const generator = this.procedural.get(name);
      if (generator) {
        buffer = generator(this.ctx);
        if (buffer) this.buffers.set(name, buffer);
      }
    }
    if (!buffer) {
      const registered = this.entries.has(name) || this.procedural.has(name);
      if (!registered && !this.unknown.has(name)) {
        this.unknown.add(name);
        console.warn(`[SoundLibrary] played unknown sound "${name}"`);
      }
      return null;
    }

    const def = this.entries.get(name) ?? {};
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = !!opts.loop;

    let rate = opts.rate ?? 1;
    if (!opts.rate && Array.isArray(def.rate) && def.rate.length === 2) {
      const [min, max] = def.rate;
      rate = min + Math.random() * (max - min);
    }
    source.playbackRate.value = rate;

    const gain = this.ctx.createGain();
    gain.gain.value = (opts.volume ?? 1) * (def.volume ?? 1);
    source.connect(gain);

    let tail = gain;
    if (opts.pan && typeof this.ctx.createStereoPanner === 'function') {
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, opts.pan));
      gain.connect(panner);
      tail = panner;
    }

    tail.connect(this.getBus(def.category ?? 'sfx'));
    try {
      source.start();
    } catch (err) {
      console.warn(`[SoundLibrary] playback error for "${name}":`, err);
      return null;
    }

    return {
      source,
      stop() {
        try { source.stop(); } catch { /* already stopped */ }
      },
    };
  }
}

export const soundLibrary = new SoundLibrary();
