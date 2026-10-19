import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JavelinVolley, JAVELIN_FX } from '../src/warframe/abilities/excalibur_abilities.js';

test('a radial javelin launches several javelins at each enemy and they clear after they fade', () => {
  const volley = new JavelinVolley();
  const player = { x: 0, y: 0 };
  const enemies = [{ x: 100, y: 0, radius: 16 }, { x: -80, y: 40, radius: 16 }];
  volley.spawn(player, enemies);
  assert.equal(volley.javelins.length, enemies.length * JAVELIN_FX.perTarget);
  assert.equal(volley.bursts.length, 1);
  volley.update(JAVELIN_FX.flightSeconds + JAVELIN_FX.stickSeconds + 0.01);
  assert.equal(volley.javelins.length, 0, 'javelins are removed after the stick time');
  assert.equal(volley.bursts.length, 0);
});

test('no javelins when nothing is in range', () => {
  const volley = new JavelinVolley();
  volley.spawn({ x: 0, y: 0 }, []);
  assert.equal(volley.javelins.length, 0);
});
