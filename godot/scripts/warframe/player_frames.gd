class_name PlayerFrames
extends RefCounted

# The Warframes the player owns: copies, formas, and the mods in each of their 3 configs.
# Port of src/warframe/player_frames.js. Only Excalibur is defined in the browser build too.

static var frames: Dictionary = {}


static func default_frames() -> Dictionary:
	var configs: Array = []
	for _i in range(3):
		var mods: Array = []
		mods.resize(10)
		mods.fill(null)
		configs.append({"mods": mods})
	return {"Excalibur": {"copies": 1, "formas": 0, "configs": configs}}


static func get_frames() -> Dictionary:
	if frames.is_empty():
		frames = default_frames()
	return frames


# Saved frames replace the defaults for known frame names only
static func apply(data: Dictionary) -> void:
	var current := get_frames()
	for frame_name in data:
		var saved = data[frame_name]
		if not current.has(frame_name) or not (saved is Dictionary) or not (saved.get("configs") is Array):
			continue
		var frame: Dictionary = current[frame_name]
		frame.copies = int(saved.get("copies", 1))
		frame.formas = int(saved.get("formas", 0))
		frame.configs = saved.configs
