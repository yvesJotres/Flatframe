import { test } from 'node:test';
import assert from 'node:assert/strict';
import { audioManager } from '../src/engine/audio.js';
import { createCountdownTick } from '../src/engine/procedural_sounds.js';

// top_bar.js creates Image objects at load time; Node has none.
globalThis.Image ??= class { set src(_) {} };
if (typeof globalThis.localStorage?.getItem !== 'function') {
  const store = new Map();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) } });
}
const { default: Navigation } = await import('../src/ui/menus/star_chart.js');

const fakeCtx = { sampleRate: 44100, createBuffer: (c, len) => { const d = new Float32Array(len); return { getChannelData: () => d }; } };

test('countdown tick is a short, audible click', () => {
  const data = createCountdownTick(fakeCtx).getChannelData(0);
  assert.ok(data.length < 44100 * 0.05, 'under 50ms');
  assert.ok(Math.max(...data.map(Math.abs)) > 0.3, 'audible');
});

test('star chart ticks once per whole second and not on launch', () => {
  const plays = [];
  const realPlay = audioManager.play;
  audioManager.play = (name, vol) => { plays.push(name); return null; };
  try {
    const launches = [];
    const nav = new Navigation((planet, mission) => launches.push(mission.name));
    nav.open = true;
    nav.selectedPlanet = 'P';
    nav.selectedMission = 'M';
    nav.startBar = () => ({ planet: { name: 'P' }, mission: { name: 'M' } });
    nav.isMissionCompleted = () => false;
    nav.launchMission = (planet, mission) => launches.push(mission.name);
    const input = { isPressed: () => false, isKeyPressed: () => false };

    // Frame 1 starts the countdown for this mission (5s); then run 6 seconds in 0.1s steps.
    nav.update(0, input);
    for (let i = 0; i < 61; i++) nav.update(0.1, input);

    assert.equal(launches.length, 1, 'mission launched once');
    // Displayed numbers 4, 3, 2, 1 each tick once; reaching 0 launches without a tick.
    assert.deepEqual(plays, ['countdown_tick', 'countdown_tick', 'countdown_tick', 'countdown_tick']);
  } finally {
    audioManager.play = realPlay;
  }
});
