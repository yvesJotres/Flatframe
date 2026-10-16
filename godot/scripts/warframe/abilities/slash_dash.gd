class_name SlashDash
extends RefCounted

# Excalibur's Slash Dash (ability 1). Port of SlashDash in excalibur_abilities.js. Wiki (rank 0):
#   - Initial target range 20 m: the dash locks onto an enemy in the aim direction within that range.
#   - Initial dash speed 36 m/s; locked-on dash speed 75 m/s.
#   - Chain range 7 m: after each strike the dash moves to the nearest enemy within 7 m.
#   - With no target, the dash goes straight for its range and damages enemies its path crosses.
# Each enemy is struck once per dash. Damage scales with the melee combo, so the base is a placeholder.

const ENERGY_COST := 25.0
const DAMAGE := 100.0          # base strike: the Exalted Blade's damage at rank 0 (wiki)
const COMBO_STEP := 0.25       # wiki: +25% damage per combo step
const COMBO_MAX := 2.75        # wiki: up to 2.75x damage
const RANGE := 20.0 * ExcaliburAbilities.UNITS_PER_METRE
const SPEED := 36.0 * ExcaliburAbilities.UNITS_PER_METRE
const LOCKED_SPEED := 75.0 * ExcaliburAbilities.UNITS_PER_METRE
const CHAIN_RANGE := 7.0 * ExcaliburAbilities.UNITS_PER_METRE
const AIM_CONE := PI / 3.0     # the initial target must be within 60 degrees of the aim

var active := false
var travelled := 0.0
var direction := Vector2.ZERO
var hit_enemies: Array = []
var target: Object = null
var searched := false


func can_activate(player: Object) -> bool:
	return not active and player.energy >= ENERGY_COST


func activate(player: Object, angle: float) -> bool:
	if not can_activate(player):
		return false
	player.energy -= ENERGY_COST
	active = true
	travelled = 0.0
	direction = Vector2.from_angle(angle)
	hit_enemies.clear()
	target = null
	searched = false
	return true


# Nearest enemy within max_dist (plus its radius) that has not been struck yet. With an aim, only inside the cone.
func nearest_target(player: Object, enemies: Array, max_dist: float, aim: Vector2 = Vector2.ZERO) -> Object:
	var best: Object = null
	var best_dist := INF
	for enemy in enemies:
		if not is_instance_valid(enemy) or enemy.dead or hit_enemies.has(enemy):
			continue
		var offset: Vector2 = enemy.position - player.position
		var dist := offset.length()
		if dist > max_dist + enemy.RADIUS:
			continue
		if aim != Vector2.ZERO and absf(wrapf(offset.angle() - aim.angle(), -PI, PI)) > AIM_CONE:
			continue
		if dist < best_dist:
			best_dist = dist
			best = enemy
	return best


# The strike's damage: the base, times the melee combo bonus (up to COMBO_MAX)
func strike_damage(player: Object) -> float:
	var tier: int = player.combo_multiplier()
	var bonus := minf(COMBO_MAX, 1.0 + COMBO_STEP * float(tier - 1))
	return DAMAGE * bonus


func strike(enemy: Object, player: Object) -> void:
	hit_enemies.append(enemy)
	enemy.take_damage(strike_damage(player))


func _is_wall(player: Object, point: Vector2) -> bool:
	return player.blocked.is_valid() and player.blocked.call(point, 0.0)


# Advances the dash by delta seconds
func update(delta: float, player: Object, enemies: Array) -> void:
	if not active:
		return
	if not searched:
		searched = true
		target = nearest_target(player, enemies, RANGE, direction)
	if target != null:
		_update_locked(delta, player, enemies)
		return
	_update_straight(delta, player, enemies)


func _update_locked(delta: float, player: Object, enemies: Array) -> void:
	if target.dead or hit_enemies.has(target):
		target = nearest_target(player, enemies, CHAIN_RANGE)
		if target == null:
			stop(player)
		return
	var offset: Vector2 = target.position - player.position
	var dist := offset.length()
	var reach: float = player.radius + target.RADIUS
	if dist <= reach:
		strike(target, player)
		target = nearest_target(player, enemies, CHAIN_RANGE)
		if target == null:
			stop(player)
		return
	var step := minf(LOCKED_SPEED * delta, dist - reach)
	direction = offset / dist
	if _is_wall(player, player.position + direction * step):
		stop(player)   # a wall is in the way: the dash cannot go through it
		return
	player.position += direction * step
	player.velocity = direction * LOCKED_SPEED


func _update_straight(delta: float, player: Object, enemies: Array) -> void:
	var step := minf(SPEED * delta, RANGE - travelled)
	var start: Vector2 = player.position
	var end := start + direction * step
	if _is_wall(player, end):
		stop(player)   # a wall is in the way: the dash cannot go through it
		return
	player.position = end
	travelled += step
	player.velocity = direction * SPEED
	for enemy in enemies:
		if not is_instance_valid(enemy) or enemy.dead or hit_enemies.has(enemy):
			continue
		var reach: float = player.radius + enemy.RADIUS
		if ExcaliburAbilities.distance_to_segment(enemy.position, start, end) > reach:
			continue
		strike(enemy, player)
	if travelled >= RANGE:
		stop(player)


func stop(player: Object) -> void:
	active = false
	target = null
	player.velocity = direction * Player.MOVE_SPEED
