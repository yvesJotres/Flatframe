/**
 * Mod System - Core Mod Class
 * Warframe-style mod cards with polarity, capacity, ranks, and fusion
 */

export const MOD_POLARITIES = {
  MADURAI: 'madurai',       // D - Damage/Offensive
  VAZARIN: 'vazarin',       // V - Defense/Survival
  NARAMON: 'naramon',       // - - Utility/Stealth
  ZENURIK: 'zenurik',       // = - Ability/Energy
  UNAIRU: 'unairu',         // ◊ - Armor/CC
  PENAMBRA: 'penumbra',     // ⧖ - Shadow/Umbra
  UNIVERSAL: 'universal',   // No polarity (fits any)
  STANCE: 'stance',         // ✦ - Melee stance
  EXILUS: 'exilus',         // ◈ - Utility/Exilus
  ARCANE: 'arcane',         // ◇ - Arcane
};

export const MOD_CATEGORIES = {
  WARFRAME: 'warframe',
  PRIMARY: 'primary',
  SECONDARY: 'secondary',
  MELEE: 'melee',
  COMPANION: 'companion',
  ARCHWING: 'archwing',
  ARCHGUN: 'archgun',
  ARCHMELEE: 'archmelee',
  K_DRIVE: 'kdrive',
  NECRAMECH: 'necramech',
  RAILJACK: 'railjack',
  AMP: 'amp',
  PET: 'pet',
  SENTINEL: 'sentinel',
  KUBROW: 'kubrow',
  KAVAT: 'kavat',
  MOA: 'moa',
  PREDASITE: 'predasite',
  VULPAPHYLA: 'vulpaphyla',
};

export const MOD_RARITY = {
  COMMON: 0,      // Bronze
  UNCOMMON: 1,    // Silver
  RARE: 2,        // Gold
  LEGENDARY: 3,   // Platinum
  AMALGAM: 4,     // Corrupted/Amalgam
  RIVEN: 5,       // Riven (variable)
};

export const MOD_STAT_TYPES = {
  // Warframe stats
  HEALTH: 'health',
  SHIELD: 'shield',
  ARMOR: 'armor',
  POWER_STRENGTH: 'powerStrength',
  POWER_DURATION: 'powerDuration',
  POWER_RANGE: 'powerRange',
  POWER_EFFICIENCY: 'powerEfficiency',
  SPRINT_SPEED: 'sprintSpeed',
  PARKOUR_VELOCITY: 'parkourVelocity',
  KNOCKDOWN_RESIST: 'knockdownResist',
  STATUS_DURATION: 'statusDuration',
  SHIELD_RECHARGE: 'shieldRecharge',
  SHIELD_RECHARGE_DELAY: 'shieldRechargeDelay',
  HEALTH_REGEN: 'healthRegen',
  ENERGY_MAX: 'energyMax',
  ENERGY_REGEN: 'energyRegen',
  REVIVE_SPEED: 'reviveSpeed',
  HEAVY_ATTACK_EFF: 'heavyAttackEfficiency',
  COMBO_DURATION: 'comboDuration',
  CHANNELING_EFF: 'channelingEfficiency',
  FINISHER_DAMAGE: 'finisherDamage',
  SLIDE_ATTACK: 'slideAttack',
  WALL_LATCH: 'wallLatch',
  AIR_TIME: 'airTime',
  EXPLOSION_RADIUS: 'explosionRadius',
  PUNCH_THROUGH: 'punchThrough',
  MAGAZINE: 'magazine',
  RELOAD_SPEED: 'reloadSpeed',
  FIRE_RATE: 'fireRate',
  CRIT_CHANCE: 'critChance',
  CRIT_DAMAGE: 'critDamage',
  STATUS_CHANCE: 'statusChance',
  MULTISHOT: 'multishot',
  DAMAGE: 'damage',
  IMPACT: 'impact',
  PUNCTURE: 'puncture',
  SLASH: 'slash',
  HEAT: 'heat',
  COLD: 'cold',
  ELECTRICITY: 'electricity',
  TOXIN: 'toxin',
  VIRAL: 'viral',
  RADIATION: 'radiation',
  GAS: 'gas',
  MAGNETIC: 'magnetic',
  CORROSIVE: 'corrosive',
  BLAST: 'blast',
  RAW_DAMAGE: 'rawDamage',
  FACTION_DAMAGE: 'factionDamage',
  FLIGHT_SPEED: 'flightSpeed',
  RECOIL: 'recoil',
  ACCURACY: 'accuracy',
  ZOOM: 'zoom',
  COMBO_CHANCE: 'comboChance',
  CHANNELING_DAMAGE: 'channelingDamage',
  LIFESTEAL: 'lifesteal',
  HEAVY_ATTACK_DAMAGE: 'heavyAttackDamage',
  SLIDE_CRIT: 'slideCrit',
  WALL_ATTACK: 'wallAttack',
  BLOCKING: 'blocking',
  REFLECT: 'reflect',
  PARRY_ANGLE: 'parryAngle',
  FOLLOW_THROUGH: 'followThrough',
  RANGE: 'range',
  ATTACK_SPEED: 'attackSpeed',
  BLOCK_DAMAGE: 'blockDamage',
  DISARM: 'disarm',
  // Special
  DUAL_STAT: 'dualStat',      // Damage + Status
  CORRUPTED: 'corrupted',     // +Buff/-Debuff
  AUGMENT: 'augment',         // Ability specific
  SET_BONUS: 'setBonus',      // Set mod bonus
};

export class Mod {
  constructor(data = {}) {
    this.id = data.id || '';
    this.name = data.name || '';
    this.description = data.description || '';
    this.category = data.category || MOD_CATEGORIES.WARFRAME;
    this.polarity = data.polarity || MOD_POLARITIES.UNIVERSAL;
    this.rarity = data.rarity ?? MOD_RARITY.COMMON;
    this.baseCapacity = data.baseCapacity || 0;      // Cost at rank 0
    this.capacityPerRank = data.capacityPerRank || 1; // Cost increase per rank
    this.maxRank = data.maxRank || 10;
    this.currentRank = Math.min(data.currentRank || 0, this.maxRank);
    
    // Stats: { statType: { base: value, perRank: value } }
    this.stats = data.stats || {};
    
    // Fusion costs
    this.endoPerRank = data.endoPerRank || [0, 500, 1500, 3500, 7000, 12500, 20000, 30000, 42500, 57500, 75000];
    this.creditsPerRank = data.creditsPerRank || [0, 1000, 3000, 6000, 10000, 15000, 21000, 28000, 36000, 45000, 55000];
    
    // Special flags
    this.isPrime = data.isPrime || false;
    this.isUmbra = data.isUmbra || false;
    this.isAmalgam = data.isAmalgam || false;
    this.isCorrupted = data.isCorrupted || false;
    this.isAugment = data.isAugment || false;
    this.isSetMod = data.isSetMod || false;
    this.setName = data.setName || '';
    this.abilityName = data.abilityName || ''; // For augments
    
    // Transient (not saved)
    this.owned = data.owned || 1;
    this.equipped = data.equipped || false;
  }

  get capacity() {
    return this.baseCapacity + this.capacityPerRank * this.currentRank;
  }

  getStatValue(statType, rank = this.currentRank) {
    const stat = this.stats[statType];
    if (!stat) return 0;
    return stat.base + stat.perRank * rank;
  }

  getAllStats(rank = this.currentRank) {
    const result = {};
    for (const [type, stat] of Object.entries(this.stats)) {
      result[type] = stat.base + stat.perRank * rank;
    }
    return result;
  }

  getEndoToNextRank() {
    if (this.currentRank >= this.maxRank) return 0;
    return this.endoPerRank[this.currentRank + 1] || 0;
  }

  getCreditsToNextRank() {
    if (this.currentRank >= this.maxRank) return 0;
    return this.creditsPerRank[this.currentRank + 1] || 0;
  }

  getTotalEndoInvested() {
    let total = 0;
    for (let i = 1; i <= this.currentRank; i++) {
      total += this.endoPerRank[i] || 0;
    }
    return total;
  }

  getTotalCreditsInvested() {
    let total = 0;
    for (let i = 1; i <= this.currentRank; i++) {
      total += this.creditsPerRank[i] || 0;
    }
    return total;
  }

  canRankUp(endo, credits) {
    if (this.currentRank >= this.maxRank) return false;
    return endo >= this.getEndoToNextRank() && credits >= this.getCreditsToNextRank();
  }

  rankUp(endo, credits) {
    if (!this.canRankUp(endo, credits)) return false;
    this.currentRank++;
    return true;
  }

  rankDown() {
    if (this.currentRank <= 0) return false;
    this.currentRank--;
    return true;
  }

  maxOut(endo, credits) {
    let ranked = 0;
    while (this.canRankUp(endo, credits)) {
      endo -= this.getEndoToNextRank();
      credits -= this.getCreditsToNextRank();
      this.rankUp(endo, credits);
      ranked++;
    }
    return ranked;
  }

  // Polarity matching for capacity discount
  getEffectiveCapacity(slotPolarity = null, formaCount = 0) {
    let cost = this.capacity;
    
    // Same polarity = half cost (rounded up)
    if (slotPolarity && this.polarity === slotPolarity) {
      cost = Math.ceil(cost / 2);
    }
    // Opposite polarity = double cost (if no forma)
    else if (slotPolarity && this.polarity !== MOD_POLARITIES.UNIVERSAL && slotPolarity !== MOD_POLARITIES.UNIVERSAL) {
      // Check if polarities are "opposite" (Madurai vs Vazarin, Naramon vs Zenurik, etc.)
      const opposites = {
        [MOD_POLARITIES.MADURAI]: MOD_POLARITIES.VAZARIN,
        [MOD_POLARITIES.VAZARIN]: MOD_POLARITIES.MADURAI,
        [MOD_POLARITIES.NARAMON]: MOD_POLARITIES.ZENURIK,
        [MOD_POLARITIES.ZENURIK]: MOD_POLARITIES.NARAMON,
        [MOD_POLARITIES.UNAIRU]: MOD_POLARITIES.PENAMBRA,
        [MOD_POLARITIES.PENAMBRA]: MOD_POLARITIES.UNAIRU,
      };
      if (opposites[this.polarity] === slotPolarity && formaCount === 0) {
        cost = cost * 2;
      }
    }
    // Universal polarity fits anywhere at normal cost
    // Forma'd slots (universal) accept any polarity at normal cost
    
    return Math.max(0, cost);
  }

  clone() {
    return new Mod({
      ...this,
      stats: { ...this.stats },
    });
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      currentRank: this.currentRank,
      equipped: this.equipped,
      owned: this.owned,
    };
  }

  static fromJSON(json, modDatabase) {
    const template = modDatabase.get(json.id);
    if (!template) return null;
    const mod = template.clone();
    mod.currentRank = json.currentRank || 0;
    mod.equipped = json.equipped || false;
    mod.owned = json.owned || 1;
    return mod;
  }
}

export default Mod;