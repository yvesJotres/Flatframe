/**
 * Global game configuration and units.
 * All spatial measurements (range, radius, etc.) are in Meters.
 * Conversion factor: 1 Meter = 8 pixels.
 */

export const UNITS_PER_METER = 15;
export const METERS_TO_PIXELS = UNITS_PER_METER;

// Combat Constants
export const HITSCAN_SPEED = 100000;
export const DEFAULT_PROJECTILE_SPEED = 700; // pixels per second
export const DEFAULT_MELEE_COOLDOWN_MS = 450;
export const SPREAD_RECOVERY_DEG_PER_SEC = 12;

// Timing
export const COMBO_RESET_MS = 3000;
export const PARRY_WINDOW_SEC = 0.2;
