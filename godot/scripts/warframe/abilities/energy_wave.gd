class_name EnergyWave
extends RefCounted

# The Exalted Blade's energy wave (wiki: Exalted Blade). Port of EnergyWave in excalibur_abilities.js.
# It flies at 30 m/s, 3 m wide, with the attack's damage. The damage falls off linearly from full at the blade to
# nothing at the wave's range. Each enemy it passes takes 20% off the rest and shortens its range by 15 m.
# A wave stops at walls. Placeholders: the 70 m range (the wiki's stat block; its text says 75 m) and the cooldown.

const SPEED := 30.0 * ExcaliburAbilities.UNITS_PER_METRE
const HALF_WIDTH := 1.5 * ExcaliburAbilities.UNITS_PER_METRE
const RANGE := 70.0 * ExcaliburAbilities.UNITS_PER_METRE
const HIT_LOSS := 0.2
const HIT_RANGE_LOSS := 15.0 * ExcaliburAbilities.UNITS_PER_METRE

var position := Vector2.ZERO
var direction := Vector2.RIGHT
var damage := 0.0
var travelled := 0.0
var max_distance := RANGE
var hits := 0
var struck: Array = []    # each enemy is passed once
var active := true


func _init(origin: Vector2, angle: float, total_damage: float) -> void:
	position = origin
	direction = Vector2.from_angle(angle)
	damage = total_damage


# Fraction of the damage left at the wave's current distance (100% at the blade, 0% at the range)
func falloff() -> float:
	return maxf(0.0, 1.0 - travelled / max_distance)


# Advances the wave by dt. blocked is the mission's wall test (point, radius) -> bool, or invalid for none.
func update(dt: float, enemies: Array, blocked: Callable) -> void:
	if not active:
		return
	var step := minf(SPEED * dt, max_distance - travelled)
	var start := position
	var end := position + direction * step
	if _hits_wall(start, end, blocked):
		active = false
		return
	for enemy in enemies:
		if not is_instance_valid(enemy) or enemy.dead or struck.has(enemy):
			continue
		var reach: float = HALF_WIDTH + enemy.RADIUS
		if ExcaliburAbilities.distance_to_segment(enemy.position, start, end) > reach:
			continue
		var dealt := damage * falloff() * pow(1.0 - HIT_LOSS, hits)
		enemy.take_damage(dealt)
		struck.append(enemy)
		hits += 1
		max_distance -= HIT_RANGE_LOSS
	position = end
	travelled += step
	if travelled >= max_distance:
		active = false


# The wall test samples the segment, since the port has no raycast. Steps of 4 units are finer than a wall tile edge.
func _hits_wall(a: Vector2, b: Vector2, blocked: Callable) -> bool:
	if not blocked.is_valid():
		return false
	var length := a.distance_to(b)
	var samples := maxi(1, ceili(length / 4.0))
	for i in range(1, samples + 1):
		if blocked.call(a.lerp(b, float(i) / samples), 0.0):
			return true
	return false
