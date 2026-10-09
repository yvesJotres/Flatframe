import { rollLootDrop } from '../src/entities/loot.js';

const enemy = { dropChance: 1.0, lootWeights: { 'health': 1.0 } }; // Force health drop
const drops = rollLootDrop(enemy);
console.log('Drops:', drops);
if (drops.length > 0 && drops[0].type === 'health') {
    console.log('Success: Health drop rolled correctly');
} else {
    console.log('Failure: No health drop');
}
