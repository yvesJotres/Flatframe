# Goal: logic parity of the Godot port with the browser build (narrowed)

The Godot port matches the browser build in everything a headless check can verify, for the modules it claims as ported. Screen, sound, input and play-through checks need a person at the game. They are tracked in [MANUAL_CHECKS.md](MANUAL_CHECKS.md), not here, so they do not block this goal.

The browser build in `src/` is the reference. It stays the source of truth. `godot/data/` stays a generated-or-copied mirror, checked by `tools/data_sync.mjs`.

**Status: narrowed on the user's instruction.** The original six criteria (full coverage, every enemy value, every JS test ported) are not met. They are not dropped: the rows that are not yet ported stay in [COVERAGE.md](COVERAGE.md) as the backlog, and the work continues there, in later sessions.

## Definition of done (narrowed scope)

The goal is met only when **all** of these hold:

1. **Claimed rows are verified.** Every row in [COVERAGE.md](COVERAGE.md) marked `ported` has a passing check, either a headless suite in `godot/tests/` or a line in `tools/number_diff.mjs` or `tools/data_sync.mjs`. A row with no check is not `ported`.
2. **Numbers for ported code.** `node godot/tools/number_diff.mjs` reports 0 mismatches for every tuning value in the rows marked `ported`. Values in `partial` or `missing` rows are not part of this criterion. They are added when their row is ported.
3. **Data.** `node godot/tools/data_sync.mjs` reports `in sync`. Every copied JSON matches its JS source by content. Every generated JSON has a re-export check. Every JS data file the Godot port uses has a copy.
4. **Tests for ported modules.** Each JS module marked `ported` has a Godot test suite in `godot/tests/` that covers its rules, and every check in every Godot suite passes. The JS test files for modules not yet ported are not part of this criterion.
5. **Same seed, same world.** The generator produces the same map, walls, spawn points and player start as the browser for the reference seeds. This is checked headless, in `tile_generator` tests.
6. **Excalibur.** Abilities 1–4, the Exalted Blade, slash dash and the dash trail are ported, and each has tests.

## Backlog (not part of this goal, tracked in COVERAGE.md)

- Every row marked `partial` or `missing` in COVERAGE.md: 56 partial and 23 missing at the time of narrowing.
- The JS test files whose modules are not yet ported. Each one is ported with its module.
- Numbers for unported units and features (for example Lancer grenades, Grineer burst timing, the Simulacrum).
- Enemy attacks specific to Lancer, Trooper and Butcher beyond the shared burst behaviour, and flanking spots (`findFlankSpot`).
- Stealth and finisher visuals, damage numbers, the Simulacrum, and the other mission types not yet started.
- Procedural sounds, visual effects and the gamepad and touch controls. These are checked in MANUAL_CHECKS.md.

## Out of scope (must be named, not silent)

- `src/debug/layout_editor.js`, `src/tools/world_builder.js`, `dev/world_builder.html`: browser authoring tools. Godot's scene editor replaces them.
- `src/engine/auto_play.js`: browser test bot. Godot's headless tests replace it.
- `src/engine/update_prompt.js`: web-only update check.
- `src/debug/cheats.js`: optional; port only if the browser still ships it in release builds.

## How progress is checked

```bash
node godot/tools/number_diff.mjs
node godot/tools/data_sync.mjs
godot --headless --path godot -s res://tests/<name>.gd   # for each file in godot/tests/
```

Every command must pass. The coverage table is updated when a row changes status.

## Working rules

- No row moves to `ported` on "looks right". It needs a passing check.
- When the JS and the Godot disagree, the JS wins unless the JS is a known bug. The bug is recorded in MIGRATION.md before it is copied or fixed.
- Keep the JS build running and passing its own tests.
