import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CollisionWorld } from '../src/engine/collision.js';

const TS = 160;
// One wall tile at grid (2, 1): pixels x 320..480, y 160..320
function world() {
  const w = new CollisionWorld();
  w.setTiles(TS, [{ x: 320, y: 160 }]);
  return w;
}

test('a point inside a wall tile is solid, a point outside is not', () => {
  const w = world();
  assert.equal(w.isSolidAt(400, 240), true);
  assert.equal(w.isSolidAt(100, 100), false);
});

test('a unit pushed into a wall is moved out so its edge touches the wall', () => {
  const w = world();
  const unit = { x: 310, y: 240, radius: 16 }; // 10px from the wall's left face: overlaps by 6
  assert.equal(w.resolveCircle(unit), true);
  assert.ok(Math.abs(unit.x - (320 - 16)) < 1e-6, `x ${unit.x}`);
  assert.equal(unit.y, 240);
});

test('a unit already clear of the wall is not moved', () => {
  const w = world();
  const unit = { x: 200, y: 240, radius: 16 };
  assert.equal(w.resolveCircle(unit), false);
  assert.equal(unit.x, 200);
});

test('a unit whose centre is inside a wall leaves through the nearest side', () => {
  const w = world();
  const unit = { x: 330, y: 240, radius: 16 };
  w.resolveCircle(unit);
  assert.ok(unit.x <= 320 - 16 + 1e-6);
});

test('a unit slides along a flat wall made of several tiles without snagging on the seams', () => {
  const w = new CollisionWorld();
  w.setTiles(TS, [{ x: 0, y: 160 }, { x: 160, y: 160 }, { x: 320, y: 160 }]); // a wall along y 160..320
  for (let x = 20; x <= 460; x += 20) {
    const unit = { x, y: 150, radius: 16 }; // 10px above the wall's top face
    w.resolveCircle(unit);
    assert.ok(Math.abs(unit.y - (160 - 16)) < 1e-6, `x ${x}: y ${unit.y}`);
    assert.equal(unit.x, x, `x ${x} was pushed sideways`);
  }
});

test('a solid prop blocks like a wall and can be removed', () => {
  const w = new CollisionWorld();
  const locker = w.addSolid({ x: 100, y: 100, w: 40, h: 80 });
  const unit = { x: 90, y: 140, radius: 16 };
  assert.equal(w.resolveCircle(unit), true);
  assert.ok(unit.x <= 100 - 16 + 1e-6);
  w.removeSolid(locker);
  assert.equal(w.isSolidAt(120, 140), false);
});

test('a ray stops at the first wall it meets, and passes when nothing is in the way', () => {
  const w = world();
  const hit = w.raycast(100, 240, 600, 240);
  assert.ok(hit, 'hits the wall');
  assert.ok(Math.abs(hit.x - 320) < 1e-6 && Math.abs(hit.y - 240) < 1e-6);
  assert.equal(w.raycast(100, 100, 600, 100), null, 'a ray above the wall misses it');
});

test('a ray hits a wall at an angle, and one that ends before the wall does not hit it', () => {
  const w = world();
  assert.ok(w.raycast(200, 100, 420, 320));
  assert.equal(w.raycast(100, 240, 300, 240), null);
});

test('a ray stops at a solid prop', () => {
  const w = new CollisionWorld();
  w.addSolid({ x: 100, y: 100, w: 40, h: 40 });
  const hit = w.raycast(0, 120, 300, 120);
  assert.ok(hit && Math.abs(hit.x - 100) < 1e-6);
});

test('the nearer of a wall and a prop wins', () => {
  const w = world();
  w.addSolid({ x: 200, y: 200, w: 20, h: 80 });
  const hit = w.raycast(100, 240, 600, 240);
  assert.ok(Math.abs(hit.x - 200) < 1e-6, `stopped at ${hit.x}`);
});

test('a ray that starts inside a wall hits at once', () => {
  const w = world();
  assert.equal(w.raycast(400, 240, 600, 240).t, 0);
});
