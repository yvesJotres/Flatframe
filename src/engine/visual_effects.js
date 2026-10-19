// Visual effects drawn over game objects and menu backgrounds. Each effect has its settings here, and a game
// object only calls drawVisualEffect(name, ctx, target) to show it. Art data (outlines, colours) lives in
// src/assets; drawing code lives only here. Add new effects to EFFECTS and drawers.

import { THEME } from '../ui/theme.js';
import { HEAD, BODY } from '../combat/hitzones.js';
import { drawArt, FIGURE, FIGURE_BOX, FIGURE_RADIUS_UNITS, WEAPON_LAYER } from '../assets/art/art.js';
import {
 EARTH_COLORS, EARTH_SPIN,
} from '../assets/planets/earth.js';
import { EARTH_LAND_RINGS } from '../assets/planets/earth_land.js';
import {
  PLANET_BODY_COLORS, PLANET_LAND_PATCHES, PLANET_LAND_RGB, ATMOSPHERE_COLORS,
} from '../assets/planets/planets.js';

export const EFFECT_NAMES = {
  BLIND_STARS: 'blindStars',
  STARFIELD: 'starfield',
  NEBULA: 'nebula',
  ATMOSPHERE: 'atmosphere',
  PLANET_EARTH: 'planetEarth',
  PLANET_BODY: 'planetBody',
  WEATHER: 'weather',
  HUMANOID: 'humanoid',
  LOCKER: 'locker',
  CONTAINER: 'container',
  PAD: 'pad',
  CAPSULE: 'capsule',
  CORPSE: 'corpse',
  INTERACT_PROMPT: 'interactPrompt',
  PROP_LABEL: 'propLabel',
  FACING_ARROW: 'facingArrow',
};

// Settings for each effect. Values are in world units (15 units = 1 m) unless noted.
const EFFECTS = {
  // Slow coloured clouds behind the menus: three soft glows drifting on different paths
  [EFFECT_NAMES.NEBULA]: {
    clouds: 3,
    phaseStep: 2.1,
    xDrift: 0.3,
    yDrift: 0.4,
    xBase: 0.2,
    yBase: 0.3,
    radiusFraction: 0.35,
    colors: THEME.menuTints,
  },
  // Background starfield for menus: small squares that twinkle. Positions wrap around the screen and drift with the offset.
  [EFFECT_NAMES.STARFIELD]: {
    count: 120,
    driftSpeed: 10,       // how fast the field drifts sideways with the menu offset
    xSpacing: 937,        // spread of star x positions (prime, so the stars do not line up)
    ySpacing: 1297,
    sizes: [0.5, 1, 1.5], // cycles through the three sizes
    twinkleSpeed: 2,
    alphaBase: 0.3,
    alphaRange: 0.35,
    color: THEME.text.white,
  },
  [EFFECT_NAMES.BLIND_STARS]: {
    maxStars: 4,          // four stars at the start of the blind; one fewer as the blind wears off
    starRadius: 5,
    starColor: '#ffd84a',
    orbitRadiusX: 14,     // how wide the stars orbit above the head
    orbitRadiusY: 5,      // how tall the orbit is (flattened, so it reads as a ring above the head)
    orbitSpeed: 4,        // radians per second
    headOffset: 22,       // distance above the top of the target
    sparkleColor: '#ffffff',
    sparkleRadius: 1.5,
    sparkleOrbitRadius: 20,
    sparkleBlinkSpeed: 10,
    sparkleDriftSpeed: 2,
  },
  // Soft glow around a planet. target: { radius, reach, isEarth }. reach is how far the glow spreads, in px.
  [EFFECT_NAMES.ATMOSPHERE]: {
    stops: [0, 0.5, 1],
  },
  // Weather over Earth: generated cloud banks (more near the equator and in the storm belts) and storm spirals.
  // Cover rises and falls slowly, so the weather changes. Generated once from a fixed seed.
  [EFFECT_NAMES.WEATHER]: {
    seed: 7,
    count: 320,         // scattered cloud banks
    storms: 6,          // spiral storm systems
    stormArms: 36,      // cloud puffs per storm
    coverSpeed: 0.2,    // how fast cover changes
    coverMin: 0.45,     // cover never drops below this
  },
  // Mission props. Lockers: green opens, red is locked, black never opens. target: { x, y, w, h, kind, facing, opened }
  [EFFECT_NAMES.LOCKER]: {
    body: '#3b4252',
    trim: '#1b1f29',
    opened: '#12151c',
    light: { green: '#3fd17a', red: '#e0453f', black: '#2a2d36' },
    lightDepth: 6,
  },
  // Containers: more valuable kinds look different. target: { x, y, w, h, kind, hpFraction, flash }
  [EFFECT_NAMES.CONTAINER]: {
    body: { common: '#7a7f6a', uncommon: '#9a8f55', rare: '#d4af37', reinforced: '#8f9bb0' },
    trim: '#1b1f29',
    plate: { common: 2, uncommon: 2, rare: 3, reinforced: 6 }, // outline thickness: Reinforced has bulkier plating
    glow: 'rgba(212,175,55,0.35)',                              // Rare containers glow gold
  },
  // Marker for the objective and the exit (extraction). target: { x, y, role }
  // A survival life support capsule: a green cross in a ring, pulsing. target: { x, y }
  // A dead enemy lying on the ground: the figure turned sideways, pale, fading out at the end. target: { x, y, radius, fade }
  [EFFECT_NAMES.CORPSE]: {
    turn: Math.PI / 2,  // 90 degrees
    paleness: 0.45,     // how faded the body looks (0 = invisible, 1 = as strong as the living figure)
  },
  [EFFECT_NAMES.CAPSULE]: {
    color: '#4ade80',
    radius: 14,
    pulseSpeed: 4,
  },
  [EFFECT_NAMES.PAD]: {
    colors: { objective: '#ff6b35', exit: '#4ade80' },
    radius: 46,
  },
  // A name above a prop, with a health bar when it can break (like an enemy's label). target: { x, y, text, hpFraction }
  [EFFECT_NAMES.PROP_LABEL]: {
    text: '#f0e8e0',
    font: '12px system-ui, sans-serif',
    barWidth: 46,
    barHeight: 6,
    barBack: 'rgba(255,255,255,0.12)',
    barFill: '#cc2a28',
  },
  // A short text above something you can use. target: { x, y, text }
  [EFFECT_NAMES.INTERACT_PROMPT]: {
    background: 'rgba(14,16,24,0.85)',
    text: '#ffffff',
    font: 'bold 13px system-ui, sans-serif',
  },
  // A figure with a head (a circle) and a body (a capsule), the same shapes the hit zones use (hitzones.js)
  [EFFECT_NAMES.HUMANOID]: {
    pip: 'rgba(255,255,255,0.9)', // the arrow
    outline: '#ffffff',
  },
  // The gameplay arrow showing where a unit is looking. Any unit can have one; it is not part of the figure.
  [EFFECT_NAMES.FACING_ARROW]: {
    color: 'rgba(255,255,255,0.9)',
    gap: 8,           // distance from the edge of the figure to the base of the arrow
    length: 9,        // base to tip
    halfWidth: 6,     // half the width of the base: short and wide, not long and pointy
  },
  // Earth's globe: ocean, continents, ice, shading and a rim. target: { radius }.
  [EFFECT_NAMES.PLANET_EARTH]: {
    rimStops: [0, 1],
  },
  // Any other planet's body: a shaded sphere with darker land patches. target: { radius }.
  [EFFECT_NAMES.PLANET_BODY]: {
    landAlpha: null, // each patch carries its own alpha (see assets/planets/planets.js)
  },
};

// Five-point star outline and fill, centred on (x, y)
export function drawStar(ctx, x, y, radius, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? radius : radius * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

// Adds points along each edge (about every 6 degrees), so outlines curve when they are drawn on the globe
function densify(points, step = 6) {
  const out = [];
  points.forEach((a, i) => {
    const b = points[(i + 1) % points.length];
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) / step));
    for (let s = 0; s < n; s++) out.push([a[0] + ((b[0] - a[0]) * s) / n, a[1] + ((b[1] - a[1]) * s) / n]);
  });
  return out;
}
const EARTH_LAND_DENSE = EARTH_LAND_RINGS; // real coastlines are already dense, so they are used as they are
// Polar caps are the full circles of latitude; the clipping keeps only the part we can see
const latitudeCircle = (lat) => Array.from({ length: 121 }, (_, i) => [-180 + i * 3, lat]);
const EARTH_NORTH_CAP = latitudeCircle(74);
const EARTH_SOUTH_CAP = latitudeCircle(-68);

// Seeded random numbers, so the weather is the same every time
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

// How likely a cloud is at a latitude: strong at the equator, a storm belt around 50 degrees, weak in the subtropics
function cloudDensity(lat) {
  const a = Math.abs(lat);
  const equator = Math.exp(-((a / 12) ** 2));
  const storms = 0.6 * Math.exp(-(((a - 50) / 15) ** 2));
  return Math.min(1, Math.max(0.15, equator + storms));
}

// Cloud blobs as { lon, lat, w, h, a, phase } in degrees (w and h are half sizes), made from the weather settings
function makeWeather(cfg) {
  const rand = seeded(cfg.seed);
  const blobs = [];
  while (blobs.length < cfg.count) {
    const lon = rand() * 360 - 180;
    const lat = (Math.asin(rand() * 2 - 1) * 180) / Math.PI;
    if (rand() > cloudDensity(lat)) continue;
    blobs.push({ lon, lat, w: 4 + rand() * 10, h: 1.5 + rand() * 3, a: 0.35 + rand() * 0.4, phase: rand() * Math.PI * 2 });
  }
  for (let s = 0; s < cfg.storms; s++) {
    const cx = rand() * 360 - 180;
    const cy = (rand() * 2 - 1) * 45;
    for (let i = 0; i < cfg.stormArms; i++) {
      const u = i / cfg.stormArms;
      const ang = u * Math.PI * 4;
      const rad = 2 + u * 12;
      blobs.push({ lon: cx + Math.cos(ang) * rad, lat: cy + Math.sin(ang) * rad * 0.6, w: 3 + rand() * 3, h: 2, a: 0.75, phase: rand() * Math.PI * 2 });
    }
  }
  return blobs;
}

const WEATHER_BLOBS = makeWeather(EFFECTS[EFFECT_NAMES.WEATHER]);

const drawers = {
  [EFFECT_NAMES.LOCKER](ctx, target, cfg) {
    const { x, y, w, h, kind, facing, opened } = target;
    ctx.fillStyle = opened ? cfg.opened : cfg.body;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = cfg.trim;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    // A seam down the middle (the doors) and a light on the side that faces into the room
    ctx.beginPath();
    if (facing === 'n' || facing === 's') { ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y + h); } else { ctx.moveTo(x, y + h / 2); ctx.lineTo(x + w, y + h / 2); }
    ctx.stroke();
    ctx.fillStyle = opened ? cfg.light.black : (cfg.light[kind] ?? cfg.light.black);
    const d = cfg.lightDepth;
    if (facing === 'n') ctx.fillRect(x, y, w, d);
    else if (facing === 's') ctx.fillRect(x, y + h - d, w, d);
    else if (facing === 'e') ctx.fillRect(x + w - d, y, d, h);
    else ctx.fillRect(x, y, d, h);
  },
  [EFFECT_NAMES.CONTAINER](ctx, target, cfg) {
    const { x, y, w, h, kind, hpFraction = 1, flash = 0 } = target;
    if (kind === 'rare') {
      const g = ctx.createRadialGradient(x + w / 2, y + h / 2, w * 0.2, x + w / 2, y + h / 2, w * 1.1);
      g.addColorStop(0, cfg.glow);
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.fillRect(x - w, y - h, w * 3, h * 3);
    }
    ctx.fillStyle = cfg.body[kind] ?? cfg.body.common;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = cfg.trim;
    ctx.lineWidth = cfg.plate[kind] ?? 2;
    ctx.strokeRect(x, y, w, h);
    // A lid line, and damage that darkens the crate as its hit points drop
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y + h * 0.3);
    ctx.lineTo(x + w, y + h * 0.3);
    ctx.stroke();
    if (hpFraction < 1) {
      ctx.fillStyle = `rgba(0,0,0,${0.45 * (1 - hpFraction)})`;
      ctx.fillRect(x, y, w, h);
    }
    if (flash > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(x, y, w, h);
    }
  },
  // The same figure as the living enemy, turned 90 degrees and pale. No name or health bar.
  [EFFECT_NAMES.CORPSE](ctx, target, cfg) {
    const alpha = Math.max(0, Math.min(1, target.fade ?? 1));
    ctx.save();
    ctx.translate(target.x, target.y);
    ctx.rotate(cfg.turn);
    ctx.globalAlpha = (target.paleness ?? cfg.paleness) * alpha;
    drawVisualEffect(EFFECT_NAMES.HUMANOID, ctx, { x: 0, y: 0, radius: target.radius });
    ctx.restore();
  },
  [EFFECT_NAMES.CAPSULE](ctx, target, cfg) {
    const pulse = 0.7 + 0.3 * Math.sin(performance.now() / 1000 * cfg.pulseSpeed);
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = cfg.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(target.x, target.y, cfg.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = cfg.color;
    ctx.fillRect(target.x - 2, target.y - 8, 4, 16);
    ctx.fillRect(target.x - 8, target.y - 2, 16, 4);
    ctx.restore();
  },
  [EFFECT_NAMES.PAD](ctx, target, cfg) {
    const color = cfg.colors[target.role] ?? cfg.colors.objective;
    const pulse = 0.55 + 0.25 * Math.sin(performance.now() / 400);
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(target.x, target.y, cfg.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = pulse * 0.35;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(target.x, target.y, cfg.radius * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },
  [EFFECT_NAMES.PROP_LABEL](ctx, target, cfg) {
    ctx.save();
    ctx.font = cfg.font;
    ctx.fillStyle = cfg.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(target.text, target.x, target.y);
    if (target.hpFraction !== undefined) {
      const left = target.x - cfg.barWidth / 2;
      const top = target.y + 8; // the bar sits clearly below the name, with room above the crate
      ctx.fillStyle = cfg.barBack;
      ctx.fillRect(left, top, cfg.barWidth, cfg.barHeight);
      ctx.fillStyle = cfg.barFill;
      ctx.fillRect(left, top, cfg.barWidth * Math.max(0, Math.min(1, target.hpFraction)), cfg.barHeight);
    }
    ctx.restore();
  },
  [EFFECT_NAMES.INTERACT_PROMPT](ctx, target, cfg) {
    ctx.save();
    ctx.font = cfg.font;
    const w = ctx.measureText(target.text).width + 16;
    ctx.fillStyle = cfg.background;
    ctx.fillRect(target.x - w / 2, target.y - 12, w, 22);
    ctx.fillStyle = cfg.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(target.text, target.x, target.y - 1);
    ctx.restore();
  },
  // target: { x, y, radius, facing } where facing is the angle it looks toward. The arrow is a pointed tip with no shaft,
  // anchored at the centre of the unit.
  [EFFECT_NAMES.FACING_ARROW](ctx, target, cfg) {
    const { x, y, radius: r, facing } = target;
    const dx = Math.cos(facing), dy = Math.sin(facing);
    const px = -dy, py = dx; // perpendicular, for the width of the arrow base
    const baseDist = r + cfg.gap, tipDist = baseDist + cfg.length;
    const tipX = x + dx * tipDist, tipY = y + dy * tipDist;
    const baseX = x + dx * baseDist, baseY = y + dy * baseDist;
    ctx.fillStyle = cfg.color;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(baseX + px * cfg.halfWidth, baseY + py * cfg.halfWidth);
    ctx.lineTo(baseX - px * cfg.halfWidth, baseY - py * cfg.halfWidth);
    ctx.closePath();
    ctx.fill();
  },
  // target: { x, y, radius, weapon } where weapon is the art file of the equipped weapon (optional, see ART in assets/art/art.js)
  [EFFECT_NAMES.HUMANOID](ctx, target) {
    // The same figure file everywhere (see assets/art/art.js), scaled to this unit's radius
    const { x, y, radius: r } = target;
    const k = r / FIGURE_RADIUS_UNITS;
    const size = FIGURE_BOX * k;
    // Crouching: the figure is drawn shorter (squash < 1), the torso lowered in its own frame
    const squash = target.squash ?? 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, squash);
    drawArt(ctx, FIGURE, -size / 2, -size / 2, size, size);
    // The equipped weapon, in the same place on the figure
    if (target.weapon) {
      const W = WEAPON_LAYER;
      drawArt(ctx, target.weapon, W.x * k, W.y * k, W.w * k, W.h * k);
    }
    ctx.restore();
  },
  [EFFECT_NAMES.NEBULA](ctx, target, cfg) {
    const { width: w, height: h, offset } = target;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < cfg.clouds; i++) {
      const phase = offset + i * cfg.phaseStep;
      const x = w * (cfg.xBase + cfg.xDrift * Math.sin(phase * 0.3));
      const y = h * (cfg.yBase + cfg.yDrift * Math.cos(phase * 0.2));
      const r = Math.max(w, h) * cfg.radiusFraction;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, cfg.colors[i]);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
  },
  [EFFECT_NAMES.STARFIELD](ctx, target, cfg) {
    const { width: w, height: h, time, offset } = target;
    ctx.fillStyle = cfg.color;
    for (let i = 0; i < cfg.count; i++) {
      const sx = (i * cfg.xSpacing + offset * cfg.driftSpeed) % w;
      const sy = (i * cfg.ySpacing) % h;
      const size = cfg.sizes[i % cfg.sizes.length];
      ctx.globalAlpha = cfg.alphaBase + cfg.alphaRange * Math.sin(time * cfg.twinkleSpeed + i);
      ctx.fillRect(sx, sy, size, size);
    }
    ctx.globalAlpha = 1;
  },
  // Cartoon dizzy stars orbiting above the head, with a blinking sparkle
  [EFFECT_NAMES.BLIND_STARS](ctx, target, cfg) {
    const t = performance.now() / 1000;
    const headY = target.y - target.radius - cfg.headOffset;
    // Stars show how much blind is left: the count drops as the timer runs down, and is zero when it ends
    const fraction = target.blindDuration > 0 ? Math.max(0, target.blindTimer) / target.blindDuration : 0;
    const count = Math.ceil(cfg.maxStars * fraction);
    if (count <= 0) return;
    for (let i = 0; i < count; i++) {
      const a = t * cfg.orbitSpeed + (i * Math.PI * 2) / count;
      drawStar(ctx, target.x + Math.cos(a) * cfg.orbitRadiusX, headY + Math.sin(a) * cfg.orbitRadiusY, cfg.starRadius, cfg.starColor);
    }
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * cfg.sparkleBlinkSpeed);
    ctx.fillStyle = cfg.sparkleColor;
    ctx.beginPath();
    ctx.arc(target.x + Math.cos(t * cfg.sparkleDriftSpeed) * cfg.sparkleOrbitRadius, headY - 8, cfg.sparkleRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  },
  // Halo: a soft glow from the planet's edge out to `reach` px (blue for Earth, orange for the others)
  [EFFECT_NAMES.ATMOSPHERE](ctx, target, cfg) {
    const { radius: r, reach, isEarth } = target;
    const [inner, outer] = isEarth ? ATMOSPHERE_COLORS.earth : ATMOSPHERE_COLORS.other;
    const grad = ctx.createRadialGradient(0, 0, r, 0, 0, r + reach);
    grad.addColorStop(cfg.stops[0], inner);
    grad.addColorStop(cfg.stops[1], outer);
    grad.addColorStop(cfg.stops[2], 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, r + reach, 0, Math.PI * 2);
    ctx.fill();
  },
  // Earth's globe. The ctx is already centred on the planet.
  // Shapes are rough [longitude, latitude] outlines, projected onto the sphere (orthographic) and clipped to its disc.
  [EFFECT_NAMES.PLANET_EARTH](ctx, target, cfg) {
    const r = target.radius;
    const t = performance.now() / 1000;
    const spin = (t * EARTH_SPIN.land) % 360;     // continents turn a few degrees a second
    const cloudSpin = (t * EARTH_SPIN.clouds) % 360; // clouds drift a little slower, so they slide over the land
    const RAD = Math.PI / 180;

    // lon/lat -> point on the globe. Points on the far side are pushed onto the rim so shapes still close up.
    // lon/lat -> point on the unit sphere (x right, y up, z towards the viewer)
    const toVec = (lon, lat, centre) => {
      const lam = (lon - centre) * RAD, phi = lat * RAD;
      return [Math.cos(phi) * Math.sin(lam), Math.sin(phi), Math.cos(phi) * Math.cos(lam)];
    };
    // Keeps only the part of a shape on the side of the globe facing us (z >= 0), cut where it crosses the rim.
    // The cut happens on the sphere itself, so a shape cannot spread over the whole disc.
    const clipToVisible = (vs) => {
      const out = [];
      for (let i = 0; i < vs.length; i++) {
        const p = vs[i], q = vs[(i + 1) % vs.length];
        const pIn = p[2] >= 0, qIn = q[2] >= 0;
        if (pIn) out.push(p);
        if (pIn !== qIn) {
          const s = p[2] / (p[2] - q[2]);
          const m = [p[0] + (q[0] - p[0]) * s, p[1] + (q[1] - p[1]) * s, 0];
          const len = Math.hypot(m[0], m[1]) || 1;
          out.push([m[0] / len, m[1] / len, 0]);
        }
      }
      return out;
    };
    const fillShape = (points, centre, color) => {
      const vs = clipToVisible(points.map(([lon, lat]) => toVec(lon, lat, centre)));
      if (vs.length < 3) return;
      ctx.fillStyle = color;
      ctx.beginPath();
      vs.forEach(([x, y], i) => {
        if (i) ctx.lineTo(r * x, -r * y); else ctx.moveTo(r * x, -r * y);
      });
      ctx.closePath();
      ctx.fill();
    };

    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.clip();

    // Oceans
    const ocean = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.05, 0, 0, r * 1.05);
    ocean.addColorStop(0, EARTH_COLORS.oceanLight);
    ocean.addColorStop(0.5, EARTH_COLORS.oceanMid);
    ocean.addColorStop(1, EARTH_COLORS.oceanDeep);
    ctx.fillStyle = ocean;
    ctx.fillRect(-r, -r, r * 2, r * 2);

    // The land, ice and clouds are drawn on a globe whose axis leans a little, as Earth's does
    ctx.save();
    ctx.rotate(EARTH_SPIN.tilt);
    for (const land of EARTH_LAND_DENSE) fillShape(land, spin, EARTH_COLORS.land);
    fillShape(EARTH_NORTH_CAP, spin, EARTH_COLORS.ice);
    fillShape(EARTH_SOUTH_CAP, spin, EARTH_COLORS.ice);
    // Weather: each cloud's cover rises and falls with time, and clouds on the far side are hidden
    const weather = EFFECTS[EFFECT_NAMES.WEATHER];
    for (const c of WEATHER_BLOBS) {
      const lam = (c.lon - cloudSpin) * RAD, phi = c.lat * RAD;
      const facing = Math.cos(phi) * Math.cos(lam);
      if (facing <= 0.05) continue;
      const cover = weather.coverMin + (1 - weather.coverMin) * (0.5 + 0.5 * Math.sin(t * weather.coverSpeed + c.phase));
      const [vx, vy] = toVec(c.lon, c.lat, cloudSpin);
      const x = r * vx, y = -r * vy;
      ctx.fillStyle = `rgba(255,255,255,${c.a * cover * Math.min(1, facing * 2)})`;
      ctx.beginPath();
      ctx.ellipse(x, y, (c.w / 90) * r * Math.max(0.3, facing), (c.h / 90) * r, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Sunlight from the top left, a dark night edge, and a pale blue rim of atmosphere
    const shade = ctx.createRadialGradient(-r * 0.45, -r * 0.45, r * 0.2, 0, 0, r * 1.15);
    shade.addColorStop(0, THEME.cardBorder);
    shade.addColorStop(0.5, 'rgba(0,0,0,0)');
    shade.addColorStop(1, 'rgba(0,0,10,0.75)');
    ctx.fillStyle = shade;
    ctx.fillRect(-r, -r, r * 2, r * 2);
    const rim = ctx.createRadialGradient(0, 0, r * 0.82, 0, 0, r);
    rim.addColorStop(cfg.rimStops[0], 'rgba(120,180,255,0)');
    rim.addColorStop(cfg.rimStops[1], EARTH_COLORS.rim);
    ctx.fillStyle = rim;
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.restore();

    ctx.strokeStyle = EARTH_COLORS.outline;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  },
  // Any other planet: a shaded sphere with darker land patches. The ctx is already centred on the planet.
  [EFFECT_NAMES.PLANET_BODY](ctx, target, cfg) {
    const r = target.radius;
    const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 0, 0, 0, r);
    grad.addColorStop(0, PLANET_BODY_COLORS[0]);
    grad.addColorStop(0.4, PLANET_BODY_COLORS[1]);
    grad.addColorStop(1, PLANET_BODY_COLORS[2]);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    for (const [x, y, rx, ry, rot, alpha] of PLANET_LAND_PATCHES) {
      ctx.fillStyle = `rgba(${PLANET_LAND_RGB.join(',')},${cfg.landAlpha ?? alpha})`;
      ctx.beginPath();
      ctx.ellipse(x * r, y * r, rx * r, ry * r, rot, 0, Math.PI * 2);
      ctx.fill();
    }
  },
};

// Draws a named effect over a target (anything with x, y and radius)
export function drawVisualEffect(name, ctx, target) {
  const cfg = EFFECTS[name];
  const draw = drawers[name];
  if (!cfg || !draw) return;
  draw(ctx, target, cfg);
}
