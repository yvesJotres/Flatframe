// Shared energy visuals: the glow of Excalibur's energy weapons (the Radial Javelin's swords, the Exalted Blade, its
// energy waves, and the Slash Dash trail). The look follows Warframe's energy weapons: a bright white core inside a
// cyan glow, drawn additively so overlapping energy brightens. Every drawer works in the caller's current canvas frame,
// so a caller turns and moves the canvas first. Reuse these for any future energy effect so they all look the same.

export const ENERGY = {
  glow: '#7de7ff',         // the outer glow colour
  core: '#ffffff',         // the bright centre of a line
  blueRgb: '60, 160, 255', // the blue of trails (RGB, for rgba())
  blue: '#3ca0ff',
};

// Energy is additive: where two strokes overlap they brighten, as Warframe's energy does
function additive(ctx) {
  ctx.globalCompositeOperation = 'lighter';
}

// A blade from its hilt at (x, y), running forward (+x) for length units. It is a tapered, translucent blade: wide at
// the guard, a bright white core, a cyan edge glow and a sharp tip, with an angled guard at the hilt.
export function drawEnergyBlade(ctx, x, y, length) {
  const half = 3.2;        // half the width at the guard
  const tipX = x + length + 10;
  ctx.save();
  additive(ctx);

  // The blade body: a fading cyan at the hilt to a white point at the tip
  const grad = ctx.createLinearGradient(x, y, tipX, y);
  grad.addColorStop(0, 'rgba(125, 231, 255, 0.15)');
  grad.addColorStop(0.7, 'rgba(125, 231, 255, 0.55)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0.95)');
  ctx.beginPath();
  ctx.moveTo(x, y - half);
  ctx.lineTo(x + length * 0.85, y - half * 0.45);
  ctx.lineTo(tipX, y);
  ctx.lineTo(x + length * 0.85, y + half * 0.45);
  ctx.lineTo(x, y + half);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.shadowColor = ENERGY.glow;
  ctx.shadowBlur = 14;
  ctx.fill();

  // Edge glow along both sides of the blade
  ctx.shadowBlur = 8;
  ctx.strokeStyle = 'rgba(125, 231, 255, 0.9)';
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // The white core running down the middle
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x + 2, y);
  ctx.lineTo(x + length * 0.9, y);
  ctx.stroke();

  // Angled guard at the hilt
  ctx.fillStyle = 'rgba(125, 231, 255, 0.85)';
  ctx.beginPath();
  ctx.moveTo(x - 1, y - 7);
  ctx.lineTo(x + 3, y - 4);
  ctx.lineTo(x + 3, y + 4);
  ctx.lineTo(x - 1, y + 7);
  ctx.lineTo(x - 4, y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// A bowed arc of energy centred on (cx, cy): the crescent of an energy wave. span is the half-angle in radians.
// A wide cyan glow with a thin white core, drawn twice so it reads as a slash of light.
export function drawEnergyArc(ctx, cx, cy, radius, span, { lineWidth = 6, alpha = 1 } = {}) {
  ctx.save();
  additive(ctx);
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'round';
  ctx.shadowColor = ENERGY.glow;
  ctx.shadowBlur = 18;
  ctx.strokeStyle = 'rgba(125, 231, 255, 0.45)';
  ctx.lineWidth = lineWidth * 1.8;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, -span, span);
  ctx.stroke();
  ctx.shadowBlur = 6;
  ctx.strokeStyle = 'rgba(125, 231, 255, 0.9)';
  ctx.lineWidth = lineWidth;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = ENERGY.core;
  ctx.lineWidth = Math.max(1, lineWidth / 3);
  ctx.stroke();
  ctx.restore();
}

// A trail ribbon through points [{ x, y, life }] (life 1 = newest and brightest, 0 = gone). It tapers with life and has a
// wide blue glow with a white core on top.
export function drawEnergyRibbon(ctx, points, maxWidth, { rgb = ENERGY.blueRgb, glow = ENERGY.blue, alpha = 0.85 } = {}) {
  if (points.length < 2) return;
  ctx.save();
  additive(ctx);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = glow;
  ctx.shadowBlur = 14;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      const life = b.life;
      if (pass === 0) {
        ctx.strokeStyle = `rgba(${rgb}, ${alpha * life * 0.6})`;
        ctx.lineWidth = maxWidth * life;
      } else {
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.9 * life})`;
        ctx.lineWidth = Math.max(1, maxWidth * life * 0.25);
        ctx.shadowBlur = 0;
      }
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// A ring of energy expanding from (x, y), radius in units, alpha 0..1: a cyan ring with a thin white line inside it
export function drawEnergyRing(ctx, x, y, radius, alpha = 1) {
  ctx.save();
  additive(ctx);
  ctx.globalAlpha = alpha;
  ctx.shadowColor = ENERGY.glow;
  ctx.shadowBlur = 12;
  ctx.strokeStyle = 'rgba(125, 231, 255, 0.8)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}
