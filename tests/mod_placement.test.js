import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canPlace, slotKind, SLOT_KINDS } from '../src/mods/placement.js';
import { Mod } from '../src/mods/mod.js';

const mod = (name, category, extra = {}) => new Mod({ name, category, ...extra });

test('a weapon mod is rejected in a Warframe normal slot', () => {
  const serration = mod('Serration', 'primary');
  assert.equal(canPlace(serration, slotKind('warframe', 4), 'warframe'), false);
});

test('a Warframe mod is rejected on a weapon', () => {
  const vitality = mod('Vitality', 'warframe');
  assert.equal(canPlace(vitality, slotKind('primary', 0), 'primary'), false);
});

test('a weapon mod fits its own weapon type', () => {
  const serration = mod('Serration', 'primary');
  assert.equal(canPlace(serration, slotKind('primary', 0), 'primary'), true);
});

test('a Warframe mod fits a Warframe normal slot', () => {
  const vitality = mod('Vitality', 'warframe');
  assert.equal(canPlace(vitality, slotKind('warframe', 4), 'warframe'), true);
});

test('without an item type the old slot rules still apply', () => {
  const serration = mod('Serration', 'primary');
  assert.equal(canPlace(serration, SLOT_KINDS.NORMAL), true);
  assert.equal(canPlace(serration, SLOT_KINDS.AURA), false);
});
