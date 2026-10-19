import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initPrimaryWeapons } from '../src/weapons/primary_weapon.js';
import { initSecondaryWeapons } from '../src/weapons/secondary_weapon.js';
import { initMeleeWeapons } from '../src/weapons/melee_weapon.js';
import Player from '../src/warframe/player.js';

test('the melee blade sweeps from one side of the swing arc to the other', async () => {
  await initPrimaryWeapons(); await initSecondaryWeapons(); await initMeleeWeapons();
  const player = new Player(0, 0);
  const halfArc = (player.meleeWeapon.attack.arc ?? 120) * Math.PI / 180 / 2;
  assert.equal(player.swingOffset(), 0, 'resting: held forward');
  player.meleeSwingTimer = 0.15;
  player.meleeSwingType = 'normal';
  assert.ok(Math.abs(player.swingOffset() + halfArc) < 1e-9, 'starts at one side of the arc');
  player.meleeSwingTimer = 0.0001;
  assert.ok(Math.abs(player.swingOffset() - halfArc) < 0.01, 'ends at the other side');
});

test('idle, the melee blade stands upright on screen, 15 degrees to the right, whatever the aim', async () => {
  await initPrimaryWeapons(); await initSecondaryWeapons(); await initMeleeWeapons();
  const player = new Player(0, 0);
  for (const aim of [0, 1.2, -2.5]) {
    player.angle = aim;
    const onScreen = player.meleeBladeAngle() + player.angle;
    assert.ok(Math.abs(onScreen - (-Math.PI / 2 + 15 * Math.PI / 180)) < 1e-9, `aim ${aim}`);
  }
});

test('a heavy attack wind-up longer than its visual never pushes the swing progress out of 0..1', async () => {
  await initPrimaryWeapons(); await initSecondaryWeapons(); await initMeleeWeapons();
  const player = new Player(0, 0);
  player.meleeSwingType = 'heavy';
  player.meleeSwingDuration = 0.8;
  player.meleeSwingTimer = 0.8;
  assert.equal(player.swingProgress(), 0, 'the wind-up is the swing length, so the swing starts at 0');
  player.meleeSwingTimer = 0.2;
  assert.ok(Math.abs(player.swingProgress() - 0.75) < 1e-9);
  player.meleeSwingTimer = -0.5;
  assert.equal(player.swingProgress(), 1, 'clamped at the end');
});
