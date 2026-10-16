# Flatframe → Godot migration

Status: **vertical slice only.** The browser game in `src/` (about 21,000 lines of JavaScript) remains the source of truth. The Godot project in this folder reproduces one mission loop so the architecture can be checked before porting the rest.

## Running the slice

1. Install Godot 4.3 or newer (standard build, not .NET).
2. Open Godot, choose **Import**, and select `godot/project.godot`.
3. Press **F5**.

Controls: `W A S D` move, mouse aims, left mouse fires, `R` reloads. The mission is Exterminate, 24 kills. Press `Enter` to restart after a win or loss.

**Verified headless with Godot 4.7.2** (the console build, which prints to the terminal):

```bash
godot --headless --path godot --import                 # once, builds the class index
godot --headless --path godot -s res://tests/combat_test.gd   # 55 checks, all pass
godot --headless --path godot --quit-after 300         # loads the main scene
```

The main scene loads with no script errors. Playing it interactively has not been checked.

## What's ported

| JS source | Godot file | Notes |
|---|---|---|
| `src/warframe/player.js` (movement, aim, fire, reload) | `scripts/warframe/player.gd` | Movement speed is a placeholder (120 px/s). The JS value is not in the slice. |
| `src/weapons/weapon.js`, `projectile.js` (flight, hit) | `scripts/weapons/projectile.gd` | Straight-flying bullets only. No hitscan, crits, or status procs. |
| `src/enemies/enemy.js` (Crewman, basic chase) | `scripts/enemies/enemy.gd` | Chase inside 20 m, contact damage. No alert states, cover, or navmesh. |
| `src/missions/missions.js` (exterminate) | `scripts/game.gd` | Quota, spawn cap, spawn interval. Escalation (`levelPerKills`) not ported. |
| `src/data/data_loader.js` | `scripts/data/weapon_data.gd` | Reads the same JSON. |
| `src/combat/damage_types.js` | `scripts/combat/damage_types.gd` | Faction tables, element combinations. |
| `src/combat/damage.js` | `scripts/combat/damage.gd` | Armor reduction for players and enemies. |
| `src/combat/scaling.js` | `scripts/combat/scaling.gd` | Dual-curve level scaling, armor clamp. |
| `src/combat/critical.js` | `scripts/combat/critical.gd` | Crit chance, tiers, additive precision bonus. `roll_crit` takes an optional roll for tests. |
| `src/combat/health.js` | `scripts/combat/health.gd` | HP, shields, shield gate, magnetic stacks. A hit is a number or a Dictionary, as in JS. |
| `src/combat/status_manager.js` | `scripts/combat/status_manager.gd` | DoT tick loop. Slash only, see below. |
| `src/combat/hitzones.js` | `scripts/combat/hitzones.gd` | Head and body zones. |
| `tests/` (new) | `tests/combat_test.gd` | Headless checks for the ports above. |
| `src/data/weapons/chunks/primary-rifle.json` | `data/weapons/primary-rifle.json` | Copied. See "Data" below. |
| `src/missions/maps/exterminate_ship.json` | `data/maps/exterminate_ship.json` | Copied. Only `bounds` and `playerStart` are used; tile layers are empty in this file. |

## What's not ported yet

Listed in rough dependency order. Each row maps to the JS module it replaces.

- **Units and constants** (`src/engine/constants.js`): `UNITS_PER_METER = 15` and the timing constants are hard-coded in the slice. Move them to an autoload `Constants` singleton.
- **Tile map and collision** (`src/engine/map/*`, `src/engine/collision.js`, `src/engine/navigation/navmesh.js`, `orca.js`): Use `TileMapLayer` for the floor and walls. Use `NavigationRegion2D` plus `NavigationAgent2D` in place of the custom navmesh and ORCA avoidance. Enemy movement currently ignores walls.
- **Full weapon system** (`primary_weapon.js`, `secondary_weapon.js`, `melee_weapon.js`, `grenade.js`, `weapon_switch.js`): Only the Braton is wired up. Melee combos, parry, heavy attack, and grenades remain.
- **Status effects** (`src/combat/status_effects.js`): Configs, proc chance, proc picker, and stacking are ported to `scripts/combat/status_effects.gd`. Per-tick behaviour (Ignite armor strip, Tesla chain, Gas cloud, Blast detonation, Freeze slow, and similar) is **not** ported. The JS does not implement it either, so it needs a design decision first. Tau has no config in the JS and is not ported.
- **JS gap, present in the source:** `applyStatusEffect` calls `getEffect`, which `status_manager.js` never defined, and `createStatusEffect` produces no `tickDamage` or `interval`, so the JS `StatusManager.update` cannot tick those procs. The Godot port adds `get_effect` but keeps the same missing tick fields. Fix it deliberately, not by copying.
- **Stealth and finishers** (`src/combat/stealth.js`): Not ported. Depends on the enemy alert-state machine.
- **Damage numbers** (`src/combat/damage_numbers.js`, 340 lines): Visual only, not ported.
- **Warframe abilities** (`src/warframe/abilities/*`, `jump.js`, `warframes.js`): Bullet jump, self-revive, and abilities 1–4 are not ported.
- **Enemy factions** (`src/enemies/*`, 10 files): Only a generic Crewman stand-in exists. Port AI behaviour (`ai_behavior.js`, `patrol.js`), spawner, drop tables, and each unit.
- **Missions** (`src/missions/objective.js`, the other modes in `missions.js`): Survival, Defense, Dark Sector Defense, and Simulacrum are not started.
- **Pickups and economy** (`src/pickups/loot.js`, `src/economy/*`, `src/user/*`): Wallet, currencies, rewards, fusion, selling, and accounts. Accounts use PBKDF2 in the JS build. Godot has no built-in equivalent, so use `Crypto.hmac_digest` or a GDExtension, and pick a save format (`ConfigFile` or JSON in `user://`).
- **UI** (`src/ui/**`, `src/assets/style.css`, `colors.js`): Use `Control` nodes and a shared `Theme` resource in place of `menu_style.js`. The star chart, arsenal, profile, settings, and login screens are all still to do.
- **Input** (`src/engine/input_handler.js`, `touch_controls.js`, `gamepad.js`): Replace `Input.is_key_pressed` with a named InputMap, add gamepad support through InputMap, and add on-screen controls for mobile export.
- **Audio** (`src/engine/audio.js`, `sound_library.js`, `procedural_sounds.js`, `ui_sounds.js`, `menu_music.js`): The `.ogg` and `.mp3` files in `src/assets/sounds/` import directly into Godot. `procedural_sounds.js` needs an `AudioStreamGenerator` port.
- **Visual effects** (`src/engine/visual_effects.js`, `energy_visuals.js`, `damage_numbers.js`): Port to `GPUParticles2D` or `_draw()` helpers.
- **Settings** (`src/engine/settings.js`): Map to `ConfigFile` in `user://settings.cfg`.
- **Debug tools** (`src/debug/cheats.js`, `layout_editor.js`, `dev/world_builder.html`): Optional. Keep the browser tool for map authoring until the Godot scene editor is the preferred route.
- **Tests** (`tests/*.test.js`, 18 files, run with `node --test`): Re-create as GUT tests under `godot/tests/`. Start with the pure-logic files: `damage`, `scaling`, `loot`, `weapon_switch`.
- **Assets**: Icons (`src/assets/icons/*`) and `icon.svg` need importing. `webp` is supported by Godot 4.

## Data

The JSON in `godot/data/` is a **copy** of the files in `src/data/` and `src/missions/maps/`. Two options:

1. **Keep copying** while both builds are live. Simple, but the two can drift.
2. **Make Godot the owner** once the port is complete. Move `src/data/` into `godot/data/` and delete the JS build.

Recommended: option 2 once the slice matches the browser build for at least one full mission.

## Visual match (slice)

Ported from the browser build:
- Palette from `src/assets/colors.js`: background `#0a0a0c`, grid (15 px minor, 75 px major, same as `game.js`), accent, health red, Corpus blue for enemies, and the win/lose colours.
- HUD in `scripts/ui/hud.gd`: mission banner, health bar, ammo and reload, reticle, and the end-of-mission message.

Not matched yet: sprites and the humanoid figure in `src/engine/visual_effects.js`, shield and armor bars, menus and star chart, fonts (the Godot default is used), sound, and particle effects.

## Menus (slice)

The project now starts on `scenes/menu.tscn` (`scripts/ui/menus/main_menu.gd`):
- **Landing menu** with the four options from `main_menu.js`. Keyboard (up/down/enter/esc) and mouse work. **Navigation** opens the star chart. Arsenal, Profile, and Options show "not ported yet".
- **Star chart** (`scripts/ui/menus/star_chart.gd`): the Earth nodes, route lines, and mission panel from `star_chart.js`. Click a node, then **LAUNCH**. A 5-second countdown runs, click again or press Esc to cancel. Only Exterminate nodes launch (E Prime, Mariana), and they start `scenes/main.tscn`. Other types show "NOT PORTED YET".

Not ported from `star_chart.js` (1,090 lines): the other planets and sky nodes (Simulacrum), locked and completed-node state (`user_data.js`), the Survival, Defense, and other mission modes, the start pause toggle, and the squad and top-bar icons. The menu's title and option rows are placed by hand, not measured against the browser layout.

## Arsenal (slice)

`scripts/ui/menus/arsenal.gd` is the loadout screen, opened from the menu's **Arsenal** option. It covers:
- The four equipment cards (Warframe, Primary, Secondary, Melee), with the focused card highlighted.
- A swap list per slot (Enter or click to open, Enter or click to equip, Esc to go back). Items come from the same JSON as the browser build: 4 primaries, 1 secondary, 3 melee weapons, and the Excalibur frame.
- An info and stats panel for the focused item. Stats are shown only when the data has them.

`scripts/ui/menus/loadout.gd` holds the equipped item per slot. It is session-only, nothing is saved. The mission reads the equipped primary, so swapping to Grakata changes the gun you fire.

Not ported from `arsenal.js` (1,849 lines): mods and mod slots, mod placement and capacity, fusion, the upgrade screen, the frame's abilities, appearance, the squad and top-bar icons, the currency display, and the loadout tabs (Companion, Gear, Vehicles). Secondary and melee are equipped but not used in the mission yet.

## Mods (slice)

In the Arsenal, press **M** (or click **MODS**) on an item to open the mod screen (`scripts/ui/menus/mods_panel.gd`):
- **Installed** slots on the left, with the slot kind (aura, exilus, normal), the installed mod, and its drain. Weapons have 9 slots and Warframes have 10, as in the JS.
- **Owned mods** on the right, filtered to the item type, with drain and effect text.
- Keys: A/D or arrows switch between the lists, W/S moves, Enter installs (in the owned list) or removes (in the installed list), Esc goes back. Mouse: click a slot to select it, click a mod to install it.
- Capacity is enforced at Mastery Rank 0 (15), with the same placement rules as `placement.js`: aura slots take only aura mods, no mod is installed twice on one item, and drain must fit.

`scripts/mods/owned_mods.gd` holds the mod data (copied to `godot/data/mods/`), the owned list (copied from `owned_mods.js`), and the installed mods per item. Session-only, like the loadout.

Installed mods now change stats in the mission (`scripts/mods/mod_effects.gd`, port of `src/mods/mod_effects.js`):
- **Weapon mods** apply their percent bonuses to the equipped primary's damage, fire rate, reload speed, and magazine size. Crit, status, and the other weapon bonuses are parsed and summed, but the slice doesn't use them yet.
- **Warframe mods** apply their health, shield, and armor bonuses to the frame's base stats.

The player now takes damage through `HealthComponent` (the combat port), so shields, the shield gate, and armor reduction all apply. The HUD shows a shield bar above the health bar and the armor value beside it. Shield recharge is ported (`scripts/warframe/player.gd`, `recharge_shield`): partial shields recharge after 1 s without damage, depleted shields after 4 s, at (15 + 5% of max shield) per second, and Magnetic blocks it. Bleed-out and revive are ported (`scripts/warframe/player.gd`): lethal damage drops the player to 1 hp and starts a 20 s bleed-out. Downed players take no damage and can only aim. Holding X for 2 s revives (4 revives, restoring health and shield). If the timer runs out, the player waits for a self-revive. Running out of revives is death, and the mission ends. The HUD shows the revive count and the bleed-out timer. Not yet ported: switching to the secondary weapon while downed (the slice has no secondary firing), the revive from teammates, and the downed visuals beyond a pulsing X. Not yet ported: the shield recharge bonus and delay reduction from mods (the fields exist but no mod sets them), the other frame stats (energy, sprint speed), and armor scaling by level.

Not ported: polarity (the JS has no slot polarity data either), the fusion and upgrade screens, rank changes, and Riven and Amalgam mods. The 34 JS mods with no `compatName` can't be placed on any item, same as the JS.

## Survival (slice)

Survival runs in `scripts/game.gd` as a second mode (`Game.pending_mission`). It ports:
- **Waves**: 3 enemies in wave 1, +2 each wave, at most 6 on the field, then a 3 s break once the field is clear.
- **Life support**: starts at 100% and drops 1% every 1.5 s. Life support capsules drop every 90 s (up to 8), and walking over one adds 30%.
- **Extraction**: opens at 5:00. The pad is in the corner on the far side from the start (as `extractionPointFor` does when the map has no exit pad), and reaching it wins.
- **Failure**: life support at 0% before 5:00 loses at once. After 5:00, health drains to 5 hp over 5 minutes and then loses.

The star chart has no Survival node, in the browser build either. For the slice, a **SURVIVAL (SLICE)** button sits at the bottom right of the chart. Confirm whether you want that button or a different entry point.

Not ported: the other mission types (Defense, Capture, Spy, and so on), the mission-specific enemy and map differences, the corpse and kill-module drops, Survival's container and locker loot, and the generated map (the slice uses the Exterminate ship map for both modes).

## Accounts (`src/account`, `src/user`, `src/ui/login_screen.js`)

The Godot build now has the same account flow as the browser build:
- **Profiles** (`scripts/user/accounts.gd`): the same default fields, a create-user rule, the admin profile created at start-up, and case-insensitive name lookup. Stored in `user://users.json`.
- **Sign-in** (`scripts/user/auth.gd`): PBKDF2-HMAC-SHA256 with 100,000 iterations and a per-account salt, checked against the published test vectors. The first sign-in sets the password. "Auto login" keeps the session across launches (`user://session.json`); otherwise the session lasts until the game closes.
- **Saves** (`scripts/account/storage.gd`, `account.gd`): two alternating slots with FNV-1a checksums, read back after each write. The sections saved are loadout, mods (owned and installed), and profiles. Autosave runs every 30 s and when the window closes.
- **Login screen** (`scripts/ui/login_screen.gd`): drawn with the same box width, field and button sizes, colours, and messages. It shows at start-up until someone is signed in, and it covers the menu.

Stored data is separate from the browser build: the Godot profiles, password, and saves are on this device under `user://`, not in the browser's localStorage. The Godot Admin profile starts with no password, so the first sign-in sets it.

Also ported now:
- **Wallet** (`scripts/economy/wallet.gd`): per-profile balances in `user://wallets.json`, starting at 50 platinum, with spend-or-nothing. The starting values come from `currency_starts.json`, exported from `currencies.js`.
- **Frames** (`scripts/warframe/player_frames.gd`): Excalibur with 3 configs of 10 empty mod slots, saved and loaded.
- **Settings values** (`scripts/engine/settings.gd`): the 136 browser defaults, exported from `settings.js` into `settings_defaults.json`, with saved values merged over them.
- **Profile panel** (`scripts/ui/user_panel.gd`): opened from the Arsenal with **P** or the PROFILE button. It shows the signed-in name, signs out to the login screen, and closes with Close or Esc.

Not ported yet: the Settings menu screen (the values are stored, but no screen edits them); the squad panel and the top-bar avatar and invite icons; the browser's font (the Godot default is used, so the login and profile text are not an exact match); and `UserData`'s live change listeners (the Godot code reads and writes the store directly). The profile panel has not been captured on screen.

## Assets (`src/assets`)

- **Files** are copied into `godot/assets/`: 14 sounds (`sounds/`), the icons and `icon.svg` (`icons/`), and the Arsenal drawings (`art/`). Godot imports them directly.
- **Sounds** (`scripts/engine/sound_library.gd`): the manifest entries, with volume and random pitch, exported to `data/sounds.json`. Wired in: the menu music (`launcher_music`, looping), the reload, the revive, and the weapon and melee equip sounds in the Arsenal. The music stops when a mission starts. Weapon fire, melee swing, and UI sounds have no files in the manifest yet, so they are not wired.
- **Colours** (`scripts/ui/palette.gd`): all 46 tokens from `colors.js`, exported to `data/colors.json`. `Palette.get_color("HEALTH")` returns one. Most screens still use the same colours as hard-coded constants, not the palette lookup.
- **Earth** (`scripts/assets/planets/earth.gd`): the star chart planet draws the ocean and the 708 coastline rings from `earth_land.js`, rotating at 5°/s. Only the side facing the viewer is drawn. The browser build's tilt, clouds, ice caps, and outline are not ported. Other planets (`planets.js`) are exported but not drawn.
- **Arsenal drawings** (`scripts/assets/art/art.gd`): each equipment card shows its SVG drawing on the right.

Not ported: the Rajdhani font the browser stylesheet uses. Godot can't load a Google font without the font file, so the default font is used. To match it, add `Rajdhani` as a `.ttf` in `godot/assets/fonts/` and set it as the theme font. The HUD and menu text would then use it.

## Options and Profile (`src/ui/menus/settings.js`, `profile.js`)

- **Options** (`scripts/ui/menus/settings.gd`): all 8 categories and 150 rows, from `data/settings_sections.json` (exported from `settings.js`). Sliders can be dragged, toggles and choices work, and CONFIRM, DEFAULTS, and BACK all work too. Each change saves at once. Keys: 1-8 or Q/E for categories, W/S for rows, A/D to adjust, Enter to toggle, Esc to close.
- **Profile** (`scripts/ui/menus/profile.gd`): Overview, Stats, Loadout, and Appearance tabs. The name, Mastery Rank ring, and loadout come from the signed-in profile.

Matched to the browser at 1024×768 (`scripts/ui/menus/menu_style.gd` is the shared frame): the corner brackets, the top bar with the profile, globe and plus boxes and the currency bar, the close button, the letter-spaced title, the Options search box and icon tabs, the 31 px rows, the toggle styling, and the CONFIRM / DEFAULTS / BACK buttons. The Profile overview panel is 720 px wide with a 262 px avatar.

Still different: the browser font (Rajdhani is not bundled, so the default font is used), the category and avatar icons (drawn shapes, not the browser's glyphs), the currency icons (plain dots), and the browser's stats-row overlap on the Profile overview, which is not reproduced.

Earlier differences, now partly fixed: the category labels were cut off. The icon tabs replace them. Gamepad rebinding shows but cannot be edited (no gamepad input yet). The Profile stats and appearance options are the browser's placeholder numbers, copied as they are. Item rank is 0 for now, since the progression curve (`progression.js`) is not ported. The loadout polarity symbols and the theme palette swatches are not drawn. Neither screen has been compared with the browser pixel by pixel.

## Star chart globe (in progress)

Now matched to the browser: the chart layout (centre at 50% / 52%, radius from 30% of height or 18% of width), the space background gradient, the 80 px atmosphere halo, the progress ring, and the letter-spaced EARTH label. The weather generator is an exact port of the browser's seeded random sequence (checked against the browser's first values in `combat_test.gd`).

Still open: the continents. Root cause found: the visible coastline polygons are correct (they cover about 36% of the disc, as Earth should), but Godot's `Geometry2D.triangulate_polygon` only covers about 4% of their area, so the land triangles are wrong and `draw_colored_polygon` drops the large continents. The fix is to bake a land mask from the rings and draw the globe in a canvas shader, which needs the star chart's layers reordered (globe under the nodes and labels). Not done yet. The cloud density looks heavier than the browser's. The halo is built from 1 px rings, so it looks banded at the edge. The planet's tilt, clouds, and ice caps are ported but are not yet verified against the browser. Other planets, the Mars/Venus/Lua orbit arcs, the Simulacrum sky node, and the mission-node styling are not ported.

## Known differences from the browser build

- Player and enemy speeds, radii, and sight range are placeholders where the slice has no JS equivalent to copy.
- Enemies pass through walls (no collision layer yet).
- Projectiles are not hitscan. The Braton's `HitScan` shot type is not honoured yet.
- Coordinates: the JS uses screen pixels with 15 px per metre. The slice keeps that scale so numbers can be compared directly.

## Suggested next steps

1. Open the slice in Godot 4.3+ and fix any first-open errors. Commit only after it runs.
2. Add an autoload `Constants` and move the hard-coded values into it.
3. Port `src/combat/` as pure `RefCounted` classes with GUT tests. This is the highest-value, lowest-risk block.
4. Port `src/engine/map` and `navigation` onto `TileMapLayer` and `NavigationAgent2D`.
5. Port the enemy factions one at a time, comparing against the existing JS tests (e.g. `crewman.test.js`, `corpus_weapons.test.js`).
6. Port the UI last, after the gameplay numbers match.

## Folder layout

The scripts under `scripts/` mirror the browser's `src/` folders: `combat/`, `enemies/` (with `corpus/`), `engine/`
(with `map/`, `settings`, `sound_library`), `missions/generator/`, `mods/`, `pickups/`, `user/`, `economy/`,
`warframe/`, `weapons/`, `data/`, `ui/` (with `menus/`), and `account/` for the save file. Each Godot file is named after
the browser file it ports, so a port lives where its source lives. `game.gd` sits at the top, as `game.js` does.
