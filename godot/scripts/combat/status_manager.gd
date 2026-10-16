class_name StatusManager
extends RefCounted

# Damage-over-time effects, port of src/combat/status_manager.js.
# An effect is a Dictionary: {remaining, interval, timer, tickDamage, config: {bypassesArmor, bypassesShields}}.
# Only Slash (bleed) is ported so far; the other procs come with status_effects.gd.

const SLASH_BASE_DURATION := 6.0
const SLASH_TICK_INTERVAL := 1.0
const SLASH_TICK_DAMAGE_RATIO := 0.35

var effects: Array = []


func add_effect(effect: Dictionary) -> void:
	effects.append(effect)


# First active effect of this status type, or an empty Dictionary. Used by StatusEffects.apply_status_effect.
func get_effect(status_type: String) -> Dictionary:
	for effect in effects:
		if effect.get("type", "") == status_type:
			return effect
	return {}


# Bleed: 35% of the hit's total damage per second for 6 s, true damage, does not hit shields
static func make_slash(total_damage: float) -> Dictionary:
	return {
		"remaining": roundi(SLASH_BASE_DURATION / SLASH_TICK_INTERVAL),
		"interval": SLASH_TICK_INTERVAL,
		"timer": 0.0,
		"tickDamage": total_damage * SLASH_TICK_DAMAGE_RATIO,
		"config": {"bypassesArmor": true, "bypassesShields": false},
	}


func update(dt: float, health: HealthComponent) -> void:
	for i in range(effects.size() - 1, -1, -1):
		var effect: Dictionary = effects[i]
		effect.timer += dt
		if effect.timer < effect.interval:
			continue
		effect.timer -= effect.interval
		effect.remaining -= 1

		if health.shield > 0.0 and not effect.config.bypassesShields:
			health.shield = maxf(0.0, health.shield - effect.tickDamage)
		elif effect.config.bypassesArmor:
			health.hp = maxf(0.0, health.hp - effect.tickDamage)
		else:
			var dmg := DamageMath.reduce_damage(effect.tickDamage, health.current_armor, health.is_player)
			health.hp = maxf(0.0, health.hp - dmg)

		if effect.remaining <= 0 or health.is_dead():
			effects.remove_at(i)
