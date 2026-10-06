import { reduceDamage } from '../core/damage.js';
import HealthComponent from '../core/health.js';

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
  get armor() { return this.healthComponent.armor; }
  set armor(val) { this.healthComponent.armor = val; }
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

  draw(ctx) {
    const status = this.alive ? (this.hitTimer > 0 ? '#ff6b6b' : '#8f7bff') : '#4a4f63';

    ctx.save();
    ctx.translate(this.x, this.y);

    // Base plate
    ctx.fillStyle = 'rgba(143, 123, 255, 0.12)';
    ctx.beginPath();
    ctx.arc(0, 0, this.radius + 14, 0, Math.PI * 2);
    ctx.fill();

    // Rotating containment ring
    ctx.strokeStyle = status;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius + 6, this.pulse, this.pulse + Math.PI * 0.7);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, this.radius + 6, this.pulse + Math.PI, this.pulse + Math.PI * 1.7);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Pod body
    ctx.fillStyle = this.alive ? '#2b2f45' : '#20232f';
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();

    // Core
    const coreRadius = this.radius * (0.42 + 0.05 * Math.sin(this.pulse * 3));
    ctx.fillStyle = status;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(0, 0, coreRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.restore();

    // Floating health bar
    const barWidth = 120;
    const barHeight = 8;
    const barX = this.x - barWidth / 2;
    const barY = this.y - this.radius - 26;

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
