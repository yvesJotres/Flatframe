// Art for the menus: original vector drawings in this folder (SVG). Each Arsenal slot has one drawing.
// drawArt draws a file fitted (not stretched) into a box. It returns false while the file is loading or missing,
// so the caller can draw its fallback.

// Arsenal slot -> drawing file
export const ART = {
  warframe: 'excalibur.svg',
  primary: 'primary_rifle.svg',
  secondary: 'secondary_pistol.svg',
  melee: 'melee_sword.svg',
};

const images = {};

export function drawArt(ctx, file, x, y, w, h) {
  let img = images[file];
  if (!img) {
    img = new Image();
    img.onerror = () => { img.failed = true; };
    img.src = new URL(`./${file}`, import.meta.url).href;
    images[file] = img;
  }
  if (img.failed || !img.complete || !img.naturalWidth) return false;
  const aspect = img.naturalWidth / img.naturalHeight;
  let dw = w, dh = h;
  if (w / h > aspect) dw = h * aspect; else dh = w / aspect;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  return true;
}

// Draws the drawing for an Arsenal slot
export function drawSlotArt(ctx, slotId, x, y, w, h) {
  return drawArt(ctx, ART[slotId], x, y, w, h);
}

// The Warframe figure: one file, drawn the same way in the game and in the Arsenal.
// Units: the figure file is FIGURE_BOX units square, centred on its origin, where a radius of FIGURE_RADIUS_UNITS
// is the unit's radius in the game. The weapon layer uses the same units (offset and size) in both places.
export const FIGURE = 'excalibur_figure.svg';
export const FIGURE_BOX = 60;
export const FIGURE_RADIUS_UNITS = 16;
export const WEAPON_LAYER = { x: 10, y: -1, w: 21.8, h: 10.9 };
