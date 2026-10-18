class_name ModEffects
extends RefCounted
## Port of java_build/src/mods/mod_effects.js. Mod effects on weapons: wiki
## rank text such as "+165% Damage" becomes a percent bonus on the weapon's
## base stats. Each rank's text is the total at that rank (Serration rank 2 is
## +30%, not +15% + +30%), so only that rank is read.

# Wiki stat name -> bonus key used by weapon_mod_bonuses()
const STAT_RULES := [
	["(?i)^Damage$", "damage"],
	["(?i)^Critical Chance$", "critChance"],
	["(?i)^Critical Damage$", "critDamage"],
	["(?i)^Status Chance$", "statusChance"],
	["(?i)^(Fire Rate|Attack Speed)$", "fireRate"],
	["(?i)^Reload Speed$", "reloadSpeed"],
	["(?i)^Magazine Capacity$", "magazine"],
]

# Mod compatName (wiki "Primary", "Secondary", "Melee") -> weapon category used by the game
const COMPAT := {
	"primary": "primary",
	"secondary": "secondary",
	"melee": "melee",
}

const PERCENT_LINE := "^([+-]?\\d+(?:\\.\\d+)?)%\\s+(.+)$"
const FRAME_LINE := "(?i)^\\+?(\\d+(?:\\.\\d+)?)%\\s+(Health|Shields?|Armor)$"


static func _search(pattern: String, text: String) -> RegExMatch:
	var regex := RegEx.new()
	regex.compile(pattern)
	return regex.search(text)


static func parse_mod_stat(text: String):
	var match := _search(PERCENT_LINE, text.strip_edges())
	if match == null:
		return null
	var stat_name := match.get_string(2).strip_edges()
	for rule in STAT_RULES:
		if _search(rule[0], stat_name) != null:
			return {"key": rule[1], "percent": float(match.get_string(1))}
	return null


static func empty_mod_bonuses() -> Dictionary:
	return {
		"damage": 0.0,
		"critChance": 0.0,
		"critDamage": 0.0,
		"statusChance": 0.0,
		"fireRate": 0.0,
		"reloadSpeed": 0.0,
		"magazine": 0.0,
	}


# Sum of the percent bonuses from the mods that fit one weapon category (rank 0 mods add nothing)
static func weapon_mod_bonuses(mods: Array, category: String) -> Dictionary:
	var totals := empty_mod_bonuses()
	for mod in mods:
		if mod == null:
			continue
		var level_stats: Array = mod.get("levelStats", [])
		if level_stats.is_empty():
			continue
		var compat: String = String(mod.get("compatName", "")).to_lower()
		if not COMPAT.has(compat) or COMPAT[compat] != category:
			continue
		var rank: int = mini(int(mod.get("currentRank", 0)), level_stats.size())
		if rank < 1:
			continue
		for line in level_stats[rank - 1].get("stats", []):
			var parsed: Variant = parse_mod_stat(String(line))
			if parsed is Dictionary:
				var key: String = parsed["key"]
				totals[key] = float(totals[key]) + float(parsed["percent"])
	return totals


# Health, shield and armor bonuses from equipped Warframe mods. Wiki: an unranked mod gives its first level's bonus.
static func frame_mod_bonuses(mods: Array) -> Dictionary:
	var totals := {"health": 0.0, "shield": 0.0, "armor": 0.0}
	for mod in mods:
		if mod == null:
			continue
		var level_stats: Array = mod.get("levelStats", [])
		if level_stats.is_empty():
			continue
		if String(mod.get("compatName", "")).to_lower() != "warframe":
			continue
		var rank: int = clampi(int(mod.get("currentRank", 0)), 0, level_stats.size() - 1)
		for line in level_stats[rank].get("stats", []):
			var match := _search(FRAME_LINE, String(line).strip_edges())
			if match == null:
				continue
			var word := match.get_string(2).to_lower()
			var key := "health" if word.begins_with("health") else ("shield" if word.begins_with("shield") else "armor")
			totals[key] += float(match.get_string(1))
	return totals
