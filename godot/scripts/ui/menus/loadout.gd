class_name Loadout
extends RefCounted

# Equipped items, shared by the Arsenal screen and the mission. Defaults match the JS
# (DEFAULT_WARFRAME, DEFAULT_PRIMARY, DEFAULT_SECONDARY, DEFAULT_MELEE). Session-only: nothing is saved yet.

const SLOTS := ["warframe", "primary", "secondary", "melee"]
const SLOT_LABELS := {"warframe": "WARFRAME", "primary": "PRIMARY", "secondary": "SECONDARY", "melee": "MELEE"}
const SLOT_FILES := {
	"warframe": "res://data/warframes/warframes-tenno.json",
	"primary": "res://data/weapons/primary-rifle.json",
	"secondary": "res://data/weapons/secondary-pistol.json",
	"melee": "res://data/weapons/melee-sword.json",
}
const DEFAULTS := {"warframe": "Excalibur", "primary": "Braton", "secondary": "Lato", "melee": "Skana"}

static var equipped: Dictionary = DEFAULTS.duplicate()
static var _cache: Dictionary = {}


static func items(slot: String) -> Array:
	if not _cache.has(slot):
		var path: String = SLOT_FILES[slot]
		var parsed = JSON.parse_string(FileAccess.get_file_as_string(path)) if FileAccess.file_exists(path) else null
		_cache[slot] = parsed if parsed is Array else []
	return _cache[slot]


static func item(slot: String, item_name: String) -> Dictionary:
	for entry in items(slot):
		if entry is Dictionary and entry.get("name", "") == item_name:
			return entry
	return {}


static func equipped_item(slot: String) -> Dictionary:
	return item(slot, equipped.get(slot, DEFAULTS[slot]))
