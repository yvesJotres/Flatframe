class_name DamageTypes
extends RefCounted

# Port of src/combat/damage_types.js (Warframe Damage 3.0).
# Faction tables only list non-neutral entries; anything missing is x1.0.

const IMPACT := "impact"
const PUNCTURE := "puncture"
const SLASH := "slash"
const HEAT := "heat"
const COLD := "cold"
const ELECTRICITY := "electricity"
const TOXIN := "toxin"
const BLAST := "blast"
const CORROSIVE := "corrosive"
const GAS := "gas"
const MAGNETIC := "magnetic"
const RADIATION := "radiation"
const VIRAL := "viral"
const VOID := "void"
const TAU := "tau"
const TRUE := "true"

const VULNERABLE := 1.5
const RESISTANT := 0.5

const FACTION_MODIFIERS := {
	"grineer": {"impact": VULNERABLE, "corrosive": VULNERABLE},
	"kuva_grineer": {"impact": VULNERABLE, "corrosive": VULNERABLE, "heat": RESISTANT},
	"corpus": {"puncture": VULNERABLE, "magnetic": VULNERABLE},
	"corpus_amalgam": {"electricity": VULNERABLE, "magnetic": VULNERABLE, "blast": RESISTANT},
	"infested": {"slash": VULNERABLE, "heat": VULNERABLE},
	"infested_deimos": {"blast": VULNERABLE, "gas": VULNERABLE, "viral": RESISTANT},
	"orokin": {"puncture": VULNERABLE, "viral": VULNERABLE, "radiation": RESISTANT},
	"sentient": {"cold": VULNERABLE, "radiation": VULNERABLE, "corrosive": RESISTANT},
	"narmer": {"slash": VULNERABLE, "toxin": VULNERABLE, "magnetic": RESISTANT},
}

# Pairs of elements and the secondary element they form, in the same order as the JS.
const COMBINATIONS := [
	[HEAT, COLD, BLAST],
	[ELECTRICITY, TOXIN, CORROSIVE],
	[HEAT, TOXIN, GAS],
	[COLD, ELECTRICITY, MAGNETIC],
	[HEAT, ELECTRICITY, RADIATION],
	[COLD, TOXIN, VIRAL],
]


static func get_faction_multiplier(faction: String, damage_type: String) -> float:
	if not FACTION_MODIFIERS.has(faction):
		return 1.0
	return float(FACTION_MODIFIERS[faction].get(damage_type, 1.0))


static func combine_elements(types: Array) -> Array:
	var combined: Array = []
	for pair in COMBINATIONS:
		if types.has(pair[0]) and types.has(pair[1]):
			combined.append(pair[2])
	return combined
