import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SoundLibrary, soundLibrary } from '../src/core/sound_library.js';
import { audioManager } from '../src/core/audio.js';
import { SOUND_MANIFEST } from '../src/assets/sounds/manifest.js';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

test('library imports cleanly in Node and is browser-safe (no AudioContext)', () => {
  const lib = new SoundLibrary();
  assert.equal(lib.init(), false, 'init is a no-op outside the browser');
  assert.equal(lib.play('anything'), null, 'play is a no-op outside the browser');
});

test('registration: register, registerMany, has', () => {
  const lib = new SoundLibrary();
  lib.register('hit', { category: 'sfx', volume: 0.5 });
  lib.registerMany({ click: { category: 'ui' }, music: { category: 'music', src: 'x.ogg' } });
  lib.registerProcedural('gunshot', () => null);
  assert.equal(lib.has('hit'), true);
  assert.equal(lib.has('click'), true);
  assert.equal(lib.has('music'), true);
  assert.equal(lib.has('gunshot'), true);
  assert.equal(lib.has('nope'), false);
  assert.equal(lib.entries.get('hit').volume, 0.5);
  assert.equal(lib.entries.get('click').category, 'ui');
});

test('volume + mute are stored even without a browser context', () => {
  const lib = new SoundLibrary();
  lib.setVolume('music', 0.4);
  lib.setVolume('master', 2); // clamped to 1
  lib.setMuted(true);
  assert.equal(lib.volumes.music, 0.4);
  assert.equal(lib.volumes.master, 1);
  assert.equal(lib.muted, true);
});

test('audio facade wires the manifest and the procedural gunshot', () => {
  assert.equal(audioManager.library.has('gunshot'), true, 'gunshot fallback registered');
  for (const name of Object.keys(SOUND_MANIFEST)) {
    assert.equal(audioManager.library.has(name), true, `manifest entry "${name}" registered`);
  }
  // Facade API stays back-compatible with existing call sites.
  assert.equal(typeof audioManager.init, 'function');
  assert.equal(typeof audioManager.play, 'function');
  audioManager.init(); // must not throw in Node
  assert.equal(audioManager.play('gunshot', 0.35), null, 'no-op in Node');
});

test('manifest entries resolve to absolute URLs with required fields', () => {
  for (const [name, def] of Object.entries(SOUND_MANIFEST)) {
    assert.equal(typeof def.file, 'string', `${name} has a file`);
    assert.ok(def.file.startsWith('file:') || def.file.startsWith('http'), `${name} resolves to a URL`);
    assert.equal(typeof def.category, 'string', `${name} has a category`);
    // The file must actually exist next to the manifest — a typo here would
    // silently degrade the sound to nothing at runtime.
    const path = fileURLToPath(def.file);
    assert.ok(existsSync(path), `${name} file exists on disk (${path})`);
  }
});

test('facade play() accepts legacy volume or an options object', () => {
  // Node-safe: init() fails without an AudioContext, so play() returns null
  // either way — we're asserting the argument handling doesn't throw.
  assert.equal(audioManager.play('gunshot', 0.5), null);
  assert.equal(audioManager.play('gunshot', { volume: 0.5, loop: true, pan: -1, rate: 1.2 }), null);
});

test('ready() resolves even in Node (no AudioContext)', async () => {
  await audioManager.ready(); // must not throw or hang
});
