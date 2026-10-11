/**
 * Work In Progress Screen - Shown when a feature isn't implemented yet
 * Provides consistent UX for incomplete screens
 */
import { audioManager } from '../../engine/audio.js';

export default class WorkInProgressScreen {
  constructor(onBack) {
    this.onBack = onBack;
    this.visible = false;
    this.animTime = 0;
    this.panelAlpha = 0;
    this.title = 'WORK IN PROGRESS';
    this.message = 'This feature is under development.';
    this.subMessage = 'Check back in a future update.';
  }

  open(title = 'WORK IN PROGRESS', message = 'This feature is under development.', subMessage = 'Check back in a future update.') {
    this.visible = true;
    this.title = title;
    this.message = message;
    this.subMessage = subMessage;
    this.animTime = 0;
    this.panelAlpha = 0;
  }

  close() {
    this.visible = false;
    if (this.onBack) this.onBack();
  }

  handleClick(x, y) {
    if (!this.visible) return false;
    // Click anywhere to close (or could add a specific button)
    this.close();
    return true;
  }

  update(dt, input) {
    if (!this.visible) return;
    this.animTime += dt;
    this.panelAlpha = Math.min(1, this.panelAlpha + dt * 5);

    if (input.isPressed('Escape') || input.isKeyPressed('escape')) {
      this.close();
      audioManager.play('ui_back');
    }
  }

  draw(ctx, canvas) {
    if (!this.visible) return;
    ctx.save();

    const w = canvas.width;
    const h = canvas.height;

    // Dark overlay
    ctx.fillStyle = 'rgba(10, 10, 12, 0.95)';
    ctx.fillRect(0, 0, w, h);

    // Subtle animated background pattern
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const phase = this.animTime * 0.5 + i * 2.1;
      const x = w * (0.2 + 0.3 * Math.sin(phase * 0.3));
      const y = h * (0.3 + 0.4 * Math.cos(phase * 0.2));
      const r = Math.max(w, h) * 0.35;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, 'rgba(255,107,53,0.02)');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();

    // Centered panel
    const panelW = 500;
    const panelH = 280;
    const panelX = (w - panelW) / 2;
    const panelY = (h - panelH) / 2;

    ctx.globalAlpha = this.panelAlpha;

    // Panel background
    const panelGrad = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH);
    panelGrad.addColorStop(0, 'rgba(28, 28, 40, 0.98)');
    panelGrad.addColorStop(1, 'rgba(18, 18, 30, 0.98)');
    ctx.fillStyle = panelGrad;
    ctx.strokeStyle = 'rgba(255,107,53,0.3)';
    ctx.lineWidth = 2;
    this.roundRect(ctx, panelX, panelY, panelW, panelH, 16);
    ctx.fill();
    ctx.stroke();

    // Warning icon
    ctx.font = '64px Arial';
    ctx.fillStyle = '#ff6b35';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚠', w / 2, panelY + 70);

    // Title
    ctx.font = 'bold 28px "Segoe UI", Roboto, system-ui, sans-serif';
    ctx.fillStyle = '#ff6b35';
    ctx.fillText(this.title, w / 2, panelY + 130);

    // Message
    ctx.font = '16px "Segoe UI", Roboto, system-ui, sans-serif';
    ctx.fillStyle = '#c8b8a8';
    ctx.fillText(this.message, w / 2, panelY + 170);

    // Sub-message
    ctx.font = '13px "Segoe UI", Roboto, system-ui, sans-serif';
    ctx.fillStyle = '#7a7a9a';
    ctx.fillText(this.subMessage, w / 2, panelY + 195);

    // Progress bar (animated)
    const barW = 300;
    const barH = 6;
    const barX = (w - barW) / 2;
    const barY = panelY + panelH - 50;
    
    ctx.fillStyle = 'rgba(255,107,53,0.1)';
    this.roundRect(ctx, barX, barY, barW, barH, 3);
    ctx.fill();
    
    const progress = (this.animTime * 30) % (barW + 100) - 50;
    if (progress > 0 && progress < barW) {
      ctx.fillStyle = '#ff6b35';
      this.roundRect(ctx, barX, barY, Math.min(progress, barW), barH, 3);
      ctx.fill();
    }

    // Back hint
    ctx.font = '12px "Segoe UI", Roboto, system-ui, sans-serif';
    ctx.fillStyle = '#5a5a7a';
    ctx.fillText('[Esc] Back', w / 2, panelY + panelH - 15);

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x, y, width, height, radius);
    } else {
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + width - radius, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
      ctx.lineTo(x + width, y + height - radius);
      ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
      ctx.lineTo(x + radius, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
    }
  }
}