// Game time in milliseconds. It advances only while the game is running (game.js calls advanceGameClock each
// unpaused frame), so the pause menu, the update prompt and a hidden tab do not run combo, parry or lockout timers out.
let elapsedMs = 0;

export function advanceGameClock(dt) {
  elapsedMs += dt * 1000;
}

export function gameNow() {
  return elapsedMs;
}
