// What each enemy can drop, from the Warframe wiki. Chances are per kill. An enemy with no entry drops nothing.
// Mod rows name the mod; mods without stats in the data yet are placeholders (name only) until their stats are added.

export const MOD_IDS = {
  'Vitality': '/Lotus/Upgrades/Mods/Utility/VitalityMod',
  'Redirection': '/Lotus/Upgrades/Mods/Utility/RedirectionMod',
  'Steel Fiber': '/Lotus/Upgrades/Mods/Utility/SteelFiberMod',
  'Ammo Drum': '/Lotus/Upgrades/Mods/Weapon/AmmoDrumMod',
  'Fury': '/Lotus/Upgrades/Mods/Melee/FuryMod',
  'No Return': '/Lotus/Upgrades/Mods/Pistol/NoReturnMod',
};

// The mod's id: the one from its data when it has one, otherwise a placeholder id from its name
export function modIdFor(name) {
  return MOD_IDS[name] ?? `/Lotus/Upgrades/Mods/Wiki/${name.replace(/\s+/g, '')}`;
}

// Region resources by planet. Only Earth is in the game so far; a region drop picks one of its resources at random.
export const REGION_RESOURCES = {
  earth: ['ferrite', 'rubedo', 'neurodes', 'detonite_ampule'],
};
export const CURRENT_REGION = 'earth';

const mod = (name, chance) => ({ type: 'mod', modId: modIdFor(name), name, chance });
const endo = (amount, chance) => ({ type: 'endo', amount, chance });
const region = (chance) => ({ type: 'region', chance });

export const ENEMY_DROP_TABLES = {
  Crewman: [
    mod('Ammo Drum', 0.0076), mod('Reach', 0.0076), mod('Fury', 0.0022), mod('No Return', 0.0022), mod('Reaping Spiral', 0.0022),
    endo(15, 0.0076), endo(80, 0.0006), region(0.07),
  ],
  Lancer: [
    mod('Pressure Point', 0.0114), mod('Heavy Trauma', 0.0001), mod('Vitality', 0.0114), mod('Heated Charge', 0.0033),
    mod('Diamond Skin', 0.0033), mod('Streamline', 0.0001), mod('Iron Phoenix', 0.0001),
    endo(80, 0.0001), region(0.07),
  ],
  Butcher: [
    mod('Flow', 0.0003), mod('Smite Grineer', 0.0017), mod('Point Strike', 0.0057), mod('Fast Hands', 0.0057),
    mod('Reflex Coil', 0.0017), mod('North Wind', 0.0017), mod('Pressure Point', 0.0057),
    endo(15, 0.0057), endo(50, 0.0017), endo(80, 0.0003), region(0.07),
  ],
  Trooper: [
    mod('Melee Prowess', 0.0057), mod('Shocking Touch', 0.0033), mod('Pistol Gambit', 0.0057), mod('Disruptor', 0.0057),
    mod('Lingering Torment', 0.0057), mod('Sundering Weave', 0.0033),
    endo(80, 0.0006), region(0.07),
  ],
  'Shield Osprey': [
    mod('Hawk Eye', 0.0022), mod('Shotgun Barrage', 0.0022), mod('Shock Absorbers', 0.0003),
    endo(15, 0.0228), endo(50, 0.0022), endo(80, 0.0003), region(0.07),
  ],
  Charger: [
    mod('Convulsion', 0.0022), mod('Speed Trigger', 0.0022), mod('Regen', 0.0057), mod('Calculated Redirection', 0.0057),
    mod('Rupture', 0.0057), mod('Fracturing Wind', 0.0022),
    endo(15, 0.0057), endo(80, 0.0006), region(0.07),
  ],
  Leaper: [
    mod('Assault Mode', 0.0114), mod('Cleanse Infested', 0.0022), mod('Fatal Acceleration', 0.0022),
    mod('Spinning Needle', 0.0022), mod('Seismic Palm', 0.0006),
    endo(15, 0.0114), region(0.07),
  ],
};

// Every mod named in a drop table, so the data can hold a placeholder for each one
export function allTableMods() {
  const names = new Map();
  for (const rows of Object.values(ENEMY_DROP_TABLES)) {
    for (const row of rows) if (row.type === 'mod') names.set(row.modId, row.name);
  }
  return [...names.entries()].map(([uniqueName, name]) => ({ uniqueName, name }));
}
