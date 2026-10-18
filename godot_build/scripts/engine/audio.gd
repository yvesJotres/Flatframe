extends Node
## Port of java_build/src/engine/audio.js. Registered as the autoload
## `AudioManager`. The same facade the weapons call:
##   AudioManager.play("gunshot", 0.35)
##   AudioManager.play("launcher_music", {"volume": 0.4, "loop": true})
## The real work is in SoundLibrary (the autoload in sound_library.gd).
## Godot needs no browser unlock, so the sounds load on start-up.

func _ready() -> void:
	var library := SoundLibrary
	library.register_many(SoundManifest.SOUND_MANIFEST)
	library.register_procedural("gunshot", func(sr: int) -> AudioStream: return ProceduralSounds.create_gunshot(sr, ProceduralSounds.GUNSHOT_PROFILES["default"]))
	library.register_procedural("braton_fire", func(sr: int) -> AudioStream: return ProceduralSounds.create_gunshot(sr, ProceduralSounds.GUNSHOT_PROFILES["braton"]))
	library.register_procedural("ui_parry", ProceduralSounds.create_parry)
	# Sci-fi menu sounds (see ui_sounds.gd)
	library.register("ui_hover", {"category": "ui", "volume": 0.4})
	library.register("ui_select", {"category": "ui", "volume": 0.5})
	library.register("ui_back", {"category": "ui", "volume": 0.4})
	library.register_procedural("ui_hover", UiSounds.create_ui_hover)
	library.register_procedural("ui_select", UiSounds.create_ui_select)
	library.register_procedural("ui_back", UiSounds.create_ui_back)
	# No file: generated on first play, on the UI bus.
	library.register("countdown_tick", {"category": "ui", "volume": 0.6})
	library.register_procedural("countdown_tick", ProceduralSounds.create_countdown_tick)
	library.load_all()


# play("gunshot", 0.35) - legacy: sound_name + volume number
# play("launcher_music", {"volume": 0.4, "loop": true, "rate": 1.1})
func play(sound_name: String, volume = 0.3, opts: Dictionary = {}):
	if volume is Dictionary:
		opts = volume
		volume = opts.get("volume", 0.3)
	var merged := opts.duplicate()
	merged["volume"] = volume
	return SoundLibrary.play(sound_name, merged)


func set_volume(bus: String, value: float) -> void:
	SoundLibrary.set_volume(bus, value)


func set_muted(muted: bool) -> void:
	SoundLibrary.set_muted(muted)
