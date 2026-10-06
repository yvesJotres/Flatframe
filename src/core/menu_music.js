// Launcher music controller — audible ONLY on the start screen (main menu).
//
// Design:
//  * `sync(screen, exited)` is called every frame; it is idempotent and
//    starts the loop exactly while `screen === menuScreen`, stopping it
//    anywhere else (mission select, gameplay, simulacrum, debrief, exit).
//  * `stop()` is an immediate cut — called at gameplay entry points so the
//    music cannot linger for a frame between the transition and the next
//    `sync()` tick.
//  * If `audio.play()` returns null (buffer still decoding), the next
//    `sync()` retries automatically until the file is ready.
//  * The audio backend is injected, so this module is fully testable in
//    Node without a browser or AudioContext.
//
// Usage (game.js):
//   const menuMusic = createMenuMusic({ audio: audioManager, name: 'launcher_music' });
//   menuMusic.enable();            // after the first user gesture unlocks audio
//   menuMusic.sync(screen, gameExited);  // top of the game loop
//   menuMusic.stop();              // immediately when entering gameplay
export function createMenuMusic({
  audio,
  name = 'launcher_music',
  volume = 0.4,
  menuScreen = 'main-menu',
} = {}) {
  let handle = null;   // current looping play() handle, or null
  let wanted = false;  // becomes true once browser audio is unlocked

  function start() {
    if (handle) return;
    handle = audio.play(name, { volume, loop: true });
    // null = buffer not decoded yet; a later sync() will retry.
  }

  function stop() {
    if (!handle) return;
    handle.stop();
    handle = null;
  }

  return {
    /** Unlocks music playback; call after the first user gesture. */
    enable() {
      wanted = true;
    },
    get wanted() {
      return wanted;
    },
    /** True while a looping source is (or may be) sounding. */
    get playing() {
      return handle !== null;
    },
    stop,
    /** Idempotent per-frame sync: play on the menu, stop everywhere else. */
    sync(screen, exited = false) {
      if (!wanted) return;
      if (!exited && screen === menuScreen) start();
      else stop();
    },
  };
}