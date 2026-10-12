// Flatframe Color Constants
// Core Vitals
export const COLORS = {
  // Health & Shields
  HEALTH: '#cc2a28',
  SHIELDS: '#01d8ff',
  OVERSHIELDS: '#b201fe',
  ARMOR: '#e0a635',
  INVULNERABLE_HEALTH: '#585858',
  INVULNERABLE_SHIELDS: '#9c9c9a',

  // Objectives & Enemies
  OBJECTIVE_HEALTH: '#6dada7',
  HEADSHOT: '#c80406',
  ENEMY_MARKER: '#c80406',

  // Status & Effects
  BUFF: '#01d8ff',
  DEBUFF: '#cc2a28',

  // Critical Damage
  CRIT_NORMAL: '#ffff00',
  CRIT_BIG: '#fe6c09',
  CRIT_SUPER: '#fe0000',

  // UI Elements
  TEXT: '#ffffff',
  TEXT_DIM: '#9aa0b4',
  TEXT_DISABLED: '#808080',
  TEXT_NEGATIVE: '#c80406',
  TEXT_BACKGROUND: '#414141',

  // Markers & Indicators
  RETICLE: '#ffffff',
  HIT_INDICATOR: '#e9bb06',
  OBJECTIVE_PROGRESS: '#ffffff',
  OBJECTIVE_GLOW: '#01a6ff',
  FRIENDLY_MARKER: '#0795d5',
  LOOT_MARKER: '#ffffff',
  EXTRACTION: '#43b306',

  // Loot Types
  LOOT_HEALTH: '#cc2a28',
  LOOT_PRIMARY_AMMO: '#44aaff',
  LOOT_SECONDARY_AMMO: '#ffaa44',
  LOOT_ENERGY: '#01d8ff',
  LOOT_ENDO: '#e0b43a',

  // UI Theme
  ACCENT: '#ff6b35',
  PANEL_BG: 'rgba(11, 14, 22, 0.6)',
  STROKE: 'rgba(255, 255, 255, 0.12)',

  // Dark sector / Special
  KUVA_HARVESTER: '#a01b1c',
  FOCUS_DROP: '#e4d570',
  LIFE_SUPPORT: '#e9ba08',
  SYNTHESIS_TARGET: '#ffd47b',
  VIP_TARGET: '#3765ff',

  // Factions
  GRINEER: '#e85d2a',
  CORPUS: '#3a8fce',
  INFESTED: '#7ab800',
  CORRUPTED: '#e8e8f0',
  SENTIENT: '#ff2a8a',
  VOID: '#8a6fff',
};

// Shorthand aliases for common usage
export const VITALS = {
  HEALTH: COLORS.HEALTH,
  SHIELDS: COLORS.SHIELDS,
  ARMOR: COLORS.ARMOR,
};

export const LOOT = {
  HEALTH: COLORS.LOOT_HEALTH,
  ENERGY: COLORS.LOOT_ENERGY,
  PRIMARY_AMMO: COLORS.LOOT_PRIMARY_AMMO,
  SECONDARY_AMMO: COLORS.LOOT_SECONDARY_AMMO,
  ENDO: COLORS.LOOT_ENDO,
};

export const UI = {
  TEXT: COLORS.TEXT,
  TEXT_DIM: COLORS.TEXT_DIM,
  ACCENT: COLORS.ACCENT,
  PANEL_BG: COLORS.PANEL_BG,
  STROKE: COLORS.STROKE,
};

export const DAMAGE = {
  NORMAL: COLORS.TEXT,
  CRIT_NORMAL: COLORS.CRIT_NORMAL,
  CRIT_BIG: COLORS.CRIT_BIG,
  CRIT_SUPER: COLORS.CRIT_SUPER,
  SHIELD: COLORS.SHIELDS,
  ABILITY: '#b201fe',
  INVULNERABLE: COLORS.INVULNERABLE_HEALTH,
};

export const ENEMIES = {
  GRINEER: COLORS.GRINEER,
  CORPUS: COLORS.CORPUS,
  INFESTED: COLORS.INFESTED,
  CORRUPTED: COLORS.CORRUPTED,
  SENTIENT: COLORS.SENTIENT,
  VOID: COLORS.VOID,
};

export default COLORS;
