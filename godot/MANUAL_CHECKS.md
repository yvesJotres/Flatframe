# Manual checks (need a person at the game)

These checks cannot be done headless. They are not part of GOAL.md, so they do not block it. Each one ends with a note in PORT_PLAN.md saying what was seen. Record the browser and Godot builds, the seed, and the window size (1024×768 unless stated).

## Visual match

- [ ] Main menu, star chart, Arsenal, mods, Options, Profile, login, pause menu: screenshots side by side at the same seed and size. Note any difference in layout, text, colour.
- [ ] Mission HUD for each mission type: banner, shield and health bars, ammo, ability slots, POS and ANGLE read-out.
- [ ] Fonts: Rajdhani is bundled and used in Godot.
- [ ] Star chart globe: continents, cloud density, halo banding (see PORT_PLAN.md, Phase 1).

## Audio match

- [ ] Every sound in `src/assets/sounds/manifest.js` plays in the same place, with the same volume and pitch range.
- [ ] Procedural sounds (`src/engine/procedural_sounds.js`) are heard and match.
- [ ] Weapon fire, melee swing and UI sounds are wired (listed as missing in MIGRATION.md).

## Input match

- [ ] Keyboard, mouse, gamepad and touch controls work.
- [ ] Keybindings match the browser's defaults, including Shift jump, Ctrl crouch, 1 and 2 weapon switch, E melee, G grenade, X revive.

## Play-through

- [ ] Each mission type is played from start to win and to loss, with no script errors.
- [ ] Both builds run the same mission list from the same save.
- [ ] The same seed gives the same first minute of enemies and loot.

## Performance

- [ ] Frame time under 16.7 ms at 1024×768 in the star chart, the Arsenal and a mission with 24 enemies. Re-measure with `tests/measure_frames.gd`.
