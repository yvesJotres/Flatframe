class_name Sounds
extends RefCounted

# Sound playback from the browser build's sound manifest (src/assets/sounds/manifest.js, exported to
# godot/data/sounds.json). Each entry has a file, a volume, and an optional pitch range for variety.

const MANIFEST_PATH := "res://data/sounds.json"
const DIR := "res://assets/sounds/"

static var _manifest: Dictionary = {}
static var _streams: Dictionary = {}
static var _music: AudioStreamPlayer = null


static func _ensure() -> void:
	if _manifest.is_empty():
		var parsed = JSON.parse_string(FileAccess.get_file_as_string(MANIFEST_PATH))
		_manifest = parsed if parsed is Dictionary else {}


static func _stream(key: String) -> AudioStream:
	if _streams.has(key):
		return _streams[key]
	_ensure()
	var entry: Dictionary = _manifest.get(key, {})
	if entry.is_empty():
		push_warning("No sound named '%s' in the manifest" % key)
		return null
	var path := DIR + str(entry.get("file", ""))
	if not ResourceLoader.exists(path):
		push_warning("Sound file missing: %s" % path)
		return null
	var stream: AudioStream = load(path)
	_streams[key] = stream
	return stream


static func _root() -> Node:
	var loop := Engine.get_main_loop()
	return loop.root if loop is SceneTree else null


# Adds the player to the scene and starts it. Deferred, because the scene may still be setting up its children.
static func _start(player: AudioStreamPlayer) -> void:
	player.play()


# A one-shot sound. The player frees itself when the sound ends.
static func play(key: String) -> void:
	var stream := _stream(key)
	var root := _root()
	if stream == null or root == null:
		return
	var entry: Dictionary = _manifest[key]
	var player := AudioStreamPlayer.new()
	player.stream = stream
	player.volume_db = linear_to_db(float(entry.get("volume", 1.0)))
	var rate = entry.get("rate")
	if rate is Array and rate.size() == 2:
		player.pitch_scale = randf_range(float(rate[0]), float(rate[1]))
	player.finished.connect(player.queue_free)
	root.add_child.call_deferred(player)
	Sounds._start.call_deferred(player)


# Background music, looping. Replaces any music already playing.
static func play_music(key: String) -> void:
	stop_music()
	var stream := _stream(key)
	var root := _root()
	if stream == null or root == null:
		return
	if stream is AudioStreamMP3:
		stream.loop = true
	_ensure()
	_music = AudioStreamPlayer.new()
	_music.stream = stream
	_music.volume_db = linear_to_db(float(_manifest[key].get("volume", 1.0)))
	root.add_child.call_deferred(_music)
	Sounds._start.call_deferred(_music)


static func stop_music() -> void:
	if _music != null and is_instance_valid(_music):
		_music.queue_free()
	_music = null
