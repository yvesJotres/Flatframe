/**
 * Frame statistics for the "Show FPS" overlay (Settings > Interface).
 * Only what a browser can measure is shown as a number:
 *   - Frame Rate and Time come from the game loop's requestAnimationFrame timestamps.
 *   - RAM comes from performance.memory (Chromium only; the JS heap, not total process memory).
 *   - GPU time and VRAM are not exposed to web pages, so they always read "n/a".
 */

const WINDOW_MS = 500;   // averaging window for FPS and frame time
const REFRESH_MS = 250;  // how often the overlay text is rewritten

export const NOT_AVAILABLE = 'n/a';

export class FrameStats {
  constructor() {
    this.stamps = [];
    this.fps = null;
    this.frameMs = null;
  }

  /** Call once per game-loop frame with the rAF timestamp (ms). */
  tick(now) {
    this.stamps.push(now);
    while (this.stamps.length && now - this.stamps[0] > WINDOW_MS) this.stamps.shift();
    if (this.stamps.length >= 2) {
      const span = this.stamps[this.stamps.length - 1] - this.stamps[0];
      this.frameMs = span / (this.stamps.length - 1);
      this.fps = 1000 / this.frameMs;
    }
  }
}

/** Heap size in MB where the browser reports it, otherwise null. */
export function readRamMB() {
  const used = globalThis.performance?.memory?.usedJSHeapSize;
  return typeof used === 'number' ? Math.round(used / (1024 * 1024)) : null;
}

/** The overlay line, laid out like the reference screenshot. Values the browser can't read are "n/a". */
export function formatFpsLine(stats, ramMB = readRamMB()) {
  const fps = stats.fps == null ? NOT_AVAILABLE : `${Math.round(stats.fps)}fps`;
  const time = stats.frameMs == null ? NOT_AVAILABLE : `${stats.frameMs.toFixed(2)}ms`;
  const ram = ramMB == null ? NOT_AVAILABLE : `${ramMB.toLocaleString('en-US')}MB`;
  return `Frame Rate ${fps}  Time ${time}  GPU ${NOT_AVAILABLE}  RAM ${ram}  VRAM ${NOT_AVAILABLE}`;
}

/** Writes the line into el at most REFRESH_MS apart, so the numbers stay readable. */
export function updateFpsReadout(el, stats, now) {
  if (!el) return;
  if (el.lastWrite != null && now - el.lastWrite < REFRESH_MS) return;
  el.lastWrite = now;
  el.textContent = formatFpsLine(stats);
}
