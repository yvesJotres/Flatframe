// Sound manifest — declare the game's sound files here.
//
// HOW TO ADD A SOUND:
//   1. Drop the audio file (.ogg / .mp3 / .wav) into this folder
//      (src/assets/sounds/).
//   2. Add an entry below. The key is the name used by play():
//        audioManager.play('braton_fire');
//
// ENTRY FIELDS (all optional except the file):
//   file:     filename in this folder (resolved to an absolute URL)
//   category: 'sfx' | 'ui' | 'music' | 'ambience' | your own bus
//             (each category has an independent volume bus)
//   volume:   0..1 pre-scale applied on top of the bus volume
//   rate:     [min, max] random playback-rate variation per shot,
//             e.g. [0.95, 1.05] for subtle pitch variety
//
// Missing files are tolerated: the game logs one warning and continues
// (sounds with a procedural fallback, like 'gunshot', keep playing).

const sound = (file) => new URL(file, import.meta.url).href;

export const SOUND_MANIFEST = {
  // --- active: files present in src/assets/sounds/ ---
  melee_swing1:   { file: sound('swordSlash1.ogg'),       category: 'sfx', volume: 0.7, rate: [0.9, 1.1] },
  melee_swing2:   { file: sound('swordSlash2.ogg'),       category: 'sfx', volume: 0.7, rate: [0.9, 1.1] },
  melee_equip1:   { file: sound('swordEquip1.ogg'),       category: 'sfx', volume: 0.6 },
  melee_equip2:   { file: sound('swordEquip2.ogg'),       category: 'sfx', volume: 0.6 },
  heavy_attack:   { file: sound('meleeHeavySwing.ogg'),   category: 'sfx', volume: 0.8 },
  dagger_stab1:   { file: sound('daggerStab1.ogg'),       category: 'sfx', volume: 0.7, rate: [0.9, 1.1] },
  dagger_stab2:   { file: sound('daggerStab2.ogg'),       category: 'sfx', volume: 0.7, rate: [0.9, 1.1] },
  ranged_equip1:  { file: sound('rangedEquip1.ogg'),      category: 'sfx', volume: 0.6 },
  ranged_equip2:  { file: sound('rangedEquip2.ogg'),      category: 'sfx', volume: 0.6 },
  revive:         { file: sound('revive.ogg'),            category: 'sfx', volume: 0.8 },
  launcher_music: { file: sound('launcher_music.mp3'),    category: 'music', volume: 0.4 },
  ui_hover:       { file: sound('ui_hover.ogg'),          category: 'ui', volume: 0.4 },
  reload:         { file: sound('primary_reload.ogg'),    category: 'sfx', volume: 0.7 },
  ammo_collect:   { file: sound('ammo_collect.ogg'),      category: 'sfx', volume: 0.7, rate: [0.95, 1.05] },
  loot_pick:      { file: sound('loot_pick.ogg'),         category: 'sfx', volume: 0.7, rate: [0.95, 1.05] },


  // --- weapons (add the .ogg files, then uncomment) ---
  // braton_fire:  { file: sound('braton_fire.ogg'),  category: 'sfx', volume: 0.6, rate: [0.97, 1.03] },
  // grakata_fire: { file: sound('grakata_fire.ogg'), category: 'sfx', volume: 0.6, rate: [0.97, 1.03] },
  // lato_fire:    { file: sound('lato_fire.ogg'),    category: 'sfx', volume: 0.5, rate: [0.95, 1.05] },
  // reload:       { file: sound('reload.ogg'),       category: 'sfx', volume: 0.7 },
  // dry_fire:     { file: sound('dry_fire.ogg'),     category: 'sfx', volume: 0.6 },
  // hit:          { file: sound('hit.ogg'),          category: 'sfx', volume: 0.5, rate: [0.9, 1.1] },
  // crit:         { file: sound('crit.ogg'),         category: 'sfx', volume: 0.7 },

  // --- player ---
  // shield_hit:   { file: sound('shield_hit.ogg'),   category: 'sfx', volume: 0.6 },
  // shield_break: { file: sound('shield_break.ogg'), category: 'sfx', volume: 0.8 },
  // bleedout:     { file: sound('bleedout.ogg'),     category: 'sfx', volume: 0.8 },
  // revive:       { file: sound('revive.ogg'),       category: 'sfx', volume: 0.8 },

  // --- enemies ---
  // enemy_death:  { file: sound('enemy_death.ogg'),  category: 'sfx', volume: 0.6, rate: [0.9, 1.1] },

  // --- UI ---
  // ui_click:     { file: sound('ui_click.ogg'),     category: 'ui',  volume: 0.6 },
  // mission_win:  { file: sound('mission_win.ogg'),  category: 'ui',  volume: 0.9 },
  // mission_fail: { file: sound('mission_fail.ogg'), category: 'ui',  volume: 0.9 },

  // --- music / ambience ---
  // combat_music: { file: sound('combat_music.ogg'), category: 'music', volume: 0.5 },
  // ambience:     { file: sound('ambience.ogg'),     category: 'ambience', volume: 0.4 },
};
