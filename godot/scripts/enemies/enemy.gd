class_name Enemy
extends Node2D

# Crewman-style grunt. Port of the alert state machine in src/enemies/enemy.js (unalerted, cautious, alerted), with
# the vision cone, hearing, and alerting nearby enemies. Status effects (src/combat/status_effects.js) work on it.
# Cover, ranged attacks and the faction variants are the rest of Phase 4.

signal died(enemy)

const RADIUS := 14.0
const SPEED := 70.0
const MAX_HP := 60.0
const SIGHT_RANGE := 25.0 * 15.0        # 25 m (SIGHT_RANGE_M in enemy.js)
const VISION_ARC := TAU * 2.0 / 3.0     # 120° cone
const TURN_RATE := 4.0                  # radians per second
const CONTACT_DPS := 10.0
const BLAST_BURST_RADIUS := 75.0        # 5 m (status_effects.js burstRadius)
const ALERT_RANGE := 20.0 * 15.0        # 20 m communication range between enemies

var max_hp := MAX_HP           # per-unit health (set by faction subclasses, scaled through Scaling)
var level := 1                 # enemy level: the browser spawner uses 1 + kills / 8 in Exterminate
var enemy_name := "Enemy"       # the browser name, for Affinity (progression.js ENEMY_BASE_AFFINITY)
var hp := MAX_HP
var armor := 0.0               # reduces incoming damage by the enemy armour formula (DamageMath.reduce_damage)
var aim_spread := 0.0          # half-angle of the random spread on each round, in radians
var bullet_damage := BULLET_DAMAGE
var status := StatusManager.new()
var flash := 0.0
var dead := false
var target: Player = null
var bounds := Vector2(1600, 1200)
var blocked: Callable   # set by the mission: true when a circle at a point touches a wall
var stagger := 0.0      # seconds the enemy cannot move (impact)
var nav: AStarGrid2D = null   # the mission's grid pathfinding (walls are solid cells)
var path_points: Array = []   # waypoints to the goal, in world coordinates
const TILE := 96.0
var fire_rate := 20.0          # rounds per second (Grakata fireRate; the Sobek fires 2.5)
var pellets := 1               # rounds per shot (the Sobek fires 5 pellets)
const BULLET_DAMAGE := 11.0    # Grakata damage total
var engage_range := 25.0 * 15.0   # burst range in px (25 m; the Sobek stops firing at 30 m)
var burst_left := 0            # rounds left in the current burst
var burst_timer := 0.5         # seconds until the next burst
var shot_timer := 0.0          # seconds until the next round in a burst
var cover_goal := Vector2.INF  # the cover spot for the current pause (INF when none)
var at_cover := false          # true while the enemy stands at its cover spot
const BLIND_AIM := 0.1         # blind-fire spread, radians (about 6°; the browser widens the weapon's max spread)
const BLIND_CHANCE := 0.35     # share of bursts fired blind from cover (lancer.js BLIND_CHANCE)
var room_rect := Rect2()       # the room the enemy is spawned in (its patrol stays here)
var patrol_points: Array = []  # the loop of waypoints (empty until made, then [] again if none can be made)
var patrol_index := 0
var patrol_pause := 0.0
var patrol_look := 0.0
var patrol_heading := 0.0
var patrol_made := false

# Alert state: "unalerted" | "cautious" | "alerted" (enemy.js alertState)
var alert := "unalerted"
var alert_timer := 0.0
var facing := 0.0
var patrol_angle := 0.0
var patrol_timer := 0.0
var sound_source := Vector2.ZERO
var has_sound := false
var last_seen := Vector2.ZERO
var alerted := false    # true once the enemy is not unalerted (kept for the stealth check)
var knocked_seconds := 0.0   # time left on the ground (combat/stealth.js KNOCKDOWN_SECONDS = 8)

const KNOCKDOWN_SECONDS := 8.0


# Knocks the enemy down: it lies still for a while and can be finished with a ground finisher
func knock_down(seconds: float = KNOCKDOWN_SECONDS) -> void:
	knocked_seconds = seconds


func is_downed() -> bool:
	return knocked_seconds > 0.0


func _ready() -> void:
	add_to_group("enemies")
	patrol_angle = randf() * TAU
	facing = patrol_angle


func _process(delta: float) -> void:
	if not dead:
		_tick_status(delta)
	if dead or target == null:
		return
	# Knocked down: lying on the ground, with no movement or attacks until it gets up (enemy.js)
	if knocked_seconds > 0.0:
		knocked_seconds = maxf(0.0, knocked_seconds - delta)
		queue_redraw()
		return
	var sees := sees_target()
	if sees:
		last_seen = target.global_position
	_update_alert_timer(delta, sees)
	match alert:
		"unalerted":
			_patrol(delta)
			if sees:
				transition_alerted()
		"cautious":
			if has_sound:
				_move_toward_angle(delta, (sound_source - position).angle(), 0.7)
			if sees:
				transition_alerted()
		"alerted":
			if sees:
				_engage(delta)
				alert_nearby()
			else:
				_follow_path(delta, last_seen, 0.7)
	var to_target := target.global_position - global_position
	if to_target.length() <= RADIUS + Player.RADIUS:
		target.take_damage(CONTACT_DPS * _damage_out_factor() * delta)
	queue_redraw()


# What an alerted enemy does while it sees the Warframe. Grunts burst fire up close and chase when far.
# Faction subclasses override this with their own tactics.
func _engage(delta: float) -> void:
	if position.distance_to(target.global_position) <= engage_range:
		_burst(delta)
	else:
		_chase(delta)


# Whether the Warframe is within the vision cone and sight range, with no wall in the way (enemy.js isInVisionCone)
func sees_target() -> bool:
	var to_target := target.global_position - position
	var dist := to_target.length()
	if dist > SIGHT_RANGE + target.RADIUS:
		return false
	if dist > 0.0:
		var diff := wrapf(to_target.angle() - facing, -PI, PI)
		if absf(diff) > VISION_ARC / 2.0:
			return false
	return _line_clear(position, target.global_position)


# A straight line of sight: no wall cell along it
func _line_clear(a: Vector2, b: Vector2) -> bool:
	if not blocked.is_valid():
		return true
	var steps := maxi(1, int(a.distance_to(b) / 8.0))
	for i in range(1, steps):
		var p := a.lerp(b, float(i) / steps)
		if blocked.call(p, 1.0):
			return false
	return true


# Alert timers: cautious lasts 20–30 s, alerted 60 s, and the timer runs out three times faster when the enemy
# cannot see its target
func _update_alert_timer(delta: float, sees: bool) -> void:
	if alert_timer > 0.0:
		alert_timer = maxf(0.0, alert_timer - delta * (1.0 if sees else 3.0))
	if alert == "cautious" and alert_timer <= 0.0:
		alert = "unalerted"
		alerted = false
	elif alert == "alerted" and alert_timer <= 0.0:
		alert = "cautious"
		alert_timer = 30.0


# A shot the enemy can hear (same room). Unalerted enemies turn cautious and search there.
func hear_noise(source: Vector2) -> void:
	if dead:
		return
	if alert == "unalerted":
		transition_cautious(source)
	else:
		sound_source = source
		has_sound = true


func transition_cautious(source: Vector2 = Vector2.ZERO, has_source: bool = false) -> void:
	if alert != "unalerted":
		return
	alert = "cautious"
	alerted = true
	alert_timer = randf_range(20.0, 30.0)
	if has_source:
		sound_source = source
		has_sound = true


func transition_alerted() -> void:
	if alert == "alerted":
		return
	alert = "alerted"
	alerted = true
	alert_timer = 60.0
	last_seen = target.global_position


# An alerted enemy that sees the Warframe makes nearby unalerted enemies cautious, pointing them at this enemy
func alert_nearby() -> void:
	for other in get_tree().get_nodes_in_group("enemies"):
		if other == self or other.dead:
			continue
		if other.position.distance_to(position) < ALERT_RANGE and other.alert == "unalerted":
			other.transition_cautious(position, true)


# Unalerted: walk a loop of three waypoints inside the room (patrol.js). It pauses at each waypoint, looking around.
func _patrol(delta: float) -> void:
	if not patrol_made:
		patrol_made = true
		patrol_points = _make_loop()
	if patrol_points.size() < 2:
		# No loop could be made (a room with too little open floor): wander, as before
		patrol_timer -= delta
		if patrol_timer <= 0.0:
			patrol_timer = randf_range(3.0, 7.0)
			patrol_angle += (randf() - 0.5) * PI
		_move_toward_angle(delta, patrol_angle, 0.5)
		return
	if patrol_pause > 0.0:
		patrol_pause -= delta
		patrol_look += delta
		facing = patrol_heading + sin(patrol_look * 1.2) * (PI / 3.0)
		return
	var goal: Vector2 = patrol_points[patrol_index]
	if position.distance_to(goal) < 20.0:
		patrol_index = (patrol_index + 1) % patrol_points.size()
		patrol_pause = randf_range(2.0, 4.0)
		patrol_look = 0.0
		patrol_heading = facing
		path_points.clear()
		return
	_follow_path(delta, goal, 0.5)

# Three walkable points in the room, at least 10 m apart from each other. Empty when there are fewer than two.
func _make_loop() -> Array:
	if nav == null or room_rect.size == Vector2.ZERO:
		return []
	var points: Array = []
	for tries in range(80):
		if points.size() >= 3:
			break
		var p := Vector2(randf_range(room_rect.position.x, room_rect.end.x), randf_range(room_rect.position.y, room_rect.end.y))
		var cell := Vector2i(floori(p.x / TILE), floori(p.y / TILE))
		if not nav.is_in_boundsv(cell) or nav.is_point_solid(cell):
			continue
		var centre := Vector2(cell) * TILE + Vector2(TILE, TILE) / 2.0
		if not points.is_empty() and centre.distance_to(points.back()) < 150.0:
			continue
		points.append(centre)
	return points if points.size() >= 2 else []


func _chase(delta: float) -> void:
	var to_target := target.global_position - global_position
	if to_target.length() <= RADIUS + 16.0:
		return
	if _line_clear(position, target.global_position):
		path_points.clear()
		_move_toward_angle(delta, to_target.angle(), 1.0)
	else:
		_follow_path(delta, target.global_position, 1.0)

# Burst fire: 4 to 7 rounds at the fire rate, then a pause of 0.6 to 1.4 s before the next burst
func _burst(delta: float) -> void:
	facing = (target.global_position - position).angle()
	if burst_left > 0:
		cover_goal = Vector2.INF
		shot_timer -= delta
		while shot_timer <= 0.0 and burst_left > 0:
			_fire()
			burst_left -= 1
			shot_timer += 1.0 / fire_rate
		if burst_left == 0:
			burst_timer = randf_range(0.6, 1.4)
	else:
		_seek_cover(delta)
		burst_timer -= delta
		if burst_timer <= 0.0:
			burst_left = randi_range(4, 7)
			shot_timer = 0.0
			# From cover, some bursts are fired blind (wider spread), as the browser's Lancer does
			aim_spread = BLIND_AIM if at_cover and randf() < BLIND_CHANCE else 0.0

# During the pause between bursts, move to a spot the Warframe cannot see (cover), if one is close
func _seek_cover(delta: float) -> void:
	if cover_goal == Vector2.INF:
		cover_goal = _find_cover()
	if cover_goal == Vector2.INF:
		at_cover = false
		return
	if position.distance_to(cover_goal) < 8.0:
		at_cover = true
		return
	at_cover = false
	_follow_path(delta, cover_goal, 0.8)

# A fallback spot with no cover: 3 to 8 m from the Warframe, off to one side of the line between them
# (enemy.js findFlankSpot). INF when that spot is inside a wall or off the map.
func _find_flank_spot(focus: Vector2) -> Vector2:
	if nav == null:
		return Vector2.INF
	var side := 1.0 if randf() < 0.5 else -1.0
	var base := (position - focus).angle() + side * (PI / 2.5)
	var dist := randf_range(3.0, 8.0) * 15.0
	var spot := focus + Vector2(cos(base), sin(base)) * dist
	var cell := Vector2i(floori(spot.x / TILE), floori(spot.y / TILE))
	if not nav.is_in_boundsv(cell) or nav.is_point_solid(cell):
		return Vector2.INF
	return spot


# The nearest cell within four tiles that is open, reachable, and out of the Warframe's line of sight. INF when none.
func _find_cover() -> Vector2:
	if nav == null or target == null:
		return Vector2.INF
	var here := Vector2i(floori(position.x / TILE), floori(position.y / TILE))
	for r in range(1, 5):
		for dy in range(-r, r + 1):
			for dx in range(-r, r + 1):
				if maxi(absi(dx), absi(dy)) != r:
					continue
				var cell := here + Vector2i(dx, dy)
				if not nav.is_in_boundsv(cell) or nav.is_point_solid(cell):
					continue
				var centre := Vector2(cell) * TILE + Vector2(TILE, TILE) / 2.0
				if _line_clear(centre, target.global_position):
					continue
				return centre
	return Vector2.INF

func _fire() -> void:
	# Each pellet is a full round at the shot's damage (multishot in the browser)
	for _pellet in range(pellets):
		var bullet := EnemyBullet.new()
		bullet.position = position
		var aim := (target.global_position - position).angle() + randf_range(-aim_spread, aim_spread)
		bullet.velocity = Vector2(cos(aim), sin(aim)) * EnemyBullet.SPEED
		bullet.damage = bullet_damage
		bullet.target = target
		bullet.blocked = blocked
		get_parent().add_child(bullet)

# Walks a route to the goal around the walls (grid A*). Without a route, it heads straight for the goal.
func _follow_path(delta: float, goal: Vector2, share: float) -> void:
	if nav == null:
		_move_toward_angle(delta, (goal - position).angle(), share)
		return
	if path_points.is_empty() or path_points.back().distance_to(goal) > TILE:
		path_points = _route_to(goal)
	if path_points.is_empty():
		_move_toward_angle(delta, (goal - position).angle(), share)
		return
	var next: Vector2 = path_points[0]
	if position.distance_to(next) < 6.0:
		path_points.pop_front()
		if path_points.is_empty():
			return
		next = path_points[0]
	_move_toward_angle(delta, (next - position).angle(), share)

# Route from here to the goal: cell centres, skipping the start cell
func _route_to(goal: Vector2) -> Array:
	var from_cell := Vector2i(floori(position.x / TILE), floori(position.y / TILE))
	var to_cell := Vector2i(floori(goal.x / TILE), floori(goal.y / TILE))
	if not nav.is_in_boundsv(from_cell) or not nav.is_in_boundsv(to_cell) or nav.is_point_solid(to_cell):
		return []
	var route: PackedVector2Array = nav.get_point_path(from_cell, to_cell)
	var out: Array = []
	for i in range(1, route.size()):
		out.append(route[i] + Vector2(TILE, TILE) / 2.0)
	return out


# Turns toward an angle at the turn rate, then moves forward at the given share of the speed
func _move_toward_angle(delta: float, angle: float, share: float) -> void:
	if stagger > 0.0:
		return
	facing = facing + clampf(wrapf(angle - facing, -PI, PI), -TURN_RATE * delta, TURN_RATE * delta)
	var step := Vector2(cos(facing), sin(facing)) * SPEED * share * _speed_factor() * delta
	if not blocked.is_valid() or not blocked.call(position + Vector2(step.x, 0.0), RADIUS):
		position.x += step.x
	if not blocked.is_valid() or not blocked.call(position + Vector2(0.0, step.y), RADIUS):
		position.y += step.y
	position = position.clamp(Vector2(RADIUS, RADIUS), bounds - Vector2(RADIUS, RADIUS))


# Movement is slowed by freeze (1 - slow)
func _speed_factor() -> float:
	return 1.0 - _effect_value("cold", "slow")


# Damage the enemy deals is reduced by puncture (weaken)
func _damage_out_factor() -> float:
	return 1.0 - _effect_value("puncture", "reduction")


# Damage the enemy takes is raised by viral (vulnerability), 1 + bonus
func damage_taken_factor() -> float:
	return 1.0 + _effect_value("viral", "bonus")


# The strength of a timed effect of one type, from its stacks. Zero when the enemy has none.
func _effect_value(type: String, what: String) -> float:
	var effect: Dictionary = status.get_effect(type)
	if effect.is_empty():
		return 0.0
	var stacks := int(effect.get("stacks", 1))
	match type:
		"cold":
			return minf(0.9, 0.5 + 0.05 * (stacks - 1))   # firstStackSlow 0.5, +0.05 per stack, max 0.9
		"viral":
			return minf(3.25, 1.0 + 0.25 * (stacks - 1))  # firstStackVulnerability 1.0, +0.25, max 3.25
		"puncture":
			return minf(0.8, 0.4 + 0.1 * (stacks - 1))    # firstStackDamageReduction 0.4, +0.1, max 0.8
	return 0.0


# Damage-over-time effects tick on the enemy's health; timed effects count down and end
func _tick_status(delta: float) -> void:
	if stagger > 0.0:
		stagger = maxf(0.0, stagger - delta)
	if status.effects.is_empty():
		return
	var adapter := HealthComponent.new({"maxHp": max_hp, "maxShield": 0, "armor": 0}, false)
	adapter.hp = hp
	status.update(delta, adapter)
	if adapter.hp < hp:
		flash = 0.1
	hp = adapter.hp
	var i := status.effects.size() - 1
	while i >= 0:
		var effect: Dictionary = status.effects[i]
		if not effect.has("interval"):
			effect.remainingTime = float(effect.get("remainingTime", 0.0)) - delta
			if effect.remainingTime <= 0.0:
				_end_timed(effect)
				status.effects.remove_at(i)
		i -= 1
	if hp <= 0.0 and not dead:
		take_damage(0.0)


# A timed effect ends. Blast detonates: 30% of the source damage to itself at the end.
func _end_timed(effect: Dictionary) -> void:
	if effect.type == "blast":
		hp -= 0.3 * float(effect.get("sourceDamage", 0.0))
		flash = 0.1


# A shot that proc'd a status (weights are the shot's damage by type). Damage-over-time and timed statuses apply.
func apply_proc(weights: Dictionary, damage: float) -> void:
	var type = StatusEffects.pick_status_proc(weights)
	if type == null:
		return
	var effect := StatusEffects.create_status_effect(str(type), damage)
	if effect.is_empty():
		return
	if type == "impact":
		stagger = 1.0
		return
	if type == "void":
		return   # disarm: nothing to disarm yet
	StatusEffects.apply_status_effect(status, effect)


func take_damage(amount: float, true_damage: bool = false) -> void:
	if dead:
		return
	# True damage (ground finishers, combat/stealth.js) ignores armour
	var dealt := amount * damage_taken_factor()
	hp -= dealt if true_damage else DamageMath.reduce_damage(dealt, armor, false)
	queue_redraw()
	if hp <= 0.0:
		dead = true
		remove_from_group("enemies")
		_blast_burst()
		died.emit(self)
		queue_free()


# A blast that is still active bursts when the enemy dies: 300% of its source damage within 5 m
func _blast_burst() -> void:
	for e in status.effects:
		if e.type == "blast":
			var burst := 3.0 * float(e.get("sourceDamage", 0.0))
			for other in get_tree().get_nodes_in_group("enemies"):
				if other != self and other.position.distance_to(position) <= BLAST_BURST_RADIUS:
					other.take_damage(burst)


func _draw() -> void:
	# Corpus colour from src/assets/colors.js (COLORS.CORPUS); health bar in the same style as the HUD
	var frac := clampf(hp / max_hp, 0.0, 1.0)
	draw_circle(Vector2.ZERO, RADIUS, Color("#3a8fce"))
	draw_rect(Rect2(-RADIUS, -RADIUS - 8.0, RADIUS * 2.0, 4.0), Color(0.0, 0.0, 0.0, 0.5))
	draw_rect(Rect2(-RADIUS, -RADIUS - 8.0, RADIUS * 2.0 * frac, 4.0), Color("#cc2a28"))
