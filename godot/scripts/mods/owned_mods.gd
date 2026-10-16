class_name Mods
extends RefCounted

# Mod data, owned mods, and installed mods. Port of src/mods/placement.js and src/mods/owned_mods.js.
# Capacity uses Mastery Rank 0 (15), as the JS does until mastery exists.
# Installed mods do not change any stats yet: the mission does not read them.

const FILES := [
	"res://data/mods/mods-damage.json",
	"res://data/mods/mods-elemental.json",
	"res://data/mods/mods-utility.json",
]
const COMPAT := {"warframe": "Warframe", "primary": "Primary", "secondary": "Secondary", "melee": "Melee"}
const MASTERY_RANK := 0
const AURA := "aura"
const EXILUS := "exilus"
const NORMAL := "normal"

# uniqueName -> rank owned (one copy each), from owned_mods.js
static var owned_ranks: Dictionary = {
	"/Lotus/Upgrades/Mods/Utility/VitalityMod": 0,
	"/Lotus/Upgrades/Mods/Utility/RedirectionMod": 0,
	"/Lotus/Upgrades/Mods/Utility/SteelFiberMod": 0,
}
# slot -> Array of installed uniqueName, "" when empty
static var installed: Dictionary = {}
static var _all: Array = []


static func all() -> Array:
	if _all.is_empty():
		for path in FILES:
			if FileAccess.file_exists(path):
				var parsed = JSON.parse_string(FileAccess.get_file_as_string(path))
				if parsed is Array:
					_all.append_array(parsed)
	return _all


static func by_unique(unique: String) -> Dictionary:
	for m in all():
		if m is Dictionary and m.get("uniqueName", "") == unique:
			return m
	return {}


# Warframe: 10 slots (0 aura, 1 exilus, rest normal). Weapons: 9 slots (8 is exilus).
static func slot_count(slot: String) -> int:
	return 10 if slot == "warframe" else 9


static func slot_kind(slot: String, index: int) -> String:
	if slot == "warframe":
		if index == 0:
			return AURA
		if index == 1:
			return EXILUS
		return NORMAL
	return EXILUS if index == 8 else NORMAL


static func can_place(mod: Dictionary, kind: String) -> bool:
	var is_aura: bool = mod.get("isAura", false)
	if kind == AURA:
		return is_aura
	return not is_aura


static func capacity() -> int:
	return 15 + maxi(0, MASTERY_RANK) / 2


static func drain(mod: Dictionary) -> int:
	return int(mod.get("baseDrain", 0)) + int(mod.get("currentRank", 0))


# Owned mods that belong on this kind of item, each copy with its currentRank set
static func owned_for(slot: String) -> Array:
	var out: Array = []
	for unique in owned_ranks:
		var m := by_unique(unique)
		if m.is_empty() or m.get("compatName", "") != COMPAT[slot]:
			continue
		var copy := m.duplicate()
		copy["currentRank"] = owned_ranks[unique]
		out.append(copy)
	return out


static func _slots(slot: String) -> Array:
	if not installed.has(slot):
		var arr: Array = []
		arr.resize(slot_count(slot))
		arr.fill("")
		installed[slot] = arr
	return installed[slot]


static func mod_at(slot: String, index: int) -> Dictionary:
	var unique: String = _slots(slot)[index]
	if unique == "":
		return {}
	var m := by_unique(unique).duplicate()
	m["currentRank"] = owned_ranks.get(unique, 0)
	return m


static func installed_mods(slot: String) -> Array:
	var out: Array = []
	for i in range(slot_count(slot)):
		var m := mod_at(slot, i)
		if not m.is_empty():
			out.append(m)
	return out


static func used_capacity(slot: String) -> int:
	var total := 0
	for i in range(slot_count(slot)):
		var m := mod_at(slot, i)
		if not m.is_empty():
			total += drain(m)
	return total


# Why a mod won't go in a slot, or "" when it fits. Mirrors the checks in install().
static func reject_reason(slot: String, index: int, mod: Dictionary) -> String:
	if not can_place(mod, slot_kind(slot, index)):
		return "This mod doesn't fit that slot."
	var current := mod_at(slot, index)
	var others := used_capacity(slot) - (drain(current) if not current.is_empty() else 0)
	if others + drain(mod) > capacity():
		return "Not enough capacity."
	var unique: String = mod.get("uniqueName", "")
	for i in range(slot_count(slot)):
		if i != index and _slots(slot)[i] == unique:
			return "Already installed on this item."
	return ""


static func install(slot: String, index: int, mod: Dictionary) -> bool:
	if reject_reason(slot, index, mod) != "":
		return false
	var slots := _slots(slot)
	slots[index] = mod.get("uniqueName", "")
	return true


static func remove(slot: String, index: int) -> void:
	var slots := _slots(slot)
	slots[index] = ""


# Effect text at the mod's current rank, one entry per stat (e.g. "+9% Shields")
static func effect_lines(mod: Dictionary) -> Array:
	var stats: Array = mod.get("levelStats", [])
	if stats.is_empty():
		return []
	var rank := clampi(int(mod.get("currentRank", 0)), 0, stats.size() - 1)
	return stats[rank].get("stats", [])
