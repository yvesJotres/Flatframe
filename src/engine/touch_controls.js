/**
 * On-screen touch controls for phones/tablets (Android Chrome etc.).
 * Drives the existing InputHandler by writing to its keys / mouse state,
 * so game code needs no touch-specific branches.
 *
 * - Left stick: WASD movement
 * - Right stick: aim (relative to the player) and fire while held
 * - Buttons: melee, heavy, parry, reload, swap, jump, revive, pause
 */

const STICK_RADIUS = 60;
const DEAD_ZONE = 0.25;
const AIM_DISTANCE = 220;

export function isTouchDevice() {
  if (typeof window === 'undefined') return false;
  // Check for any indication of touch support: maxTouchPoints is most reliable
  return navigator.maxTouchPoints > 0;
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
    this.aim = null; // {dx, dy} unit vector while right stick is held
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
        <button data-key="e">MELEE</button>
        <button data-mouse="middleDown">HEAVY</button>
        <button data-mouse="rightDown">PARRY</button>
        <button data-key="r">RELOAD</button>
        <button data-key="1">PRI</button>
        <button data-key="2">SEC</button>
        <button data-key="f">SWAP</button>
        <button data-key="control,space, ">JUMP</button>
        <button data-key="x">REVIVE</button>
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
        if (btn.dataset.key) btn.dataset.key.split(',').forEach((k) => this.keyDown(k));
        if (btn.dataset.mouse) this.input.mouse[btn.dataset.mouse] = true;
      };
      const release = (e) => {
        e.preventDefault();
        btn.classList.remove('active');
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
    // Tapping the prompt after a triple-tap exit goes back to landscape
    // Tapping it always gets you into the game: after a triple-tap release it re-locks landscape;
    // on first load it just goes fullscreen and hides the prompt for this session (portrait still works)
    // The tap that dismisses the prompt must not also select something in the menu behind it
    for (const type of ['mousedown', 'mouseup', 'touchstart', 'touchend', 'pointerdown', 'pointerup']) {
      el.addEventListener(type, (e) => e.stopPropagation());
    }
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.landscapeReleased && performance.now() - this.releasedAt > 700) this.resumeLandscape(true);
      else {
        document.body.classList.add('rotate-dismissed');
        this.enterFullscreen();
      }
    });
    document.body.appendChild(el);
    this.watchOrientation();
  }

  // Back in landscape after a release (phone rotated back) -> hide the prompt again
  watchOrientation() {
    const mq = window.matchMedia('(orientation: portrait)');
    mq.addEventListener('change', () => {
      if (!this.landscapeReleased) return;
      if (mq.matches) this.seenPortrait = true;
      else if (this.seenPortrait) this.resumeLandscape(false);
    });
  }

  // Browsers only allow fullscreen + orientation lock from a user gesture, so retry on
  // every tap while not fullscreen (e.g. after the player swipes out of it).
  // Installed to the home screen, manifest.webmanifest opens it in landscape directly.
  enableFullscreenOnFirstTap() {
    const go = async () => {
      // After a triple-tap exit, stay out of landscape until the next mission starts
      if (this.landscapeReleased || document.fullscreenElement) return;
      try {
        await document.documentElement.requestFullscreen?.({ navigationUI: 'hide' });
        await screen.orientation?.lock?.('landscape');
      } catch { /* not supported or denied: game still works in the browser UI */ }
    };
    window.addEventListener('touchend', go);
    this.enableTripleTapExit();
  }

  // Triple-tap on any menu, the pause screen or a results screen releases the landscape lock and leaves
  // fullscreen, then shows the first-load "Rotate your phone to landscape" screen.
  enableTripleTapExit() {
    this.landscapeReleased = false;
    let taps = [];
    window.addEventListener('touchend', () => {
      if (!this.hooks.canExitLandscape?.()) { taps = []; return; }
      const now = performance.now();
      taps = taps.filter(t => now - t < 600).concat(now);
      if (taps.length >= 3) { taps = []; this.releaseLandscape(); }
    });
  }

  // Back to the first-load state: leave fullscreen, free the rotation, and show the
  // "Rotate your phone to landscape" screen until the player returns to landscape.
  async releaseLandscape() {
    this.landscapeReleased = true;
    this.releasedAt = performance.now();
    this.seenPortrait = window.matchMedia('(orientation: portrait)').matches;
    document.body.classList.add('landscape-released');
    try { screen.orientation?.unlock?.(); } catch { /* unsupported */ }
    try { if (document.fullscreenElement) await document.exitFullscreen(); } catch { /* ignore */ }
  }

  // fromTap: called from a tap, so fullscreen + landscape lock are allowed right now
  async resumeLandscape(fromTap) {
    this.landscapeReleased = false;
    document.body.classList.remove('landscape-released');
    if (!fromTap) return; // the next tap re-locks (browsers need a tap for fullscreen)
    await this.enterFullscreen(true);
  }

  async enterFullscreen(lock = true) {
    try {
      await document.documentElement.requestFullscreen?.({ navigationUI: 'hide' });
      if (lock) await screen.orientation?.lock?.('landscape');
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
