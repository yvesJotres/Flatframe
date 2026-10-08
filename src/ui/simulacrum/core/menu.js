import { SimulacrumSpawner } from './spawner.js';

export class SimulacrumMenu {
  constructor() {
    this.visible = false;
    this.spawner = new SimulacrumSpawner();
    this.factions = this.spawner.list();
    this.selectedFactionIndex = 0;
    this.selectedTypeIndex = 0;
    this.level = 30;
    this.spawnMode = 0; // 0: Random, 1: Player, 2: East 10m
  }

  toggle() {
    this.visible = !this.visible;
  }

  update(input, canvas, enemies, player) {
    if (!this.visible) return false;

    // Mouse handling
    const mouse = input.getMousePos();
    if (input.isMouseClicked() && mouse.x >= 0 && mouse.y >= 0) {
      this.handleMouseClick(mouse.x, mouse.y, canvas);
    }

    // Keyboard handling
    if (input.isKeyPressed('arrowup')) this.selectedTypeIndex--;
    if (input.isKeyPressed('arrowdown')) this.selectedTypeIndex++;
    if (input.isKeyPressed('arrowleft')) this.selectedFactionIndex--;
    if (input.isKeyPressed('arrowright')) this.selectedFactionIndex++;

    if (input.isKeyPressed('equals')) this.level = Math.min(150, this.level + 1);
    if (input.isKeyPressed('minus')) this.level = Math.max(1, this.level - 1);
    if (input.isKeyPressed('space')) this.spawnMode = (this.spawnMode + 1) % 3;

    this.selectedFactionIndex = Math.max(0, Math.min(this.factions.length - 1, this.selectedFactionIndex));
    this.selectedTypeIndex = Math.max(0, Math.min(this.factions[this.selectedFactionIndex].types.length - 1, this.selectedTypeIndex));

    if (input.isKeyPressed('enter')) {
      this.spawnSelected(canvas, enemies, player);
    }
  }

  handleMouseClick(mouseX, mouseY, canvas) {
    const panelWidth = 320;
    const panelHeight = 420;
    const x = (canvas.width - panelWidth) / 2;
    const y = (canvas.height - panelHeight) / 2;

    // Check faction headers (clickable areas)
    this.factions.forEach((f, i) => {
      const yBase = y + 140 + i * 110;
      // Faction header area
      if (mouseX >= x + 20 && mouseX <= x + 280 && mouseY >= yBase - 20 && mouseY <= yBase + 10) {
        this.selectedFactionIndex = i;
        this.selectedTypeIndex = 0;
      }
      // Enemy type areas
      f.types.forEach((t, j) => {
        const typeY = yBase + 25 + j * 22;
        if (mouseX >= x + 40 && mouseX <= x + 280 && mouseY >= typeY - 15 && mouseY <= typeY + 5) {
          this.selectedFactionIndex = i;
          this.selectedTypeIndex = j;
        }
      });
    });

    // Status bar click - cycle spawn mode
    if (mouseX >= x + 20 && mouseX <= x + 280 && mouseY >= y + 85 && mouseY <= y + 105) {
      this.spawnMode = (this.spawnMode + 1) % 3;
    }
    
    // Level click area (left side for -, right side for +)
    if (mouseX >= x + 20 && mouseX <= x + 280 && mouseY >= y + 70 && mouseY <= y + 90) {
      // Roughly left half = -, right half = +
      if (mouseX < x + 150) {
        this.level = Math.max(1, this.level - 1);
      } else {
        this.level = Math.min(150, this.level + 1);
      }
    }
  }

  spawnSelected(canvas, enemies, player) {
    const faction = this.factions[this.selectedFactionIndex].faction;
    const type = this.factions[this.selectedFactionIndex].types[this.selectedTypeIndex];
    let spawnX, spawnY;
    
    if (this.spawnMode === 0) { // Random
      spawnX = Math.random() * canvas.width;
      spawnY = Math.random() * canvas.height;
    } else if (this.spawnMode === 1) { // Player
      spawnX = player.x;
      spawnY = player.y;
    } else { // East 10m
      spawnX = player.x + 400;
      spawnY = player.y;
    }

    this.spawner.spawn(faction, type, spawnX, spawnY, this.level)
      .then(enemy => {
        if (enemy) enemies.push(enemy);
      });
  }

  draw(ctx, canvas) {
    if (!this.visible) return;

    ctx.save();
    
    // Calculate centered position
    const panelWidth = 320;
    const panelHeight = 420;
    const x = (canvas.width - panelWidth) / 2;
    const y = (canvas.height - panelHeight) / 2;
    
    // Panel styling
    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)'; 
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.6)'; 
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, panelWidth, panelHeight, 12);
    ctx.fill();
    ctx.stroke();

    // Header
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 24px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText('SIMULACRUM', x + 20, y + 40);

    // Controls Help
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px system-ui';
    ctx.fillText('Arrows: Nav | Space: Mode | +/-: Level | Enter: Spawn', x + 20, y + 65);
    
    // Status Bar
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 14px system-ui';
    ctx.fillText(`LVL: ${this.level}  |  MODE: ${['RANDOM', 'PLAYER', 'EAST 10M'][this.spawnMode]}`, x + 20, y + 95);

    // List Factions
    this.factions.forEach((f, i) => {
      const yBase = y + 140 + i * 110;
      ctx.fillStyle = this.selectedFactionIndex === i ? '#4ade80' : '#f1f5f9';
      ctx.font = 'bold 16px system-ui';
      ctx.fillText(f.faction.toUpperCase(), x + 20, yBase);
      
      f.types.forEach((t, j) => {
        const isSelected = this.selectedFactionIndex === i && this.selectedTypeIndex === j;
        ctx.fillStyle = isSelected ? '#fbbf24' : '#64748b';
        ctx.font = isSelected ? 'bold 14px system-ui' : '14px system-ui';
        ctx.fillText(`${isSelected ? '▶' : '  '} ${t}`, x + 40, yBase + 25 + j * 22);
      });
    });
    
    ctx.restore();
  }
}
