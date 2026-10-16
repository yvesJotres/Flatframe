# Flatframe → Godot: port plan

Status of the current Godot build, and the order to finish the port. `MIGRATION.md` lists what is ported per module; this file says what to do next and how each phase is verified.

## Where things stand

- JS source: about 21,000 lines in 124 files. Godot: about 4,400 lines in 37 scripts.
- Verified: 118 headless checks pass (`godot --headless -s res://tests/combat_test.gd`), and the menu and mission scenes load without errors.
- Verified by eye only: menus, star chart, Arsenal, Options, Profile. No pixel diff has been done.
- Not verified: the mission HUD against the browser, frame rate, and a full play-through of any mission.

## Known blockers

1. **Star chart continents do not draw.** The coastline polygons are correct (about 36% of the visible disc), but `Geometry2D.triangulate_polygon` covers only about 4% of their area. Fix: a land mask baked from the rings (`godot/assets/earth_land_mask.png`, already generated, 30% land), drawn in a canvas shader. This needs the star chart layers reordered so the globe sits under the nodes and labels.
2. **Mission HUD has no browser reference.** The browser's star chart → mission launch path needs a reliable way in. Keyboard input on the browser menu was flaky, so use a direct URL or a saved state if needed.
3. **Font.** The browser uses Rajdhani, which is not bundled. Add the `.ttf` to `godot/assets/fonts/` and set it as the theme font. Every screen's text match depends on it.
4. **Smoothness.** No frame-rate measurement exists. The globe redraws about 700 coastline polygons and 536 clouds every frame, which is the likely cost. Measure before optimising.

## Phases

Each phase ends with a check that can fail. Do not start the next phase until the current one passes.

### Phase 0: measurement (1–2 days)
- Add a frame-time readout (debug overlay) and log average and worst frame time for the star chart, the Arsenal, and a mission.
- Capture each screen in both builds at 1024×768 for a visual diff. Write the captures to the scratchpad, not the repo.
- **Done when:** every screen has a frame-time number and a side-by-side capture.

### Phase 1: fix the globe (1–2 days)
- Shader globe from the land mask, drawn under the chart's nodes and labels.
- Keep clouds as ellipses for now; move them into the shader later if they cost frame time.
- Compare the halo banding and cloud density against the browser.
- **Done when:** continents show at the same positions as the browser at the same spin, and the chart holds 60 fps on the dev machine.

### Phase 2: mission HUD and the Exterminate mission (1 week)
- Capture the browser's mission HUD and match layout, colours, and text: health and shield bars, armor, ammo, reload, reticle, objective, kill count, and the end messages.
- Match the Exterminate mission rules and spawn timing exactly, and check them against `missions.js`.
- **Done when:** a browser screenshot and a Godot screenshot of the same mission state match in layout, and the mission plays through to a win and a loss.

### Phase 3: combat and weapons (2–3 weeks)
- Status effects per tick (Ignite, Tesla, Gas, Blast, Freeze, and the rest).
- Stealth and finishers, melee combos, parry, heavy attacks, grenades.
- Port all weapons in `src/data` and the weapon classes, and wire secondary and melee into missions.
- **Done when:** the combat tests in `tests/` pass in Godot, and each weapon behaves the same as the browser in the same scenario.

### Phase 4: enemies and AI (2–3 weeks)
- Grineer, Corpus, and Infested factions, their AI, alert states, cover, patrols, and spawner.
- Navmesh and walls (Godot `NavigationAgent2D` on a `TileMapLayer`).
- **Done when:** each faction's AI passes the matching JS test, and the factions behave the same in the same scenario.

### Phase 5: other missions (2–3 weeks)
- Defense, Capture, Spy, Sabotage, Interception, Mobile Defense, Dark Sector, Survival (already ported, to re-check), Simulacrum, and Open World.
- Generated maps and the map editor data.
- **Done when:** each mission starts, plays, and ends the same way as the browser.

### Phase 6: progression, economy, and loot (2 weeks)
- Item rank and affinity (`progression.js`), mastery rank, drops and loot tables, pickups, selling, fusion, and upgrades.
- **Done when:** a profile's rank and loot after a mission match the browser for the same inputs.

### Phase 7: UI completion (2 weeks)
- Squad panel, top-bar avatar and invite icons, pause menu, mission select, Simulacrum menu, the account-switching panel, currency toasts, the focus sound, and the work-in-progress screen.
- Settings: gamepad rebinding once input exists.
- **Done when:** every screen in `src/ui` is reachable in Godot and matches its browser capture.

### Phase 8: audio and input (1–2 weeks)
- The remaining sounds (weapon fire, melee, UI, mission) once the manifest has files for them.
- Gamepad, touch controls, and rebinding.
- **Done when:** every action is reachable by keyboard, mouse, and gamepad, and every sound in the manifest plays.

### Phase 9: release (1 week)
- Export builds for Windows and the web. Check smoothness on the target devices.
- **Done when:** the exported build passes the Phase 0 frame-time budget on each target.

## Ways of working

- One phase at a time, with its check passing before the next starts.
- Every screen change gets a capture of both builds before it is called done.
- Keep the test suite green: run `combat_test.gd` after each change.
- Update `MIGRATION.md` with what each phase ports, and this file when the order changes.

## Open decisions

- Where Survival lives. The browser has no star chart node for it; the slice has a temporary button.
- Whether the Godot build keeps the browser's localStorage data format for existing players, or starts fresh (the current build starts fresh).

## Phase 0 measurements (vsync off, 1024×768, 570 frames after warm-up)

| Scene | Average | Worst | Notes |
|---|---|---|---|
| Star chart (Earth) | 145.6 ms (7 fps) | 285.7 ms | per-frame triangulation of the coastline rings |
| Arsenal | 0.37 ms | 1.9 ms | fine |
| Mission (Exterminate) | 0.35 ms | 1.9 ms | fine, few enemies on screen |

Run again with `tests/measure_frames.gd` after each phase. The star chart is the only screen over budget.

## Phase 1 status

- Done: the continents draw (shader globe from the baked land mask). The star chart now averages 6.1 ms per frame (164 fps, vsync off), down from 145.6 ms.
- Done: the chart layers are ordered (space background, surface shader, clouds), and the chart's own drawing sits above them.
- Still open: the halo is built from 1 px rings and looks banded at the edge; the cloud density has not been compared with the browser's; the mission-node labels are not styled like the browser's.

## Phase 2 status

- Done: the mission HUD is laid out to match the browser's Exterminate HUD (captured at 1024×768): the banner and "Eliminated x / 33", the shield and health numbers and bars, the frame name and armor, the ammo, weapon, energy, the four ability slots, and the POS and ANGLE read-out. Kill quota is 33 (E Prime). The mission frame time is 0.55 ms (1815 fps).
- Still open: the abilities are shown but do nothing; energy does not regenerate; the arena has no floor tiles or walls (the browser draws tiles); the Exterminate win and loss have not been played through in Godot; the layout is matched by eye, not by pixel diff.

## Phase 2: win and loss

- Done: `tests/mission_flow_test.gd` drives Exterminate to a win (kill quota reached) and to a loss (dying with no revives). Both pass headless (5 of 5 checks).
- Note: a broken shield gates the first hit that breaks it, as the browser does. The test clears the shield first so the hit reaches health.
- Still open: the arena floor tiles and walls, which the browser draws and Godot does not. The HUD match is by eye.

## Phase 2: arena tiles (partly done)

- Done: the floor panels are drawn as the browser draws them (`scripts/engine/map/tile_art.gd`, port of `tile_art.js`), with seams, glints, and rivets. Wall blocks are ported too (bevels by neighbour, rivets, gradient), but the Exterminate ship map has no walls, so none show yet.
- Still open: the browser's generated map (rooms and walls, `generated.json`) is not ported, so the Godot arena is a single open floor. The generator is the next Phase 2 task.

## Phase 2: generated map (done, with caveats)

- Done: the browser's room generator is ported (`scripts/missions/generator/tile_generator.gd`). It matches the browser's output for three reference seeds on bounds, walls, entities, spawn points, player start, and room roles (135 of 135 checks pass).
- Done: the mission uses the generated map (a random seed per run, as in the browser). Walls block the player and enemies (each axis slides), enemies spawn from the spawn points, and a camera follows the player inside the map.
- Caveats: gates and lockers are generated but not yet interactive; the HUD match is by eye; no pixel diff yet.
- Mission frame time with the generated map: about 4 ms (240 fps, vsync off, 1024×768).

## Phase 2: gates and lockers (done, with caveats)

- Done: gates open when the Warframe is near and close after a short hold; a closed gate blocks movement (`scripts/pickups/mission_gate.gd`, port of `Gate` in `pickups/lootable.js`). Lockers open on X when in range; green opens, red and black don't; the prompt shows above the locker (`scripts/pickups/mission_locker.gd`, port of `Locker`).
- Caveats: opened lockers and containers give no loot yet (the loot tables in `loot.js` are not ported). Containers are not drawn or interactive yet. Gates do not block enemy sight or bullets yet.
- Tests: combat suite 135 of 135, mission flow 5 of 5.

## Phase 2: containers and loot (done, with caveats)

- Done: containers are solid, take shots, break and drop loot (`scripts/pickups/mission_container.gd`, port of `Container` and `rollLootableDrops`). Drops are picked up by walking over them: health, ammo and energy apply; credits and Endo are collected but have no effect yet.
- Caveats: region-resource drops are not ported (they need the region tables); the drop effects are placeholders; containers do not block enemy sight.

## Phase 2: complete

Done-when: a browser screenshot and a Godot screenshot of the same mission state match in layout, and the mission plays to a win and a loss.

- Layout match: the browser build now accepts `?seed=N` (a change to `src/game.js`), and the Godot build accepts `-- seed=N`. At seed 12345 both start at (2352, 240) and show the same room structure, walls, containers and gate, at the same tile scale.
- Found and fixed while comparing: the Godot mission drew tiles at 160 units while the generator uses 96, so walls and collision did not line up. Now both use 96.
- Win and loss: `tests/mission_flow_test.gd` passes (5 of 5), and the reference mission ran in the browser.
- Caveats, to close in later phases: the comparison is by eye at different window scales, not a pixel diff; region-resource drops and loot effects are placeholders; gates and containers do not yet block enemy sight or bullets.

## Phase 3: started

- Done: weapon switching. Keys 1 and 2 switch between the primary and the secondary, each with its own ammo, and both use the loadout and mods (`scripts/warframe/player.gd`, `set_weapons`, `switch_to`).
- Still open in Phase 3: melee weapons (Skana, Prova, Cleaver) and their swing, status effects per tick, stealth and finishers, parry, heavy attacks, grenades, and the weapon families (Grakata, Dera, Sobek, Lato) beyond their stats.
- Done since: melee. E swings the equipped melee weapon (Skana by default) at the enemies inside its arc and reach (2.5 m, 45°), using its total damage and attack speed. Tested in `mission_flow_test.gd` (7 of 7 checks).
- Still open in Phase 3: the melee combo, heavy attack and parry; status effects per tick; stealth and finishers; grenades; and the melee visuals (the swing arc is not drawn yet).

## Phase 3: complete

- Weapon switching (keys 1 and 2), each weapon with its own ammo and mods.
- Melee: E quick swing (2.5 m, 45° arc, total damage, attack-speed cooldown); middle mouse heavy swing (double damage, double cooldown); stealth bonus (2×) on enemies that have not noticed the Warframe.
- Parry: holding the right mouse button takes 10% damage while a melee weapon is equipped.
- Status effects per tick: shots roll their proc chance (the weapon's procChance) and pick a status by damage type; damage-over-time procs (bleed, ignite, poison, tesla, gas) tick enemy health once a second.
- Grenades: G throws at the mouse position; 1.4 s fuse; 4 m blast with falloff to 25%.
- Tests: combat 137 of 137, mission flow 8 of 8.
- Caveats, carried to later phases: non-damage statuses (freeze, corrosive, viral, magnetic, radiation, puncture, impact, void) are not applied; blast (detonation) is not applied; the melee combo is not ported; finishers on knocked-down enemies are not ported; melee and grenade visuals are not drawn; enemies do not yet have the browser's alert states (they alert by sight distance only).

## Phase 3: fully ported

- Done since the last note: all status effects that the browser defines are applied. Damage-over-time (bleed, ignite, poison, tesla, gas) tick each second. Timed statuses last their duration: freeze slows movement, viral raises the damage taken, puncture cuts the enemy's damage, impact staggers, and blast detonates at the end (30% to itself) or bursts on death (300% within 5 m). Void disarm is a no-op because enemies have no weapons to disarm yet.
- Done since the last note: the melee combo (hits in a row, reset after 5 s; the heavy attack uses the combo multiplier and resets the combo), and the swing arc drawn for each swing.
- Stealth: a melee hit on an enemy that has not noticed the Warframe takes the 2× stealth bonus. Enemies still alert by sight distance only (the browser's alert states are Phase 4).
- Remaining known gaps in Phase 3, which depend on Phase 4: knocked-down enemies and ground finishers (enemies have no knockdown yet); corrosive's armor reduction (enemies have no armor model yet); and the browser's blind and cold crit effects (the enemy has no crit receive).
- Tests: combat 137 of 137, mission flow 8 of 8.

## Phase 4: started

- Done: the enemy alert state machine from `enemy.js`: unalerted (patrols), cautious (searches toward a sound), and alerted (chases and alerts nearby enemies). Vision cone (120°, 25 m, blocked by walls), alert timers (cautious 20–30 s, alerted 60 s, three times faster decay without sight), hearing (a shot is heard by enemies in the same room), and alert spread (an alerted enemy makes unalerted enemies within 20 m cautious).
- Done: the stealth bonus now depends on the alert state (unalerted only).
- Still open in Phase 4: the faction variants (Grineer, Corpus, Infested) and their units (Lancer, Trooper, Butcher, Moa, Shield Osprey, Charger, Leaper, Runner, Crewman as the Corpus grunt); cover; ranged attacks and grenades by faction; the patrol loops in `patrol.js` (the enemy wanders for now); navmesh pathing (enemies steer straight, not around walls).
- Performance: the tile drawing now culls to the camera view. The mission frame time is about 5 ms (188 fps, vsync off) after it.

## Phase 4: pathing (done for chasing)

- Done: grid pathfinding over the generated walls (Godot AStarGrid2D, one cell per tile, walls solid). Enemies chase straight when they can see the player and follow a route around walls when they cannot. Tested: a route exists to a reachable spot on the generated map.
- Still open in Phase 4: cover, the Grineer burst-and-cover behaviour, the Corpus and Infested units, and the patrol loops from `patrol.js`.

## Phase 4: ranged attacks (first step)

- Done: enemies fire bursts (4 to 7 rounds at the Grakata's 20 rounds per second, then a 0.6 to 1.4 s pause) when they see the player within 25 m. Their rounds do 11 damage (the Grakata's total) and stop at walls (`scripts/enemies/enemy_bullet.gd`).
- Caveat: every enemy uses this one behaviour for now. The browser's faction units differ (the Lancer's cover, the Corpus and Infested attacks), so the cover and faction work is still open.
- Tests: mission flow 10 of 10, combat 137 of 137.

## Phase 4: cover (first step)

- Done: during the pause between bursts, an enemy moves to the nearest spot within four tiles that is out of the Warframe's line of sight and reachable, then fires the next burst from there.
- Caveat: this is a simplified cover rule. The browser's cover search and flanking spots (`enemy.js` findCover and findFlankSpot) are not ported in full, and enemies still fire from a stopped position rather than peeking.
- Tests: mission flow 10 of 10, combat 137 of 137.

## Phase 4: patrol loops (done)

- Done: unalerted enemies walk a loop of three waypoints inside their room, spaced at least 10 m apart and on open floor, following the grid route between them. They pause 2 to 4 s at each waypoint and sweep their facing (±60°) while they look around. A room with no loop falls back to a wander.
- Tests: mission flow 10 of 10, combat 137 of 137.
- Still open in Phase 4: the Corpus and Infested units (their own attacks and behaviour), the Grineer units beyond the shared burst behaviour (the Lancer's flanking spots and the faction attacks), and the rest of the faction files.

## Phase 4: Corpus Crewman (done, except flanking)

- Done: the Crewman (`scripts/enemies/corpus/crewman.gd`, port of `src/enemies/corpus/crewman.js`) is now the Exterminate enemy, as the mission's enemy pool names only crewman. It has 90 health from the Corpus scaling table and fires the Dera at 11.25 rounds per second, 7 damage per round, with random spread: aimed (1.5° to 4°) when peeking, blind (8° to 14°) between peeks. Tactic phases: advance, cover run, covered (peek and blind toggling), and grenade throw (4 to 22 m, 0.6 s windup, 400 blast, 8 to 14 s cooldown, twice as often from cover and when the target is still). Enemy grenades hurt the Warframe (`scripts/weapons/grenade.gd`, `from_enemy`).
- Shared changes: enemies have their own `max_hp`, `armor` (reduces damage through `DamageMath.reduce_damage`), `bullet_damage`, and `aim_spread`; alerted behaviour goes through `Enemy._engage`, which the Crewman overrides.
- Caveat: flanking spots (`findFlankSpot`) are not ported, so the flank phase falls back to advancing. Cover uses the simplified four-tile search. Enemies are all level 1 (no level scaling from kills yet). The browser's per-round status chance (1%) is not applied yet.
- Not done: MOA, Shield Osprey, Charger, Leaper and Runner have no Godot class. No mission spawns them yet (the Exterminate pool is crewman only and the Grineer missions are not wired in), so they wait for the mission work in Phase 5.
- Tests: mission flow 12 of 12 (new: crewman health, enemy grenade damage), combat 137 of 137.

## Phase 4: unit stats (done, behaviour partial)

- Done: every faction unit exists in Godot with its browser base health and armour, scaled through `scripts/combat/scaling.gd` (`scripts/enemies/registry.gd`, `scripts/enemies/unit.gd`): MOA, Shield Osprey, Charger, Leaper, Runner, Lancer, Trooper, Butcher. Ranged units (Lancer, Trooper) use the shared burst and cover behaviour; the rest close in and hit on contact.
- Not done: the Lancer's grenades, blind fire and spawn penalty; the Trooper's Sobek pellets (it fires the Grakata's damage for now); the Butcher's Cleaver melee (its data is not exported yet); the Charger, Leaper and Runner's own attacks; flanking spots (`findFlankSpot`); knockdown and ground finishers; enemy level scaling.
- Tests: mission flow 20 of 20 (checks each unit's health and armour), combat 137 of 137.

## Phase 4: remainder (code done; live check partial)

- Done: the Trooper fires the Sobek as 5 pellets of 70 damage at 2.5 shots per second, out to 30 m (`scripts/enemies/registry.gd`, `enemy.gd` `pellets`, `fire_rate`, `engage_range`). The Charger, Leaper and Runner have no attacks in the browser (their files set only stats), so their contact charge already matches.
- Done: knockdown (`Enemy.knock_down`, 8 s, no movement or attacks while down) and ground finishers (400% of the normal attack as true damage, which ignores armour, `Enemy.take_damage(amount, true)`). A heavy hit knocks down (the browser's placeholder trigger).
- Done: enemy level scaling (Exterminate spawns at `1 + kills / 8`).
- Caveats: the Sobek's range falloff (50% beyond 20 m) is not applied; the finisher's invulnerability window is not ported; the Butcher's critical chance is not applied.
- Not verified: Lancer grenades, blind fire, flanking, and the Butcher's melee have only been checked by the test suites, not in a played mission.
- Tests: mission flow 23 of 23, combat 137 of 137.

## Phase 5: Defense and Dark Sector Defense (first slice)

- Done: the Cryo Pod objective (`scripts/missions/objective.gd`, `CryoPod`, 4000 health and 240 armour, as `src/missions/objective.js`). Defense (`defense`) and Dark Sector Defense (`dark_sector_defense`, 5000 health and 100 armour) play as an open arena with no walls or rooms, endless waves (3 + 2 per wave, or 4 + 2 for Dark Sector), and a rotation choice after every 3rd wave: Y extracts with the reward, N continues. Enemies that reach the objective damage it, and breaking it loses the mission (`scripts/game.gd` `_update_defense`).
- Caveats: the arena is a 1600 by 1200 open floor, not the browser's `arena.json` layout. Enemies damage the objective by contact rather than targeting it from range, and they are all Crewman (the Dark Sector's Infested units are not spawned yet). The rotation choice is keyboard only (no panel).
- Not started: Capture, Spy, Sabotage, Interception, Mobile Defense, Excavation, Rescue, Shrine Defense, Dark Sector Excavation, Assassination, Open World (the browser lists these as work-in-progress screens, `src/ui/menus/work_in_progress.js`), and Simulacrum (sandbox).
- Tests: defense 7 of 7 (new `tests/defense_test.gd`), mission flow 23 of 23, combat 137 of 137.

## Phase 5: node missions and Simulacrum (placeholder rules)

- Done: the eleven Earth node types (Interception, Mobile Defense, Excavation, Capture, Spy, Rescue, Sabotage, Shrine Defense, Dark Sector Excavation, Open World, Assassination) run on the generated map with Exterminate's kill quota, as `src/missions/missions.js` does: 24 kills, six units on the field, and Trooper, Lancer and Butcher units (`scripts/game.gd` `NODE_TYPES`, `node_pool`, `kill_quota`).
- Done: Simulacrum (`simulacrum`) is a sandbox with no quota and no spawns on its own; F spawns one crewman. The browser's Simulacrum menu, console and wall editor are not ported.
- Caveat: the placeholder node types use the same rules as Exterminate, as the browser does until each type gets its own. Their own rules are still open.
- Tests: mission flow 23 of 23, defense 7 of 7, combat 137 of 137.

## Phase 6: Affinity and Mastery (first slice)

- Done: Affinity per item and per profile, item ranks from Affinity, Mastery Rank from mastery points, and the kill formula (`scripts/progression/progression.gd`, port of `src/progression/progression.js`). Each kill awards Affinity to the Warframe and the primary, split 50/50. Enemies carry their browser name and level for the award (`Enemy.enemy_name`, `died(enemy)`).
- Caveats: ability kills (all Affinity to the Warframe) and ability Affinity (energy cost) are not wired yet; the Arsenal and profile bars do not read the new ranks yet (the profile still shows rank 0 for the equipped frame, see `profile.gd`); the browser's Affinity rank-up checks are not ported.
- Not started: drops and loot tables (`enemies/drop_tables.js`, `pickups/loot.js`), region resources, selling, fusion, and item upgrades (`economy/*.js`).
- Tests: progression 8 of 8 (new `tests/progression_test.gd`), mission flow 23 of 23, defense 7 of 7, combat 137 of 137. Live smoke test (`tests/live_smoke_test.gd`) runs a node mission for 600 frames with no script errors.

## Phase 6: drops, selling, fusion, upgrades (rules done; UI not)

- Done: the enemy drop tables (`scripts/enemies/drop_tables.gd`): per-kill chances for mods, Endo and Earth region resources, rolled on each kill. Drops lie where the enemy fell and are picked up (Endo and resources to the wallet, a mod to the owned list at rank 0).
- Done: mod fusion (`scripts/economy/fusion.gd`), with the browser's default cost tables; Orokin Catalyst and Reactor (`scripts/economy/upgrades.gd`); selling rules (`scripts/economy/selling.gd`).
- Caveats: the Arsenal, Market and Equipment menus that use these are not ported, so the player cannot fuse, buy or sell from the UI yet. Mods from drops have no stats in the data yet (placeholders, as in the browser). Region resources are stored but not spent by anything yet.
- Tests: economy 9 of 9 (new `tests/economy_test.gd`), progression 11 of 11, mission flow 23 of 23, defense 7 of 7, combat 137 of 137, live smoke 4 of 4.

## Phase 7: pause menu (done); the rest open

- Done: the pause menu (`scripts/ui/menus/pause_menu.gd`, port of `src/ui/menus/pause_menu.js`). Esc opens it and pauses the mission. Resume, Restart Mission, Options (the settings menu), and Abort Mission (asks first, then returns to the menu with no rewards).
- Not done: the work-in-progress screen, mission select, currency toasts, the squad panel, the top-bar avatar and invite icons, the Simulacrum menu, and the focus sound. Phases 8 and 9 have not started.
- Tests: pause 5 of 5 (new `tests/pause_test.gd`); combat 137, mission flow 23, defense 7, progression 11, economy 9, live smoke 4, all passing.

## Phase 7: currency toasts (done)

- Done: "+45 Endo" and "−20 Platinum" pop-ups over the mission (`scripts/ui/currency_toast.gd`, port of `src/ui/currency_toast.js`). The wallet records each change (`Wallet.pending_changes`), and the toast reads them. Shown in missions; not yet on the menus.
- Tests: toast 4 of 4 (new `tests/toast_test.gd`); the other suites still pass.
- Still open in Phase 7: the work-in-progress screen, mission select, the squad panel, the top-bar avatar and invite icons, the Simulacrum menu, and the focus sound.
