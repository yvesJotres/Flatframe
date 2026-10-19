/**
 * The one close button shared by every menu screen (Navigation, Arsenal, Profile,
 * Settings, Simulacrum...), on desktop and touch alike. A Windows-style × in the top-right
 * corner; it acts like pressing Escape, so each screen's Escape handling decides what
 * "close" means there.
 * Also maps the Android system back gesture to the same action.
 */
export class BackButton {
  /**
   * @param {InputHandler} input
   * @param {{ isVisible: () => boolean, handlesSystemBack: () => boolean }} hooks
   */
  constructor(input, hooks) {
    this.input = input;
    this.hooks = hooks;

    const btn = document.createElement('button');
    btn.id = 'menu-close';
    btn.className = 'hidden';
    btn.setAttribute('aria-label', 'Close');
    btn.title = 'Close (Esc)';
    btn.innerHTML = '&#x2715;';
    // Keep the click from also reaching the canvas as a menu click
    for (const type of ['mousedown', 'touchstart', 'pointerdown']) {
      btn.addEventListener(type, (e) => e.stopPropagation());
    }
    btn.addEventListener('click', (e) => { e.stopPropagation(); this.pressEscape(); });
    document.body.appendChild(btn);
    this.el = btn;

    history.pushState({ flatframe: true }, '');
    window.addEventListener('popstate', () => {
      if (this.hooks.handlesSystemBack()) this.pressEscape();
      history.pushState({ flatframe: true }, '');
    });

    const tick = () => {
      const shown = this.hooks.isVisible();
      this.el.classList.toggle('hidden', !shown);
      document.body.classList.toggle('has-close', shown); // HUD moves down under the X
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  pressEscape() {
    const keys = this.input.keys, pressed = this.input.pressedKeys;
    if (!keys.escape) pressed.escape = true;
    keys.escape = true;
    setTimeout(() => { keys.escape = false; }, 50);
  }
}
