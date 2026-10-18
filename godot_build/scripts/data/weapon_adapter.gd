class_name WeaponAdapter
extends RefCounted
## Port of java_build/src/data/weapon_adapter.js. Converts a Warframe Public
## Export weapon into the stats the Weapon constructor uses. Each JS `??`
## becomes _first(), which takes the first value that is not null.

# Sound names for weapons that have their own sound (see the audio port).
# Weapons not listed fall back to the generic 'gunshot'.
const WEAPON_SOUNDS := {
	"Braton": "braton_fire",
}


static func _first(values: Array, fallback = null):
	for value in values:
		if value != null:
			return value
	return fallback


# Convert Warframe Public Export weapon -> Weapon constructor stats
static func adapt_attack(wf_attack: Dictionary) -> Dictionary:
	var heavy = wf_attack.get("heavy_attack")
	var normal_damage: Dictionary = _first([wf_attack.get("damage")], {})
	var heavy_multiplier = heavy.get("damage_multiplier") if heavy != null else null
	var heavy_damage := {}
	if heavy_multiplier:
		for key in normal_damage:
			heavy_damage[key] = normal_damage[key] * heavy_multiplier
	# Warframe JSON uses 'blocking_angle' for normal attack arc, 'arc' for heavy
	var arc = _first([wf_attack.get("blocking_angle"), wf_attack.get("arc")])
	var shot_type: String = String(_first([wf_attack.get("shot_type")], "hit-scan")).to_lower().replace("hitscan", "hit-scan")
	return {
		"fireRate": _first([wf_attack.get("fire_rate"), wf_attack.get("speed")], 1),
		"damage": normal_damage,
		"critChance": float(_first([wf_attack.get("critical_chance"), wf_attack.get("crit_chance")], 0)) / 100.0,
		"critMultiplier": _first([wf_attack.get("critical_multiplier"), wf_attack.get("crit_mult")], 1),
		"statusChance": float(_first([wf_attack.get("status_chance")], 0)) / 100.0,
		"shotType": shot_type,
		"range": _first([wf_attack.get("range")], 300),
		"multishot": _first([wf_attack.get("multishot")], 1),
		"falloff": _first([wf_attack.get("falloff")]),
		"minSpread": _first([wf_attack.get("min_spread")], 0),
		"maxSpread": _first([wf_attack.get("max_spread"), wf_attack.get("min_spread")], 0),
		"ammoCost": _first([wf_attack.get("ammo_cost")], 1),
		"punchThrough": _first([wf_attack.get("punch_through")], 0),
		# melee
		"arc": arc,
		"heavyAttackData": _heavy_attack_data(heavy, heavy_damage) if heavy != null else null,
		"meleeCooldown": wf_attack.get("melee_cooldown"),
	}


static func _heavy_attack_data(heavy: Dictionary, heavy_damage: Dictionary) -> Dictionary:
	return {
		"damage_multiplier": heavy.get("damage_multiplier"),
		"wind_up": heavy.get("wind_up"),
		"critChance": float(_first([heavy.get("crit_chance")], 0)) / 100.0,
		"critMultiplier": _first([heavy.get("crit_mult")], 1),
		"statusChance": float(_first([heavy.get("status_chance")], 0)) / 100.0,
		"damage": heavy_damage,
	}


static func adapt_weapon(wf_weapon: Dictionary) -> Dictionary:
	var attacks: Array = _first([wf_weapon.get("attacks")], [])
	var primary_attack: Dictionary = {}
	for attack in attacks:
		if attack.get("name") == "Normal":
			primary_attack = attack
			break
	if primary_attack.is_empty() and attacks.size() > 0:
		primary_attack = attacks[0]

	var polarities: Array = _first([wf_weapon.get("polarities")], [])
	var polarity = null
	# Data stores polarities as plain strings (e.g. "naramon"); the JS read .polarity on them, which is undefined,
	# so the default applies. Only dictionary entries carry a polarity field.
	if polarities.size() > 0 and polarities[0] is Dictionary:
		polarity = polarities[0].get("polarity")

	var magazine = _first([wf_weapon.get("magazine_size"), wf_weapon.get("magazineSize")], 30)
	return {
		"name": wf_weapon.get("name"),
		"uniqueName": wf_weapon.get("uniqueName"),
		"magazine": magazine,
		"reload": _first([wf_weapon.get("reload_time"), wf_weapon.get("reloadTime")], 1),
		"ammoPickup": wf_weapon.get("ammoPickup"),
		"ammoMax": _first([wf_weapon.get("ammoMax"), wf_weapon.get("magazine_size"), wf_weapon.get("magazineSize")], 30),
		"sound": _first([wf_weapon.get("sound"), WEAPON_SOUNDS.get(wf_weapon.get("name"))]),
		"reloadSound": _first([wf_weapon.get("reload_sound"), wf_weapon.get("reloadSound")]),
		"attack": adapt_attack(primary_attack),
		"attacks": wf_weapon.get("attacks"),
		"range": _first([primary_attack.get("range")], 2.5),
		"class": wf_weapon.get("type"),
		"stats": wf_weapon,
		# mod capacity
		"polarity": _first([polarity], "madurai"),
		"masteryReq": _first([wf_weapon.get("masteryReq")], 0),
		# melee cooldown (default 0.45s from constants)
		"meleeCooldown": _first([primary_attack.get("melee_cooldown")], 0.45),
	}
