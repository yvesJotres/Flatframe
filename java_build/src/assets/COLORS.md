# Flatframe Color Palette

Color definitions for the Flatframe game.
## Core Vitals

| Element | Hex Code | Usage |
|---------|----------|-------|
| **Health** | `#cc2a28` | Player health bar, health orb, health indicators |
| **Shields** | `#01d8ff` | Player shield bar, shield orb, shield indicators |
| **Overshields** | `#b201fe` | Overshield status (future) |
| **Armored Health** | `#e0a635` | Armored enemy health display |
| **Invulnerable (Health)** | `#585858` | Invulnerable health indicator |
| **Invulnerable (Shields)** | `#9c9c9a` | Invulnerable shield indicator |

## Enemy Elements

| Element | Hex Code | Usage |
|---------|----------|-------|
| **Object Health** | `#6dada7` | Objective/destructible health |

## Status & Damage Numbers

| Element | Hex Code | Usage |
|---------|----------|-------|
| **Buff Icons** | `#01d8ff` | Buff visual indicators |
| **Debuff Icons** | `#cc2a28` | Debuff/status effect indicators |
| **Normal Crit** | `#ffff00` | Normal critical hit damage |
| **Big Crit** | `#fe6c09` | Orange critical hit damage |
| **Super Crit** | `#fe0000` | Red critical hit damage |
| **Headshot Indicator** | `#c80406` | Headshot hit markers |

## UI Markers & Text

| Element | Hex Code | Usage |
|---------|----------|-------|
| **Text** | `#ffffff` | Default UI text |
| **Disabled Text** | `#808080` | Disabled/inactive text |
| **Negative Text** | `#c80406` | Warning/error text |
| **Text Background** | `#414141` | Text background panels |
| **Objective Progress** | `#ffffff` | Progress text |
| **Objective Glow** | `#01a6ff` | Objective highlight |
| **Hit Indicator** | `#e9bb06` | Hit flash color |

## Markers

| Element | Hex Code | Usage |
|---------|----------|-------|
| **Enemy Marker** | `#c80406` | Enemy indicators (red) |
| **Friendly Marker** | `#0795d5` | Friendly unit markers |
| **Extraction** | `#43b306` | Extraction point marker (green) |
| **Loot Marker** | `#ffffff` | Loot/pickup marker |

## Current Implementation

The following colors are already implemented in `src/assets/style.css`:

```css
:root {
  --health: #ff5b5b;        /* Current: slightly brighter red */
  --shield: #7fe3ff;        /* Current: slightly different cyan */
  --damage-shield: #01d8ff; /* Matches official palette */
}
```

## Notes

- **Energy**: The official Warframe palette does not specify a separate hex code for energy. Based on Warframe UI conventions, energy typically uses a **light blue** similar to shields (`#01d8ff` or `#7fe3ff`).
- **Overshields**: Currently unused in Flatframe but reserved for future mechanic implementation.
- **Invulnerable states**: Used when shield gating activates; applies grey-out effect to vitals.
- Color consistency is important for player readability across all UI elements.
