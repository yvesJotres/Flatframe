class_name ArtSlot
extends RefCounted

# Arsenal drawings for each equipment slot, from src/assets/art/art.js (ART map). The SVG files are in
# godot/assets/art/ and are loaded as textures.

const FILES := {
	"warframe": "res://assets/art/excalibur.svg",
	"primary": "res://assets/art/primary_rifle.svg",
	"secondary": "res://assets/art/secondary_pistol.svg",
	"melee": "res://assets/art/melee_sword.svg",
}

static var _textures: Dictionary = {}


static func texture(slot: String) -> Texture2D:
	if not _textures.has(slot):
		var path: String = FILES.get(slot, "")
		_textures[slot] = load(path) if path != "" and ResourceLoader.exists(path) else null
	return _textures[slot]
