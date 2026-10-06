import { SimulacrumSpawner } from './spawner.js';

export class SimulacrumMenu {
  constructor() {
    this.visible = false;
    this.spawner = new SimulacrumSpawner();
    this.factions = this.spawner.list();
    this.selectedFactionIndex = 0;
    this.selectedTypeIndex = 0;
    this.level = 30;
  }

  toggle() {
    this.visible = !this.visible;
  }

  update(input, canvas, enemies) {
    if (!this.visible) return;

    if (input.isKeyPressed('arrowup')) this.selectedTypeIndex--;
    if (input.isKeyPressed('arrowdown')) this.selectedTypeIndex++;
    if (input.isKeyPressed('arrowleft')) this.selectedFactionIndex--;
    if (input.isKeyPressed('arrowright')) this.selectedFactionIndex++;

    this.selectedFactionIndex = Math.max(0, Math.min(this.factions.length - 1, this.selectedFactionIndex));
    this.selectedTypeIndex = Math.max(0, Math.min(this.factions[this.selectedFactionIndex].types.length - 1, this.selectedTypeIndex));

    if (input.isKeyPressed('enter')) {
      const faction = this.factions[this.selectedFactionIndex].faction;
      const type = this.factions[this.selectedFactionIndex].types[this.selectedTypeIndex];
      this.spawner.spawn(faction, type, Math.random() * canvas.width, Math.random() * canvas.height, this.level)
        .then(enemy => {
          if (enemy) enemies.push(enemy);
        });
    }

  }

  draw(ctx, canvas) {
    if (!this.visible) return;

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(50, 50, 300, 400);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px system-ui';
    ctx.fillText('SIMULACRUM', 70, 80);

    this.factions.forEach((f, i) => {
      ctx.fillStyle = this.selectedFactionIndex === i ? '#4ade80' : '#fff';
      ctx.fillText(f.faction.toUpperCase(), 70, 120 + i * 100);
      
      f.types.forEach((t, j) => {
        ctx.fillStyle = (this.selectedFactionIndex === i && this.selectedTypeIndex === j) ? '#fbbf24' : '#9aa0b4';
        ctx.fillText(t, 90, 150 + i * 100 + j * 25);
      });
    });
    ctx.restore();
  }
}
