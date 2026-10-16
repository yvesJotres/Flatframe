extends Node

# Global game configuration and units. Port of src/engine/constants.js.
# Registered as the `Constants` autoload in project.godot. Spatial values are in
# units: UNITS_PER_METER units make one metre, as in the browser build.

const UNITS_PER_METER := 15
const METERS_TO_PIXELS := UNITS_PER_METER
const GRID_SIZE := UNITS_PER_METER

const AI_STATES := {
	"UNALERTED": "UNALERTED",
	"CAUTIOUS": "CAUTIOUS",
	"ALERTED": "ALERTED",
}

# Combat
const HITSCAN_SPEED := 100000.0
const DEFAULT_PROJECTILE_SPEED := 700.0   # units per second
const DEFAULT_MELEE_COOLDOWN_MS := 450.0
const SPREAD_RECOVERY_DEG_PER_SEC := 12.0

# Timing
const COMBO_RESET_MS := 5000.0   # the combo resets after 5 seconds without a melee hit
const PARRY_WINDOW_SEC := 0.2
