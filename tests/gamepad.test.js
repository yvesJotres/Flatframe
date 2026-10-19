import { test } from 'node:test';
import assert from 'node:assert/strict';

// Minimal browser globals so gamepad.js and settings.js load under node
globalThis.window = { addEventListener() {}, dispatchEvent() {} };
globalThis.document = { body: { classList: { toggle() {} } } };
globalThis.requestAnimationFrame = () => 0;
Object.defineProperty(globalThis, 'navigator', { value: { getGamepads: () => [] }, configurable: true });

const { DEFAULT_SETTINGS, DEFAULT_PAD_BINDINGS, GAMEPAD_ACTIONS } = await import('../src/engine/settings.js');
const { GamepadControls } = await import('../src/engine/gamepad.js');

function fakeInput() {
  return {
    keys: {}, pressedKeys: {}, mouse: { x: 0, y: 0, down: false, rightDown: false, middleDown: false },
    mouseClicked: false, gamepadMove: { x: 0, y: 0 },
  };
}

function fakePad(pressed = [], axes = [0, 0, 0, 0]) {
  const buttons = Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i) }));
  return { connected: true, buttons, axes };
}

test('default pad bindings: plain actions never share a button; abilities only share with plain actions', () => {
  // Revive shares X with Reload on purpose: X reloads normally and revives while the player is downed
  const plain = GAMEPAD_ACTIONS.filter((a) => !a.id.startsWith('ability') && a.id !== 'revive').map((a) => DEFAULT_PAD_BINDINGS[a.id]).filter((b) => b >= 0);
  assert.equal(DEFAULT_PAD_BINDINGS.revive, DEFAULT_PAD_BINDINGS.reload);
  assert.equal(new Set(plain).size, plain.length);
  const abilities = GAMEPAD_ACTIONS.filter((a) => a.id.startsWith('ability') && a.id !== 'abilityModifier').map((a) => DEFAULT_PAD_BINDINGS[a.id]);
  assert.equal(new Set(abilities).size, abilities.length);
  assert.equal(DEFAULT_SETTINGS.gamepadBindings.fire, 7); // RT fires
  assert.equal(DEFAULT_SETTINGS.gamepadBindings.pause, 9); // Start pauses
  assert.equal(GAMEPAD_ACTIONS.length, Object.keys(DEFAULT_PAD_BINDINGS).length);
});

test('in play: RT holds fire; A alone dashes', () => {
  const input = fakeInput();
  const gp = new GamepadControls(input, { isPlaying: () => true, getPlayerScreenPos: () => ({ x: 100, y: 100 }) });
  gp.update(fakePad([7, 0]));
  assert.equal(input.mouse.down, true);
  assert.equal(input.mouseClicked, true);
  assert.equal(input.keys.shift, true);
  assert.equal(input.keys['touch-ability-1'], undefined);
  gp.update(fakePad([]));
  assert.equal(input.mouse.down, false);
  assert.equal(input.keys.shift, false);
});

test('in play: holding LB makes A, X, B and Y cast abilities 1-4 instead of their plain actions', () => {
  const input = fakeInput();
  const gp = new GamepadControls(input, { isPlaying: () => true, getPlayerScreenPos: () => ({ x: 100, y: 100 }) });
  gp.update(fakePad([4, 0]));
  assert.equal(input.keys['touch-ability-1'], true);
  assert.equal(input.keys.control, undefined);
  gp.update(fakePad([4]));
  gp.update(fakePad([4, 2]));
  assert.equal(input.keys['touch-ability-2'], true);
  gp.update(fakePad([4]));
  gp.update(fakePad([4, 1]));
  assert.equal(input.keys['touch-ability-3'], true);
  gp.update(fakePad([4]));
  gp.update(fakePad([4, 3]));
  assert.equal(input.keys['touch-ability-4'], true);
});

test('in play: without LB, X reloads, B melees and Y swaps', () => {
  const input = fakeInput();
  const gp = new GamepadControls(input, { isPlaying: () => true, getPlayerScreenPos: () => ({ x: 100, y: 100 }) });
  gp.update(fakePad([2]));
  assert.equal(input.keys.r, true);
  gp.update(fakePad([]));
  gp.update(fakePad([1]));
  assert.equal(input.keys.e, true);
  gp.update(fakePad([]));
  gp.update(fakePad([3]));
  assert.equal(input.keys.f, true);
});

test('in play: the left stick sets analog movement and the right stick aims', () => {
  const input = fakeInput();
  const gp = new GamepadControls(input, { isPlaying: () => true, getPlayerScreenPos: () => ({ x: 100, y: 100 }) });
  gp.update(fakePad([], [0.6, 0, 1, 0]));
  assert.ok(input.gamepadMove.x > 0.4 && input.gamepadMove.x < 0.6);
  assert.equal(input.gamepadMove.y, 0);
  assert.equal(input.mouse.x, 100 + 220);
  assert.equal(input.mouse.y, 100);
});

test('menus: A confirms, B goes back, D-pad moves; game keys are not sent', () => {
  const input = fakeInput();
  const gp = new GamepadControls(input, { isPlaying: () => false, getPlayerScreenPos: () => null });
  gp.update(fakePad([0, 12]));
  assert.equal(input.pressedKeys.enter, true);
  assert.equal(input.pressedKeys.arrowup, true);
  assert.equal(input.mouse.down, false);
  gp.update(fakePad([]));
  gp.update(fakePad([1]));
  assert.equal(input.pressedKeys.escape, true);
  assert.equal(input.pressedKeys['touch-ability-1'], undefined);
});
