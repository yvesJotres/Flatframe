class_name WeaponData
extends RefCounted

# Loads a weapon definition from the shared JSON data (same files the JS build reads).
# Returns an empty dictionary if the file or weapon name is missing.
static func load_weapon(path: String, weapon_name: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		push_error("Weapon data not found: %s" % path)
		return {}
	var parsed = JSON.parse_string(FileAccess.get_file_as_string(path))
	if typeof(parsed) != TYPE_ARRAY:
		push_error("Weapon data is not an array: %s" % path)
		return {}
	for entry in parsed:
		if entry is Dictionary and entry.get("name", "") == weapon_name:
			return entry
	push_error("Weapon '%s' not found in %s" % [weapon_name, path])
	return {}


static func load_map(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		push_error("Map not found: %s" % path)
		return {}
	var parsed = JSON.parse_string(FileAccess.get_file_as_string(path))
	return parsed if parsed is Dictionary else {}
