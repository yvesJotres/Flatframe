// src/damage/damageNumbers.js
// Warframe-accurate Damage Numbers System (based on Damage 3.0 wiki)

/**
 * Damage Number Types - determines color and priority
 * @enum {string}
 */
export const DamageNumberType = {
  NORMAL: 'normal',           // White - regular damage to health
  SHIELD: 'shield',           // Blue - damage to shields/overshields
  CRIT: 'crit',               // Yellow - base critical hit / stealth
  CRIT_ORANGE: 'crit_orange', // Orange - big critical hit
  CRIT_RED: 'crit_red',       // Red - super critical hit
  ABILITY: 'ability',         // Purple - ability damage
  INVULNERABLE: 'invulnerable', // Grey - invulnerable target
};

/**
 * Damage Number Display Modes
 * @enum {string}
 */
export const DamageNumberMode = {
  LEGACY: 'legacy',     // First-come-first-serve, equal priority
  ENHANCED: 'enhanced', // Prioritizes larger numbers and crits
  OFF: 'off',           // No damage numbers
};

/**
 * Settings for damage numbers (mirrors Warframe settings)
 */
export const defaultDamageNumberSettings = {
  mode: DamageNumberMode.ENHANCED,
  compact: false,          // 100357 -> 100k
  scale: 1.0,              // 0.5 to 3.0 (50% to 300%)
  opacity: 1.0,            // 0.0 to 1.0
  bold: false,
  showForAllies: true,     // Show companion/summon damage
};

/**
 * Color mapping for each damage number type
 * Uses CSS custom properties for theming
 */
export const DamageNumberColors = {
  [DamageNumberType.NORMAL]: 'var(--damage-normal, #ffffff)',
  [DamageNumberType.SHIELD]: 'var(--damage-shield, #01d8ff)',
  [DamageNumberType.CRIT]: 'var(--damage-crit, #ffff00)',
  [DamageNumberType.CRIT_ORANGE]: 'var(--damage-crit-orange, #fe6c09)',
  [DamageNumberType.CRIT_RED]: 'var(--damage-crit-red, #fe0000)',
  [DamageNumberType.ABILITY]: 'var(--damage-ability, #b201fe)',
  [DamageNumberType.INVULNERABLE]: 'var(--damage-invulnerable, #585858)',
};

/**
 * Priority for Enhanced mode (higher = shown longer, not culled first)
 * Critical hits and larger numbers get higher priority
 */
export const DamageNumberPriority = {
  [DamageNumberType.NORMAL]: 1,
  [DamageNumberType.SHIELD]: 2,
  [DamageNumberType.CRIT]: 5,
  [DamageNumberType.CRIT_ORANGE]: 8,
  [DamageNumberType.CRIT_RED]: 10,
  [DamageNumberType.ABILITY]: 4,
  [DamageNumberType.INVULNERABLE]: 0,
};

/**
 * Determine damage number type from hit context
 * @param {Object} context - Hit context
 * @param {boolean} context.isShieldDamage - Damage went to shields
 * @param {boolean} context.isCritical - Is a critical hit
 * @param {number} context.critTier - 1=yellow, 2=orange, 3=red
 * @param {boolean} context.isAbility - From Warframe ability
 * @param {boolean} context.isInvulnerable - Target is invulnerable
 * @param {boolean} context.isStealth - Stealth attack
 * @returns {DamageNumberType}
 */
export function getDamageNumberType(context) {
  if (context.isInvulnerable) return DamageNumberType.INVULNERABLE;
  if (context.isShieldDamage) return DamageNumberType.SHIELD;
  if (context.isAbility) return DamageNumberType.ABILITY;
  if (context.isCritical || context.isStealth) {
    switch (context.critTier) {
      case 3: return DamageNumberType.CRIT_RED;
      case 2: return DamageNumberType.CRIT_ORANGE;
      default: return DamageNumberType.CRIT;
    }
  }
  return DamageNumberType.NORMAL;
}

/**
 * Format damage value per settings (rounding, compact, separators)
 * @param {number} value - Raw damage value
 * @param {Object} settings - Damage number settings
 * @returns {string}
 */
export function formatDamageNumber(value, settings = defaultDamageNumberSettings) {
  // Round to nearest integer (wiki: "Displayed damage values will be rounded to the nearest integer")
  let num = Math.round(value);
  
  // Integer overflow handling (wiki: shows negative at 2,147,483,647)
  if (num > 2147483647) {
    num = num - 4294967296; // Simulate 32-bit signed overflow for display
  }
  
  if (settings.compact && num >= 1000) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  }
  
  // Add thousands separator (locale-aware in real game, using comma for now)
  return num.toLocaleString();
}

/**
 * Damage Number instance - represents a single floating number
 */
export class DamageNumber {
  constructor({
    x, y,                    // World position
    value,                   // Raw numeric value
    type = DamageNumberType.NORMAL,
    isAlly = false,          // From companion/summon
    settings = defaultDamageNumberSettings,
  }) {
    this.id = DamageNumber.generateId();
    this.x = x;
    this.y = y;
    this.value = value;
    this.type = type;
    this.isAlly = isAlly;
    this.settings = { ...defaultDamageNumberSettings, ...settings };
    
    // Display properties
    this.displayValue = formatDamageNumber(value, this.settings);
    this.color = DamageNumberColors[type];
    this.priority = DamageNumberPriority[type];
    
    // Animation state
    this.age = 0;
    this.lifetime = this.calculateLifetime();
    this.opacity = 1;
    this.scale = this.settings.scale;
    this.offsetY = 0;
    this.velocityY = -30; // Initial upward velocity (px/s)
    this.driftX = (Math.random() - 0.5) * 20; // Random horizontal drift
    
    // Enhanced mode: larger numbers and crits linger longer
    if (this.settings.mode === DamageNumberMode.ENHANCED) {
      this.lifetime *= 1 + (this.priority * 0.15);
    }
  }
  
  calculateLifetime() {
    // Base lifetime: 1.5s for normal, up to 3s for red crits
    const base = 1.5;
    const bonus = (this.priority / 10) * 1.5;
    return base + bonus;
  }
  
  update(dt) {
    this.age += dt;
    
    // Float upward with deceleration
    this.offsetY += this.velocityY * dt;
    this.velocityY *= 0.98; // Air resistance
    
    // Horizontal drift
    this.x += this.driftX * dt;
    
    // Fade out in last 30% of lifetime
    const fadeStart = this.lifetime * 0.7;
    if (this.age > fadeStart) {
      this.opacity = 1 - (this.age - fadeStart) / (this.lifetime - fadeStart);
    }
    
    // Scale pulse on spawn
    if (this.age < 0.1) {
      this.scale = this.settings.scale * (1 + 0.3 * (1 - this.age / 0.1));
    }
    
    return this.age < this.lifetime; // Return true if still alive
  }
  
  isExpired() {
    return this.age >= this.lifetime;
  }
  
  static generateId() {
    return 'dmg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
}

/**
 * Damage Numbers Manager - handles spawning, updating, culling
 */
export class DamageNumbersManager {
  constructor(settings = defaultDamageNumberSettings) {
    this.numbers = [];
    this.settings = { ...defaultDamageNumberSettings, ...settings };
    this.maxNumbers = 50; // Cap to prevent perf issues
    this.layer = null; // DOM element reference
    this.worldToScreen = null; // Transform function
  }
  
  setLayer(element) {
      this.layer = element;
    }

    setVisible(visible) {
      if (this.layer) {
        this.layer.style.display = visible ? '' : 'none';
      }
    }

    // world -> screen coordinate converter (set from game.js with camera)
  setTransform(fn) {
    this.worldToScreen = fn;
  }
  
  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
  }
  
  /**
   * Spawn a damage number
   * @param {Object} params - Damage number parameters
   * @returns {DamageNumber|null} The created number or null if disabled
   */
  spawn(params) {
    if (this.settings.mode === DamageNumberMode.OFF) return null;
    if (params.isAlly && !this.settings.showForAllies) return null;
    
    const number = new DamageNumber({ ...params, settings: this.settings });
    
    // Enhanced mode culling: if at capacity, remove lowest priority
    if (this.settings.mode === DamageNumberMode.ENHANCED && this.numbers.length >= this.maxNumbers) {
      this.cullLowestPriority();
    }
    
    this.numbers.push(number);
    this.renderNumber(number);
    return number;
  }
  
  cullLowestPriority() {
    // Remove lowest priority, oldest number
    let lowestIdx = 0;
    let lowestPriority = Infinity;
    let oldestAge = -1;
    
    this.numbers.forEach((num, idx) => {
      if (num.priority < lowestPriority || 
          (num.priority === lowestPriority && num.age > oldestAge)) {
        lowestPriority = num.priority;
        oldestAge = num.age;
        lowestIdx = idx;
      }
    });
    
    this.removeNumber(this.numbers[lowestIdx]);
    this.numbers.splice(lowestIdx, 1);
  }
  
  update(dt) {
    // Update all numbers, remove expired
    for (let i = this.numbers.length - 1; i >= 0; i--) {
      const num = this.numbers[i];
      if (!num.update(dt)) {
        this.removeNumber(num);
        this.numbers.splice(i, 1);
      } else {
        this.updateNumberDOM(num);
      }
    }
  }
  
  renderNumber(number) {
    if (!this.layer) return;
    
    const el = document.createElement('div');
    el.className = 'damage-number';
    el.dataset.id = number.id;
    el.dataset.type = number.type;
    el.textContent = number.displayValue;
    el.style.cssText = `
      position: absolute;
      pointer-events: none;
      user-select: none;
      color: ${number.color};
      font-size: ${16 * number.scale}px;
      font-weight: ${this.settings.bold ? 'bold' : 'normal'};
      opacity: ${number.opacity * this.settings.opacity};
      text-shadow: 0 0 3px rgba(0,0,0,0.8), 0 0 1px rgba(0,0,0,0.5);
      transform: translate(-50%, -50%) scale(${number.scale});
      z-index: ${1000 + number.priority};
      will-change: transform, opacity;
      white-space: nowrap;
    `;
    
    this.layer.appendChild(el);
    this.updateNumberDOM(number);
  }
  
  updateNumberDOM(number) {
    if (!this.layer) return;
    const el = this.layer.querySelector('[data-id="' + number.id + '"]');
    if (!el) return;
    
    // Convert world to screen coordinates using provided transform
    let screenX = number.x;
    let screenY = number.y + number.offsetY;
    
    if (this.worldToScreen) {
      const result = this.worldToScreen(number.x, number.y + number.offsetY);
      screenX = result.x;
      screenY = result.y;
    }
    
    el.style.transform = `translate(-50%, -50%) translate(${screenX}px, ${screenY}px) scale(${number.scale})`;
    el.style.opacity = number.opacity * this.settings.opacity;
  }
  
  removeNumber(number) {
    if (!this.layer) return;
    const el = this.layer.querySelector('[data-id="' + number.id + '"]');
    if (el) el.remove();
  }
  
  clear() {
    this.numbers.forEach(n => this.removeNumber(n));
    this.numbers = [];
  }
}

// Singleton instance
export const damageNumbersManager = new DamageNumbersManager();