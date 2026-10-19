import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SlashDash, SLASH_DASH } from '../src/warframe/abilities/excalibur_abilities.js';

function enemy(x, y) {
  return {
    x, y, radius: 16, hp: 1000, hits: 0,
    takeDamage(damage) { this.hits += 1; this.hp -= damage; },
  };
}

function player() {
  return { x: 0, y: 0, radius: 16, energy: 100, moveSpeed: 100, velocity: { x: 0, y: 0 } };
}

// Runs the dash for up to `seconds` in small frames until it stops
function run(dash, p, enemies, seconds = 5) {
  dash.update(0, p, enemies);
  for (let t = 0; t < seconds && dash.active; t += 1 / 60) dash.update(1 / 60, p, enemies);
}

test('Slash Dash locks onto an enemy in the aim direction and chains to the next one within 7 m', () => {
  const dash = new SlashDash();
  const p = player();
  const first = enemy(200, 0);
  const second = enemy(200, 80); // 80 units from the first, inside the 105-unit chain range
  const far = enemy(900, 0);     // beyond the chain from the second enemy
  dash.activate(p, 0);
  run(dash, p, [first, second, far]);
  assert.equal(first.hits, 1, 'first enemy struck once');
  assert.equal(second.hits, 1, 'second enemy struck via chain');
  assert.equal(far.hits, 0, 'out-of-chain enemy not struck');
  assert.equal(dash.active, false, 'dash ends when nothing is left to chain to');
});

test('Slash Dash with no enemy in the aim cone runs straight and strikes what its path crosses', () => {
  const dash = new SlashDash();
  const p = player();
  const onPath = enemy(100, 0);
  const aside = enemy(0, 200); // 90° off the aim direction, outside the 60° cone
  dash.activate(p, 0);
  run(dash, p, [onPath, aside]);
  assert.equal(onPath.hits, 1);
  assert.equal(aside.hits, 0);
  assert.ok(p.x <= SLASH_DASH.range + 1e-6, 'straight dash stops at its range');
});

test('each enemy is struck once per dash', () => {
  const dash = new SlashDash();
  const p = player();
  const only = enemy(150, 0);
  dash.activate(p, 0);
  run(dash, p, [only]);
  assert.equal(only.hits, 1);
});

test('Slash Dash damage is 100 at no combo and caps at 2.75× with the combo bonus', () => {
  const dash = new SlashDash();
  const withTier = (tier) => ({ meleeWeapon: { getComboMultiplier: () => tier } });
  assert.equal(dash.strikeDamage(withTier(1)), 100);
  assert.equal(dash.strikeDamage(withTier(2)), 125);
  assert.equal(dash.strikeDamage(withTier(12)), 275);
});
