import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMenuMusic } from '../src/core/menu_music.js';

// Fake audio backend: records plays, returns stoppable handles.
function fakeAudio({ failFirst = 0 } = {}) {
  const state = { plays: [], stops: [], failFirst };
  return {
    state,
    play(name, opts) {
      if (state.failFirst > 0) {
        state.failFirst--;
        return null; // buffer not decoded yet
      }
      const handle = {
        name,
        opts,
        stop() { state.stops.push(name); },
      };
      state.plays.push(handle);
      return handle;
    },
  };
}

test('silent until enabled (audio not unlocked yet)', () => {
  const audio = fakeAudio();
  const m = createMenuMusic({ audio });
  m.sync('main-menu');
  assert.equal(audio.state.plays.length, 0, 'no play before enable()');
  assert.equal(m.wanted, false);
});

test('plays on main menu after enable, looping at configured volume', () => {
  const audio = fakeAudio();
  const m = createMenuMusic({ audio, volume: 0.4 });
  m.enable();
  m.sync('main-menu');
  assert.equal(audio.state.plays.length, 1);
  const [handle] = audio.state.plays;
  assert.equal(handle.name, 'launcher_music');
  assert.equal(handle.opts.loop, true);
  assert.equal(handle.opts.volume, 0.4);
});

test('sync is idempotent: no repeated plays while staying on the menu', () => {
  const audio = fakeAudio();
  const m = createMenuMusic({ audio });
  m.enable();
  for (let i = 0; i < 10; i++) m.sync('main-menu');
  assert.equal(audio.state.plays.length, 1, 'exactly one looping source');
  assert.equal(audio.state.stops.length, 0, 'nothing stopped');
});

test('STOPS as soon as the screen is no longer main-menu (gameplay, etc.)', () => {
  const audio = fakeAudio();
  const m = createMenuMusic({ audio });
  m.enable();
  for (const screen of ['playing', 'simulacrum', 'mission-select', 'failed', 'complete']) {
    m.sync('main-menu'); // music starts for this round
    const plays = audio.state.plays.length;
    m.sync(screen);
    assert.equal(audio.state.stops.length, plays, `music stopped on "${screen}"`);
    // Repeated frames in gameplay must not restart or re-stop.
    m.sync(screen);
    assert.equal(audio.state.plays.length, plays, `no restart while on "${screen}"`);
    assert.equal(audio.state.stops.length, plays, `no duplicate stop on "${screen}"`);
  }
  assert.equal(audio.state.plays.length, 5, 'one play per return to the menu');
  assert.equal(audio.state.stops.length, 5, 'one stop per entry into a non-menu screen');
});

test('explicit stop() cuts immediately and is safe to call anywhere', () => {
  const audio = fakeAudio();
  const m = createMenuMusic({ audio });
  m.enable();
  m.sync('main-menu');
  m.stop(); // gameplay entry point — no waiting for the next sync tick
  assert.equal(audio.state.stops.length, 1);
  m.stop(); // idempotent
  assert.equal(audio.state.stops.length, 1);
  assert.equal(m.playing, false);
});

test('stops when the game is exiting even on the menu screen', () => {
  const audio = fakeAudio();
  const m = createMenuMusic({ audio });
  m.enable();
  m.sync('main-menu');
  m.sync('main-menu', true); // exited=true
  assert.equal(audio.state.stops.length, 1);
});

test('retries until the buffer decodes (play returning null)', () => {
  const audio = fakeAudio({ failFirst: 3 });
  const m = createMenuMusic({ audio });
  m.enable();
  m.sync('main-menu'); // null
  assert.equal(audio.state.plays.length, 0);
  m.sync('main-menu'); // null
  m.sync('main-menu'); // null
  assert.equal(audio.state.plays.length, 0);
  m.sync('main-menu'); // success
  assert.equal(audio.state.plays.length, 1);
  m.sync('main-menu'); // now stable
  assert.equal(audio.state.plays.length, 1);
});

test('handle becomes null after stop, so returning to the menu replays', () => {
  const audio = fakeAudio();
  const m = createMenuMusic({ audio });
  m.enable();
  m.sync('main-menu');
  m.sync('playing');
  assert.equal(m.playing, false);
  m.sync('main-menu');
  assert.equal(m.playing, true);
  assert.equal(audio.state.plays.length, 2, 'fresh play on return');
  assert.equal(audio.state.stops.length, 1);
});
