# Flatframe

A 2D top-down, Warframe-inspired shooter that runs in the browser. It is written in plain JavaScript (ES modules) with the HTML5 Canvas and has no build step and no runtime dependencies.

**Current version:** 1.7.0 — see the [releases page](https://github.com/yvesJotres/Flatframe/releases).

> **Status:** 1.7.0 is the last release of the Java/JavaScript build. Development moves to the Godot build, which will be maintained in its own repository. This branch stays as the stable reference for the Java version.

---

## Contents

- [Features](#features)
- [What's changed in v1.7.0](#whats-changed-in-v170)
- [Quick start](#quick-start)
- [Controls](#controls)
- [Playing the game](#playing-the-game)
- [Accounts and saves](#accounts-and-saves)
- [Debug and developer tools](#debug-and-developer-tools)
- [Project structure](#project-structure)
- [Game data](#game-data)
- [Testing](#testing)
- [Deploying](#deploying)
- [Troubleshooting](#troubleshooting)
- [Releasing](#releasing)
- [License](#license)

---

## Features

- **Combat** — primary and secondary firearms, melee weapons with combos, heavy attacks, and parrying.
- **Movement** — bullet jump, and a self-revive when downed.
- **Damage model** — damage types, armor and shield mitigation, shield gating, and per-faction health and armor scaling.
- **Status effects** — procs such as Slash, Toxin, and Magnetic, with shields and armor-bypass rules applied.
- **Enemies** — three factions (Grineer, Corpus, Infested) with alert states, target acquisition, line-of-sight checks, and cover behaviour.
- **Missions** — Exterminate, Survival, Defense, Dark Sector Defense, and the Simulacrum test arena.
- **Progression** — a star chart to pick missions, an Arsenal for loadouts and mods, a Profile screen, and currencies (platinum, credits, endo).
- **Local accounts** — several player profiles per browser, each with its own password and wallet.
- **Touch support** — on-screen sticks and buttons appear automatically on touch devices.
- **Procedural audio** — sound effects are generated in code when no sound file is available.

---

## What's changed in v1.7.0

v1.7.0 is the last release of the Java/JavaScript build. Gameplay is unchanged from v1.6.0.

### Changed
- **Version.** Bumped from 1.6.0 to 1.7.0 in `package.json`, `package-lock.json`, and the title screen label.
- **Main branch.** The Java build is now the `main` branch of the repository. The previous v1.x history is kept on the `archive/main-before-java-stable` branch.
- **README.** Added the status note, and corrected the controls and the test count.

### Notes
- Verified: `npm test` passes (291 tests).
- The manual playthrough in `RELEASE_CHECKLIST.md` was not run for this release.

For the changes that came before, see the [v1.6.0 release notes](https://github.com/yvesJotres/Flatframe/releases/tag/v1.6.0) and the [v1.5.0...v1.6.0 diff](https://github.com/yvesJotres/Flatframe/compare/v1.5.0...v1.6.0).

---

## Quick start

You need [Node.js](https://nodejs.org/) 18 or newer (LTS recommended). Node is only used for the dev server and the tests. The game itself runs in the browser.

```bash
git clone https://github.com/yvesJotres/Flatframe.git
cd Flatframe
npm install
npm start
```

Open **http://localhost:8080**. `npm start` runs [live-server](https://www.npmjs.com/package/live-server), which reloads the page when you save a file.

The game must be served over HTTP. Opening `index.html` directly from disk (`file://`) will not load the ES modules.

---

## Controls

### Keyboard and mouse

| Action | Input |
|--------|-------|
| Move | `W` `A` `S` `D` |
| Aim | Mouse position |
| Fire primary / secondary | Left mouse button |
| Reload | `R` |
| Switch weapon | `F` (tap). Hold `F` to equip melee |
| Quick melee attack | `E` |
| Heavy melee attack | Middle mouse button |
| Parry | Hold right mouse button (melee equipped) |
| Jump | `Shift` |
| Bullet jump | Hold `Ctrl` to crouch, then press `Shift` |
| Abilities | `1` `2` `3` `4` |
| Self-revive while downed | Hold `X` |
| Pause | `P` or `Esc` |

### Menus

| Action | Input |
|--------|-------|
| Move between options | `W` / `S` or arrow keys |
| Select | `Enter` or click |
| Back | `Esc` |

### Touch (phones and tablets)

| Control | Function |
|---------|----------|
| Left stick | Move |
| Right stick | Aim, and fire while held |
| Buttons | Melee, heavy attack, parry, reload, weapon swap, jump, revive, pause |

Touch controls appear automatically on devices with a coarse (touch) pointer.

---

## Playing the game

### Main menu and navigation

The main menu has four entries:

- **Navigation** — the star chart. Choose a mission from here.
- **Arsenal** — loadouts, weapons, mods, and warframe selection.
- **Profile** — mastery rank, stats, and account details.
- **Settings** — game options, including audio settings.

**Simulacrum** is a test arena that is available from the main menu and from the Navigation screen.

### Missions

| Mission | Goal |
|---------|------|
| Exterminate | Clear the level of enemies. |
| Survival | Survive as long as possible. |
| Defense | Protect an objective from waves of enemies. |
| Dark Sector Defense | A Defense variant with its own objective and stats. |
| Simulacrum | A sandbox arena for testing weapons and enemies. |

### Combat basics

- Melee combos build up a counter. Heavy attacks spend the counter for burst damage.
- Shields absorb damage first. Armor reduces damage taken after shields are gone.
- Status effects can proc from weapons. Procs are rolled from each weapon's status chance.

### When you are downed

When health reaches zero and shields are gone, you are downed:

1. **Bleedout** — you have 20 seconds. Only your secondary weapon can be used.
2. **Awaiting revive** — hold `X` to self-revive. Each revive uses one of your 4 revives.
3. **Dead** — when no revives are left, the run ends.

The bleedout timer and revive count replace the health readout on the HUD.

### Weapons and warframes in the data

- **Primary:** Braton, Grakata, Dera, Sobek
- **Secondary:** Lato
- **Melee:** Skana, Prova, Cleaver
- **Warframe:** Excalibur

The exact stats, damage types, and status chances for each item live in the data files (see [Game data](#game-data)).

---

## Accounts and saves

The game keeps everything in the browser's storage. Nothing is sent to a server.

- **Profiles.** Each browser can hold several profiles. An `Admin` account is created on first launch. Switch profiles by signing out and signing in.
- **Passwords.** Passwords are salted and hashed with PBKDF2 (SHA-256, 100,000 iterations) in the browser. The first sign-in to an account sets its password. Passwords must be at least 4 characters.
- **Sign-in on secure pages.** The login screen appears only on secure origins (HTTPS or `localhost`). Plain HTTP skips sign-in, because the browser cannot hash passwords there.
- **Stay signed in.** If you tick this option, the session persists across visits. Otherwise it ends when the tab closes.
- **Wallets.** Each profile has its own platinum, credits, and endo.

Local storage keys used by the game:

| Key | Holds |
|-----|-------|
| `flatframe.users.v2` | Profiles and password hashes |
| `flatframe.user.v1` | The active user's data |
| `flatframe.wallet.v1` | Currency balances |
| `flatframe.session.v1` | The signed-in session |
| `flatframe.settings.v1` | Settings |

Clearing site data in your browser deletes all profiles and progress. Use the `resetdata` console command to clear the saved wallet and profile from inside the game.

> **Note:** Accounts live only in the browser that created them. They are not a server-side login and should not be used to protect anything sensitive.

---

## Debug and developer tools

### Console cheats

Open the browser developer console (`F12`) and type a command name. These are included in release builds on purpose.

| Command | Effect |
|---------|--------|
| `imrich` | +9,999 platinum |
| `imrichcredits` | +1,000,000 credits |
| `imrichendo` | +9,999 endo |
| `gimmepotato` | One free Orokin Catalyst and one Orokin Reactor |
| `godmode` | Toggle invulnerability |
| `winmission` | End the current mission as a win |
| `killall` | Kill every enemy in the current mission |
| `resetdata` | Clear the saved wallet and profile, then reload |

### Layout editor

`src/debug/layout_editor.js` lets you drag missions on the star chart to set their positions. Its header explains how to copy the output back into `star_chart.js`.

### World Builder

A tile and map editor for creating mission maps.

- Start the dev server (`npm start`).
- Open **http://localhost:8080/dev/world_builder.html**.

### Sound preview

**http://localhost:8080/dev/sound_preview.html** plays the game's sound effects so you can audition them.

---

## Project structure

```
index.html            Page shell and loading screen
src/
  game.js             Entry point: game loop, screen flow, and wiring
  engine/             Input, touch controls, audio, procedural sounds, constants, movement, map, navigation
  combat/             Damage types, armor, health and shields, scaling, status effects, crits, damage numbers
  warframe/           The player's warframe, weapon switching, and warframe definitions
  enemies/            Enemy base class, AI, spawner, and units by faction (grineer/, corpus/, infested/)
  weapons/            Weapon classes (primary, secondary, melee), projectiles, and grenades
  pickups/            Loot drops and pickup handling
  missions/           Mission definitions and objectives
  mods/               Mod data and placement rules for the Arsenal
  economy/            Wallet, currencies, rewards, selling, fusion, and item upgrades
  user/               Profiles (accounts), authentication, and per-user data
  data/               Game data (weapons, mods, warframes) and the loader and adapter
  ui/                 HUD, menus (main, pause, star chart, arsenal, profile, settings), squad panel,
                      login, user panel, currency toasts, and the Simulacrum UI
  debug/              Console cheats and the layout editor
  tools/              World Builder logic
  assets/             Styles, icons, and sound files with the sound manifest
dev/                  Standalone developer tools (World Builder, sound preview)
tests/                Automated tests (node --test)
```

---

## Game data

Game data is stored as JSON chunks under `src/data/`:

- `src/data/weapons/chunks/` — primary, secondary, and melee weapons
- `src/data/mods/chunks/` — damage, elemental, and utility mods
- `src/data/warframes/chunks/` — warframes

`src/data/data_loader.js` loads the chunks, and `src/data/weapon_adapter.js` maps them to the in-game weapon classes. Numbers such as damage, fire rate, and status chance are edited in the JSON files.

Audio files are listed in `src/assets/sounds/manifest.js`. Any sound that is missing a file falls back to a procedural version.

---

## Testing

```bash
npm test
```

This runs `node --test` over `tests/`. The suite currently has **291 tests** across these areas:

- Melee mechanics, combos, and parrying
- Bleedout and revive
- Enemy AI, line of sight, and movement
- Shields, armor, and status effects
- Loot drops and loot pickups
- Weapon switching and shooting
- Audio registration and sound library
- Procedural sounds
- Simulacrum states and mission scenarios
- Damage numbers and the crewman enemy

The tests run in Node and do not need a browser. Browser-only behaviour, such as rendering and the touch UI, is not covered and must be checked by playing.

---

## Deploying

The game is static files, so you can host the repository root on any static host, such as GitHub Pages, Netlify, Vercel, or Cloudflare Pages. Point the host at the folder that contains `index.html`.

Use HTTPS when hosting. Local-account sign-in needs a secure origin, so on plain HTTP the game skips the login screen.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `npm: command not found` | Install Node.js 18+ and restart the terminal. |
| Port 8080 is already in use | Change the port in `package.json`, e.g. `"start": "live-server --port=3000"`. |
| Blank screen or module errors in the console | Serve the game over HTTP (`npm start`). Do not open `index.html` from disk. |
| No sound | Click the page once. Browsers block audio until there is a user gesture. |
| Touch controls missing | They appear only on devices with a touch pointer. On a desktop, use the keyboard and mouse. |
| Forgot a profile password | Clear the site data for the game, or use `resetdata` from the console. This deletes all local profiles. |
| Login screen never appears | You are on plain HTTP. Use `localhost` or HTTPS. |

---

## Releasing

Releases are tagged on `main` as `vX.Y.Z` and published on GitHub with release notes. The version appears in three places, and all three must be updated together:

1. `package.json` — the `version` field
2. `package-lock.json` — the top-level `version` fields
3. `src/ui/menus/main_menu.js` — the version shown on the title screen

Before tagging, run `npm test` on a fresh clone of the commit you are releasing, and play through at least one mission.

---

## License

ISC. See `package.json`.
