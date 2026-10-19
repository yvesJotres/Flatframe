// Enemies only know where the player is when they see the player (within sight range and not through a wall),
// or when another enemy that saw the player is still alive and tells them where it is.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isInVisionCone, SIGHT_RANGE_M } from '../src/enemies/enemy.js';
import { collision } from '../src/engine/collision.js';
import { UNITS_PER_METER } from '../src/engine/constants.js';
import Crewman from '../src/enemies/corpus/crewman.js';
import { initPrimaryWeapons } from '../src/weapons/primary_weapon.js';
import { initSecondaryWeapons } from '../src/weapons/secondary_weapon.js';
import { initMeleeWeapons } from '../src/weapons/melee_weapon.js';

await initPrimaryWeapons();
await initSecondaryWeapons();
await initMeleeWeapons();

const player = (x, y) => ({ x, y, radius: 16 });

test('an enemy does not see the player beyond its sight range, even straight ahead', () => {
  collision.clear();
  const e = new Crewman(0, 0, { lvl: 1 });
  e.angle = 0;
  assert.equal(isInVisionCone(e, player(10 * UNITS_PER_METER, 0)), true, 'close, in front: seen');
  assert.equal(isInVisionCone(e, player((SIGHT_RANGE_M + 10) * UNITS_PER_METER, 0)), false, 'far in front: not seen');
});

test('a wall between the enemy and the player blocks sight', () => {
  collision.clear();
  collision.setTiles(160, [{ x: 320, y: -80 }, { x: 320, y: 0 }, { x: 320, y: 80 }]);
  const e = new Crewman(0, 0, { lvl: 1 });
  e.angle = 0;
  assert.equal(isInVisionCone(e, player(600, 0)), false, 'a wall in the line of sight');
  assert.equal(isInVisionCone(e, player(200, 0)), true, 'in front of the wall: seen');
  collision.clear();
});

test('a prop (a locker or container) blocks sight too', () => {
  collision.clear();
  collision.addSolid({ x: 200, y: -40, w: 40, h: 80 });
  const e = new Crewman(0, 0, { lvl: 1 });
  e.angle = 0;
  assert.equal(isInVisionCone(e, player(400, 0)), false);
  collision.clear();
});

test('an unalerted enemy far away never becomes alerted from its patrol', () => {
  collision.clear();
  const e = new Crewman(0, 0, { lvl: 1 });
  e.angle = 0;
  const far = player((SIGHT_RANGE_M + 30) * UNITS_PER_METER, 0);
  for (let i = 0; i < 300; i++) e.update(1 / 60, [far], [], []);
  assert.equal(e.alertState, 'unalerted', 'it stays unalerted');
});

test('an alert passed on from a living enemy gives the place it was seen, not the player position', () => {
  collision.clear();
  const spotter = new Crewman(100, 100, { lvl: 1 });
  const other = new Crewman(300, 100, { lvl: 1 });
  spotter.alertState = 'alerted';
  spotter.focus = player(160, 100);
  spotter.alertNearbyEnemies([spotter, other]);
  assert.equal(other.alertState, 'cautious', 'the other enemy is alerted to cautious');
  // It searches toward the spotter's position (east-west line through 100), not toward the player's exact spot
  const expected = Math.atan2(100 - 100, 100 - 300); // angle from the other enemy to the spotter
  assert.ok(Math.abs(other.lastSoundAngle - expected) < 1e-9, `searches toward the spotter (${other.lastSoundAngle})`);
});

// Gunshots: enemies hear a shot only when they are in the same room as the shot
import { updateEnemies, setHearingRooms } from '../src/enemies/ai_behavior.js';

const ROOM_A = { x: 0, y: 0, w: 1000, h: 1000 };
const ROOM_B = { x: 1000, y: 0, w: 1000, h: 1000 };

test('an unalerted enemy in the same room as a shot turns cautious toward it', () => {
  collision.clear();
  setHearingRooms([ROOM_A, ROOM_B]);
  const shooter = { x: 500, y: 500, radius: 16, alive: true, isBleedingOut: false, noiseSerial: 1, lastNoisePosition: { x: 500, y: 500 } };
  const sameRoom = new Crewman(200, 500, { lvl: 1 });
  updateEnemies(1 / 60, [sameRoom], shooter, null, []);
  assert.equal(sameRoom.alertState, 'cautious', 'the enemy in the same room heard the shot');
  setHearingRooms(null);
});

test('an enemy in another room does not hear the shot', () => {
  collision.clear();
  setHearingRooms([ROOM_A, ROOM_B]);
  const shooter = { x: 500, y: 500, radius: 16, alive: true, isBleedingOut: false, noiseSerial: 2, lastNoisePosition: { x: 500, y: 500 } };
  const otherRoom = new Crewman(1500, 500, { lvl: 1 });
  updateEnemies(1 / 60, [otherRoom], shooter, null, []);
  assert.equal(otherRoom.alertState, 'unalerted', 'the enemy in the other room did not hear');
  setHearingRooms(null);
});

test('a shot is heard once, not again every frame', () => {
  collision.clear();
  setHearingRooms([ROOM_A]);
  const shooter = { x: 500, y: 500, radius: 16, alive: true, isBleedingOut: false, noiseSerial: 3, lastNoisePosition: { x: 500, y: 500 } };
  const e = new Crewman(200, 500, { lvl: 1 });
  updateEnemies(1 / 60, [e], shooter, null, []);
  const first = e.lastSoundAngle;
  e.lastSoundAngle = 123; // change it: a repeat hearing of the same shot would reset it to the shot's direction
  updateEnemies(1 / 60, [e], shooter, null, []);
  assert.equal(e.lastSoundAngle, 123, 'the same shot is not heard twice');
  void first;
  setHearingRooms(null);
});

// Bodies: an unalerted enemy that sees a dead body becomes alerted; one that cannot see it does not
import { setBodies } from '../src/enemies/ai_behavior.js';

test('an unalerted enemy that sees a body becomes alerted; one that cannot see it stays unalerted', () => {
  collision.clear();
  setHearingRooms(null);
  const body = { x: 300, y: 0, radius: 16, age: 1 };
  const seesIt = new Crewman(0, 0, { lvl: 1 });
  seesIt.angle = 0;
  const behindIt = new Crewman(0, 0, { lvl: 1 });
  behindIt.angle = Math.PI; // facing away
  const player = { x: -9999, y: -9999, radius: 16, alive: false, isBleedingOut: true };
  setBodies([body]);
  updateEnemies(1 / 60, [seesIt, behindIt], player, null, []);
  assert.equal(seesIt.alertState, 'alerted', 'the enemy that sees the body is alerted');
  assert.equal(behindIt.alertState, 'unalerted', 'the enemy facing away is not');
  setBodies([]);
});
