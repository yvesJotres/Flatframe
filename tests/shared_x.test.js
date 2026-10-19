// On the gamepad, X is reload and interact: X interacts when something usable is in reach, and reloads otherwise.
// On the keyboard, X is interact and R is reload (see gamepad.js ACTION_INPUT and game.js updateLootables).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GamepadControls } from '../src/engine/gamepad.js';

// The gamepad's button action decision, with the given situation
function actionFor(hooks) {
  const pad = Object.create(GamepadControls.prototype);
  pad.hooks = hooks;
  return (button) => pad.actionFor(button, false);
}

test('the default X button reloads when nothing usable is in reach', () => {
  const x = actionFor({ isDowned: () => false, canInteract: () => false });
  assert.equal(x(2), 'reload');
});

test('the same X button interacts when a usable point (a green locker) is in reach', () => {
  const x = actionFor({ isDowned: () => false, canInteract: () => true });
  assert.equal(x(2), 'interact');
});

test('while downed, X revives rather than interacting', () => {
  const x = actionFor({ isDowned: () => true, canInteract: () => true });
  assert.notEqual(x(2), 'interact');
});

test('interact is bound to the X key on the keyboard (R stays reload)', async () => {
  const src = await import('node:fs').then((fs) => fs.readFileSync(new URL('../src/engine/gamepad.js', import.meta.url), 'utf8'));
  assert.match(src, /interact: \{ keys: \['x'\] \}/);
  assert.match(src, /reload: \{ keys: \['r'\] \}/);
});
