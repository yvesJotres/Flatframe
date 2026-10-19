// High-definition tiles for generated missions: steel floor panels and bevelled wall blocks, drawn from the tile grid,
// plus the gates across doorways. Only the tiles inside the camera view are drawn each frame. The colours and the
// per-tile variation are fixed (no randomness per frame), so the map looks the same from frame to frame.

export const TILE_ART = {
  floorBase: '#1a1f2c',
  floorPanel: '#222839',
  floorSeam: 'rgba(8, 10, 16, 0.85)',
  floorGlint: 'rgba(120, 140, 185, 0.10)',
  wallTop: '#5a6686',
  wallFace: '#343c52',
  wallBottom: '#1b2030',
  wallEdge: '#9aa8cc',
  wallShadow: 'rgba(5, 7, 12, 0.7)',
  rivet: '#c3cde6',
  gateSteel: '#3a4358',
  gateStripe: '#ffb020',
  gateStripeDark: '#1a1408',
  gateGlow: 'rgba(255, 176, 32, 0.45)',
};

// A stable pseudo-random value in 0..1 for a tile, so each tile gets the same variation every frame
function tileNoise(gx, gy) {
  let h = Math.imul(gx, 374761393) + Math.imul(gy, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function drawFloorTile(ctx, x, y, t, gx, gy) {
  ctx.fillStyle = TILE_ART.floorBase;
  ctx.fillRect(x, y, t, t);
  // A panel inset from the tile edges, with a seam around it
  const inset = t * 0.06;
  ctx.fillStyle = TILE_ART.floorPanel;
  ctx.fillRect(x + inset, y + inset, t - inset * 2, t - inset * 2);
  ctx.strokeStyle = TILE_ART.floorSeam;
  ctx.lineWidth = Math.max(1, t * 0.03);
  ctx.strokeRect(x + inset, y + inset, t - inset * 2, t - inset * 2);
  // A faint glint on the top edge, and a small bolt on about half the panels
  ctx.fillStyle = TILE_ART.floorGlint;
  ctx.fillRect(x + inset, y + inset, t - inset * 2, Math.max(1, t * 0.03));
  if (tileNoise(gx, gy) > 0.5) {
    ctx.fillStyle = TILE_ART.wallShadow;
    ctx.beginPath();
    ctx.arc(x + t * 0.2, y + t * 0.8, t * 0.025, 0, Math.PI * 2);
    ctx.fill();
  }
}

// A wall block: a lit top, a dark face, rivets in the corners, and a bright bevel on every side that faces open floor
function drawWallTile(ctx, x, y, t, gx, gy, isWall) {
  const grad = ctx.createLinearGradient(x, y, x, y + t);
  grad.addColorStop(0, TILE_ART.wallTop);
  grad.addColorStop(0.5, TILE_ART.wallFace);
  grad.addColorStop(1, TILE_ART.wallBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, t, t);

  // Inset panel
  const inset = t * 0.12;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
  ctx.fillRect(x + inset, y + inset, t - inset * 2, t - inset * 2);
  ctx.strokeStyle = TILE_ART.wallShadow;
  ctx.lineWidth = Math.max(1, t * 0.03);
  ctx.strokeRect(x + inset, y + inset, t - inset * 2, t - inset * 2);

  // Bevel: a bright edge where the wall meets open floor, a dark one where it meets another wall
  const bevel = Math.max(2, t * 0.07);
  const edges = [
    [0, -1, x, y, t, bevel],                 // north
    [0, 1, x, y + t - bevel, t, bevel],      // south
    [-1, 0, x, y, bevel, t],                 // west
    [1, 0, x + t - bevel, y, bevel, t],      // east
  ];
  for (const [dx, dy, ex, ey, ew, eh] of edges) {
    const open = !isWall(gx + dx, gy + dy);
    ctx.fillStyle = open ? TILE_ART.wallEdge : TILE_ART.wallShadow;
    ctx.fillRect(ex, ey, ew, eh);
  }

  // Rivets in the corners
  ctx.fillStyle = TILE_ART.rivet;
  const r = Math.max(1, t * 0.03);
  for (const [px, py] of [[0.22, 0.22], [0.78, 0.22], [0.22, 0.78], [0.78, 0.78]]) {
    ctx.beginPath();
    ctx.arc(x + t * px, y + t * py, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Draws the tiles of a generated map inside the camera view.
// map: { tileSize, walls: Set of "gx,gy" keys, bounds: { width, height } }; view: { x, y, w, h } in world units
export function drawMapTiles(ctx, map, view) {
  const t = map.tileSize;
  const maxX = Math.ceil(map.bounds.width / t) - 1;
  const maxY = Math.ceil(map.bounds.height / t) - 1;
  const gx0 = Math.max(0, Math.floor(view.x / t));
  const gx1 = Math.min(maxX, Math.floor((view.x + view.w) / t));
  const gy0 = Math.max(0, Math.floor(view.y / t));
  const gy1 = Math.min(maxY, Math.floor((view.y + view.h) / t));
  const isWall = (gx, gy) => map.walls.has(`${gx},${gy}`);
  for (let gy = gy0; gy <= gy1; gy++) {
    for (let gx = gx0; gx <= gx1; gx++) {
      const x = gx * t, y = gy * t;
      if (isWall(gx, gy)) drawWallTile(ctx, x, y, t, gx, gy, isWall);
      else drawFloorTile(ctx, x, y, t, gx, gy);
    }
  }
}

// A gate across a doorway. Closed: a steel bar with hazard stripes that blocks walking, bullets and sight. Open: an
// outline only, so the doorway still reads.
export function drawGate(ctx, gate) {
  const r = gate.rect;
  ctx.save();
  if (gate.open) {
    ctx.strokeStyle = TILE_ART.gateStripe;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.restore();
    return;
  }
  ctx.shadowColor = TILE_ART.gateGlow;
  ctx.shadowBlur = 10;
  ctx.fillStyle = TILE_ART.gateSteel;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.shadowBlur = 0;
  // Hazard stripes along the bar
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
  const period = Math.max(6, Math.max(r.w, r.h) / 6);
  ctx.fillStyle = TILE_ART.gateStripe;
  const long = Math.max(r.w, r.h), short = Math.min(r.w, r.h);
  for (let s = -short; s < long + short; s += period) {
    ctx.beginPath();
    if (gate.orientation === 'v') {
      ctx.moveTo(r.x, r.y + s); ctx.lineTo(r.x + r.w, r.y + s + r.w); ctx.lineTo(r.x + r.w, r.y + s + r.w + period / 2); ctx.lineTo(r.x, r.y + s + period / 2);
    } else {
      ctx.moveTo(r.x + s, r.y); ctx.lineTo(r.x + s + r.h, r.y + r.h); ctx.lineTo(r.x + s + r.h + period / 2, r.y + r.h); ctx.lineTo(r.x + s + period / 2, r.y);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = TILE_ART.gateStripeDark;
  ctx.lineWidth = 1;
  ctx.strokeRect(r.x, r.y, r.w, r.h);
  ctx.restore();
}
