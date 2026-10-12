/**
 * On-screen touch controls for phones/tablets (Android Chrome etc.).
 * Drives the existing InputHandler by writing to its keys / mouse state,
 * so game code needs no touch-specific branches.
 *
 * - Left stick: WASD movement
 * - Right stick: aim (relative to the player) and fire while held
 * - Buttons: melee, heavy, parry, reload, swap, jump, revive, pause
 * - AUTO toggle: aim and fire at the nearest enemy in range (the right stick overrides it)
 */

import { findAutoPlayTarget, autoPlayAimPoint } from './auto_play.js';

const STICK_RADIUS = 60;
const DEAD_ZONE = 0.25;
const AIM_DISTANCE = 220;

export function isTouchDevice() {
  return typeof window !== 'undefined' &&
    (('ontouchstart' in window) || navigator.maxTouchPoints > 0) &&
    window.matchMedia?.('(pointer: coarse)').matches;
}

export class TouchControls {
  /**
   * @param {InputHandler} input
   * @param {{ isPlaying: () => boolean, mode?: () => 'play'|'sim-play'|'sim-menu'|'menu', getPlayerScreenPos: () => ({x:number,y:number}|null) }} hooks
   */
  constructor(input, hooks) {
    this.input = input;
    this.hooks = hooks;
    this.root = this.buildDom();
    document.body.appendChild(this.root);
    document.body.classList.add('touch-device');
    this.addRotatePrompt();
    this.enableFullscreenOnFirstTap();
    this.keepScreenAwake();
    this.aim = null; // {dx, dy} unit vector while right stick is held
    this.autoPlay = false; // AUTO toggle
    this.autoFiring = false; // true while auto-play holds fire, so it only releases what it pressed
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  buildDom() {
    const root = document.createElement('div');
    root.id = 'touch-controls';
    root.innerHTML = `
      <div class="tc-stick tc-left"><div class="tc-knob"></div></div>
      <div class="tc-stick tc-right"><div class="tc-knob"></div></div>
      <div class="tc-buttons">
        <button data-key="e" data-melee="1">MELEE</button>
        <button data-mouse="middleDown">HEAVY</button>
        <button data-mouse="rightDown">PARRY</button>
        <button data-key="r">RELOAD</button>
        <button data-key="1">PRI</button>
        <button data-key="2">SEC</button>
        <button data-key="f">SWAP</button>
        <button data-key="control,space, ">JUMP</button>
        <button data-key="x">REVIVE</button>
        <button class="tc-auto" data-auto="1">AUTO</button>
      </div>
      <button class="tc-pause" data-key="escape">II</button>
      <button class="tc-spawner" data-key="p">SPAWNER</button>
    `;

    this.setupStick(root.querySelector('.tc-left'), (dx, dy) => this.setMove(dx, dy));
    this.setupStick(root.querySelector('.tc-right'), (dx, dy, active) => {
      this.aim = active ? { dx, dy } : null;
      this.input.mouse.down = active && Math.hypot(dx, dy) > DEAD_ZONE;
      if (this.input.mouse.down) this.input.mouseClicked = true;
    });

    root.querySelectorAll('button').forEach((btn) => {
      const press = (e) => {
        e.preventDefault();
        btn.classList.add('active');
        if (btn.dataset.auto) {
          this.toggleAutoPlay(btn);
          return;
        }
        // Melee is equipped by holding F; a tap on MELEE while ranged is out holds it for the switch handler
        if (btn.dataset.melee && this.hooks.isMeleeEquipped && !this.hooks.isMeleeEquipped()) {
          this.keyDown('f');
          setTimeout(() => this.keyUp('f'), 260);
          return;
        }
        if (btn.dataset.key) btn.dataset.key.split(',').forEach((k) => this.keyDown(k));
        if (btn.dataset.mouse) this.input.mouse[btn.dataset.mouse] = true;
      };
      const release = (e) => {
        e.preventDefault();
        btn.classList.remove('active');
        if (btn.dataset.auto) return; // a toggle acts on press only
        if (btn.dataset.key) btn.dataset.key.split(',').forEach((k) => this.keyUp(k));
        if (btn.dataset.mouse) this.input.mouse[btn.dataset.mouse] = false;
      };
      btn.addEventListener('touchstart', press, { passive: false });
      btn.addEventListener('touchend', release, { passive: false });
      btn.addEventListener('touchcancel', release, { passive: false });
    });
    return root;
  }

  addRotatePrompt() {
    const el = document.createElement('div');
    el.id = 'rotate-prompt';
    el.innerHTML = '<div class="rp-icon">&#x21bb;</div><div>Rotate your phone to landscape</div><div class="rp-sub">or tap to go fullscreen</div>';
    // The tap that dismisses the prompt must not also select something in the menu behind it
    for (const type of ['mousedown', 'mouseup', 'touchstart', 'touchend', 'pointerdown', 'pointerup']) {
      el.addEventListener(type, (e) => e.stopPropagation());
    }
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      document.body.classList.add('rotate-dismissed');
      this.enterFullscreen();
    });
    document.body.appendChild(el);
  }

  // Browsers only allow fullscreen + orientation lock from a user gesture, so retry on
  // every tap while not fullscreen (e.g. after the player swipes out of it).
  // Installed to the home screen, manifest.webmanifest opens it in landscape directly.
  enableFullscreenOnFirstTap() {
    window.addEventListener('touchend', async () => {
      if (document.fullscreenElement) return;
      await this.enterFullscreen();
    });
  }

  // Browsers release the wake lock when the page is hidden and need a user gesture to take it again
  keepScreenAwake() {
    let lock = null;
    const acquire = async () => {
      if (lock && !lock.released) return;
      try { lock = await navigator.wakeLock?.request('screen'); } catch { /* unsupported or denied */ }
    };
    window.addEventListener('touchend', acquire);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') acquire();
    });
  }

  async enterFullscreen() {
    try {
      await document.documentElement.requestFullscreen?.({ navigationUI: 'hide' });
      await screen.orientation?.lock?.('landscape');
    } catch { /* not supported or denied: the game still works in the browser UI */ }
  }

  setupStick(el, onChange) {
    const knob = el.querySelector('.tc-knob');
    let touchId = null;
    let center = null;

    const update = (t) => {
      let dx = t.clientX - center.x;
      let dy = t.clientY - center.y;
      const dist = Math.hypot(dx, dy);
      if (dist > STICK_RADIUS) { dx *= STICK_RADIUS / dist; dy *= STICK_RADIUS / dist; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      onChange(dx / STICK_RADIUS, dy / STICK_RADIUS, true);
    };
    const find = (list) => Array.from(list).find((t) => t.identifier === touchId);

    el.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (touchId !== null) return;
      const t = e.changedTouches[0];
      touchId = t.identifier;
      const r = el.getBoundingClientRect();
      center = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      update(t);
    }, { passive: false });
    el.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const t = find(e.changedTouches);
      if (t) update(t);
    }, { passive: false });
    const end = (e) => {
      e.preventDefault();
      if (!find(e.changedTouches)) return;
      touchId = null;
      knob.style.transform = '';
      onChange(0, 0, false);
    };
    el.addEventListener('touchend', end, { passive: false });
    el.addEventListener('touchcancel', end, { passive: false });
  }

  toggleAutoPlay(btn) {
    this.autoPlay = !this.autoPlay;
    btn.classList.toggle('on', this.autoPlay);
  }

  // While auto-play is on and the right stick is idle, aim at the nearest enemy and hold fire
  updateAutoPlay(playing) {
    const player = this.hooks.getPlayerWorldPos?.();
    const target = playing && this.autoPlay && !this.aim && this.hooks.getEnemies
      ? findAutoPlayTarget(player, this.hooks.getEnemies())
      : null;
    if (target) {
      const origin = this.hooks.getPlayerScreenPos();
      const point = autoPlayAimPoint(origin, player, target, AIM_DISTANCE);
      this.input.mouse.x = point.x;
      this.input.mouse.y = point.y;
      this.input.mouse.down = true;
      this.autoFiring = true;
    } else if (this.autoFiring) {
      this.input.mouse.down = false;
      this.autoFiring = false;
    }
  }

  setMove(dx, dy) {
    const set = (k, on) => (on ? this.keyDown(k) : this.keyUp(k));
    set('w', dy < -DEAD_ZONE);
    set('s', dy > DEAD_ZONE);
    set('a', dx < -DEAD_ZONE);
    set('d', dx > DEAD_ZONE);
  }

  keyDown(k) {
    if (!this.input.keys[k]) this.input.pressedKeys[k] = true;
    this.input.keys[k] = true;
  }

  keyUp(k) {
    this.input.keys[k] = false;
  }

  loop() {
    const playing = this.hooks.isPlaying();
    // Simulacrum: sticks and action buttons work while playing the arena; the SPAWNER button
    // opens and closes the spawner (P). Its UI is driven by taps on its panel.
    const mode = this.hooks.mode?.() ?? (playing ? 'play' : 'menu');
    this.root.classList.toggle('hidden', !(playing || mode === 'sim-play' || mode === 'sim-menu'));
    this.root.classList.toggle('sim', mode === 'sim-play' || mode === 'sim-menu');
    this.root.classList.toggle('sim-play', mode === 'sim-play');
    this.updateAutoPlay(playing);
    if (playing && this.aim) {
      const p = this.hooks.getPlayerScreenPos();
      const len = Math.hypot(this.aim.dx, this.aim.dy);
      if (p && len > 0.05) {
        // Canvas pixels: same space InputHandler.mouse uses
        this.input.mouse.x = p.x + (this.aim.dx / len) * AIM_DISTANCE;
        this.input.mouse.y = p.y + (this.aim.dy / len) * AIM_DISTANCE;
      }
    }
    requestAnimationFrame(this.loop);
  }
}
