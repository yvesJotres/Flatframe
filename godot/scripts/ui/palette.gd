class_name Palette
extends RefCounted

# Colour tokens from src/assets/colors.js, exported to godot/data/colors.json.
# Values are hex ("#cc2a28") or rgba text ("rgba(255,255,255,0.12)").

const COLORS_PATH := "res://data/colors.json"

static var _colors: Dictionary = {}


static func _ensure() -> void:
	if _colors.is_empty():
		var parsed = JSON.parse_string(FileAccess.get_file_as_string(COLORS_PATH))
		_colors = parsed if parsed is Dictionary else {}


# The colour for a token name, e.g. Palette.get_color("HEALTH")
static func get_color(token: String) -> Color:
	_ensure()
	return parse(str(_colors.get(token, "#ff00ff")))


static func parse(text: String) -> Color:
	if text.begins_with("rgba("):
		var parts := text.trim_prefix("rgba(").trim_suffix(")").split(",")
		if parts.size() == 4:
			return Color(float(parts[0]) / 255.0, float(parts[1]) / 255.0, float(parts[2]) / 255.0, float(parts[3]))
	return Color(text)
