class_name Critical
extends RefCounted

# Critical hits and precision bonus, port of src/combat/critical.js.

enum Tier { NONE = 0, YELLOW = 1, ORANGE = 2, RED = 3 }


static func calculate_crit_chance(base_crit_chance: float, crit_chance_mods: float = 0.0) -> float:
	return minf(1.0, base_crit_chance * (1.0 + crit_chance_mods))


static func calculate_crit_multiplier(base_crit_multiplier: float, crit_damage_mods: float = 0.0) -> float:
	return base_crit_multiplier * (1.0 + crit_damage_mods)


static func get_crit_tier(final_multiplier: float) -> int:
	if final_multiplier >= 3.0:
		return Tier.RED
	if final_multiplier >= 2.0:
		return Tier.ORANGE
	if final_multiplier > 1.0:
		return Tier.YELLOW
	return Tier.NONE


# roll is a uniform 0..1 value, passed in so tests are deterministic (the JS uses Math.random)
static func roll_crit(base_crit_chance: float, base_crit_multiplier: float, crit_chance_mods: float = 0.0,
		crit_damage_mods: float = 0.0, roll: float = -1.0) -> Dictionary:
	var chance := calculate_crit_chance(base_crit_chance, crit_chance_mods)
	var mult := calculate_crit_multiplier(base_crit_multiplier, crit_damage_mods)
	var r := roll if roll >= 0.0 else randf()
	if r > chance:
		return {"is_crit": false, "tier": Tier.NONE, "multiplier": 1.0}
	return {"is_crit": true, "tier": get_crit_tier(mult), "multiplier": mult}


static func calculate_stealth_headshot_bonus(is_stealth: bool, is_headshot: bool) -> float:
	var bonus := 1.0
	if is_stealth:
		bonus += 1.0
	if is_headshot:
		bonus += 1.0
	return bonus


# Crit and stealth/headshot are additive: base * (critMult + precisionBonus - 1)
static func apply_crit_and_precision(base_damage: float, crit_result: Dictionary, stealth_headshot_bonus: float = 1.0) -> float:
	if not crit_result.get("is_crit", false):
		return base_damage * stealth_headshot_bonus
	var total_mult: float = crit_result.multiplier + stealth_headshot_bonus - 1.0
	return base_damage * total_mult
