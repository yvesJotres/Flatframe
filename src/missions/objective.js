import { reduceDamage } from '../combat/damage.js';
import HealthComponent from '../combat/health.js';

export const POD_THREAT = 1.4;

export default class CryoPod {
  constructor(x, y, options = {}) {
    this.name = options.name ?? 'Cryo Pod';
    this.x = x;
    this.y = y;
    this.radius = options.radius ?? 34;
    this.healthComponent = new HealthComponent({
      maxHp: options.health ?? 4000,
      armor: options.armor ?? 240,
    }, false);
    this.alive = true;
    this.threat = options.threat ?? POD_THREAT;

    this.hitTimer = 0;
    this.pulse = 0;
  }

  get health() { return this.healthComponent.hp; }
  set health(val) { this.healthComponent.hp = val; }
  get maxHealth() { return this.healthComponent.maxHp; }
  get baseArmor() { return this.healthComponent.baseArmor; }
    set baseArmor(val) { this.healthComponent.baseArmor = val; }
    get armor() { return this.healthComponent.currentArmor; }
    set armor(val) { this.healthComponent.currentArmor = val; }
  get healthPercent() { return this.maxHealth > 0 ? Math.max(0, this.health / this.maxHealth) : 0; }
  get isDead() { return this.healthComponent.isDead; }

  takeDamage(damage) {
    const taken = this.healthComponent.takeDamage(damage, 0);
    this.hitTimer = 0.2;
    if (this.healthComponent.isDead) this.alive = false;
    return taken;
  }

  update(dt) {
    this.hitTimer = Math.max(0, this.hitTimer - dt);
    this.pulse += dt;
  }

  // The cryopod (wiki: Defense): a tall glass pod on a platform. Its liquid level drops with its health, and it glows
  // in the objective colour; red while it is being hit, grey once it is broken.
  draw(ctx) {
    const status = this.alive ? (this.hitTimer > 0 ? '#ff6b6b' : '#8f7bff') : '#4a4f63';
    const w = this.radius * 1.1;   // pod width
    const h = this.radius * 2.6;   // pod height
    const top = -h / 2, bottom = h / 2;

    ctx.save();
    ctx.translate(this.x, this.y);

    // Glow on the floor under the platform
    ctx.save();
    ctx.scale(1, 0.45);
    ctx.fillStyle = 'rgba(143, 123, 255, 0.16)';
    ctx.beginPath();
    ctx.arc(0, bottom * 2.2, this.radius * 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Containment rings around the pod, turning slowly
    ctx.save();
    ctx.scale(1, 0.45);
    ctx.strokeStyle = status;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.arc(0, bottom * 2.2, this.radius * 1.9, this.pulse, this.pulse + Math.PI * 0.7);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, bottom * 2.2, this.radius * 1.9, this.pulse + Math.PI, this.pulse + Math.PI * 1.7);
    ctx.stroke();
    ctx.restore();

    // Platform
    ctx.fillStyle = '#1b1f30';
    ctx.fillRect(-w * 0.8, bottom - 6, w * 1.6, 12);
    ctx.strokeStyle = 'rgba(143, 123, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(-w * 0.8, bottom - 6, w * 1.6, 12);

    // Pod frame and glass
    ctx.fillStyle = this.alive ? '#222740' : '#171a25';
    ctx.fillRect(-w / 2, top, w, h);

    // Liquid: rises to the health level, from the bottom up
    const level = Math.max(0, Math.min(1, this.healthPercent));
    const liquidTop = bottom - (h - 8) * level;
    ctx.fillStyle = status;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(-w / 2 + 4, liquidTop, w - 8, bottom - 4 - liquidTop);
    ctx.globalAlpha = 1;

    // Glass highlights
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.fillRect(-w / 2 + 6, top + 6, 4, h - 12);

    // The pod's core, pulsing, sits in the liquid
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = status;
    const pulse = 0.85 + 0.15 * Math.sin(this.pulse * 3);
    ctx.beginPath();
    ctx.arc(0, (top + bottom) / 2, w * 0.2 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Frame edge and caps
    ctx.strokeStyle = status;
    ctx.lineWidth = 2;
    ctx.strokeRect(-w / 2, top, w, h);
    ctx.fillStyle = '#2d3350';
    ctx.fillRect(-w / 2 - 3, top - 4, w + 6, 6);

    ctx.restore();

    // Floating health bar
    const barWidth = 120;
    const barHeight = 8;
    const barX = this.x - barWidth / 2;
    const barY = this.y - this.radius * 1.3 - 26;

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(barX, barY, barWidth, barHeight);
    ctx.fillStyle = this.healthPercent > 0.35 ? '#8f7bff' : '#ff6b6b';
    ctx.fillRect(barX, barY, barWidth * this.healthPercent, barHeight);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    ctx.fillStyle = '#ffffff';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(this.name, this.x, barY - 4);
    ctx.restore();
  }
}
