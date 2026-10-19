// Launcher music controller — audible on all pre-mission screens (main menu, navigation, arsenal, profile, settings).
//
export function createMenuMusic({
  audio,
  name = 'launcher_music',
  volume = 0.4,
  menuScreens = ['main-menu', 'navigation', 'arsenal', 'profile', 'settings'],
} = {}) {
  let handle = null;
  let wanted = false;

  function start() {
    if (handle) return;
    handle = audio.play(name, { volume, loop: true });
  }

  function stop() {
    if (!handle) return;
    handle.stop();
    handle = null;
  }

  return {
    enable() { wanted = true; },
    get wanted() { return wanted; },
    get playing() { return handle !== null; },
    stop,
    sync(screen, exited = false) {
      if (!wanted) return;
      if (!exited && menuScreens.includes(screen)) start();
      else stop();
    },
  };
}
