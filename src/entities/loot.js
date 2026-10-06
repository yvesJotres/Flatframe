// Loot drop system — enemies drop pickups on death.
// Types: health, primary_ammo, secondary_ammo, energy

export const LOOT_TYPES = {
  HEALTH: 'health',
  PRIMARY_AMMO: 'primary_ammo',
  SECONDARY_AMMO: 'secondary_ammo',
  ENERGY: 'energy',
};

// 50% of kills drop loot. When a drop happens, the type is rolled from
// these weights: energy 30%, health 30%, primary ammo 20%, secondary ammo 20%.
// (Per-enemy overrides: enemy.dropChance, enemy.lootWeights)
export const DEFAULT_DROP_CHANCE = 0.5;
export const DEFAULT_LOOT_WEIGHTS = {
  [LOOT_TYPES.ENERGY]: 0.3,
  [LOOT_TYPES.HEALTH]: 0.3,
  [LOOT_TYPES.PRIMARY_AMMO]: 0.2,
  [LOOT_TYPES.SECONDARY_AMMO]: 0.2,
};

const LOOT_COLORS = {
  [LOOT_TYPES.HEALTH]: '#ff4444',
  [LOOT_TYPES.PRIMARY_AMMO]: '#44aaff',
  [LOOT_TYPES.SECONDARY_AMMO]: '#ffaa44',
  [LOOT_TYPES.ENERGY]: '#44ff88',
};

const LOOT_LABELS = {
  [LOOT_TYPES.HEALTH]: 'HP',
  [LOOT_TYPES.PRIMARY_AMMO]: 'PRI',
  [LOOT_TYPES.SECONDARY_AMMO]: 'SEC',
  [LOOT_TYPES.ENERGY]: 'NRG',
};

const PICKUP_RADIUS = 20;
const MAGNET_RADIUS = 80;

export default class LootDrop {
  constructor(x, y, type, amount = 1) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.amount = amount;
    this.radius = PICKUP_RADIUS;
    this.magnetRadius = MAGNET_RADIUS;
    this.age = 0;
    this.lifetime = 60; // seconds before despawn
    this.bobOffset = Math.random() * Math.PI * 2;
    this.bobSpeed = 2 + Math.random() * 2;
    this.color = LOOT_COLORS[type] || '#ffffff';
    this.label = LOOT_LABELS[type] || '???';
    this.collected = false;
  }

  update(dt, player) {
    if (this.collected) return true; // signal for removal

    this.age += dt;
    if (this.age >= this.lifetime) return true; // expired

    // Magnet pull towards player when in range
    if (player && player.alive) {
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const dist = Math.hypot(dx, dy);

      if (dist < this.magnetRadius && dist > 0) {
        const pullStrength = (1 - dist / this.magnetRadius) * 300;
        this.x += (dx / dist) * pullStrength * dt;
        this.y += (dy / dist) * pullStrength * dt;
      }

      // Auto-collect on contact
      if (dist < this.radius + (player.radius ?? 16)) {
        this.collected = true;
        return 'collect';
      }
    }

    return false;
  }

  draw(ctx) {
    if (this.collected) return;

    const bob = Math.sin(this.age * this.bobSpeed + this.bobOffset) * 3;

    ctx.save();
    ctx.translate(this.x, this.y + bob);

    // Outer glow ring
    const pulse = 0.5 + Math.sin(this.age * 4) * 0.2;
    ctx.strokeStyle = this.color;
    ctx.globalAlpha = 0.4 * pulse;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius + 4, 0, Math.PI * 2);
    ctx.stroke();

    // Main body
    ctx.globalAlpha = 1;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 0.6, 0, Math.PI * 2);
    ctx.fill();

    // Inner highlight
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.arc(-3, -3, this.radius * 0.25, 0, Math.PI * 2);
    ctx.fill();

    // Label
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.label, 0, 0);

    ctx.restore();
  }
}

// Helper to roll loot from an enemy's drop table.
// Returns an array (0 or 1 drops) — 50% chance per kill, weighted by type.
export function rollLootDrop(enemy) {
  const dropChance = enemy.dropChance ?? DEFAULT_DROP_CHANCE;
  if (Math.random() >= dropChance) return [];

  const weights = enemy.lootWeights || DEFAULT_LOOT_WEIGHTS;
  const entries = Object.entries(weights);
  // Scale the roll by the total weight so partial/over-full tables
  // distribute proportionally. Without this a roll in the leftover range
  // falls through every bucket and defaults to energy — that bug made
  // energy ~50% of all drops instead of 30%.
  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = Math.random() * totalWeight;
  let type = entries[0]?.[0] ?? LOOT_TYPES.ENERGY;
  for (const [candidate, weight] of entries) {
    roll -= weight;
    if (roll <= 0) {
      type = candidate;
      break;
    }
  }

  return [
    new LootDrop(
      enemy.x + (Math.random() - 0.5) * 20,
      enemy.y + (Math.random() - 0.5) * 20,
      type,
      1
    ),
  ];
}

export function applyLootPickup(player, loot) {
  switch (loot.type) {
    case LOOT_TYPES.HEALTH:
      const healAmount = 50;
      player.health = Math.min(player.maxHealth, player.health + healAmount);
      break;

    case LOOT_TYPES.PRIMARY_AMMO:
      if (player.primaryWeapon) {
        const pickupAmount = player.primaryWeapon.ammoPickup || 20;
        player.primaryWeapon.ammoReserve = Math.min(
          player.primaryWeapon.ammoMax,
          player.primaryWeapon.ammoReserve + pickupAmount
        );
      }
      break;

    case LOOT_TYPES.SECONDARY_AMMO:
      if (player.secondaryWeapon) {
        const pickupAmount = player.secondaryWeapon.ammoPickup || 20;
        player.secondaryWeapon.ammoReserve = Math.min(
          player.secondaryWeapon.ammoMax,
          player.secondaryWeapon.ammoReserve + pickupAmount
        );
      }
      break;

    case LOOT_TYPES.ENERGY:
      const energyAmount = 25;
      player.energy = Math.min(player.maxEnergy, player.energy + energyAmount);
      break;
  }
}