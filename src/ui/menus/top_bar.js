import { THEME } from '../theme.js';
/**
 * The top bar shared by the menus: the squad icons (top left) and the currency bar (top right).
 * Used by the main menu, the pause menu and the navigation screen. The Arsenal has its own copy of the currency bar.
 */
import { FONT, MENU_COLORS, MENU_SIDE_MARGIN, MENU_TOP_MARGIN, roundRectPath, drawProfileAndInvite } from './menu_style.js';
import { getMode } from '../squad.js';
import { wallet } from '../../economy/wallet.js';
import { DISPLAY_CURRENCIES } from '../../economy/currencies.js';
import { user } from '../../user/user_data.js';

// Squad icons: 54x54 boxes, 6px apart. The name box opens to the right of the profile when it is hovered.
const ICON = 54;
const GAP = 6;
const CURRENCY_RIGHT_MARGIN = 96;
const PANEL_BG = THEME.panel.fill;
const PANEL_STROKE = THEME.panel.stroke;

// The username box is 200 wide and opens to the right of the profile icon while it is hovered.
// The mode and invite icons move right by its width, with a 6px gap between every box.
// reveal is 0..1 (closed..open); it eases toward the hover state like the Arsenal's card animation.
const NAME_W = 200;
let reveal = 0;

// Boxes for the given reveal (0..1, or true/false for fully open/closed)
export function squadIconRects(open = 0) {
  const k = typeof open === 'number' ? open : (open ? 1 : 0);
  const y = MENU_TOP_MARGIN;
  const avatar = { x: MENU_SIDE_MARGIN, y, w: ICON, h: ICON };
  // The name box sits flush against the profile icon; the 6px gap is kept after it
  const name = { x: avatar.x + ICON, y, w: NAME_W * k, h: ICON };
  const modeX = avatar.x + ICON + GAP + NAME_W * k;
  const mode = { x: modeX, y, w: ICON, h: ICON };
  const invite = { x: mode.x + ICON + GAP, y, w: ICON, h: ICON };
  return { avatar, mode, invite, name };
}

function inside(r, p) {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

// True when the pointer (canvas pixels) is over the profile icon, or over the username box while it is open.
// The box is only counted when it is already open, so the icons do not jump back while the pointer is on them.
export function profileHovered(mouse, wasHovered = false) {
  if (!mouse) return false;
  const r = squadIconRects(wasHovered ? 1 : 0);
  return inside(r.avatar, mouse) || (wasHovered && inside(r.name, mouse));
}

// The matchmaking icon's box where it is drawn right now (it moves while the username box opens)
export function liveModeBox() {
  return squadIconRects(reveal).mode;
}

// Every squad icon box where it is drawn right now
export function liveSquadRects() {
  return squadIconRects(reveal);
}

export function drawSquadIcons(ctx, hoverProfile = false) {
  // Ease toward the target, about 14 steps a second (same as the Arsenal's card animation)
  const target = hoverProfile ? 1 : 0;
  reveal += (target - reveal) * Math.min(1, (1 / 60) * 14);
  if (Math.abs(target - reveal) < 0.002) reveal = target;

  const r = squadIconRects(reveal);
  drawProfileAndInvite(ctx, r.avatar, r.invite, { box: r.mode, glyph: getMode().glyph });
  if (reveal <= 0) return;

  // The username box, to the right of the profile icon (drawn over the mode and invite boxes)
  const n = r.name;
  ctx.save();
  ctx.globalAlpha = reveal;
  roundRectPath(ctx, n.x, n.y, n.w, n.h, 2);
  ctx.fillStyle = PANEL_BG;
  ctx.fill();
  ctx.strokeStyle = PANEL_STROKE;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.font = `bold 18px ${FONT}`;
  ctx.fillStyle = MENU_COLORS.title;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(user.get('displayName')), n.x + 14, n.y + n.h / 2, Math.max(0, n.w - 28));
  ctx.restore();
}

// Credit, platinum and endo amounts, right aligned at the currency margin (same look as the Arsenal bar)
export function drawCurrencyBar(ctx, canvasWidth, foundryReady = false) {
  const h = 42, y = MENU_TOP_MARGIN, cy = y + h / 2;
  const size = 18, icon = 24;
  ctx.save();
  ctx.font = `${size}px ${FONT}`;
  const items = DISPLAY_CURRENCIES.map((c) => {
    const text = wallet.format(c);
    return { currency: c, text, w: icon + 6 + ctx.measureText(text).width };
  });
  const boxW = 14 + items.reduce((sum, it) => sum + it.w, 0) + 16 * (items.length - 1) + 14;
  const box = { x: canvasWidth - CURRENCY_RIGHT_MARGIN - boxW, y, w: boxW, h };
  roundRectPath(ctx, box.x, box.y, box.w, box.h, 2);
  ctx.fillStyle = PANEL_BG;
  ctx.fill();
  ctx.strokeStyle = PANEL_STROKE;
  ctx.lineWidth = 1;
  ctx.stroke();

  let x = box.x + 14;
  for (const it of items) {
    drawCurrencyIcon(ctx, it.currency, x, cy, icon);
    ctx.font = `${size}px ${FONT}`;
    ctx.fillStyle = MENU_COLORS.title;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(it.text, x + icon + 6, cy);
    x += it.w + 16;
  }

  // Foundry flask, always shown to the left of the currency box. It is lit when something is ready to craft.
  const f = { x: box.x - h - 6, y, w: h, h };
  roundRectPath(ctx, f.x, f.y, f.w, f.h, 2);
  ctx.fillStyle = foundryReady ? THEME.accentFaint : PANEL_BG;
  ctx.fill();
  ctx.strokeStyle = foundryReady ? MENU_COLORS.selected : PANEL_STROKE;
  ctx.lineWidth = foundryReady ? 1.5 : 1;
  ctx.stroke();
  const fx = f.x + f.w / 2, s = 12; // flask is 24x24
  ctx.beginPath();
  ctx.moveTo(fx - s * 0.3, cy - s); ctx.lineTo(fx + s * 0.3, cy - s);
  ctx.lineTo(fx + s * 0.3, cy - s * 0.2); ctx.lineTo(fx + s, cy + s);
  ctx.lineTo(fx - s, cy + s); ctx.lineTo(fx - s * 0.3, cy - s * 0.2);
  ctx.closePath();
  ctx.strokeStyle = foundryReady ? MENU_COLORS.selected : MENU_COLORS.hint;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  if (foundryReady) {
    ctx.fillStyle = MENU_COLORS.accent;
    ctx.beginPath();
    ctx.arc(f.x + f.w - 6, f.y + 6, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Currency icon images, kept in src/assets/icons. A currency without a file draws nothing.
const ICON_FILES = { credits: 'credits.webp', platinum: 'platinum.webp', endo: 'endo.webp' };
const iconImages = {};
for (const [currency, file] of Object.entries(ICON_FILES)) {
  const img = new Image();
  img.src = new URL(`../../assets/icons/${file}`, import.meta.url).href;
  iconImages[currency] = img;
}

// Small icons for each currency, icon x icon pixels, centred on cy
export function drawCurrencyIcon(ctx, currency, x, cy, icon) {
  const img = iconImages[currency];
  if (img) {
    // Nothing is drawn until the image has loaded
    if (img.complete && img.naturalWidth > 0) ctx.drawImage(img, x, cy - icon / 2, icon, icon);
    return;
  }
}
