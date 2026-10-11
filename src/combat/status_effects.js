/**
 * Warframe Status Effects (Procs) — Damage 3.0
 * Source: wiki Damage page, Status Effect section
 */

import { PhysicalDamageType, ElementalDamageType, CombinedDamageType } from './damage_types.js';

export const StatusType = {
  // Physical
  SLASH: 'slash',           // Bleed (true damage over time, bypasses armor)
  IMPACT: 'impact',         // Stagger / knockdown
  PUNCTURE: 'puncture',     // Weaken (reduces target damage output)

  // Elemental
  HEAT: 'heat',             // Ignite (DoT + armor strip + panic)
  COLD: 'cold',             // Freeze / slow
  ELECTRICITY: 'electricity', // Tesla chain stun
  TOXIN: 'toxin',           // Poison (bypasses shields, DoT to health)

  // Combined
  BLAST: 'blast',           // Accuracy reduction / knockdown
  CORROSIVE: 'corrosive',   // Armor reduction (permanent, stacks)
  GAS: 'gas',               // Toxin cloud AoE
  MAGNETIC: 'magnetic',     // Shield drain + prevent regen
  RADIATION: 'radiation',   // Confusion (friendly fire)
  VIRAL: 'viral',           // +100% damage to health (stacks to 10)

  // Special
  VOID: 'void',             // Bullet attractor / disarm
  TAU: 'tau',               // Sentient adaptation
};

/**
 * Status Effect configurations.
 * Each proc applies an effect with duration, tick rate, and stacking behavior.
 */
export const StatusEffectConfigs = {
  [StatusType.SLASH]: {
    name: 'Bleed',
    icon: 'slash',
    color: '#cc2a28',
    // Ref: 35% of base damage per second as Cinematic damage for 6s after a 1s delay; unlimited stacks, each with its own duration
    dealsDamage: true,
    bypassesArmor: true,
    bypassesShields: false,
    maxStacks: 999,
    baseDuration: 6,
    startDelay: 1,
    tickInterval: 1,
    tickDamageRatio: 0.35,
    stackBehavior: 'independent',
  },

  [StatusType.HEAT]: {
    name: 'Ignite',
    icon: 'heat',
    color: '#ff6600',
    // Ref: 50% of base damage per second for 6s after a 1s delay (refreshed by new procs); panic 4s; strips up to 50% armor over 2s
    dealsDamage: true,
    bypassesArmor: false,
    bypassesShields: false,
    maxStacks: 999,
    baseDuration: 6,
    startDelay: 1,
    tickInterval: 1,
    tickDamageRatio: 0.5,
    maxArmorStrip: 0.5,
    armorStripTime: 2,
    panicDuration: 4,
    stackBehavior: 'refresh',
  },

  [StatusType.TOXIN]: {
    name: 'Poison',
    icon: 'toxin',
    color: '#00ff00',
    // Ref: 50% of base damage over 6s after a 1s delay, bypasses shields; unlimited stacks, each with its own duration
    dealsDamage: true,
    bypassesArmor: false,
    bypassesShields: true,
    maxStacks: 999,
    baseDuration: 6,
    startDelay: 1,
    tickInterval: 1,
    tickDamageRatio: 0.5,
    stackBehavior: 'independent',
  },

  [StatusType.ELECTRICITY]: {
    name: 'Tesla',
    icon: 'electricity',
    color: '#00ffff',
    // Ref: 50% of base damage per second for 6s to enemies within 3m; stuns the target 3s; each stack has its own duration
    dealsDamage: true,
    bypassesArmor: false,
    bypassesShields: false,
    maxStacks: 999,
    baseDuration: 6,
    tickInterval: 1,
    tickDamageRatio: 0.5,
    chainRadius: 3,
    stunDuration: 3,
    stackBehavior: 'independent',
  },

  [StatusType.COLD]: {
    name: 'Freeze',
    icon: 'cold',
    color: '#4da6ff',
    // Ref: 50% slow (+5%/stack to 90%), +0.1 crit multiplier received (+0.05/stack to +0.5) for 6s; 10 stacks freeze for 3s
    dealsDamage: false,
    bypassesArmor: false,
    bypassesShields: false,
    maxStacks: 10,
    baseDuration: 6,
    firstStackSlow: 0.5,
    slowPerStack: 0.05,
    maxSlow: 0.9,
    firstStackCritMult: 0.1,
    critMultPerStack: 0.05,
    maxCritMult: 0.5,
    freezeThreshold: 10,
    freezeDuration: 3,
    stackBehavior: 'stack',
  },

  [StatusType.CORROSIVE]: {
    name: 'Corrosion',
    icon: 'corrosive',
    color: '#80ff00',
    dealsDamage: false,
    bypassesArmor: false,
    bypassesShields: false,
    maxStacks: 10,
    baseDuration: 8,
    armorReductionPerStack: 0.26, // 26% per stack
    maxArmorReduction: 0.8,       // 80% cap
    stackBehavior: 'stack',
  },

  [StatusType.VIRAL]: {
    name: 'Viral',
    icon: 'viral',
    color: '#cc66ff',
    // Ref: +100% damage to health for 6s; stacks to 10 for +325%
    dealsDamage: false,
    bypassesArmor: false,
    bypassesShields: false,
    maxStacks: 10,
    baseDuration: 6,
    firstStackVulnerability: 1.0,
    damageVulnerabilityPerStack: 0.25,
    maxDamageVulnerability: 3.25,
    stackBehavior: 'stack',
  },

  [StatusType.MAGNETIC]: {
    name: 'Magnetic',
    icon: 'magnetic',
    color: '#6600ff',
    // Ref: +100% damage to shields/overguard for 6s; stacks to 10 for +325%; prevents natural shield regen
    dealsDamage: false,
    bypassesArmor: false,
    bypassesShields: false,
    maxStacks: 10,
    baseDuration: 6,
    firstStackVulnerability: 1.0,
    shieldVulnerabilityPerStack: 0.25,
    maxShieldVulnerability: 3.25,
    preventsShieldRegen: true,
    stackBehavior: 'stack',
  },

  [StatusType.GAS]: {
    name: 'Gas',
    icon: 'gas',
    color: '#80ff80',
    // Ref: 3m cloud dealing 50% of base damage per second for 6s; max 10 stacks, radius grows to 6m
    dealsDamage: true,
    bypassesArmor: false,
    bypassesShields: false,
    maxStacks: 10,
    baseDuration: 6,
    tickInterval: 1,
    tickDamageRatio: 0.5,
    cloudRadius: 3,
    maxCloudRadius: 6,
    stackBehavior: 'independent',
  },

  [StatusType.RADIATION]: {
    name: 'Radiation',
    icon: 'radiation',
    color: '#ffcc00',
    // Ref: target attacks nearest unit for 12s; +100% damage to allies, stacking to 10 for +550%
    dealsDamage: false,
    bypassesArmor: false,
    bypassesShields: false,
    maxStacks: 10,
    baseDuration: 12,
    firstStackAllyDamage: 1.0,
    allyDamagePerStack: 0.5,
    maxAllyDamage: 5.5,
    stackBehavior: 'stack',
  },

  [StatusType.BLAST]: {
    name: 'Blast',
    icon: 'blast',
    color: '#ff8800',
    // Ref: detonates for 30% of base damage after 1.5s; at 10 stacks (or on death) all detonate, 300% base damage within 5m
    dealsDamage: true,
    bypassesArmor: false,
    bypassesShields: false,
    maxStacks: 10,
    baseDuration: 1.5,
    detonationRatio: 0.3,
    burstRatio: 3.0,
    burstRadius: 5,
    stackBehavior: 'independent',
  },

  [StatusType.IMPACT]: {
    name: 'Impact',
    icon: 'impact',
    color: '#ffffff',
    // Ref: stagger 1s; for 6s raises Parazon mercy threshold 8% per stack, up to 5 stacks
    dealsDamage: false,
    bypassesArmor: false,
    bypassesShields: false,
    maxStacks: 5,
    baseDuration: 6,
    staggerDuration: 1,
    mercyThresholdPerStack: 0.08,
    stackBehavior: 'stack',
  },

  [StatusType.PUNCTURE]: {
    name: 'Puncture',
    icon: 'puncture',
    color: '#ffff00',
    // Ref: target deals 40% less damage (+10%/stack to 80% at 5 stacks) and takes +5% crit chance per stack (25% at 5) for 6s
    dealsDamage: false,
    bypassesArmor: false,
    bypassesShields: false,
    maxStacks: 5,
    baseDuration: 6,
    firstStackDamageReduction: 0.4,
    damageReductionPerStack: 0.1,
    maxDamageReduction: 0.8,
    critChancePerStack: 0.05,
    stackBehavior: 'stack',
  },

  [StatusType.VOID]: {
    name: 'Void',
    icon: 'void',
    color: '#ff00ff',
    dealsDamage: false,
    bypassesArmor: false,
    bypassesShields: false,
    maxStacks: 10,
    baseDuration: 6,
    bulletAttractorRadius: 3,
    disarmChance: 0.1,
    stackBehavior: 'refresh',
  },
};

/**
 * Status chance calculation.
 * baseStatusChance: weapon base (e.g., 0.1 = 10%)
 * statusChanceMods: sum of +status chance mods (e.g., 0.6 = 60% from mods)
 * multishot: number of projectiles per shot
 * Returns per-projectile status chance.
 */
export function calculateStatusChance(baseStatusChance, statusChanceMods = 0, multishot = 1) {
  const finalChance = baseStatusChance * (1 + statusChanceMods);
  // With multishot, each projectile rolls independently
  // Effective chance per shot = 1 - (1 - chance)^multishot
  return 1 - Math.pow(1 - Math.min(1, finalChance), multishot);
}

/**
 * Pick a status to proc based on damage type weighting.
 * damageWeights: { slash: 100, heat: 50, ... } - raw damage amounts per type
 * Returns the status type that procs.
 */
export function pickStatusProc(damageWeights) {
  const total = Object.values(damageWeights).reduce((a, b) => a + b, 0);
  if (total <= 0) return null;

  const roll = Math.random() * total;
  let accum = 0;

  // Map damage types to status types
  const damageToStatus = {
    [PhysicalDamageType.SLASH]: StatusType.SLASH,
    [PhysicalDamageType.IMPACT]: StatusType.IMPACT,
    [PhysicalDamageType.PUNCTURE]: StatusType.PUNCTURE,
    [ElementalDamageType.HEAT]: StatusType.HEAT,
    [ElementalDamageType.COLD]: StatusType.COLD,
    [ElementalDamageType.ELECTRICITY]: StatusType.ELECTRICITY,
    [ElementalDamageType.TOXIN]: StatusType.TOXIN,
    [CombinedDamageType.BLAST]: StatusType.BLAST,
    [CombinedDamageType.CORROSIVE]: StatusType.CORROSIVE,
    [CombinedDamageType.GAS]: StatusType.GAS,
    [CombinedDamageType.MAGNETIC]: StatusType.MAGNETIC,
    [CombinedDamageType.RADIATION]: StatusType.RADIATION,
    [CombinedDamageType.VIRAL]: StatusType.VIRAL,
  };

  for (const [dmgType, weight] of Object.entries(damageWeights)) {
    if (weight <= 0) continue;
    accum += weight;
    if (roll <= accum) {
      return damageToStatus[dmgType] || null;
    }
  }
  return null;
}

/**
 * Create a status effect instance from a proc.
 */
export function createStatusEffect(statusType, sourceDamage, sourceLevel = 1) {
  const config = StatusEffectConfigs[statusType];
  if (!config) return null;

  return {
    type: statusType,
    config,
    sourceDamage,
    sourceLevel,
    stacks: 1,
    remainingTime: config.baseDuration,
    tickTimer: 0,
    // Armor strip tracking for heat/corrosive
    armorStripped: 0,
  };
}

/**
 * Apply status effect to target's status manager.
 * Handles stacking, refreshing, and caps.
 */
export function applyStatusEffect(targetStatusManager, effect) {
  const existing = targetStatusManager.getEffect(effect.type);
  const config = effect.config;

  if (existing) {
    switch (config.stackBehavior) {
      case 'stack':
        existing.stacks = Math.min(existing.stacks + 1, config.maxStacks);
        existing.remainingTime = config.baseDuration; // Refresh duration
        break;
      case 'refresh':
        existing.remainingTime = config.baseDuration;
        break;
      case 'independent':
        // Add as separate effect instance
        targetStatusManager.addEffect({ ...effect });
        return;
    }
  } else {
    targetStatusManager.addEffect(effect);
  }
}