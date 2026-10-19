/**
 * Gamepad support (Bluetooth pads such as the GameSir G8+ on iPad, or any pad the Gamepad API reports).
 * Works like touch_controls.js: it writes to the InputHandler's keys / mouse state, so game code needs
 * no pad-specific branches. Polls navigator.getGamepads() every frame, but only while a pad is connected.
 *
 * - Left stick: analog movement. Right stick: aim (relative to the player)
 * - Playing: buttons follow the bindings in Settings > Gamepad (default: RT fires, Y swaps, LB is the ability modifier, Start pauses)
 * - Menus: D-pad or left stick move, A confirms, B goes back, LB/RB switch settings sections
 */

import { settings, GAMEPAD_ACTIONS } from './settings.js';

const STICK_DEAD_ZONE = 0.2;
const CURSOR_SPEED = 700; // canvas pixels per second at full stick
const CURSOR_START = 0.3; // stick push needed to switch the menu cursor on (keeps resting drift from doing it)
const MENU_STICK_THRESHOLD = 0.5;
const AIM_DISTANCE = 220;

// Standard mapping button indices, for the menu and for binding labels
export const BUTTON_NAMES = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Back', 'Start', 'L3', 'R3', 'D-Up', 'D-Down', 'D-Left', 'D-Right', 'Home'];

// What each action does in play: mouse flags for fire/parry/heavy, otherwise keys held for the press
const ACTION_INPUT = {
  fire: { mouse: 'down' },
  parry: { mouse: 'rightDown' },
  heavy: { mouse: 'middleDown' },
  melee: { keys: ['e'] },
  reload: { keys: ['r'] },
  swap: { keys: ['f'] }, // tap swaps ranged weapons, hold equips melee (see weapon_switch.js)
  dash: { keys: ['shift'] }, // Jump: hop, double jump, or bullet jump when crouched (see warframe/jump.js)
  crouch: { keys: ['control'] }, // held: Ctrl on the keyboard
  revive: { keys: ['x'] },
  interact: { keys: ['x'] }, // X on the keyboard too: lockers, containers and other interact points
  pause: { keys: ['escape'] },
  ability1: { keys: ['touch-ability-1'] },
  ability2: { keys: ['touch-ability-2'] },
  ability3: { keys: ['touch-ability-3'] },
  ability4: { keys: ['touch-ability-4'] },
};

// Menu mapping, used whenever the game is not in live play
const MENU_BUTTONS = { 0: 'enter', 1: 'escape', 4: 'q', 5: 'e', 9: 'escape', 12: 'arrowup', 13: 'arrowdown', 14: 'arrowleft', 15: 'arrowright' };

export function connectedGamepad() {
  const pads = globalThis.navigator?.getGamepads?.() ?? [];
  return Array.from(pads).find((p) => p && p.connected) ?? null;
}

// Radial dead zone, rescaled so the stick still reaches full deflection
function stickVector(x, y) {
  const mag = Math.hypot(x, y);
  if (mag < STICK_DEAD_ZONE) return { x: 0, y: 0 };
  const scale = Math.min(1, (mag - STICK_DEAD_ZONE) / (1 - STICK_DEAD_ZONE)) / mag;
  return { x: x * scale, y: y * scale };
}

export class GamepadControls {
  /**
   * @param {InputHandler} input
   * @param {{ isPlaying: () => boolean, getPlayerScreenPos: () => ({x:number,y:number}|null) }} hooks
   */
  constructor(input, hooks) {
    this.input = input;
    this.hooks = hooks;
    this.running = false;
    this.down = []; // previous pressed state per button
    this.active = {}; // button index -> { keys, mouse } currently held in the input state
    this.menuStick = { up: false, down: false, left: false, right: false };
    this.cursorActive = false; // menus: the left stick moves a pointer that hovers and clicks like the mouse
    this.cursor = null;
    this.cursorEl = null;
    this.lastFrame = 0;
    this.loop = this.loop.bind(this);

    window.addEventListener('gamepadconnected', () => this.onConnectionChange());
    window.addEventListener('gamepaddisconnected', () => this.onConnectionChange());
    this.onConnectionChange();
  }

  // Starts or stops the polling loop and toggles the touch overlay to match
  onConnectionChange() {
    const connected = !!connectedGamepad();
    document.body.classList.toggle('gamepad-connected', connected);
    if (connected) {
      if (!this.running) { this.running = true; requestAnimationFrame(this.loop); }
    } else {
      this.releaseAll();
      this.running = false;
    }
  }

  loop() {
    if (!this.running) return;
    const pad = connectedGamepad();
    if (!pad) { this.onConnectionChange(); return; }
    this.update(pad);
    requestAnimationFrame(this.loop);
  }

  update(pad) {
    // Buttons held down this frame, so a screen can tell a hold from a press (e.g. RT for fusion)
    this.input.padHeld = new Set(pad.buttons.flatMap((b, i) => (b?.pressed ? [i] : [])));
    const playing = this.hooks.isPlaying();
    const modifier = settings.get('gamepadBindings')?.abilityModifier ?? -1;
    const modifierHeld = modifier >= 0 && !!pad.buttons[modifier]?.pressed;
    // Buttons: edges only, so one press is one key press
    pad.buttons.forEach((b, i) => {
      const down = !!b?.pressed;
      if (down && !this.down[i]) this.press(i, playing, modifierHeld);
      else if (!down && this.down[i]) this.release(i);
      this.down[i] = down;
    });

    const [lx, ly, rx, ry] = [pad.axes[0] ?? 0, pad.axes[1] ?? 0, pad.axes[2] ?? 0, pad.axes[3] ?? 0];
    const left = stickVector(lx, ly);
    const right = stickVector(rx, ry);

    if (playing) {
      this.releaseMenuStick();
      this.cursorActive = false;
      this.hideCursor();
      this.input.gamepadMove = left;
      // Right stick aims like touch: the point AIM_DISTANCE ahead of the player; it holds its last aim when centred
      const p = this.hooks.getPlayerScreenPos();
      const len = Math.hypot(right.x, right.y);
      if (p && len > 0) {
        this.input.mouse.x = p.x + (right.x / len) * AIM_DISTANCE;
        this.input.mouse.y = p.y + (right.y / len) * AIM_DISTANCE;
      }
    } else {
      this.input.gamepadMove = { x: 0, y: 0 };
      this.input.gamepadRight = right;
      this.updateMenuCursor(pad, left);
    }
  }

  // Menus: the left stick moves a pointer (once it has moved) and D-pad goes back to stepping through options
  updateMenuCursor(pad, left) {
    const dpad = [12, 13, 14, 15].some((i) => pad.buttons[i]?.pressed);
    // A D-pad press always wins: the cursor turns off and only a clear stick push turns it back on.
    // Small drift on a resting stick does not count, so it cannot undo the D-pad.
    if (dpad) this.cursorActive = false;
    else if (Math.hypot(left.x, left.y) > CURSOR_START) this.cursorActive = true;

    if (!this.cursorActive) {
      this.updateMenuStick(left);
      if (this.wasCursor) { this.input.mouseInside = false; this.wasCursor = false; }
      this.hideCursor();
      return;
    }

    const canvas = this.input.canvas;
    const now = performance.now();
    const dt = this.lastFrame ? Math.min(0.05, (now - this.lastFrame) / 1000) : 0;
    this.lastFrame = now;
    if (!this.cursor) this.cursor = { x: canvas.width / 2, y: canvas.height / 2 };
    this.cursor.x = Math.min(canvas.width, Math.max(0, this.cursor.x + left.x * CURSOR_SPEED * dt));
    this.cursor.y = Math.min(canvas.height, Math.max(0, this.cursor.y + left.y * CURSOR_SPEED * dt));
    this.input.mouse.x = this.cursor.x;
    this.input.mouse.y = this.cursor.y;
    this.input.mouseInside = true;
    this.wasCursor = true;
    this.releaseMenuStick();
    this.showCursor(canvas);
  }

  showCursor(canvas) {
    if (!this.cursorEl) {
      this.cursorEl = document.createElement('div');
      this.cursorEl.id = 'gamepad-cursor';
      this.cursorEl.style.cssText = 'position:fixed;left:0;top:0;z-index:450;pointer-events:none;display:none;';
      this.cursorEl.innerHTML = '<svg width="22" height="26" viewBox="0 0 20 24"><path d="M1 1 L1 19 L6 14 L9 22 L12 21 L9 13 L16 13 Z" fill="#ffffff" stroke="#000000" stroke-width="1.5" stroke-linejoin="round"/></svg>';
      document.body.append(this.cursorEl);
    }
    const r = canvas.getBoundingClientRect();
    const x = r.left + this.cursor.x * (r.width / canvas.width);
    const y = r.top + this.cursor.y * (r.height / canvas.height);
    this.cursorEl.style.transform = `translate(${x}px, ${y}px)`;
    this.cursorEl.style.display = 'block';
  }

  hideCursor() {
    if (this.cursorEl) this.cursorEl.style.display = 'none';
  }

  // Menus: the left stick acts as arrow keys, one press per push past the threshold
  updateMenuStick(v) {
    const next = {
      up: v.y < -MENU_STICK_THRESHOLD, down: v.y > MENU_STICK_THRESHOLD,
      left: v.x < -MENU_STICK_THRESHOLD, right: v.x > MENU_STICK_THRESHOLD,
    };
    const keys = { up: 'arrowup', down: 'arrowdown', left: 'arrowleft', right: 'arrowright' };
    for (const dir of Object.keys(next)) {
      if (next[dir] && !this.menuStick[dir]) this.input.pressedKeys[keys[dir]] = true;
    }
    this.menuStick = next;
  }

  releaseMenuStick() {
    this.menuStick = { up: false, down: false, left: false, right: false };
  }

  press(i, playing, modifierHeld = false) {
    // A controller press counts as a user gesture, which the browser needs before it allows sound
    window.dispatchEvent(new Event('gamepadpress'));
    // Every press is also recorded under pad<N>, so the Settings screen can read it when rebinding
    this.input.pressedKeys[`pad${i}`] = true;
    let entry = null;
    if (playing) {
      const actionId = this.actionFor(i, modifierHeld);
      const def = actionId && ACTION_INPUT[actionId];
      if (def) entry = def;
    } else if (MENU_BUTTONS[i]) {
      // With the cursor on screen, A clicks where it points; otherwise it sends the usual key
      entry = this.cursorActive && i === 0 ? { mouse: 'down' } : { keys: [MENU_BUTTONS[i]] };
    }
    if (!entry) return;

    this.active[i] = entry;
    for (const k of entry.keys ?? []) {
      this.input.keys[k] = true;
      this.input.pressedKeys[k] = true;
    }
    if (entry.mouse) {
      this.input.mouse[entry.mouse] = true;
      if (entry.mouse === 'down') this.input.mouseClicked = true;
    }
  }

  release(i) {
    const entry = this.active[i];
    if (!entry) return;
    for (const k of entry.keys ?? []) this.input.keys[k] = false;
    if (entry.mouse) this.input.mouse[entry.mouse] = false;
    delete this.active[i];
  }

  releaseAll() {
    for (const i of Object.keys(this.active)) this.release(Number(i));
    this.input.gamepadMove = { x: 0, y: 0 };
    this.input.gamepadRight = { x: 0, y: 0 };
    this.releaseMenuStick();
    this.down = [];
  }

  // The action bound to a button, from Settings > Gamepad (-1 means unbound).
  // Abilities need the modifier held; without it the button does its plain action.
  // A button shared by Reload and Revive revives while the player is downed, and reloads otherwise.
  actionFor(button, modifierHeld) {
    const bindings = settings.get('gamepadBindings') ?? {};
    const ids = GAMEPAD_ACTIONS
      .filter((a) => a.id !== 'abilityModifier' && bindings[a.id] === button)
      .map((a) => a.id);
    const abilities = ids.filter((id) => id.startsWith('ability'));
    if (modifierHeld && abilities.length) return abilities[0];
    const plain = ids.filter((id) => !id.startsWith('ability'));
    // A shared X: when something usable is in reach (and the player is not downed), X interacts instead of reloading
    if (plain.includes('reload') && !this.hooks.isDowned?.() && this.hooks.canInteract?.()) return 'interact';
    if (plain.includes('reload') && plain.includes('revive')) return this.hooks.isDowned?.() ? 'revive' : 'reload';
    return plain[0] ?? null;
  }
}
