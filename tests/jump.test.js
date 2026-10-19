import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JUMP, JumpState } from '../src/warframe/jump.js';

// Runs the jump forward until it lands; returns the total distance covered and the landing kind.
function runToLanding(state) {
  let dist = 0;
  let landed = null;
  for (let i = 0; i < 300 && !landed; i++) {  // 5 s at 60 fps: longer than any jump here
    const dt = 1 / 60;
    dist += Math.hypot(state.vx, state.vy) * dt;
    landed = state.update(dt)?.landed ?? null;
  }
  return { dist, landed };
}

test('a hop goes in the movement direction and lands as a hop', () => {
  const s = new JumpState();
  assert.equal(s.press(1, 0, 0, 1, false), 'hop');
  assert.ok(s.vx > 0 && s.vy === 0);
  const { landed } = runToLanding(s);
  assert.equal(landed, 'hop');
});

test('a standing hop goes where the player aims', () => {
  const s = new JumpState();
  s.press(0, 0, 0, 1, false);
  assert.ok(s.vy > 0 && s.vx === 0);
});

test('a second press in the air is a double jump, once per landing', () => {
  const s = new JumpState();
  s.press(1, 0, 1, 0, false);
  assert.equal(s.press(0, 1, 0, 1, false), 'double');
  assert.equal(s.press(0, 1, 0, 1, false), null);
});

test('a bullet jump covers the wiki distance toward the aim', () => {
  const s = new JumpState();
  assert.equal(s.press(0, 0, 1, 0, true), 'bullet');
  const { dist, landed } = runToLanding(s);
  assert.equal(landed, 'bullet');
  // Within one frame of travel (1050 units/s at 60 fps is 17.5 units) of the wiki distance
  assert.ok(Math.abs(dist - JUMP.bulletDistance) < 20, `distance ${dist}`);
});

test('a bullet jump needs the ground again and blocks a double jump', () => {
  const s = new JumpState();
  s.press(0, 0, 1, 0, true);
  assert.equal(s.press(0, 0, 1, 0, true), null);   // still airborne
  assert.equal(s.press(0, 1, 0, 1, false), null);  // no double jump after a bullet jump
  runToLanding(s);
  assert.equal(s.press(0, 0, 1, 0, true), 'bullet'); // back on the ground
});

test('landing restores the double jump after a hop', () => {
  const s = new JumpState();
  s.press(1, 0, 1, 0, false);
  s.press(1, 0, 1, 0, false); // double
  runToLanding(s);
  assert.equal(s.press(1, 0, 1, 0, false), 'hop');
});
