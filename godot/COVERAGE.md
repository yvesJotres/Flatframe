# Coverage: browser `src/` to Godot

One row per JS file in `src/`. Generated from the mapping in this session; update the row when a file changes status. Status meanings:

- **ported**: a Godot counterpart exists and its own tests pass. The rule is still a judgment, not a diff, until the number-diff check (`godot/tools/number_diff.mjs`) and the screenshot comparison cover it.
- **partial**: a counterpart exists, but a rule, value or screen is missing or unverified. The note says which.
- **missing**: no Godot counterpart.
- **out-of-scope**: excluded in GOAL.md with a reason.

| JS file | Godot file | Status | Note |
|---|---|---|---|
| `src/account/account.js` | `godot/scripts/account/account.gd` | partial | no dedicated headless test yet |
| `src/account/sections.js` | `godot/scripts/account/storage.gd` | partial | save sections are listed in storage/account, not one file |
| `src/account/storage.js` | `godot/scripts/account/storage.gd` | partial | two slots with checksums; no dedicated suite yet (shared or indirect coverage only) |
| `src/assets/art/art.js` | `godot/scripts/assets/art/art.gd` | partial | no dedicated headless test yet |
| `src/assets/colors.js` | `godot/scripts/ui/palette.gd` | partial | 46 tokens exported; most screens still hard-code colours |
| `src/assets/planets/earth.js` | `godot/scripts/assets/planets/earth.gd` | partial | tilt, clouds, ice caps not verified |
| `src/assets/planets/earth_land.js` | `godot/scripts/assets/planets/earth.gd` | partial | rings and land mask; no dedicated suite yet (shared or indirect coverage only) |
| `src/assets/planets/planets.js` | `godot/data/planets.json` | partial | exported as data; other planets not drawn |
| `src/assets/sounds/manifest.js` | `godot/scripts/engine/sound_library.gd` | partial | entries exported; weapon fire and UI sounds not wired |
| `src/combat/critical.js` | `godot/scripts/combat/critical.gd` | partial | no dedicated suite yet (shared or indirect coverage only) |
| `src/combat/damage.js` | `godot/scripts/combat/damage.gd` | partial | no dedicated suite yet (shared or indirect coverage only) |
| `src/combat/damage_numbers.js` | - | missing | visual only |
| `src/combat/damage_types.js` | `godot/scripts/combat/damage_types.gd` | partial | no dedicated suite yet (shared or indirect coverage only) |
| `src/combat/health.js` | `godot/scripts/combat/health.gd` | partial | no dedicated suite yet (shared or indirect coverage only) |
| `src/combat/hitzones.js` | `godot/scripts/combat/hitzones.gd` | partial | no dedicated suite yet (shared or indirect coverage only) |
| `src/combat/scaling.js` | `godot/scripts/combat/scaling.gd` | partial | no dedicated suite yet (shared or indirect coverage only) |
| `src/combat/status_effects.js` | `godot/scripts/combat/status_effects.gd` | partial | no dedicated suite yet (shared or indirect coverage only) |
| `src/combat/status_manager.js` | `godot/scripts/combat/status_manager.gd` | partial | no dedicated suite yet (shared or indirect coverage only) |
| `src/combat/stealth.js` | `godot/scripts/enemies/enemy.gd` | partial | stealth bonus only; finishers partly ported |
| `src/data/data_loader.js` | `godot/scripts/data/weapon_data.gd` | partial | reads the same JSON; not all loader paths |
| `src/data/weapon_adapter.js` | `godot/scripts/data/weapon_data.gd` | partial |  |
| `src/debug/cheats.js` | - | out-of-scope | optional; see GOAL.md |
| `src/debug/layout_editor.js` | - | out-of-scope | browser authoring tool; see GOAL.md |
| `src/economy/currencies.js` | `godot/scripts/economy/wallet.gd` | partial | starting values exported; currency UI missing |
| `src/economy/fusion.js` | `godot/scripts/economy/fusion.gd` | partial | no dedicated suite yet (shared or indirect coverage only) |
| `src/economy/item_upgrades.js` | `godot/scripts/economy/upgrades.gd` | partial | no dedicated suite yet (shared or indirect coverage only) |
| `src/economy/rewards.js` | - | missing |  |
| `src/economy/selling.js` | `godot/scripts/economy/selling.gd` | partial | no dedicated suite yet (shared or indirect coverage only) |
| `src/economy/wallet.js` | `godot/scripts/economy/wallet.gd` | partial | no dedicated suite yet (shared or indirect coverage only) |
| `src/enemies/ai_behavior.js` | `godot/scripts/enemies/enemy.gd` | partial | alert states ported; not as a separate module |
| `src/enemies/corpus/crewman.js` | `godot/scripts/enemies/corpus/crewman.gd` | partial | flanking missing; no dedicated suite yet (shared or indirect coverage only) |
| `src/enemies/corpus/moa.js` | `godot/scripts/enemies/registry.gd` | partial | stats only; no own attacks |
| `src/enemies/corpus/shield_osprey.js` | `godot/scripts/enemies/registry.gd` | partial | stats only |
| `src/enemies/drop_tables.js` | `godot/scripts/enemies/drop_tables.gd` | partial | no dedicated suite yet (shared or indirect coverage only) |
| `src/enemies/enemy.js` | `godot/scripts/enemies/enemy.gd` | partial |  |
| `src/enemies/grineer/butcher.js` | `godot/scripts/enemies/registry.gd` | partial | stats only; Cleaver melee missing |
| `src/enemies/grineer/lancer.js` | `godot/scripts/enemies/registry.gd` | partial | stats only; grenades and blind fire missing |
| `src/enemies/grineer/trooper.js` | `godot/scripts/enemies/registry.gd` | partial | Sobek pellets done; falloff missing |
| `src/enemies/infested/charger.js` | `godot/scripts/enemies/registry.gd` | partial | stats only |
| `src/enemies/infested/leaper.js` | `godot/scripts/enemies/registry.gd` | partial | stats only |
| `src/enemies/infested/runner.js` | `godot/scripts/enemies/registry.gd` | partial | stats only |
| `src/enemies/levels.js` | `godot/scripts/enemies/enemy.gd` | partial | level from kills only |
| `src/enemies/patrol.js` | `godot/scripts/enemies/enemy.gd` | partial | loops ported, not as a module |
| `src/enemies/registry.js` | `godot/scripts/enemies/registry.gd` | partial | no dedicated suite yet (shared or indirect coverage only) |
| `src/enemies/spawner.js` | `godot/scripts/game.gd` | partial | spawn rules in game.gd |
| `src/engine/audio.js` | `godot/scripts/engine/sound_library.gd` | partial |  |
| `src/engine/auto_play.js` | - | out-of-scope | test bot; see GOAL.md |
| `src/engine/collision.js` | `godot/scripts/engine/map/tile_art.gd` | missing | walls block via game.gd callable; no collision module |
| `src/engine/constants.js` | `godot/scripts/engine/constants.gd` | partial | autoload Constants; no dedicated suite yet (shared or indirect coverage only) |
| `src/engine/energy_visuals.js` | - | missing |  |
| `src/engine/frame_stats.js` | `godot/tests/measure_frames.gd` | partial | measurement only |
| `src/engine/game_clock.js` | - | missing |  |
| `src/engine/gamepad.js` | - | missing |  |
| `src/engine/input_handler.js` | `godot/scripts/warframe/player.gd` | partial | keyboard and mouse only; no InputMap |
| `src/engine/map/tile.js` | `godot/scripts/engine/map/tile_art.gd` | partial |  |
| `src/engine/map/tile_art.js` | `godot/scripts/engine/map/tile_art.gd` | partial | no dedicated headless test yet |
| `src/engine/map/tilemap.js` | `godot/scripts/missions/generator/tile_generator.gd` | partial |  |
| `src/engine/menu_music.js` | `godot/scripts/engine/sound_library.gd` | partial | menu music plays; behaviour not checked |
| `src/engine/movement.js` | `godot/scripts/warframe/player.gd` | partial | approach logic inline; no dedicated suite yet (shared or indirect coverage only) |
| `src/engine/navigation/navmesh.js` | `godot/scripts/enemies/enemy.gd` | partial | AStarGrid2D replaces navmesh |
| `src/engine/navigation/orca.js` | - | missing | no avoidance; enemies can overlap |
| `src/engine/navigation/tacmap.js` | - | missing |  |
| `src/engine/navigation/walls.js` | `godot/scripts/missions/generator/tile_generator.gd` | partial |  |
| `src/engine/procedural_sounds.js` | - | missing | needs AudioStreamGenerator |
| `src/engine/settings.js` | `godot/scripts/engine/settings.gd` | partial | no dedicated suite yet (shared or indirect coverage only) |
| `src/engine/sound_library.js` | `godot/scripts/engine/sound_library.gd` | partial | no dedicated headless test yet |
| `src/engine/touch_controls.js` | - | missing |  |
| `src/engine/ui_sounds.js` | - | missing |  |
| `src/engine/update_prompt.js` | - | out-of-scope | web-only; see GOAL.md |
| `src/engine/visual_effects.js` | - | missing |  |
| `src/game.js` | `godot/scripts/game.gd` | partial |  |
| `src/missions/generator/arena.js` | - | missing | defense arena is an open floor |
| `src/missions/generator/tile_generator.js` | `godot/scripts/missions/generator/tile_generator.gd` | partial | matches browser for 3 seeds; no dedicated suite yet (shared or indirect coverage only) |
| `src/missions/mission_stats.js` | - | missing |  |
| `src/missions/missions.js` | `godot/scripts/game.gd` | partial | node types and quotas; per-type rules placeholder |
| `src/missions/objective.js` | `godot/scripts/missions/objective.gd` | ported |  |
| `src/mods/mod.js` | `godot/scripts/mods/owned_mods.gd` | partial |  |
| `src/mods/mod_effects.js` | `godot/scripts/mods/mod_effects.gd` | partial | crit, status and other weapon bonuses not used |
| `src/mods/owned_mods.js` | `godot/scripts/mods/owned_mods.gd` | partial | no dedicated suite yet (shared or indirect coverage only) |
| `src/mods/placement.js` | `godot/scripts/ui/menus/mods_panel.gd` | partial | rules inside the panel |
| `src/pickups/loot.js` | `godot/scripts/enemies/drop_tables.gd` | partial | loot tables for drops; containers partly |
| `src/pickups/lootable.js` | `godot/scripts/pickups/mission_locker.gd` | partial | gate, locker and container split across three files |
| `src/progression/progression.js` | `godot/scripts/progression/progression.gd` | ported |  |
| `src/tools/world_builder.js` | - | out-of-scope | browser authoring tool; see GOAL.md |
| `src/ui/currency_toast.js` | `godot/scripts/ui/currency_toast.gd` | ported |  |
| `src/ui/dropdown.js` | - | missing |  |
| `src/ui/focus_sound.js` | `godot/scripts/ui/menus/main_menu.gd` | partial | main menu only |
| `src/ui/hud.js` | `godot/scripts/ui/hud.gd` | partial | layout matched by eye |
| `src/ui/login_screen.js` | `godot/scripts/ui/login_screen.gd` | partial | no dedicated headless test yet |
| `src/ui/menus/arsenal.js` | `godot/scripts/ui/menus/arsenal.gd` | partial | main view only; swap grid, filter, search missing |
| `src/ui/menus/back_button.js` | - | missing |  |
| `src/ui/menus/main_menu.js` | `godot/scripts/ui/menus/main_menu.gd` | partial |  |
| `src/ui/menus/menu_style.js` | `godot/scripts/ui/menus/menu_style.gd` | partial |  |
| `src/ui/menus/mission_select.js` | - | missing |  |
| `src/ui/menus/pause_menu.js` | `godot/scripts/ui/menus/pause_menu.gd` | ported | 5 checks in `pause_test.gd`, run through the main scene |
| `src/ui/menus/profile.js` | `godot/scripts/ui/menus/profile.gd` | partial | stats and appearance placeholders |
| `src/ui/menus/settings.js` | `godot/scripts/ui/menus/settings.gd` | partial | not pixel-checked |
| `src/ui/menus/star_chart.js` | `godot/scripts/ui/menus/star_chart.gd` | partial | Simulacrum and locked nodes missing |
| `src/ui/menus/top_bar.js` | - | missing |  |
| `src/ui/menus/work_in_progress.js` | `godot/scripts/ui/menus/work_in_progress.gd` | ported |  |
| `src/ui/palette.js` | `godot/scripts/ui/palette.gd` | ported | 5 checks in `palette_test.gd`; colours also checked by `data_sync.mjs` |
| `src/ui/simulacrum/core/menu.js` | - | missing |  |
| `src/ui/simulacrum/core/spawner.js` | - | missing |  |
| `src/ui/simulacrum/entities/simulacrum_console.js` | - | missing |  |
| `src/ui/simulacrum/entities/wall.js` | - | missing |  |
| `src/ui/squad.js` | - | missing |  |
| `src/ui/theme.js` | `godot/scripts/ui/menus/menu_style.gd` | partial |  |
| `src/ui/user_panel.js` | `godot/scripts/ui/user_panel.gd` | partial | no dedicated headless test yet; not captured on screen |
| `src/user/accounts.js` | `godot/scripts/user/accounts.gd` | partial | no dedicated headless test yet |
| `src/user/auth.js` | `godot/scripts/user/auth.gd` | partial | PBKDF2 test vectors pass; no dedicated suite yet (shared or indirect coverage only) |
| `src/user/user_data.js` | `godot/scripts/account/account.gd` | partial | no live change listeners |
| `src/warframe/abilities/excalibur_abilities.js` | `godot/scripts/warframe/abilities/excalibur_abilities.gd`, `exalted_blade.gd`, `energy_wave.gd`, `slash_dash.gd`, `dash_trail.gd` | ported | logic and numbers; 36 checks in `excalibur_test.gd`. Javelin and wave drawings not ported |
| `src/warframe/jump.js` | `godot/scripts/warframe/jump.gd` | ported | hop, double jump, bullet jump; 17 checks in `parkour_test.gd` |
| `src/warframe/library.js` | `godot/scripts/warframe/player_frames.gd` | partial |  |
| `src/warframe/player.js` | `godot/scripts/warframe/player.gd` | partial | parkour and crouch ported; bullet jump trail and crouched figure not drawn |
| `src/warframe/player_frames.js` | `godot/scripts/warframe/player_frames.gd` | partial | no dedicated suite yet (shared or indirect coverage only) |
| `src/warframe/warframes.js` | `godot/scripts/warframe/player_frames.gd` | partial |  |
| `src/warframe/weapon_switch.js` | `godot/scripts/warframe/player.gd` | partial | F swaps primary and secondary on a tap; the hold action is not ported |
| `src/weapons/grenade.js` | `godot/scripts/weapons/grenade.gd` | partial | no dedicated suite yet (shared or indirect coverage only) |
| `src/weapons/melee_weapon.js` | `godot/scripts/warframe/player.gd` | partial | combo, heavy and parry in player.gd |
| `src/weapons/primary_weapon.js` | `godot/scripts/warframe/player.gd` | partial |  |
| `src/weapons/projectile.js` | `godot/scripts/weapons/projectile.gd` | partial | no hitscan |
| `src/weapons/secondary_weapon.js` | `godot/scripts/warframe/player.gd` | partial |  |
| `src/weapons/weapon.js` | `godot/scripts/warframe/player.gd` | partial |  |

## Summary

- ported: 8
- partial: 88
- missing: 23
- out-of-scope: 5
- total: 124 (matches the 124 JS files in src/)
