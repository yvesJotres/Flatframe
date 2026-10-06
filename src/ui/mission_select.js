// Canvas mission-select screen, styled after the pause menu.
//
// Shown on boot and whenever the player picks "Change Mission". Pick a card with
// the keyboard or the mouse; update() returns the chosen mission id.
import { MISSIONS } from '../missions/missions.js';
import { audioManager } from '../core/audio.js';

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(x, y, width, height, radius);
  } else {
    ctx.rect(x, y, width, height);
  }
}

// Simple vector badges so the cards do not depend on an icon font.
function drawIcon(ctx, kind, cx, cy, size, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;

  if (kind === 'crosshair') {
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.75, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.18, 0, Math.PI * 2);
    ctx.fill();
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      ctx.beginPath();
      ctx.moveTo(dx * size * 0.85, dy * size * 0.85);
      ctx.lineTo(dx * size * 1.25, dy * size * 1.25);
      ctx.stroke();
    }
  } else if (kind === 'infinity') {
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(-size * 0.5, 0, size * 0.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(size * 0.5, 0, size * 0.5, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(size * 0.8, -size * 0.55);
    ctx.lineTo(size * 0.6, size * 0.55);
    ctx.lineTo(0, size);
    ctx.lineTo(-size * 0.6, size * 0.55);
    ctx.lineTo(-size * 0.8, -size * 0.55);
    ctx.closePath();
    ctx.stroke();
  }

  ctx.restore();
}

export default class MissionSelect {
  constructor() {
    this.visible = false;
    this.selectedIndex = 0;
    this.cards = []; // Cached card bounds from the last layout, used for hit-testing.
    this.vertical = false;
    this.lastHoverIndex = -1; // hover blip only fires when this changes
  }

  open(preselectId = null) {
    this.visible = true;
    const index = MISSIONS.findIndex((mission) => mission.id === preselectId);
    this.selectedIndex = index === -1 ? 0 : index;
    this.lastHoverIndex = -1;
  }

  close() {
    this.visible = false;
  }

  get selectedMission() {
    return MISSIONS[this.selectedIndex];
  }

  /**
   * Returns the id of the mission the player just confirmed, or null.
   */
  update(input, canvas) {
    if (!this.visible) return null;
    this.layout(canvas);

    // Both axes navigate: a row of cards on a wide window, a stack on a narrow one.
    const backward = ['arrowup', 'w', 'arrowleft', 'a'].some((key) => input.isKeyPressed(key));
    const forward = ['arrowdown', 's', 'arrowright', 'd'].some((key) => input.isKeyPressed(key));
    if (backward) this.selectedIndex = (this.selectedIndex - 1 + MISSIONS.length) % MISSIONS.length;
    if (forward) this.selectedIndex = (this.selectedIndex + 1) % MISSIONS.length;

    const hovered = this.hitTest(input.mouse.x, input.mouse.y);
    if (hovered !== -1) {
      this.selectedIndex = hovered;
      // Play only when the pointer moves onto a *different* card —
      // sitting on one must not machine-gun the blip.
      if (hovered !== this.lastHoverIndex) {
        audioManager.play('ui_hover');
      }
    }
    this.lastHoverIndex = hovered;

    const clicked = input.isMouseClicked();
    if (clicked && hovered !== -1) return MISSIONS[hovered].id;

    const confirmed = ['enter', ' '].some((key) => input.isKeyPressed(key));
    if (confirmed) return MISSIONS[this.selectedIndex].id;

    return null;
  }

  // A row of tall cards on a wide window, a stack of short ones on a narrow one.
  layout(canvas) {
    const count = MISSIONS.length;
    const vertical = canvas.width < 780;
    const rects = [];

    if (vertical) {
      const width = Math.min(canvas.width - 48, 520);
      const height = 88;
      const gap = 12;
      const total = count * height + (count - 1) * gap;
      const startY = Math.max(150, (canvas.height - total) / 2 + 26);
      for (let i = 0; i < count; i++) {
        rects.push({ x: (canvas.width - width) / 2, y: startY + i * (height + gap), width, height });
      }
    } else {
      const gap = 26;
      const width = Math.min(300, (canvas.width - 96 - gap * (count - 1)) / count);
      const height = Math.min(320, canvas.height - 200);
      const total = count * width + (count - 1) * gap;
      const startX = (canvas.width - total) / 2;
      const y = (canvas.height - height) / 2 + 18;
      for (let i = 0; i < count; i++) {
        rects.push({ x: startX + i * (width + gap), y, width, height });
      }
    }

    this.cards = rects.map((rect, index) => ({ ...rect, mission: MISSIONS[index] }));
    this.vertical = vertical;
    return this;
  }

  hitTest(x, y) {
    for (let i = 0; i < this.cards.length; i++) {
      const card = this.cards[i];
      if (x >= card.x && x <= card.x + card.width && y >= card.y && y <= card.y + card.height) {
        return i;
      }
    }
    return -1;
  }

  draw(ctx, canvas) {
    if (!this.visible) return;
    this.layout(canvas);

    const time = performance.now() / 1000;
    const top = this.cards[0] ? this.cards[0].y : canvas.height / 2;

    ctx.save();

    // Backdrop
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#0b0d15');
    gradient.addColorStop(1, '#171c2e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Drifting grid so the screen is not flat.
    ctx.strokeStyle = 'rgba(120, 140, 200, 0.06)';
    ctx.lineWidth = 1;
    const step = 48;
    const offset = (time * 12) % step;
    for (let x = -step + offset; x < canvas.width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = -step + offset; y < canvas.height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Heading
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 38px system-ui, sans-serif';
    ctx.fillText('SELECT MISSION', canvas.width / 2, top - 92);

    ctx.fillStyle = '#8b93ad';
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText('WASD move · mouse aim · LMB fire · R reload · Esc pause', canvas.width / 2, top - 64);

    this.cards.forEach((card, index) => {
      this.drawCard(ctx, card, index === this.selectedIndex, time);
    });

    // Brief for the highlighted mission, under the cards.
    const bottom = Math.max(...this.cards.map((card) => card.y + card.height));
    const briefLines = this.vertical
      ? []
      : wrapText(ctx, this.selectedMission.brief, Math.min(canvas.width - 160, 720));

    ctx.textAlign = 'center';
    ctx.fillStyle = '#c7cddf';
    ctx.font = '15px system-ui, sans-serif';
    briefLines.forEach((line, index) => {
      ctx.fillText(line, canvas.width / 2, bottom + 34 + index * 22);
    });

    ctx.fillStyle = '#8b93ad';
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText('Enter / click to deploy', canvas.width / 2, bottom + 34 + briefLines.length * 22 + 18);

    ctx.restore();
  }

  drawCard(ctx, card, selected, time) {
    const mission = card.mission;
    const compact = this.vertical;
    const accent = mission.accent ?? '#4fc3f7';

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    // Panel — the selected card glows and breathes.
    if (selected) {
      ctx.shadowColor = accent;
      ctx.shadowBlur = 18 + Math.sin(time * 2.5) * 8;
    }
    ctx.fillStyle = selected ? 'rgba(255, 255, 255, 0.07)' : 'rgba(255, 255, 255, 0.025)';
    ctx.strokeStyle = selected ? accent : '#333a52';
    ctx.lineWidth = selected ? 2.5 : 1.5;
    roundRect(ctx, card.x, card.y, card.width, card.height, 14);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Accent stripe down the selected card's leading edge.
    if (selected) {
      ctx.fillStyle = accent;
      roundRect(ctx, card.x, card.y, 4, card.height, 2);
      ctx.fill();
    }

    const cx = card.x + card.width / 2;
    const iconY = card.y + (compact ? card.height / 2 : 66);
    drawIcon(ctx, mission.icon, cx, iconY, compact ? 14 : 20, selected ? accent : '#6f7896');

    // Tall cards stack the text under the badge; short ones put it alongside.
    const nameY = compact ? card.y + card.height / 2 - 8 : card.y + 124;
    const textX = compact ? card.x + 92 : cx;

    ctx.textAlign = compact ? 'left' : 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${compact ? 20 : 24}px system-ui, sans-serif`;
    ctx.fillText(mission.name, textX, nameY);

    ctx.fillStyle = '#9aa0b4';
    ctx.font = '13px system-ui, sans-serif';
    const taglineWidth = compact ? card.width - 120 : card.width - 40;
    wrapText(ctx, mission.tagline, taglineWidth).forEach((line, index) => {
      ctx.fillText(line, textX, nameY + 24 + index * 18);
    });

    if (compact) {
      ctx.restore();
      return;
    }

    // Divider, then the stat list.
    const dividerY = card.y + 190;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(card.x + 22, dividerY);
    ctx.lineTo(card.x + card.width - 22, dividerY);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.font = '13px system-ui, sans-serif';
    mission.stats.forEach((stat, index) => {
      const y = dividerY + 30 + index * 24;
      ctx.fillStyle = selected ? accent : '#5d6580';
      ctx.beginPath();
      ctx.arc(card.x + 30, y - 4, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#c7cddf';
      ctx.fillText(stat, card.x + 44, y);
    });

    ctx.restore();
  }
}
