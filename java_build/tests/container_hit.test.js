import { test } from 'node:test';
import assert from 'node:assert/strict';
import { segmentTouchesRect, Container } from '../src/pickups/lootable.js';

const box = { x: 100, y: 100, w: 56, h: 56 };

test('a shot touches the container anywhere on its box, not only the centre', () => {
  assert.ok(segmentTouchesRect(0, 102, 200, 102, box), 'a shot along the top edge');
  assert.ok(segmentTouchesRect(0, 150, 200, 150, box), 'a shot through the middle');
  assert.ok(segmentTouchesRect(96, 96, 104, 104, box), 'a shot clipping the corner');
  assert.ok(!segmentTouchesRect(0, 0, 50, 50, box), 'a shot that misses');
  assert.ok(!segmentTouchesRect(0, 150, 90, 150, box), 'a shot that stops short');
});

test('a container takes damage from a hit on its edge', () => {
  const c = new Container({ id: 'c', kind: 'common', x: 100, y: 100, w: 56, h: 56 });
  assert.ok(c.touchedBy(0, 100, 200, 100, 4));
  c.takeDamage({ total: 10 });
  assert.equal(c.hp, c.maxHp - 10);
});
