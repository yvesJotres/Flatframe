class_name HealthComponent
extends RefCounted

# HP, shields, armor and shield gating. Port of src/combat/health.js.
# A hit is either a plain number (total damage) or a Dictionary with optional keys:
#   total, toxin, magnetic, trueDamage (bool)

const SHIELD_DR_PLAYER := 0.5
const MAGNETIC_BONUS_PER_STACK := 1.0
const MAGNETIC_MAX_BONUS := 3.25
const MAGNETIC_MAX_STACKS := 10
const MAGNETIC_DURATION := 6.0   # seconds per stack, same value as the JS (not yet checked on the wiki)

var max_hp: float
var hp: float
var max_shield: float
var shield: float
var base_armor: float
var current_armor: float
var is_player: bool

var shield_gate_timer := 0.0
var max_shield_since_last_gate: float
var shield_gate_invulnerable := false
var shield_gate_multiplier := 1.0
var fixed_gate_duration = null   # float, or null when not overridden
var is_hildryn := false

var magnetic_timer := 0.0
var magnetic_stacks: Array = []


func _init(stats: Dictionary = {}, player: bool = false) -> void:
	max_hp = float(stats.get("maxHp", 100.0))
	hp = max_hp
	max_shield = float(stats.get("maxShield", 0.0))
	shield = max_shield
	base_armor = float(stats.get("armor", 0.0))
	current_armor = base_armor
	is_player = player
	max_shield_since_last_gate = max_shield


func magnetic_shield_bonus() -> float:
	return minf(MAGNETIC_MAX_BONUS, magnetic_stacks.size() * MAGNETIC_BONUS_PER_STACK)


func calculate_gate_duration(max_sh: float) -> float:
	if fixed_gate_duration != null:
		return float(fixed_gate_duration)
	if is_hildryn:
		return 3.5
	var base: float
	if max_sh < 53.0:
		base = max_sh / 180.0 + 1.0 / 3.0
	elif max_sh <= 1150.0:
		base = pow(max_sh / 350.0, 0.65) + 1.0 / 3.0
	else:
		base = 2.5
	return base * shield_gate_multiplier


static func _field(hit: Variant, key: String, fallback: Variant) -> Variant:
	return hit.get(key, fallback) if hit is Dictionary else fallback


# Returns the health damage actually applied (0 when shields or the gate absorbed everything)
func take_damage(hit: Variant, mitigation: float = 0.0, is_weakspot: bool = false, bypass_gate: bool = false) -> float:
	var raw: float = float(hit) if not (hit is Dictionary) else float(hit.get("total", 0.0))
	var remaining := raw * (1.0 - mitigation)

	if shield_gate_timer > 0.0 and not bypass_gate:
		if is_player:
			return 0.0
		elif not is_weakspot:
			remaining *= 0.05

	var toxin_damage: float = _field(hit, "toxin", 0.0)
	if toxin_damage > 0.0:
		var to_health_toxin := DamageMath.reduce_damage(toxin_damage, current_armor, is_player)
		hp = maxf(0.0, hp - to_health_toxin)
		remaining -= toxin_damage

	var magnetic_damage: float = _field(hit, "magnetic", 0.0)
	if magnetic_damage > 0.0:
		magnetic_timer = MAGNETIC_DURATION
		if magnetic_stacks.size() < MAGNETIC_MAX_STACKS:
			magnetic_stacks.append(MAGNETIC_DURATION)

	var shield_dr := 0.0
	if is_player and shield > 0.0:
		shield_dr = SHIELD_DR_PLAYER

	var shield_multiplier := (1.0 - shield_dr) * (1.0 + magnetic_shield_bonus())
	var effective_remaining := remaining * shield_multiplier
	var absorbed := minf(shield, effective_remaining)
	shield -= absorbed
	remaining -= absorbed / shield_multiplier

	if absorbed > 0.0 and shield <= 0.0:
		if is_player:
			shield_gate_timer = calculate_gate_duration(max_shield_since_last_gate)
			shield_gate_invulnerable = true
		elif not is_weakspot:
			shield_gate_timer = 0.1
		shield = 0.0
		return 0.0

	var true_damage: bool = _field(hit, "trueDamage", false) == true
	var to_health := 0.0
	if remaining > 0.0:
		to_health = remaining if true_damage else DamageMath.reduce_damage(remaining, current_armor, is_player)
	hp = maxf(0.0, hp - to_health)
	return to_health


func update(dt: float) -> void:
	if shield_gate_timer > 0.0:
		shield_gate_timer = maxf(0.0, shield_gate_timer - dt)
		if shield_gate_timer <= 0.0:
			shield_gate_invulnerable = false
			max_shield_since_last_gate = 0.0

	if magnetic_timer > 0.0:
		magnetic_timer = maxf(0.0, magnetic_timer - dt)
	var kept: Array = []
	for t in magnetic_stacks:
		var left: float = t - dt
		if left > 0.0:
			kept.append(left)
	magnetic_stacks = kept


func can_regenerate_shield() -> bool:
	return magnetic_timer <= 0.0 and not shield_gate_invulnerable


func restore_shield(amount: float) -> void:
	if magnetic_timer > 0.0:
		return
	shield = minf(max_shield, shield + amount)
	if shield > max_shield_since_last_gate:
		max_shield_since_last_gate = shield
	if shield_gate_invulnerable:
		shield_gate_timer = 0.0
		shield_gate_invulnerable = false


func has_armor() -> bool:
	return current_armor > 0.0


func is_dead() -> bool:
	return hp <= 0.0


func is_invulnerable() -> bool:
	return shield_gate_timer > 0.0 or shield_gate_invulnerable
