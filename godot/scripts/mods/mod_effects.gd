class_name ModEffects
extends RefCounted

# Mod effects on weapons and the Warframe. Port of src/mods/mod_effects.js.
# Rank text such as "+165% Damage" is a percent bonus. Each rank's text is the total at that rank,
# so only that rank is read (Serration rank 2 is +30%, not +15% + +30%).

const WEAPON_STATS := {
	"damage": "damage",
	"critical chance": "critChance",
	"critical damage": "critDamage",
	"status chance": "statusChance",
	"fire rate": "fireRate",
	"attack speed": "fireRate",
	"reload speed": "reloadSpeed",
	"magazine capacity": "magazine",
}
const PERCENT_LINE := "^([+-]?\\d+(?:\\.\\d+)?)%\\s+(.+)$"
const FRAME_LINE := "(?i)^\\+?(\\d+(?:\\.\\d+)?)%\\s+(Health|Shields?|Armor)$"


# {key, percent} for a weapon stat line, or {} when the line is not a weapon stat
static func parse_mod_stat(text: String) -> Dictionary:
	var re := RegEx.create_from_string(PERCENT_LINE)
	var m := re.search(text.strip_edges())
	if m == null:
		return {}
	var stat := m.get_string(2).strip_edges().to_lower()
	if not WEAPON_STATS.has(stat):
		return {}
	return {"key": WEAPON_STATS[stat], "percent": float(m.get_string(1))}


static func empty_weapon_bonuses() -> Dictionary:
	return {"damage": 0.0, "critChance": 0.0, "critDamage": 0.0, "statusChance": 0.0,
		"fireRate": 0.0, "reloadSpeed": 0.0, "magazine": 0.0}


# Sum of the percent bonuses from the mods that fit one weapon category ("primary", "secondary", "melee")
static func weapon_bonuses(mods: Array, category: String) -> Dictionary:
	var totals := empty_weapon_bonuses()
	for mod in mods:
		var levels: Array = mod.get("levelStats", [])
		if levels.is_empty() or str(mod.get("compatName", "")).to_lower() != category:
			continue
		var rank := mini(int(mod.get("currentRank", 0)), levels.size())
		if rank < 1:
			continue
		for line in levels[rank - 1].get("stats", []):
			var parsed := parse_mod_stat(str(line))
			if not parsed.is_empty():
				totals[parsed.key] += parsed.percent
	return totals


# Health, shield and armor bonuses from the Warframe's mods. An unranked mod gives its first level's bonus.
static func frame_bonuses(mods: Array) -> Dictionary:
	var totals := {"health": 0.0, "shield": 0.0, "armor": 0.0}
	var re := RegEx.create_from_string(FRAME_LINE)
	for mod in mods:
		var levels: Array = mod.get("levelStats", [])
		if levels.is_empty() or str(mod.get("compatName", "")).to_lower() != "warframe":
			continue
		var rank := clampi(int(mod.get("currentRank", 0)), 0, levels.size() - 1)
		for line in levels[rank].get("stats", []):
			var m := re.search(str(line).strip_edges())
			if m == null:
				continue
			var word := m.get_string(2).to_lower()
			var key := "health" if word.begins_with("health") else ("shield" if word.begins_with("shield") else "armor")
			totals[key] += float(m.get_string(1))
	return totals


# A copy of a weapon definition with the bonuses applied to its base stats
static func apply_to_weapon(weapon: Dictionary, b: Dictionary) -> Dictionary:
	var w := weapon.duplicate(true)
	if w.get("damage") is Dictionary and w.damage.has("total"):
		w.damage["total"] = float(w.damage.total) * (1.0 + b.damage / 100.0)
	if w.has("fireRate"):
		w["fireRate"] = float(w.fireRate) * (1.0 + b.fireRate / 100.0)
	if w.has("reloadTime"):
		w["reloadTime"] = float(w.reloadTime) / (1.0 + b.reloadSpeed / 100.0)
	if w.has("magazineSize"):
		w["magazineSize"] = roundi(float(w.magazineSize) * (1.0 + b.magazine / 100.0))
	return w
