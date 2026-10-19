// Base class for all map entities (walls, consoles, props, etc.)
export class MapEntity {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.visible = true;
  }

  // Override in subclasses
  draw(ctx, _player) {
    if (!this.visible) return;
  }
}

// Wall entity
export class Wall extends MapEntity {
  constructor(x, y, w, h) {
    super(x, y);
    this.w = w;
    this.h = h;
  }

  draw(ctx, _player) {
    super.draw(ctx, _player);
    ctx.save();
    ctx.fillStyle = '#2d3436';
    ctx.fillRect(this.x, this.y, this.w, this.h);
    ctx.restore();
  }
}