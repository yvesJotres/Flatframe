class_name Settings
extends RefCounted

# Player settings values, saved per device. Port of the storage in src/engine/settings.js.
# The defaults come from the browser build (godot/data/settings_defaults.json, exported from settings.js), so
# every key and its starting value match. The on-screen Settings menu is not ported yet.

const DEFAULTS_PATH := "res://data/settings_defaults.json"
const STORE_PATH := "user://settings.json"

static var values: Dictionary = {}
static var _loaded := false


static func defaults() -> Dictionary:
	var parsed = JSON.parse_string(FileAccess.get_file_as_string(DEFAULTS_PATH))
	return parsed if parsed is Dictionary else {}


static func _ensure() -> void:
	if _loaded:
		return
	_loaded = true
	values = defaults()
	if FileAccess.file_exists(STORE_PATH):
		var saved = JSON.parse_string(FileAccess.get_file_as_string(STORE_PATH))
		if saved is Dictionary:
			values.merge(saved, true)


static func get_value(key: String) -> Variant:
	_ensure()
	return values.get(key)


static func set_value(key: String, value: Variant) -> void:
	_ensure()
	values[key] = value
	save()


static func collect() -> Dictionary:
	_ensure()
	return values.duplicate(true)


# Used when an account is loaded: the saved values replace the current ones
static func apply(data: Dictionary) -> void:
	_ensure()
	values.merge(data, true)
	save()


# The Settings menu's categories and rows, exported from settings.js (SETTING_SECTIONS)
static func sections() -> Array:
	var parsed = JSON.parse_string(FileAccess.get_file_as_string("res://data/settings_sections.json"))
	return parsed if parsed is Array else []


# Puts a category back to its defaults (settings.js reset). Gamepad bindings reset with the controller category.
static func reset(section_id: String) -> void:
	_ensure()
	var section: Dictionary = {}
	for s in sections():
		if s.get("id", "") == section_id:
			section = s
	var items: Array = section.get("items", [])
	var defs := defaults()
	for item in items:
		if item.get("type", "") != "binding":
			values[item.key] = defs.get(item.key, item.get("default"))
	if section.is_empty() or section_id == "controller":
		values["gamepadBindings"] = defs.get("gamepadBindings", {})
	save()


static func save() -> bool:
	var f := FileAccess.open(STORE_PATH, FileAccess.WRITE)
	if f == null:
		return false
	f.store_string(JSON.stringify(values))
	return true
