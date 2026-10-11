// Shared look for full-screen menus (main menu, pause menu): fonts, colors,
// corner accents and the glowing selected-row treatment.

export const FONT = '"Segoe UI", Roboto, system-ui, sans-serif';

export const MENU_COLORS = {
  accent: '#ff6b35',
  title: '#f0e8e0',
  selected: '#ffd78a',
  label: '#c8b8a8',
  hint: '#9090b0',
  footer: '#7a7a9a',
  danger: '#ff5b5b',
};

// Distance of the orange corner brackets from the screen edge (canvas px).
// It is THE screen margin: HUD, back button, touch controls and menu content all align to it
// (CSS mirrors it as --edge in style.css).
export const SCREEN_EDGE = 30;

export const ROW_HALF_WIDTH = 200;
export const ROW_HEIGHT = 44;

export function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** Orange glow band with tick marks behind the selected option at (cx, y). */
export function drawSelectedRow(ctx, cx, y, color = MENU_COLORS.accent) {
  const rgb = color === MENU_COLORS.danger ? '255,91,91' : '255,107,53';
  const glow = ctx.createLinearGradient(cx - ROW_HALF_WIDTH, 0, cx + ROW_HALF_WIDTH, 0);
  glow.addColorStop(0, `rgba(${rgb},0)`);
  glow.addColorStop(0.5, `rgba(${rgb},0.12)`);
  glow.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = glow;
  roundRectPath(ctx, cx - ROW_HALF_WIDTH, y - ROW_HEIGHT / 2, ROW_HALF_WIDTH * 2, ROW_HEIGHT, 8);
  ctx.fill();

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const side of [-1, 1]) {
    for (const dy of [-10, 10]) {
      ctx.moveTo(cx + side * (ROW_HALF_WIDTH + 10), y + dy);
      ctx.lineTo(cx + side * (ROW_HALF_WIDTH - 5), y + dy);
    }
  }
  ctx.stroke();
}

/** Option label (and optional one-line description) centered at (cx, y). */
export function drawOption(ctx, cx, y, label, description, selected, danger = false) {
  if (selected) drawSelectedRow(ctx, cx, y, danger ? MENU_COLORS.danger : MENU_COLORS.accent);
  ctx.font = selected ? `bold 22px ${FONT}` : `20px ${FONT}`;
  ctx.fillStyle = selected ? (danger ? MENU_COLORS.danger : MENU_COLORS.selected) : MENU_COLORS.label;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, cx, description ? y - 4 : y);
  if (description) {
    ctx.font = `12px ${FONT}`;
    ctx.fillStyle = selected ? (danger ? MENU_COLORS.danger : MENU_COLORS.accent) : MENU_COLORS.hint;
    ctx.fillText(description, cx, y + 16);
  }
}

export function drawCornerAccents(ctx, w, h) {
  const size = 60;
  const offset = SCREEN_EDGE;
  ctx.strokeStyle = 'rgba(255,107,53,0.3)';
  ctx.lineWidth = 2;
  const corners = [
    [offset, offset + size, offset, offset, offset + size, offset],
    [w - offset - size, offset, w - offset, offset, w - offset, offset + size],
    [offset, h - offset - size, offset, h - offset, offset + size, h - offset],
    [w - offset, h - offset - size, w - offset, h - offset, w - offset - size, h - offset],
  ];
  for (const [x1, y1, x2, y2, x3, y3] of corners) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.stroke();
  }
}
