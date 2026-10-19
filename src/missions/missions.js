// Mission definitions.
//
// A mission is pure data: it describes how the arena gets populated and how the
// run is won or lost. game.js reads these fields, so adding a new mode is mostly
// a matter of describing it here and (for a new objective) giving it an entity.

const HAND_MISSIONS = [
  {
    id: 'exterminate',
    name: 'Exterminate',
    tagline: 'Purge a fixed number of Corpus.',
    brief: 'Command wants this sector cleared. Crewmen keep trickling in from the edges until the quota is met.',
    accent: '#ff9f43',
    icon: 'crosshair',
    objectiveLabel: 'Eliminated',
    stats: ['Quota: 24 Crewmen', 'Up to 5 units on the field', 'Tougher units every 8 kills'],

    // Population
    maxEnemies: 5,
    spawnInterval: 1.1,
    killQuota: 24,
    levelPerKills: 8, // Enemy level ticks up every N kills

    endless: false,
    family: 'exterminate',
    enemyPool: ['crewman'],
    map: 'generated.json', // every node plays on the generated tile map and navmesh (no blank arenas)
  },
  {
    id: 'exterminate_e_prime',
    name: 'Exterminate',
    tagline: 'Purge 33 Grineer from E Prime.',
    brief: 'Grineer have fortified a section of E Prime, room by room. Clear the rooms until the quota is met.',
    accent: '#ff9f43',
    icon: 'crosshair',
    objectiveLabel: 'Eliminated',
    stats: ['Quota: 33 Grineer', 'Up to 5 units on the field', 'Tougher units every 8 kills'],

    // Population
    maxEnemies: 6, // six enemies from the spawn room at a time
    spawnInterval: 1.1,
    killQuota: 33,
    levelPerKills: 8,

    endless: false,
    family: 'exterminate',
    enemyPool: ['trooper', 'lancer', 'butcher'],
    map: 'generated.json', // procedural rooms, new layout each launch
    // Patrol rule: unaware Grineer walk a loop in their room, stop for 3-6 s at each point and look around
    patrol: { pauseMin: 3, pauseMax: 6, waypointCount: 3 },
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
    map: 'generated.json', // rooms and walls from the generator, like E Prime
  },
  {
      id: 'defense',
      name: 'Defense',
      tagline: 'Protect the cryo pod — extract every 3 waves.',
      brief: 'The pod cannot move and it cannot dodge. Keep the Lancers off it — the squad prefers the pod over you. Every 3 waves you may extract with rewards or continue for more.',
      accent: '#8f7bff',
      icon: 'shield',
      objectiveLabel: 'Wave',
      stats: ['Objective: Cryo Pod (4000 HP)', 'Endless waves — extract every 3 waves', 'Up to 5 units on the field'],

      maxEnemies: 5,
      spawnInterval: 1.1,
      waveBreak: 3,
      baseEnemiesPerWave: 3,
      enemiesPerWave: 2,
      // No waveLimit — endless until players extract
      objective: { name: 'Cryo Pod', health: 4000, armor: 240 },

      endless: true,
      rotationWaves: 3, // a rotation is 3 waves; then each player extracts or continues (wiki)
      map: 'arena.json', // the cryo pod stands in the middle of an open arena; enemies come from every side (wiki)
    },
      {
        id: 'dark_sector_defense',
        name: 'Dark Sector Defense',
        tagline: 'Defend the solar rail against Infested swarms.',
        brief: 'A clan\'s solar rail is under attack. Protect the objective from relentless Infested hordes — extract every 3 waves or fight on for greater rewards.',
        accent: '#7ab800',
        icon: 'biohazard',
        objectiveLabel: 'Wave',
        stats: ['Objective: Solar Rail (5000 HP)', 'Endless waves — extract every 3 waves', 'Infested faction', 'Up to 6 units on the field'],

        maxEnemies: 6,
        spawnInterval: 1.0,
        waveBreak: 3,
        baseEnemiesPerWave: 4,
        enemiesPerWave: 2,
        objective: { name: 'Solar Rail', health: 5000, armor: 100 },

        endless: true,
        rotationWaves: 3, // a rotation is 3 waves; then each player extracts or continues (wiki)
        map: 'arena.json', // the solar rail stands in the middle of an open arena
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
    noCreditReward: true, // sandbox: pays nothing, like Free Roam

    endless: true,
    map: 'simulacrum_arena.json',
  },
];

// Earth node types that have no rules of their own yet. Each plays on the generated map with Exterminate's rules (a kill
// quota), as a placeholder until its own rules are written from the wiki.
const NODE_TYPES = [
  { id: 'interception', type: 'Interception', tagline: 'Intercept the Grineer transmission.' },
  { id: 'mobile_defense', type: 'Mobile Defense', tagline: 'Escort the mobile defense unit.' },
  { id: 'excavation', type: 'Excavation', tagline: 'Mine the resource vein.' },
  { id: 'capture', type: 'Capture', tagline: 'Capture the target.' },
  { id: 'spy', type: 'Spy', tagline: 'Infiltrate and get the data.' },
  { id: 'rescue', type: 'Rescue', tagline: 'Rescue the captive.' },
  { id: 'sabotage', type: 'Sabotage', tagline: 'Sabotage the target.' },
  { id: 'shrine_defense', type: 'Shrine Defense', tagline: 'Defend the shrine.' },
  { id: 'dark_sector_excavation', type: 'Dark Sector Excavation', tagline: 'Excavate the Infested sector.' },
  { id: 'open_world', type: 'Open World', tagline: 'Explore the open world.' },
  { id: 'assassination', type: 'Assassination', tagline: 'Eliminate the target.' },
];

const NODE_MISSIONS = NODE_TYPES.map(({ id, type, tagline }) => ({
  id,
  name: type,
  tagline,
  brief: `${type} on the generated map. Rules are placeholders until this mission type gets its own.`,
  accent: '#ff9f43',
  icon: 'crosshair',
  objectiveLabel: 'Eliminated',
  stats: ['Kill quota (placeholder)', 'Up to 5 units on the field'],
  maxEnemies: 6, // six enemies from the spawn room at a time
  spawnInterval: 1.1,
  killQuota: 24,
  levelPerKills: 8,
  endless: false,
  family: 'exterminate',
  enemyPool: ['trooper', 'lancer', 'butcher'],
  map: 'generated.json',
}));

export const MISSIONS = [...HAND_MISSIONS, ...NODE_MISSIONS];

export const DEFAULT_MISSION_ID = 'exterminate';

export function getMission(id) {
  return MISSIONS.find((mission) => mission.id === id) ?? MISSIONS[0];
}

// Star-chart nodes that need their own mission definition. Anything not listed
// falls back to the mission type (see LAUNCH_IDS in star_chart.js).
export const NODE_MISSION_IDS = {
  'E Prime': 'exterminate_e_prime',
};

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
