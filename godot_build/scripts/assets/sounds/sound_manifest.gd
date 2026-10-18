class_name SoundManifest
extends RefCounted
## Port of java_build/src/assets/sounds/manifest.js. The game's sound files.
##
## HOW TO ADD A SOUND:
##   1. Drop the audio file into godot_build/assets/sounds/.
##   2. Add an entry below. The key is the name used by play():
##        AudioManager.play("braton_fire")
##
## ENTRY FIELDS (all optional except the file):
##   file:     path under res://assets/sounds/
##   category: "sfx" | "ui" | "music" | "ambience" | your own bus
##   volume:   0..1 pre-scale applied on top of the bus volume
##   rate:     [min, max] random pitch variation per shot, e.g. [0.95, 1.05]
##
## Missing files are tolerated: the game warns once and continues.

const SOUND_DIR := "res://assets/sounds/"

const SOUND_MANIFEST := {
	# --- active: files present in godot_build/assets/sounds/ ---
	"melee_swing1": {"file": SOUND_DIR + "swordSlash1.ogg", "category": "sfx", "volume": 0.7, "rate": [0.9, 1.1]},
	"melee_swing2": {"file": SOUND_DIR + "swordSlash2.ogg", "category": "sfx", "volume": 0.7, "rate": [0.9, 1.1]},
	"melee_equip1": {"file": SOUND_DIR + "swordEquip1.ogg", "category": "sfx", "volume": 0.6},
	"melee_equip2": {"file": SOUND_DIR + "swordEquip2.ogg", "category": "sfx", "volume": 0.6},
	"heavy_attack": {"file": SOUND_DIR + "meleeHeavySwing.ogg", "category": "sfx", "volume": 0.8},
	"dagger_stab1": {"file": SOUND_DIR + "daggerStab1.ogg", "category": "sfx", "volume": 0.7, "rate": [0.9, 1.1]},
	"dagger_stab2": {"file": SOUND_DIR + "daggerStab2.ogg", "category": "sfx", "volume": 0.7, "rate": [0.9, 1.1]},
	"ranged_equip1": {"file": SOUND_DIR + "rangedEquip1.ogg", "category": "sfx", "volume": 1.0},
	"ranged_equip2": {"file": SOUND_DIR + "rangedEquip2.ogg", "category": "sfx", "volume": 1.0},
	"revive": {"file": SOUND_DIR + "revive.ogg", "category": "sfx", "volume": 0.8},
	"launcher_music": {"file": SOUND_DIR + "launcher_music.mp3", "category": "music", "volume": 0.4},
	"ui_hover": {"file": SOUND_DIR + "ui_hover.ogg", "category": "ui", "volume": 0.4},
	"ui_back": {"file": SOUND_DIR + "ui_hover.ogg", "category": "ui", "volume": 0.4},  # reuses ui_hover until a dedicated file exists
	"reload": {"file": SOUND_DIR + "primary_reload.ogg", "category": "sfx", "volume": 0.7},
	"ammo_collect": {"file": SOUND_DIR + "ammo_collect.ogg", "category": "sfx", "volume": 0.7, "rate": [0.95, 1.05]},
	"loot_pick": {"file": SOUND_DIR + "loot_pick.ogg", "category": "sfx", "volume": 0.7, "rate": [0.95, 1.05]},

	# --- weapons, player, enemies, UI, music: add the files, then uncomment in the JS manifest and port here ---
	# braton_fire, grakata_fire, lato_fire, dry_fire, hit, crit, shield_hit, shield_break, bleedout,
	# enemy_death, ui_click, mission_win, mission_fail, combat_music, ambience
}
