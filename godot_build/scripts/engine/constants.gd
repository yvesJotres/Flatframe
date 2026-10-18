class_name Constants
extends RefCounted
## Port of java_build/src/engine/constants.js: global game configuration and
## units. All spatial measurements (range, radius, etc.) are in meters.
## Conversion factor: 1 meter = 15 units.

const UNITS_PER_METER := 15
const METERS_TO_PIXELS := UNITS_PER_METER
const GRID_SIZE := UNITS_PER_METER

const AI_STATES := {
	"UNALERTED": "UNALERTED",
	"CAUTIOUS": "CAUTIOUS",
	"ALERTED": "ALERTED",
}

# Combat Constants
const HITSCAN_SPEED := 100000
const DEFAULT_PROJECTILE_SPEED := 700  # pixels per second
const DEFAULT_MELEE_COOLDOWN_MS := 450
const SPREAD_RECOVERY_DEG_PER_SEC := 12

# Timing
const COMBO_RESET_MS := 5000  # wiki: the combo resets after 5 seconds without a melee hit
const PARRY_WINDOW_SEC := 0.2
