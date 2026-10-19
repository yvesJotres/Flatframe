// Hit zones for enemies: a head (a circle) and a body (a capsule). Hitting the head counts as a headshot.
// Offsets are in multiples of the enemy's radius, measured from its centre (y grows downward, so negative is up).

export const HEAD = { offsetY: -0.6, radiusScale: 0.3 };                      // head circle above the centre
export const BODY = { top: -0.2, bottom: 0.5, radiusScale: 0.45 };          // capsule: a slim, tall segment with round ends

function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

// Which zone a point is in: 'head', 'body', or null when it misses both
export function hitZone(enemy, px, py) {
  const r = enemy.radius ?? 16;
  const headR = HEAD.radiusScale * r;
  if (Math.hypot(px - enemy.x, py - (enemy.y + HEAD.offsetY * r)) <= headR) return 'head';
  const bodyR = BODY.radiusScale * r;
  if (distanceToSegment(px, py, enemy.x, enemy.y + BODY.top * r, enemy.x, enemy.y + BODY.bottom * r) <= bodyR) return 'body';
  return null;
}
