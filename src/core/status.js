/**
 * Manages active status effects on an entity.
 */
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
        healthComponent.hp = Math.max(0, healthComponent.hp - effect.tickDamage);
        
        if (effect.remaining <= 0 || healthComponent.isDead) {
          this.effects.splice(i, 1);
        }
      }
    }
  }
}
