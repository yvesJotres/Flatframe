// Mission definitions.
//
// A mission is pure data: it describes how the arena gets populated and how the
// run is won or lost. game.js reads these fields, so adding a new mode is mostly
// a matter of describing it here and (for a new objective) giving it an entity.

export const MISSIONS = [
  {
    id: 'exterminate',
    name: 'Exterminate',
    tagline: 'Purge a fixed number of Grineer.',
    brief: 'Command wants this sector cleared. Lancers keep trickling in from the edges until the quota is met.',
    accent: '#ff9f43',
    icon: 'crosshair',
    objectiveLabel: 'Eliminated',
    stats: ['Quota: 24 Lancers', 'Up to 5 units on the field', 'Tougher units every 8 kills'],

    // Population
    maxEnemies: 5,
    spawnInterval: 1.1,
    killQuota: 24,
    levelPerKills: 8, // Enemy level ticks up every N kills

    endless: false,
    map: 'exterminate_ship.json',
  },
  {
    id: 'survival',
    name: 'Survival',
    tagline: 'Hold out against endless waves.',
    brief: 'No extraction, no quota — just you and a ring of Grineer that never stops growing.',
    accent: '#4fc3f7',
    icon: 'infinity',
    objectiveLabel: 'Wave',
    stats: ['Endless waves', 'Up to 6 units on the field', 'Wave 1: 3 units, +2 each wave'],

    maxEnemies: 6,
    spawnInterval: 1.1,
    waveBreak: 3,
    baseEnemiesPerWave: 3,
    enemiesPerWave: 2,

    endless: true,
    map: 'survival_arena.json',
  },
  {
    id: 'defense',
    name: 'Defense',
    tagline: 'Protect the cryo pod for five waves.',
    brief: 'The pod cannot move and it cannot dodge. Keep the Lancers off it — the squad prefers the pod over you.',
    accent: '#8f7bff',
    icon: 'shield',
    objectiveLabel: 'Wave',
    stats: ['Objective: Cryo Pod (4000 HP)', 'Hold out for 5 waves', 'Up to 5 units on the field'],

    maxEnemies: 5,
    spawnInterval: 1.1,
    waveBreak: 4,
    baseEnemiesPerWave: 3,
    enemiesPerWave: 2,
    waveLimit: 5,
    objective: { name: 'Cryo Pod', health: 4000, armor: 240 },

    endless: false,
    map: 'defense_outpost.json',
  },
  {
    id: 'simulacrum',
    name: 'Simulacrum',
    tagline: 'Sandbox testing environment.',
    brief: 'Test weapons and enemies in a controlled arena.',
    accent: '#fbbf24',
    icon: 'beaker',
    objectiveLabel: 'Active',
    stats: ['Sandbox mode', 'Manual enemy spawning', 'Customizable level'],

    maxEnemies: 0,
    spawnInterval: 0,
    killQuota: 0,

    endless: true,
    map: 'simulacrum_arena.json',
  },
];

export const DEFAULT_MISSION_ID = 'exterminate';

export function getMission(id) {
  return MISSIONS.find((mission) => mission.id === id) ?? MISSIONS[0];
}

// How many units a single wave of a wave-based mission deploys.
export function waveSize(mission, wave) {
  const base = mission.baseEnemiesPerWave ?? 3;
  const step = mission.enemiesPerWave ?? 2;
  return base + Math.max(0, wave - 1) * step;
}

// Survival never ends on its own; the other missions have a goal to reach.
export function isEndless(mission) {
  return mission.endless === true;
}
