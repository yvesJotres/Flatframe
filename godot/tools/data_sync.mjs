// Checks that the Godot data in godot/data/ still matches the browser build (src/), the owner of the data
// (see GOAL.md, criterion 3). Usage: node godot/tools/data_sync.mjs   (exit 1 on any drift)
import { readFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

let drift = 0;

// Copied JSON: godot path -> JS source path. Compared by content, not bytes.
const COPIES = {
  'godot/data/mods/mods-damage.json': 'src/data/mods/chunks/mods-damage.json',
  'godot/data/mods/mods-elemental.json': 'src/data/mods/chunks/mods-elemental.json',
  'godot/data/mods/mods-utility.json': 'src/data/mods/chunks/mods-utility.json',
  'godot/data/warframes/warframes-tenno.json': 'src/data/warframes/chunks/warframes-tenno.json',
  'godot/data/weapons/melee-sword.json': 'src/data/weapons/chunks/melee-sword.json',
  'godot/data/weapons/primary-rifle.json': 'src/data/weapons/chunks/primary-rifle.json',
  'godot/data/weapons/secondary-pistol.json': 'src/data/weapons/chunks/secondary-pistol.json',
  'godot/data/maps/exterminate_ship.json': 'src/missions/maps/exterminate_ship.json',
};

// Key order does not matter: sort object keys before comparing
const canon = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x)
  ? Object.fromEntries(Object.keys(x).sort().map((key) => [key, x[key]])) : x));

const check = (label, expected, gdFile) => {
  const got = JSON.parse(readFileSync(gdFile, 'utf8'));
  if (canon(expected) !== canon(got)) { drift++; console.log(`DRIFT  ${gdFile}  !=  ${label}`); }
  else console.log(`ok     ${gdFile}  (from ${label})`);
};

for (const [gd, js] of Object.entries(COPIES)) {
  check(js, JSON.parse(readFileSync(js, 'utf8')), gd);
}

// Generated JSON: rebuilt from the JS module in Node, then compared
const js = (p) => import(pathToFileURL(p).href);
const colors = (await js('src/assets/colors.js')).default;
const earth = await js('src/assets/planets/earth.js');
const planets = await js('src/assets/planets/planets.js');
const landRings = (await js('src/assets/planets/earth_land.js')).EARTH_LAND_RINGS;
const currencies = (await js('src/economy/currencies.js')).CURRENCY_DEFS;
const sounds = (await js('src/assets/sounds/manifest.js')).SOUND_MANIFEST;

check('src/assets/colors.js', colors, 'godot/data/colors.json');
check('src/assets/planets/earth.js', { colors: earth.EARTH_COLORS, spin: earth.EARTH_SPIN }, 'godot/data/earth.json');
check('src/assets/planets/planets.js', {
  PLANET_BODY_COLORS: planets.PLANET_BODY_COLORS,
  PLANET_LAND_PATCHES: planets.PLANET_LAND_PATCHES,
  PLANET_LAND_RGB: planets.PLANET_LAND_RGB,
  ATMOSPHERE_COLORS: planets.ATMOSPHERE_COLORS,
}, 'godot/data/planets.json');
check('src/assets/planets/earth_land.js', landRings, 'godot/data/earth_land.json');
check('src/economy/currencies.js (start values)',
  Object.fromEntries(Object.entries(currencies).map(([k, v]) => [k, v.start])), 'godot/data/currency_starts.json');

// sounds.json is the manifest plus ui_hover, which src/engine/audio.js registers outside the manifest (volume 0.4)
const soundsGd = JSON.parse(readFileSync('godot/data/sounds.json', 'utf8'));
const { ui_hover: hover, ...soundsRest } = soundsGd;
// The JS stores each file as a URL, Godot as the bare filename: compare on the filename
// The JS omits "rate" when a sound has no pitch range, Godot writes null: both mean none
const basename = (f) => f.split('/').pop();
const normalise = (v) => {
  const { rate, ...rest } = v;
  return { ...rest, file: basename(rest.file), rate: rate ?? null };
};
const jsSounds = Object.fromEntries(Object.entries(sounds).map(([k, v]) => [k, normalise(v)]));
const gdSounds = Object.fromEntries(Object.entries(soundsRest).map(([k, v]) => [k, normalise(v)]));
if (canon(jsSounds) !== canon(gdSounds) || hover?.volume !== 0.4 || hover?.category !== 'ui') {
  drift++;
  console.log('DRIFT  godot/data/sounds.json  !=  src/assets/sounds/manifest.js + ui_hover in src/engine/audio.js');
} else {
  console.log('ok     godot/data/sounds.json  (manifest + ui_hover from src/engine/audio.js)');
}

// src/engine/settings.js reads localStorage when it loads, so Node gets a stub first
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
const settingsJs = await js('src/engine/settings.js');
check('src/engine/settings.js (DEFAULT_SETTINGS)', settingsJs.DEFAULT_SETTINGS, 'godot/data/settings_defaults.json');
check('src/engine/settings.js (SETTING_SECTIONS)', settingsJs.SETTING_SECTIONS, 'godot/data/settings_sections.json');

// JS data the Godot port does not copy yet
for (const f of ['src/data/index.json', 'src/missions/maps/defense_outpost.json',
  'src/missions/maps/survival_arena.json', 'src/missions/maps/simulacrum_arena.json']) {
  if (existsSync(f)) console.log(`gap    ${f}  has no Godot copy`);
}

console.log(`\n${drift === 0 ? 'in sync' : `${drift} drift`}`);
process.exit(drift ? 1 : 0);
