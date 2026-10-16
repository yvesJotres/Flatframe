// Compares tuning numbers between the browser build (src/) and the Godot port (godot/scripts/).
// Usage: node godot/tools/number_diff.mjs   (exit 1 on any mismatch)
// Add a pair to PAIRS when a value is ported. Each side is a regex with one capture group for the number.
import { readFileSync } from 'node:fs';

const PAIRS = [
  // [label, JS file, JS regex, Godot file, Godot regex]
  ['player move speed', 'src/warframe/player.js', /this\.moveSpeed = (\d+)/, 'godot/scripts/warframe/player.gd', /const MOVE_SPEED := ([\d.]+)/],
  ['player acceleration', 'src/warframe/player.js', /this\.acceleration = (\d+)/, 'godot/scripts/warframe/player.gd', /const ACCELERATION := ([\d.]+)/],
  ['player deceleration', 'src/warframe/player.js', /this\.deceleration = (\d+)/, 'godot/scripts/warframe/player.gd', /const DECELERATION := ([\d.]+)/],
  ['player radius', 'src/warframe/player.js', /this\.radius = (\d+)/, 'godot/scripts/warframe/player.gd', /const RADIUS := ([\d.]+)/],
  ['projectile speed', 'src/engine/constants.js', /DEFAULT_PROJECTILE_SPEED = (\d+)/, 'godot/scripts/engine/constants.gd', /DEFAULT_PROJECTILE_SPEED := ([\d.]+)/],
  ['units per metre', 'src/engine/constants.js', /UNITS_PER_METER = (\d+)/, 'godot/scripts/engine/constants.gd', /UNITS_PER_METER := (\d+)/],
  ['enemy move speed', 'src/enemies/enemy.js', /this\.moveSpeed = options\.moveSpeed \?\? (\d+)/, 'godot/scripts/enemies/enemy.gd', /const SPEED := ([\d.]+)/],
  ['enemy radius', 'src/enemies/enemy.js', /this\.radius = options\.radius \?\? (\d+)/, 'godot/scripts/enemies/enemy.gd', /const RADIUS := ([\d.]+)/],
  ['melee cooldown ms', 'src/engine/constants.js', /DEFAULT_MELEE_COOLDOWN_MS = (\d+)/, 'godot/scripts/engine/constants.gd', /DEFAULT_MELEE_COOLDOWN_MS := ([\d.]+)/],
  ['spread recovery', 'src/engine/constants.js', /SPREAD_RECOVERY_DEG_PER_SEC = (\d+)/, 'godot/scripts/engine/constants.gd', /SPREAD_RECOVERY_DEG_PER_SEC := ([\d.]+)/],
  ['combo reset ms', 'src/engine/constants.js', /COMBO_RESET_MS = (\d+)/, 'godot/scripts/engine/constants.gd', /COMBO_RESET_MS := ([\d.]+)/],
  ['parry window s', 'src/engine/constants.js', /PARRY_WINDOW_SEC = ([\d.]+)/, 'godot/scripts/engine/constants.gd', /PARRY_WINDOW_SEC := ([\d.]+)/],
];

// Excalibur's abilities (src/warframe/abilities/excalibur_abilities.js)
const ABILITIES = 'src/warframe/abilities/excalibur_abilities.js';
const ABILITY_GD = 'godot/scripts/warframe/abilities/excalibur_abilities.gd';
const obj = (name) => new RegExp(`${name} = \\{[\\s\\S]*?`);
const gdObj = (name) => new RegExp(`${name} := \\{[\\s\\S]*?`);
PAIRS.push(
  ['radial blind energy', ABILITIES, new RegExp(obj('RADIAL_BLIND').source + 'energyCost: (\\d+)'), ABILITY_GD, new RegExp(gdObj('RADIAL_BLIND').source + '"energy_cost": ([\\d.]+)')],
  ['radial blind duration', ABILITIES, new RegExp(obj('RADIAL_BLIND').source + 'duration: (\\d+)'), ABILITY_GD, new RegExp(gdObj('RADIAL_BLIND').source + '"duration": ([\\d.]+)')],
  ['radial javelin energy', ABILITIES, new RegExp(obj('RADIAL_JAVELIN').source + 'energyCost: (\\d+)'), ABILITY_GD, new RegExp(gdObj('RADIAL_JAVELIN').source + '"energy_cost": ([\\d.]+)')],
  ['radial javelin damage', ABILITIES, new RegExp(obj('RADIAL_JAVELIN').source + 'damage: (\\d+)'), ABILITY_GD, new RegExp(gdObj('RADIAL_JAVELIN').source + '"damage": ([\\d.]+)')],
  ['exalted blade energy', ABILITIES, new RegExp(obj('EXALTED_BLADE').source + 'energyCost: (\\d+)'), ABILITY_GD, new RegExp(gdObj('EXALTED_BLADE').source + '"energy_cost": ([\\d.]+)')],
  ['exalted blade drain/s', ABILITIES, new RegExp(obj('EXALTED_BLADE').source + 'drainPerSecond: ([\\d.]+)'), ABILITY_GD, new RegExp(gdObj('EXALTED_BLADE').source + '"drain_per_second": ([\\d.]+)')],
  ['exalted wave cooldown', ABILITIES, /EXALTED_WAVE_COOLDOWN = ([\d.]+)/, ABILITY_GD, /EXALTED_WAVE_COOLDOWN := ([\d.]+)/],
  ['slash dash energy', ABILITIES, new RegExp(obj('SLASH_DASH').source + 'energyCost: (\\d+)'), 'godot/scripts/warframe/abilities/slash_dash.gd', /const ENERGY_COST := ([\d.]+)/],
  ['slash dash damage', ABILITIES, new RegExp(obj('SLASH_DASH').source + 'damage: (\\d+)'), 'godot/scripts/warframe/abilities/slash_dash.gd', /const DAMAGE := ([\d.]+)/],
  ['energy wave hit loss', ABILITIES, /hitLoss: ([\d.]+)/, 'godot/scripts/warframe/abilities/energy_wave.gd', /const HIT_LOSS := ([\d.]+)/],
  ['dash trail seconds', 'src/warframe/abilities/excalibur_abilities.js', new RegExp(obj('DASH_TRAIL').source + 'seconds: ([\\d.]+)'), 'godot/scripts/warframe/abilities/dash_trail.gd', /const SECONDS := ([\d.]+)/],
  ['dash trail spacing', 'src/warframe/abilities/excalibur_abilities.js', new RegExp(obj('DASH_TRAIL').source + 'spacing: (\\d+)'), 'godot/scripts/warframe/abilities/dash_trail.gd', /const SPACING := ([\d.]+)/],
);

// Bullet jump and hop (src/warframe/jump.js JUMP)
const JUMP_JS = 'src/warframe/jump.js';
const JUMP_GD = 'godot/scripts/warframe/jump.gd';
const jumpJs = (name) => new RegExp(`${name}: ([\\d.]+)`);
PAIRS.push(
  ['hop speed', JUMP_JS, jumpJs('hopSpeed'), JUMP_GD, /const HOP_SPEED := ([\d.]+)/],
  ['double jump speed', JUMP_JS, jumpJs('doubleSpeed'), JUMP_GD, /const DOUBLE_SPEED := ([\d.]+)/],
  ['bullet jump speed', JUMP_JS, jumpJs('bulletSpeed'), JUMP_GD, /const BULLET_SPEED := ([\d.]+)/],
  ['bullet jump distance', JUMP_JS, jumpJs('bulletDistance'), JUMP_GD, /const BULLET_DISTANCE := ([\d.]+)/],
  ['bullet blast radius', JUMP_JS, jumpJs('blastRadius'), JUMP_GD, /const BLAST_RADIUS := ([\d.]+)/],
  ['bullet blast damage', JUMP_JS, jumpJs('blastDamage'), JUMP_GD, /const BLAST_DAMAGE := ([\d.]+)/],
  ['stand radius', JUMP_JS, jumpJs('standRadius'), JUMP_GD, /const STAND_RADIUS := ([\d.]+)/],
  ['crouch radius', JUMP_JS, jumpJs('crouchRadius'), JUMP_GD, /const CROUCH_RADIUS := ([\d.]+)/],
  ['crouch sight factor', JUMP_JS, jumpJs('crouchSightFactor'), JUMP_GD, /const CROUCH_SIGHT_FACTOR := ([\d.]+)/],
  ['hop seconds', JUMP_JS, jumpJs('hopSeconds'), JUMP_GD, /const HOP_SECONDS := ([\d.]+)/],
);

// Currency toast (src/ui/currency_toast.js, in milliseconds; Godot uses seconds)
PAIRS.push(
  ['toast show time', 'src/ui/currency_toast.js', /SHOW_MS = (\d+)/, 'godot/scripts/ui/currency_toast.gd', /const SHOW_SECONDS := ([\d.]+)/, 0.001],
  ['toast fade time', 'src/ui/currency_toast.js', /SHOW_MS \+ (\d+)/, 'godot/scripts/ui/currency_toast.gd', /const FADE_SECONDS := ([\d.]+)/, 0.001],
);

// Cryo Pod (src/missions/objective.js) and progression (src/progression/progression.js)
PAIRS.push(
  ['cryo pod health', 'src/missions/objective.js', /maxHp: options\.health \?\? (\d+)/, 'godot/scripts/missions/objective.gd', /func _init\(max_hp: float = ([\d.]+)/],
  ['cryo pod armour', 'src/missions/objective.js', /armor: options\.armor \?\? (\d+)/, 'godot/scripts/missions/objective.gd', /armor: float = ([\d.]+)\)/],
  ['mastery xp per rank²', 'src/progression/progression.js', /return (\d+) \* rank \* rank/, 'godot/scripts/progression/progression.gd', /return ([\d.]+) \* rank \* rank/],
  ['item xp per rank² (warframe)', 'src/progression/progression.js', /const base = (\d+) \* rank \* rank/, 'godot/scripts/progression/progression.gd', /var base := ([\d.]+) \* rank \* rank/],
  ['kill affinity level term', 'src/progression/progression.js', /\(1 \+ ([\d.]+) \* Math\.sqrt/, 'godot/scripts/progression/progression.gd', /\(1\.0 \+ ([\d.]+) \* sqrt/],
  ['weapon kill warframe share', 'src/progression/progression.js', /WEAPON_KILL_WARFRAME_SHARE = ([\d.]+)/, 'godot/scripts/progression/progression.gd', /WEAPON_KILL_WARFRAME_SHARE := ([\d.]+)/],
  ['mastery max rank', 'src/progression/progression.js', /MASTERY_MAX_RANK = (\d+)/, 'godot/scripts/progression/progression.gd', /MASTERY_MAX_RANK := (\d+)/],
  ['item max rank', 'src/progression/progression.js', /ITEM_MAX_RANK = (\d+)/, 'godot/scripts/progression/progression.gd', /ITEM_MAX_RANK := (\d+)/],
);

// Faction units: base health and armour before scaling (the JS passes these to scaleStatByFaction)
const UNIT_FILES = {
  'MOA': 'src/enemies/corpus/moa.js',
  'Shield Osprey': 'src/enemies/corpus/shield_osprey.js',
  'Charger': 'src/enemies/infested/charger.js',
  'Leaper': 'src/enemies/infested/leaper.js',
  'Runner': 'src/enemies/infested/runner.js',
  'Lancer': 'src/enemies/grineer/lancer.js',
  'Trooper': 'src/enemies/grineer/trooper.js',
  'Butcher': 'src/enemies/grineer/butcher.js',
};
PAIRS.push([
  'Crewman base hp', 'src/enemies/corpus/crewman.js', /scaleStatByFaction\((\d+), this\.lvl, 'hp'/,
  'godot/scripts/enemies/corpus/crewman.gd', /const SHOT_HP := ([\d.]+)/,
]);
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
for (const [unit, jsFile] of Object.entries(UNIT_FILES)) {
  for (const stat of ['hp', 'armor']) {
    PAIRS.push([
      `${unit} base ${stat}`,
      jsFile,
      new RegExp(`scaleStatByFaction\\((\\d+), this\\.lvl, '${stat}'`),
      'godot/scripts/enemies/registry.gd',
      new RegExp(`"${escapeRe(unit)}": \\{[^}]*"${stat}": ([\\d.]+)`),
    ]);
  }
}

let bad = 0;
for (const [label, jsFile, jsRe, gdFile, gdRe, jsScale = 1] of PAIRS) {
  const js = readFileSync(jsFile, 'utf8').match(jsRe);
  const gd = readFileSync(gdFile, 'utf8').match(gdRe);
  if (!js || !gd) {
    bad++;
    console.log(`FAIL  ${label}: not found (js ${js ? 'ok' : 'missing'}, godot ${gd ? 'ok' : 'missing'})`);
    continue;
  }
  if (Math.abs(Number(js[1]) * jsScale - Number(gd[1])) > 1e-9) {
    bad++;
    console.log(`FAIL  ${label}: js ${js[1]} x ${jsScale} vs godot ${gd[1]}`);
  } else {
    console.log(`ok    ${label}: ${js[1]}`);
  }
}
console.log(`\n${PAIRS.length - bad} of ${PAIRS.length} match`);
process.exit(bad ? 1 : 0);
