# Flatframe

A 2D top-down Warframe-inspired canvas shooter built with vanilla JavaScript (ES modules).

## Features

- **Warframe-style combat**: Primary, secondary, and melee weapons with combos, heavy attacks, and parrying
- **Parkour movement**: Bullet jump, sprint, roll dodge
- **Advanced Mechanics**:
    - **Shield Gating**: Wiki-accurate invulnerability thresholds and timing
    - **Damage Reduction**: Tenno/Enemy formulas for armor mitigation
    - **Per-Faction Scaling**: Faction-based stat growth for health and armor
    - **Status Effects**: Magnetic, Toxin, and Slash interactions
    - **Visual Feedback**: Armored (yellow health) and Invulnerable (grey vitals) HUD states
- **Mission system**: Exterminate, Defense, Survival, Simulacrum modes
- **Enemy AI**: Factions (Grineer, Corpus, Infested) with alert states, target acquisition, and cover mechanics
- **Loot & progression**: Mod drops, weapon switching, combo counters, health orb system

## Quick Start

```bash
npm install
npm start
```

Opens the game at `http://localhost:8080` via live-server.

## Controls

| Action | Key |
|--------|-----|
| Move | WASD |
| Aim / Fire | Mouse / Left Click |
| Melee / Quick Attack | E / Left Click (melee equipped) |
| Heavy Attack | Middle Click (melee equipped) |
| Parry | Right Click Hold (melee equipped) |
| Reload | R |
| Weapon Swap | 1 / 2 / F (hold F for melee) |
| Bullet Jump | Ctrl + Space |
| Roll / Dodge | Shift |
| Self-Revive (downed) | Hold X (2s) |
| Pause / Simulacrum Menu | P / Escape |

## Dev Tools

Dev tools live in `dev/` and are opened directly — they are not linked from the game.

- **World Builder** → `http://localhost:8080/dev/world_builder.html` — tile/map editor
- **Simulacrum** — accessible in-game via the Navigation screen

## Project Structure

```
src/
  game.js         # Entry point: game loop and screen flow
  engine/         # Input, touch controls, audio, music, constants, movement, map, navigation
  combat/         # Damage 3.0: damage types, armor, health/shields, scaling, status effects, crits, damage numbers
  warframe/       # The player's Warframe and weapon switching
  enemies/        # Enemy base + AI, spawner, registry, and units by faction (grineer/, corpus/, infested/)
  weapons/        # Weapon, primary, secondary, melee classes and projectiles
  pickups/        # Loot drops (health, energy, ammo)
  missions/       # Mission definitions, objectives, map JSON
  mods/           # Mod system (not wired in yet)
  data/           # Warframe Public Export data (weapons, mods, warframes) + loader/adapter
  ui/             # HUD, menus/ (main, pause, star chart, arsenal, profile, settings), simulacrum/
  tools/          # World Builder
  assets/         # CSS, icon, sounds
tests/            # Unit tests (node --test); tests/helpers for shared fixtures
ref/              # Saved WARFRAME Wiki pages the mechanics are checked against
mockup/           # Static HTML mockups
```

## Weapon System

- **Primary**: Braton, Grakata (auto-rifles)
- **Secondary**: Lato (pistol)
- **Melee**: Skana (sword)
- Melee combos scale cooldown and damage (1.25x at 20 hits, 1.5x at 40)
- Heavy attacks consume combo counter for burst damage
- Daggers have distinct stab SFX; swords use swing SFX (no daggers in the data yet)

## Downed State

When health reaches 0 with shield depleted:
1. **Bleedout** (20s timer) — only secondary weapon usable
2. **Awaiting Revive** — body despawns, X marker remains; hold X for 2s to self-revive (consumes 1 of 4 revives)
3. **DEAD** — no revives left = instant death

Revive status displays inline in the health value position (same font/color).

## Audio

Manifest-driven (`src/assets/sounds/manifest.js`). Uses procedural fallbacks for missing files.

## Testing

```bash
npm test
```

106 tests covering melee mechanics, bleedout/revive, enemy AI (behavior + LOS + movement), loot, audio, weapon switching, damage numbers, and mission scenarios.

## License

ISC