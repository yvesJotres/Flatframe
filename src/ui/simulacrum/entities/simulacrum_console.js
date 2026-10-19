/**
 * Simulacrum Console - Interactive terminal for spawning enemies.
 * Player presses X to interact (like Warframe's Simulacrum console).
 */

export const CONSOLE_INTERACTION_RADIUS = 48;

export default class SimulacrumConsole {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 24;
    this.pulse = 0;
    this.isInteracting = false;
    this.interactionProgress = 0; // 0 to 1
  }

  update(dt, player) {
    this.pulse += dt * 2;
    
    // Check if player is in range and pressing X
    const dist = Math.hypot(player.x - this.x, player.y - this.y);
    const inRange = dist <= CONSOLE_INTERACTION_RADIUS;
    
    return inRange;
  }

  draw(ctx, player) {
    const dist = Math.hypot(player.x - this.x, player.y - this.y);
    const inRange = dist <= CONSOLE_INTERACTION_RADIUS;
    const alpha = inRange ? 1 : 0.6;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(alpha, alpha);

    // Base platform
    ctx.fillStyle = `rgba(40, 40, 60, ${0.8 * alpha})`;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius + 8, 0, Math.PI * 2);
    ctx.fill();

    // Pulsing outer ring
    const ringRadius = this.radius + 4 + Math.sin(this.pulse * 3) * 3;
    ctx.strokeStyle = `rgba(143, 123, 255, ${0.7 * alpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Console body
    ctx.fillStyle = `rgba(20, 22, 35, ${0.95 * alpha})`;
    ctx.beginPath();
    ctx.roundRect(-this.radius, -this.radius, this.radius * 2, this.radius * 2, 6);
    ctx.fill();

    // Screen glow
    const screenGlow = 0.3 + 0.2 * Math.sin(this.pulse * 4);
    ctx.fillStyle = `rgba(143, 123, 255, ${screenGlow * alpha})`;
    ctx.beginPath();
    ctx.roundRect(-this.radius + 6, -this.radius + 6, this.radius * 2 - 12, this.radius * 2 - 12, 4);
    ctx.fill();

    // Interaction prompt (X key)
    if (inRange && !this.isInteracting) {
      ctx.fillStyle = `rgba(255, 255, 255, ${0.9 * alpha})`;
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('[X] Simulacrum', 0, -this.radius - 16);
      
      // Key hint
      ctx.fillStyle = `rgba(251, 191, 36, ${0.9 * alpha})`;
      ctx.beginPath();
      ctx.roundRect(-16, -this.radius - 30, 32, 20, 4);
      ctx.fill();
      ctx.fillStyle = '#1a1a2e';
      ctx.fillText('X', 0, -this.radius - 16);
    }

    // Decorative lines
    ctx.strokeStyle = `rgba(143, 123, 255, ${0.4 * alpha})`;
    ctx.lineWidth = 1;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(-this.radius + 10, -this.radius + 18 + i * 12);
      ctx.lineTo(this.radius - 10, -this.radius + 18 + i * 12);
      ctx.stroke();
    }

    ctx.restore();
  }
}

// Add roundRect polyfill if needed
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    this.beginPath();
    this.moveTo(x + radius, y);
    this.lineTo(x + w - radius, y);
    this.quadraticCurveTo(x + w, y, x + w, y + radius);
    this.lineTo(x + w, y + h - radius);
    this.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    this.lineTo(x + radius, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - radius);
    this.lineTo(x, y + radius);
    this.quadraticCurveTo(x, y, x + radius, y);
    this.closePath();
  };
}