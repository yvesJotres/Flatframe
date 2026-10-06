/**
 * Move `current` toward `target` by at most `maxDelta`, never overshooting.
 * Tying the step size to `dt` keeps the motion frame-rate independent.
 */
export function approach(current, target, maxDelta) {
  const delta = target - current;
  if (Math.abs(delta) <= maxDelta) return target;
  return current + Math.sign(delta) * maxDelta;
}
