class_name Scaling
extends RefCounted

# Enemy level scaling, port of src/combat/scaling.js.
# Dual-curve: f1 for levels up to 70, f2 from 80, smoothstep between them.
# Values are transcribed from the wiki pages noted in the JS source.

const BASE_LEVEL := 1
const TRANSITION_START := 70
const TRANSITION_END := 80
const ARMOR_MIN := 200.0
const ARMOR_MAX := 2700.0


static func c(coeff: float, exponent: float) -> Dictionary:
	return {"coeff": coeff, "exponent": exponent}


const ARMOR_F1 := {"coeff": 0.005, "exponent": 1.75}
const ARMOR_F2 := {"coeff": 0.4, "exponent": 0.75}

const HP_GRINEER := {"f1": {"coeff": 0.015, "exponent": 2.12}, "f2": {"coeff": 10.7332, "exponent": 0.72}}
const HP_MISC := {"f1": {"coeff": 0.015, "exponent": 2.0}, "f2": {"coeff": 10.7332, "exponent": 0.5}}
const SH_GRINEER := {"f1": {"coeff": 0.02, "exponent": 1.75}, "f2": {"coeff": 1.6, "exponent": 0.75}}

const FACTION_SCALING := {
	"grineer": {"hp": HP_GRINEER, "shield": SH_GRINEER},
	"scaldra": {"hp": HP_GRINEER, "shield": SH_GRINEER},
	"corpus": {
		"hp": {"f1": {"coeff": 0.015, "exponent": 2.12}, "f2": {"coeff": 13.4165, "exponent": 0.55}},
		"shield": {"f1": {"coeff": 0.02, "exponent": 1.76}, "f2": {"coeff": 2.0, "exponent": 0.76}},
	},
	"infested": {
		"hp": {"f1": {"coeff": 0.0225, "exponent": 2.12}, "f2": {"coeff": 16.0998, "exponent": 0.72}},
		"shield": SH_GRINEER,
	},
	"corrupted": {
		"hp": {"f1": {"coeff": 0.015, "exponent": 2.1}, "f2": {"coeff": 10.7332, "exponent": 0.685}},
		"shield": {"f1": {"coeff": 0.02, "exponent": 1.75}, "f2": {"coeff": 2.0, "exponent": 0.75}},
	},
	"murmur": {"hp": HP_MISC, "shield": SH_GRINEER},
	"sentient": {"hp": HP_MISC, "shield": SH_GRINEER},
	"anarchs": {"hp": HP_MISC, "shield": SH_GRINEER},
	"unaffiliated": {"hp": HP_MISC, "shield": SH_GRINEER},
	"techrot": {
		"hp": {"f1": {"coeff": 0.02, "exponent": 2.12}, "f2": {"coeff": 15.0998, "exponent": 0.7}},
		"shield": {"f1": {"coeff": 0.02, "exponent": 1.76}, "f2": {"coeff": 3.5, "exponent": 0.76}},
	},
}


static func _curve(base_value: float, level: float, coeff: float, exponent: float) -> float:
	if level <= BASE_LEVEL:
		return base_value
	return base_value * (1.0 + coeff * pow(level - BASE_LEVEL, exponent))


static func _smoothstep(t: float) -> float:
	return t * t * (3.0 - 2.0 * t)


# round_down: the armor path uses Math.floor in the JS, everything else Math.round
static func _apply_round(value: float, round_down: bool) -> float:
	return floor(value) if round_down else round(value)


static func _dual_curve(base_value: float, level: float, f1: Dictionary, f2: Dictionary, round_down: bool) -> float:
	var v1 := _curve(base_value, level, f1.coeff, f1.exponent)
	var position := level - BASE_LEVEL
	if position <= TRANSITION_START:
		return _apply_round(v1, round_down)
	var v2 := _curve(base_value, level, f2.coeff, f2.exponent)
	if position >= TRANSITION_END:
		return _apply_round(v2, round_down)
	var t := (position - TRANSITION_START) / float(TRANSITION_END - TRANSITION_START)
	var s := _smoothstep(t)
	return _apply_round(v1 * (1.0 - s) + v2 * s, round_down)


static func scale_stat(base_value: float, level: float, f1: Dictionary, f2: Dictionary, round_down: bool = false) -> float:
	return _dual_curve(base_value, level, f1, f2, round_down)


static func scale_stat_by_faction(base_value: float, level: float, stat_type: String, faction: String) -> float:
	if stat_type == "armor":
		if base_value <= 0.0:
			return 0.0
		var armor := scale_stat(base_value, level, ARMOR_F1, ARMOR_F2, true)
		return minf(ARMOR_MAX, maxf(ARMOR_MIN, armor))
	var table: Dictionary = FACTION_SCALING.get(faction, FACTION_SCALING["grineer"])
	var params: Dictionary = table.get(stat_type, FACTION_SCALING["grineer"][stat_type])
	return scale_stat(base_value, level, params.f1, params.f2)
