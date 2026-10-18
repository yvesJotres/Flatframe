extends Node
## Port of java_build/src/engine/sound_library.js. Registered as the autoload
## `SoundLibrary`. File-based and procedurally generated sounds, mixed into
## buses by category (sfx, ui, music, ambience...).
##
## Differences from the web version:
##  * Playback uses one AudioStreamPlayer per shot, freed when it finishes.
##    Web Audio's stereo pan is not ported yet; the pan option is ignored.
##  * Buses are AudioServer buses, created on first use, all sending to Master.
##  * Missing files warn once and degrade to silence (or their procedural fallback).

const DEFAULT_SAMPLE_RATE := 44100

var sample_rate := DEFAULT_SAMPLE_RATE
var entries := {}  # sound_name -> { src, category, volume, rate }
var streams := {}  # sound_name -> AudioStream (loaded from file or generated)
var procedural := {}  # sound_name -> Callable(sample_rate) -> AudioStream
var missing := {}  # names whose files failed to load
var unknown := {}  # names played that were never registered
var volumes := {"master": 1.0}
var muted := false


# ---- registration -----------------------------------------------------

func register(sound_name: String, def: Dictionary = {}) -> Node:
	var src = def.get("src")
	if src == null:
		src = def.get("file")
	entries[sound_name] = {
		"src": src,
		"category": def.get("category", "sfx"),
		"volume": def.get("volume", 1.0),
		# Optional playback-rate variation: [min, max] rolls a random pitch per shot
		"rate": def.get("rate"),
	}
	return self


func register_many(manifest: Dictionary = {}) -> Node:
	for sound_name in manifest:
		register(sound_name, manifest[sound_name])
	return self


func register_procedural(sound_name: String, generator: Callable) -> Node:
	procedural[sound_name] = generator
	return self


func has_sound(sound_name: String) -> bool:
	return entries.has(sound_name) or streams.has(sound_name) or procedural.has(sound_name)


# ---- loading ----------------------------------------------------------

# Loads every registered file. Never fails the game; failures are recorded in `missing` and warned once.
func load_all() -> Node:
	for sound_name in entries:
		var src = entries[sound_name]["src"]
		if src != null:
			_load_one(sound_name, src)
	return self


func _load_one(sound_name: String, src: String) -> void:
	var stream = load(src) if ResourceLoader.exists(src) else null
	if stream is AudioStream:
		streams[sound_name] = stream
	else:
		missing[sound_name] = true
		push_warning("[SoundLibrary] could not load \"%s\" (%s)" % [sound_name, src])


# ---- mixing -----------------------------------------------------------

func set_volume(bus: String, value: float) -> Node:
	var v := clampf(value, 0.0, 1.0)
	volumes[bus] = v
	if bus == "master":
		_apply_master_gain()
	else:
		var index := AudioServer.get_bus_index(bus)
		if index >= 0:
			AudioServer.set_bus_volume_db(index, linear_to_db(v))
	return self


func set_muted(is_muted: bool) -> Node:
	muted = is_muted
	_apply_master_gain()
	return self


func _apply_master_gain() -> void:
	AudioServer.set_bus_mute(0, muted)
	AudioServer.set_bus_volume_db(0, linear_to_db(volumes.get("master", 1.0)))


# Finds the bus for a category, creating it (sending to Master) on first use
func _get_bus(category: String) -> String:
	if AudioServer.get_bus_index(category) == -1:
		AudioServer.add_bus()
		var index := AudioServer.get_bus_count() - 1
		AudioServer.set_bus_name(index, category)
		AudioServer.set_bus_volume_db(index, linear_to_db(volumes.get(category, 1.0)))
	return category


# ---- playback ---------------------------------------------------------

# Returns the AudioStreamPlayer that plays it, or null (unknown sound or load failure).
# opts: { volume, rate, loop }
func play(sound_name: String, opts: Dictionary = {}):
	var stream = streams.get(sound_name)
	if stream == null and procedural.has(sound_name):
		stream = procedural[sound_name].call(sample_rate)
		if stream != null:
			streams[sound_name] = stream
	if stream == null:
		var registered := entries.has(sound_name) or procedural.has(sound_name)
		if not registered and not unknown.has(sound_name):
			unknown[sound_name] = true
			push_warning("[SoundLibrary] played unknown sound \"%s\"" % sound_name)
		return null

	var def: Dictionary = entries.get(sound_name, {})
	var player := AudioStreamPlayer.new()
	if opts.get("loop", false):
		stream = _looped(stream)
	player.stream = stream

	var rate: float = opts.get("rate", 1.0)
	var def_rate = def.get("rate")
	if not opts.has("rate") and def_rate is Array and def_rate.size() == 2:
		rate = lerpf(def_rate[0], def_rate[1], randf())
	player.pitch_scale = rate

	player.volume_db = linear_to_db(float(opts.get("volume", 1.0)) * float(def.get("volume", 1.0)))
	player.bus = _get_bus(def.get("category", "sfx"))
	add_child(player)
	player.finished.connect(player.queue_free)
	player.play()
	return player


static func _looped(stream: AudioStream) -> AudioStream:
	var copy = stream.duplicate()
	if copy is AudioStreamWAV:
		copy.loop_mode = AudioStreamWAV.LOOP_FORWARD
	elif "loop" in copy:
		copy.loop = true
	return copy
