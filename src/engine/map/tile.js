export class Tile {
  constructor(x, y, size, type = 'floor') {
    this.x = x;
    this.y = y;
    this.size = size;
    this.type = type;
  }

  draw(ctx) {
    ctx.save();
    ctx.fillStyle = this.type === 'wall' ? '#2d3436' : '#1a1a2e';
    ctx.fillRect(this.x, this.y, this.size, this.size);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.strokeRect(this.x, this.y, this.size, this.size);
    ctx.restore();
  }
}
