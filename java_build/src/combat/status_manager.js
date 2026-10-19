/**
 * Manages active status effects on an entity.
 */
import { reduceDamage } from './damage.js';

export default class StatusManager {
  constructor() {
    this.effects = [];
  }

  addEffect(effect) {
    this.effects.push(effect);
  }

  update(dt, healthComponent) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i];
      effect.timer += dt;
      
      if (effect.timer >= effect.interval) {
        effect.timer -= effect.interval;
        effect.remaining -= 1;
        
        // 1. If shield is present and not bypassing shields
        if (healthComponent.shield > 0 && !effect.config.bypassesShields) {
          healthComponent.shield = Math.max(0, healthComponent.shield - effect.tickDamage);
        } else {
          // 2. Apply to health
          if (effect.config.bypassesArmor) {
            // True damage (Slash bleed)
            healthComponent.hp = Math.max(0, healthComponent.hp - effect.tickDamage);
          } else {
            // Standard DoT (e.g. Heat) - applies armor reduction
            const dmg = reduceDamage(effect.tickDamage, healthComponent.currentArmor, healthComponent.isPlayer);
            healthComponent.hp = Math.max(0, healthComponent.hp - dmg);
          }
        }
        
        if (effect.remaining <= 0 || healthComponent.isDead) {
          this.effects.splice(i, 1);
        }
      }
    }
  }
}
