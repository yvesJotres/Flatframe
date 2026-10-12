import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGunshot, GUNSHOT_PROFILES } from '../src/engine/procedural_sounds.js';

// Minimal AudioContext stand-in: just enough for the generators.
const fakeCtx = (sampleRate = 44100) => ({
  sampleRate,
  createBuffer(channels, length, rate) {
    const data = new Float32Array(length);
    return { sampleRate: rate, getChannelData: () => data };
  },
});

test('gunshot: right length, finite, peaks below full scale', () => {
  const data = createGunshot(fakeCtx()).getChannelData(0);
  assert.equal(data.length, Math.floor(44100 * 0.25));
  let peak = 0;
  for (const v of data) {
    assert.ok(Number.isFinite(v), 'no NaN/Infinity samples');
    peak = Math.max(peak, Math.abs(v));
  }
  assert.ok(peak > 0.3 && peak <= 1, `peak ${peak.toFixed(3)} is audible and not clipping`);
});

test('gunshot: sharp attack, then decays to near silence', () => {
  const sr = 44100;
  const data = createGunshot(fakeCtx(sr)).getChannelData(0);
  const rms = (from, to) => {
    let s = 0;
    for (let i = from; i < to; i++) s += data[i] * data[i];
    return Math.sqrt(s / (to - from));
  };
  const attack = rms(0, Math.floor(sr * 0.01));
  const late = rms(Math.floor(sr * 0.2), data.length);
  assert.ok(attack > 0.1, 'attack is loud');
  assert.ok(late < attack / 20, 'tail has decayed well below the attack');
});

test('braton profile: shorter than the generic shot so fast repeats do not smear', () => {
  const braton = createGunshot(fakeCtx(), GUNSHOT_PROFILES.braton).getChannelData(0);
  const generic = createGunshot(fakeCtx(), GUNSHOT_PROFILES.default).getChannelData(0);
  assert.ok(braton.length < generic.length, 'shorter buffer');
  // Braton fires ~8.75/s (~114ms apart): the tail must be quiet by then.
  const sr = 44100;
  const from = Math.floor(sr * 0.114);
  let s = 0;
  for (let i = from; i < braton.length; i++) s += braton[i] * braton[i];
  assert.ok(Math.sqrt(s / (braton.length - from)) < 0.02, 'tail is quiet at the next shot');
});

test('Braton has its own registered sound; other weapons keep the generic one', async () => {
  const { audioManager } = await import('../src/engine/audio.js');
  const { adaptWeapon, WEAPON_SOUNDS } = await import('../src/data/weapon_adapter.js');
  assert.equal(WEAPON_SOUNDS.Braton, 'braton_fire');
  assert.equal(adaptWeapon({ name: 'Braton', attacks: [] }).sound, 'braton_fire');
  assert.equal(adaptWeapon({ name: 'Grakata', attacks: [] }).sound, undefined, 'falls back to gunshot');
  assert.equal(audioManager.library.has('braton_fire'), true);
});
