import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initMeleeWeapons } from '../src/weapons/melee_weapon.js';
import { initPrimaryWeapons } from '../src/weapons/primary_weapon.js';
import { initSecondaryWeapons } from '../src/weapons/secondary_weapon.js';
import Player from '../src/warframe/player.js';
import BaseEnemy from '../src/enemies/enemy.js';

test('the finisher prompt targets an unaware enemy in reach, and a downed enemy comes first', async () => {
  await initPrimaryWeapons(); await initSecondaryWeapons(); await initMeleeWeapons();
  const player = new Player(0, 0);
  const w = player.meleeWeapon;
  const unaware = new BaseEnemy(30, 0, {});
  assert.equal(w.finisherTargetFor(player, [unaware]), unaware, 'unaware enemy in reach');
  unaware.alertState = 'alerted';
  assert.equal(w.finisherTargetFor(player, [unaware]), null, 'alerted enemy gets no prompt');
  const far = new BaseEnemy(400, 0, {});
  assert.equal(w.finisherTargetFor(player, [far]), null, 'out of reach');
  const downed = new BaseEnemy(25, 0, {});
  downed.knockDown();
  const nearUnaware = new BaseEnemy(10, 0, {});
  assert.equal(w.finisherTargetFor(player, [nearUnaware, downed]), downed, 'downed beats a closer unaware enemy');
});
