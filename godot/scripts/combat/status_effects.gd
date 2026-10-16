class_name StatusEffects
extends RefCounted

# Status procs, port of src/combat/status_effects.js (Warframe Damage 3.0).
# Each config is a Dictionary with the same keys as the JS. Behaviour lives in the callers;
# this file holds the numbers, the proc chance, the proc picker, and stacking.

const SLASH := "slash"
const IMPACT := "impact"
const PUNCTURE := "puncture"
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

const CONFIGS := {
	"slash": {
		"name": "Bleed", "icon": "slash", "color": "#cc2a28",
		"dealsDamage": true, "bypassesArmor": true, "bypassesShields": false,
		"maxStacks": 999, "baseDuration": 6, "startDelay": 1, "tickInterval": 1,
		"tickDamageRatio": 0.35, "stackBehavior": "independent",
	},
	"heat": {
		"name": "Ignite", "icon": "heat", "color": "#ff6600",
		"dealsDamage": true, "bypassesArmor": false, "bypassesShields": false,
		"maxStacks": 999, "baseDuration": 6, "startDelay": 1, "tickInterval": 1,
		"tickDamageRatio": 0.5, "maxArmorStrip": 0.5, "armorStripTime": 2,
		"panicDuration": 4, "stackBehavior": "refresh",
	},
	"toxin": {
		"name": "Poison", "icon": "toxin", "color": "#00ff00",
		"dealsDamage": true, "bypassesArmor": false, "bypassesShields": true,
		"maxStacks": 999, "baseDuration": 6, "startDelay": 1, "tickInterval": 1,
		"tickDamageRatio": 0.5, "stackBehavior": "independent",
	},
	"electricity": {
		"name": "Tesla", "icon": "electricity", "color": "#00ffff",
		"dealsDamage": true, "bypassesArmor": false, "bypassesShields": false,
		"maxStacks": 999, "baseDuration": 6, "tickInterval": 1, "tickDamageRatio": 0.5,
		"chainRadius": 3, "stunDuration": 3, "stackBehavior": "independent",
	},
	"cold": {
		"name": "Freeze", "icon": "cold", "color": "#4da6ff",
		"dealsDamage": false, "bypassesArmor": false, "bypassesShields": false,
		"maxStacks": 10, "baseDuration": 6, "firstStackSlow": 0.5, "slowPerStack": 0.05,
		"maxSlow": 0.9, "firstStackCritMult": 0.1, "critMultPerStack": 0.05,
		"maxCritMult": 0.5, "freezeThreshold": 10, "freezeDuration": 3, "stackBehavior": "stack",
	},
	"corrosive": {
		"name": "Corrosion", "icon": "corrosive", "color": "#80ff00",
		"dealsDamage": false, "bypassesArmor": false, "bypassesShields": false,
		"maxStacks": 10, "baseDuration": 8, "armorReductionPerStack": 0.26,
		"maxArmorReduction": 0.8, "stackBehavior": "stack",
	},
	"viral": {
		"name": "Viral", "icon": "viral", "color": "#cc66ff",
		"dealsDamage": false, "bypassesArmor": false, "bypassesShields": false,
		"maxStacks": 10, "baseDuration": 6, "firstStackVulnerability": 1.0,
		"damageVulnerabilityPerStack": 0.25, "maxDamageVulnerability": 3.25, "stackBehavior": "stack",
	},
	"magnetic": {
		"name": "Magnetic", "icon": "magnetic", "color": "#6600ff",
		"dealsDamage": false, "bypassesArmor": false, "bypassesShields": false,
		"maxStacks": 10, "baseDuration": 6, "firstStackVulnerability": 1.0,
		"shieldVulnerabilityPerStack": 0.25, "maxShieldVulnerability": 3.25,
		"preventsShieldRegen": true, "stackBehavior": "stack",
	},
	"gas": {
		"name": "Gas", "icon": "gas", "color": "#80ff80",
		"dealsDamage": true, "bypassesArmor": false, "bypassesShields": false,
		"maxStacks": 10, "baseDuration": 6, "tickInterval": 1, "tickDamageRatio": 0.5,
		"cloudRadius": 3, "maxCloudRadius": 6, "stackBehavior": "independent",
	},
	"radiation": {
		"name": "Radiation", "icon": "radiation", "color": "#ffcc00",
		"dealsDamage": false, "bypassesArmor": false, "bypassesShields": false,
		"maxStacks": 10, "baseDuration": 12, "firstStackAllyDamage": 1.0,
		"allyDamagePerStack": 0.5, "maxAllyDamage": 5.5, "stackBehavior": "stack",
	},
	"blast": {
		"name": "Blast", "icon": "blast", "color": "#ff8800",
		"dealsDamage": true, "bypassesArmor": false, "bypassesShields": false,
		"maxStacks": 10, "baseDuration": 1.5, "detonationRatio": 0.3, "burstRatio": 3.0,
		"burstRadius": 5, "stackBehavior": "independent",
	},
	"impact": {
		"name": "Impact", "icon": "impact", "color": "#ffffff",
		"dealsDamage": false, "bypassesArmor": false, "bypassesShields": false,
		"maxStacks": 5, "baseDuration": 6, "staggerDuration": 1,
		"mercyThresholdPerStack": 0.08, "stackBehavior": "stack",
	},
	"puncture": {
		"name": "Puncture", "icon": "puncture", "color": "#ffff00",
		"dealsDamage": false, "bypassesArmor": false, "bypassesShields": false,
		"maxStacks": 5, "baseDuration": 6, "firstStackDamageReduction": 0.4,
		"damageReductionPerStack": 0.1, "maxDamageReduction": 0.8,
		"critChancePerStack": 0.05, "stackBehavior": "stack",
	},
	"void": {
		"name": "Void", "icon": "void", "color": "#ff00ff",
		"dealsDamage": false, "bypassesArmor": false, "bypassesShields": false,
		"maxStacks": 10, "baseDuration": 6, "bulletAttractorRadius": 3,
		"disarmChance": 0.1, "stackBehavior": "refresh",
	},
}

# Damage type to the status it can proc. Names are identical in this port, so this is an identity map
# for every type that has a config, and the table is kept only to mirror the JS mapping.
const DAMAGE_TO_STATUS := {
	"slash": SLASH, "impact": IMPACT, "puncture": PUNCTURE,
	"heat": HEAT, "cold": COLD, "electricity": ELECTRICITY, "toxin": TOXIN,
	"blast": BLAST, "corrosive": CORROSIVE, "gas": GAS, "magnetic": MAGNETIC,
	"radiation": RADIATION, "viral": VIRAL,
}


# Per-projectile chance of at least one proc across a multishot. baseChance and mods are fractions.
static func calculate_status_chance(base_status_chance: float, status_chance_mods: float = 0.0, multishot: int = 1) -> float:
	var final_chance := base_status_chance * (1.0 + status_chance_mods)
	return 1.0 - pow(1.0 - minf(1.0, final_chance), multishot)


# Picks a status from raw damage weights, e.g. {"slash": 100, "heat": 50}. roll is 0..1 for tests.
static func pick_status_proc(damage_weights: Dictionary, roll: float = -1.0) -> Variant:
	var total := 0.0
	for weight in damage_weights.values():
		total += float(weight)
	if total <= 0.0:
		return null
	var r := roll if roll >= 0.0 else randf()
	var target := r * total
	var accum := 0.0
	for dmg_type in damage_weights:
		var weight := float(damage_weights[dmg_type])
		if weight <= 0.0:
			continue
		accum += weight
		if target <= accum:
			return DAMAGE_TO_STATUS.get(dmg_type, null)
	return null


static func create_status_effect(status_type: String, source_damage: float, source_level: int = 1) -> Dictionary:
	if not CONFIGS.has(status_type):
		return {}
	var config: Dictionary = CONFIGS[status_type]
	var effect := {
		"type": status_type,
		"config": config,
		"sourceDamage": source_damage,
		"sourceLevel": source_level,
		"stacks": 1,
		"remainingTime": float(config.baseDuration),
		"tickTimer": 0.0,
		"armorStripped": 0.0,
	}
	# DoT procs also carry the fields StatusManager.update() ticks with (the JS left these out)
	if config.get("dealsDamage", false) and config.has("tickInterval"):
		effect["interval"] = float(config.tickInterval)
		effect["timer"] = 0.0
		effect["tickDamage"] = source_damage * float(config.tickDamageRatio)
		effect["remaining"] = roundi(float(config.baseDuration) / float(config.tickInterval))
	return effect


# Applies an effect to a StatusManager, honouring the config's stacking rule.
static func apply_status_effect(target: StatusManager, effect: Dictionary) -> void:
	var existing := target.get_effect(effect.type)
	var config: Dictionary = effect.config
	if existing.is_empty():
		target.add_effect(effect)
		return
	match config.stackBehavior:
		"stack":
			existing.stacks = mini(existing.stacks + 1, config.maxStacks)
			existing.remainingTime = float(config.baseDuration)
		"refresh":
			existing.remainingTime = float(config.baseDuration)
		"independent":
			target.add_effect(effect.duplicate())
