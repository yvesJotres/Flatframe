import { THEME } from '../theme.js';
// Shared look for full-screen menus (main menu, pause menu): fonts, colors,
// corner accents and the glowing selected-row treatment.

export const FONT = '"Segoe UI", Roboto, system-ui, sans-serif';

export const MENU_COLORS = {
  accent: THEME.accent,
  title: THEME.text.title,
  selected: THEME.highlight.stroke,
  label: THEME.text.label,
  hint: THEME.text.hint,
  footer: THEME.text.footer,
  danger: THEME.text.danger,
};

// Distance of the orange corner brackets from the screen edge (canvas px).
// It is THE screen margin: HUD, back button, touch controls and menu content all align to it
// (CSS mirrors it as --edge in style.css).
export const SCREEN_EDGE = 30;
// Content margins on menu screens: 96px from the left and right edges, 46px from the top and bottom
export const MENU_SIDE_MARGIN = 96;
export const MENU_TOP_MARGIN = 46;

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
// showDescription: the description line is drawn only when this is true (the label keeps its place either way)
export function drawOption(ctx, cx, y, label, description, selected, danger = false, showDescription = true) {
  if (selected) drawSelectedRow(ctx, cx, y, danger ? MENU_COLORS.danger : MENU_COLORS.accent);
  ctx.font = selected ? `bold 22px ${FONT}` : `20px ${FONT}`;
  ctx.fillStyle = selected ? (danger ? MENU_COLORS.danger : MENU_COLORS.selected) : MENU_COLORS.label;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, cx, description ? y - 4 : y);
  if (description && showDescription) {
    ctx.font = `12px ${FONT}`;
    ctx.fillStyle = selected ? (danger ? MENU_COLORS.danger : MENU_COLORS.accent) : MENU_COLORS.hint;
    ctx.fillText(description, cx, y + 16);
  }
}

// The Warframe-style arrow used as the profile icon
export function drawFrameGlyph(ctx, cx, cy, size, color = THEME.frameGreen) {
  const s = size / 32;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-Math.PI / 2);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(20, 0); ctx.lineTo(-12, -12); ctx.lineTo(-6, 0); ctx.lineTo(-12, 12);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 2 / s;
  ctx.strokeStyle = THEME.text.white;
  ctx.stroke();
  ctx.restore();
}

// The profile icon and the invite (+) button, drawn the same way on every screen.
// avatar and invite are { x, y, w, h } boxes. Clicking them is handled by each screen.
// The pointer in canvas pixels, set once per frame by the game loop. The squad mode box is outlined only under it.
let menuPointer = null;
export function setMenuPointer(p) {
  menuPointer = p ? { x: p.x, y: p.y } : null;
}

// True when the pointer is over a box (canvas pixels)
function pointerOver(r) {
  const p = menuPointer;
  return !!p && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

export function drawProfileAndInvite(ctx, avatar, invite, mode) {
  const g = ctx.createLinearGradient(avatar.x, avatar.y, avatar.x + avatar.w, avatar.y + avatar.h);
  g.addColorStop(0, THEME.avatar.from);
  g.addColorStop(1, THEME.avatar.to);
  ctx.fillStyle = g;
  ctx.fillRect(avatar.x, avatar.y, avatar.w, avatar.h);
  // Gold outline while the pointer is over the profile icon
  const avatarHover = pointerOver(avatar);
  ctx.strokeStyle = avatarHover ? THEME.highlight.stroke : THEME.subtle.pip;
  ctx.lineWidth = avatarHover ? 2 : 1;
  ctx.strokeRect(avatar.x + (avatarHover ? 1 : 0.5), avatar.y + (avatarHover ? 1 : 0.5), avatar.w - (avatarHover ? 2 : 1), avatar.h - (avatarHover ? 2 : 1));
  drawFrameGlyph(ctx, avatar.x + avatar.w / 2, avatar.y + avatar.h / 2 + 1, avatar.w * 0.55);

  // Squad mode box (between the profile and the invite): the current mode's symbol, outlined gold like the reference
  if (mode) {
    // Outlined in full gold (2px, on whole pixels) only while the pointer is over it
    const m = mode.box;
    roundRectPath(ctx, m.x, m.y, m.w, m.h, 2);
    ctx.fillStyle = THEME.panel.fill;
    ctx.fill();
    roundRectPath(ctx, m.x + 1, m.y + 1, m.w - 2, m.h - 2, 2);
    const hover = pointerOver(m);
    ctx.strokeStyle = hover ? THEME.highlight.stroke : THEME.panel.stroke;
    ctx.lineWidth = hover ? 2 : 1;
    ctx.stroke();
    ctx.font = `20px "Segoe UI Symbol", Arial, sans-serif`;
    ctx.fillStyle = MENU_COLORS.selected;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(mode.glyph, m.x + m.w / 2, m.y + m.h / 2);
  }

  // Invite box: the same panel look as the rest of the menus, with a light line along the bottom and a plus
  roundRectPath(ctx, invite.x, invite.y, invite.w, invite.h, 2);
  ctx.fillStyle = THEME.panel.fill;
  ctx.fill();
  // Gold outline while the pointer is over the plus button
  const inviteHover = pointerOver(invite);
  ctx.strokeStyle = inviteHover ? THEME.highlight.stroke : THEME.panel.stroke;
  ctx.lineWidth = inviteHover ? 2 : 1;
  ctx.stroke();
  ctx.fillStyle = MENU_COLORS.title;
  ctx.fillRect(invite.x + 4, invite.y + invite.h - 3, invite.w - 8, 2);
  ctx.font = `22px ${FONT}`;
  ctx.fillStyle = MENU_COLORS.title;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('+', invite.x + invite.w / 2, invite.y + invite.h / 2 - 1);
}

// The Return button: the BACK button at the bottom right of the Arsenal and Navigation screens.
// r is its box; it turns gold while the pointer is over it.
export function drawReturnButton(ctx, r, hover = false, size = 15) {
  roundRectPath(ctx, r.x, r.y, r.w, r.h, 3);
  ctx.fillStyle = hover ? THEME.accentFaint : THEME.panel.fill;
  ctx.fill();
  ctx.strokeStyle = hover ? MENU_COLORS.selected : THEME.panel.stroke;
  ctx.lineWidth = hover ? 1.5 : 1;
  ctx.stroke();
  ctx.font = `bold ${size}px ${FONT}`;
  ctx.fillStyle = hover ? MENU_COLORS.selected : MENU_COLORS.title;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('BACK', r.x + r.w / 2, r.y + r.h / 2);
}

export function drawCornerAccents(ctx, w, h) {
  const size = 60;
  const offset = SCREEN_EDGE;
  ctx.strokeStyle = THEME.accentGlow;
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
