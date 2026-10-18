class_name Projectile
extends RefCounted
## Port of java_build/src/weapons/projectile.js. A bullet or hitscan shot.
## Targets are objects with x, y, radius, and take_damage(hit, x, y). Props
## set is_breakable and touched_by(x0, y0, x1, y1, radius). Hit data is a
## Dictionary: total, impact, puncture, slash, heat, crit, status, plus
## isWeakspot and sourceX/Y added by the weapon.

var x := 0.0
var y := 0.0
var start_x := 0.0
var start_y := 0.0
var direction_x := 1.0
var direction_y := 0.0
var hit := {}
var damage := 0.0
var speed := 700.0
var max_distance := 2000.0
var distance_travelled := 0.0
var punch_through := 0
var active := true
var radius := 4.0
var is_hitscan := false
var targets = null  # Array of target objects, or null to use the default targets
var color := "#ffd166"
var hitscan_timer := 0.0
var hitscan_duration := 0.08  # seconds to show hitscan tracer


func _init(px: float, py: float, dir_x: float, dir_y: float, damage_or_hit, options: Dictionary = {}) -> void:
	x = px
	y = py
	start_x = x
	start_y = y

	var dir_len := Vector2(dir_x, dir_y).length()
	if dir_len == 0.0:
		dir_len = 1.0
	direction_x = dir_x / dir_len
	direction_y = dir_y / dir_len

	if damage_or_hit is Dictionary:
		hit = damage_or_hit
	else:
		hit = {
			"total": float(damage_or_hit),
			"impact": float(damage_or_hit),
			"puncture": 0.0,
			"slash": 0.0,
			"heat": 0.0,
			"crit": false,
			"status": null,
		}

	damage = hit["total"]
	speed = options.get("speed", 700.0)
	max_distance = options.get("maxDistance", 2000.0)
	punch_through = options.get("punchThrough", 0)
	radius = 5.0 if hit.get("crit", false) else 4.0
	is_hitscan = speed >= 10000.0
	targets = options.get("targets")
	color = options.get("color", "#fff3bf" if hit.get("crit", false) else "#ffd166")


static func _is_alive(target) -> bool:
	if target == null:
		return false
	var hp = target.get("hp")
	if typeof(hp) == TYPE_INT or typeof(hp) == TYPE_FLOAT:
		return hp > 0
	var alive = target.get("alive")
	if typeof(alive) == TYPE_BOOL:
		return alive
	return target.has_method("take_damage")


static func _radius_of(target) -> float:
	var r = target.get("radius")
	return 16.0 if r == null else float(r)


static func _is_breakable(target) -> bool:
	return bool(target.get("is_breakable"))


func _hit_with_weakspot(is_weakspot: bool) -> Dictionary:
	var copy := hit.duplicate()
	copy["isWeakspot"] = is_weakspot
	return copy


func update(dt: float, default_targets: Array = []) -> void:
	if not active:
		return

	# Hitscan tracer phase: the shot already landed (or ran out of range), only the fade remains.
	# Without this the shot would be tested against its target again next frame and deal damage twice.
	if is_hitscan and hitscan_timer > 0.0:
		hitscan_timer -= dt
		if hitscan_timer <= 0.0:
			active = false
		return

	var target_list: Array = targets if targets != null else default_targets
	var remaining := max_distance - distance_travelled
	var step_distance := minf(speed * dt, remaining)

	if step_distance <= 0.0:
		active = false
		return

	var move_x := direction_x * step_distance
	var move_y := direction_y * step_distance
	var next_x := x + move_x
	var next_y := y + move_y
	# A wall or prop in the way cuts the shot short: it still hits targets before the wall, then lands there
	var hit_wall := false
	var wall = Collision.raycast(x, y, next_x, next_y)
	if wall != null:
		next_x = wall["x"]
		next_y = wall["y"]
		move_x = next_x - x
		move_y = next_y - y
		hit_wall = true
	var travelled := Vector2(move_x, move_y).length()
	var segment_length_sq := move_x * move_x + move_y * move_y

	# Breakable props (containers) take the whole box: the shot hits wherever its path touches the box
	var bodies := target_list.filter(func(t): return not _is_breakable(t))
	for prop in target_list:
		if not _is_breakable(prop) or not _is_alive(prop) or not prop.has_method("touched_by"):
			continue
		if not prop.touched_by(x, y, next_x, next_y, radius):
			continue
		prop.take_damage(_hit_with_weakspot(false), x, y)
		land()
		return

	# Check collision at start position (in case projectile spawns inside target)
	for target in bodies:
		if not _is_alive(target):
			continue
		var start_offset_x: float = target.x - x
		var start_offset_y: float = target.y - y
		var hit_radius := radius + _radius_of(target)
		if start_offset_x * start_offset_x + start_offset_y * start_offset_y <= hit_radius * hit_radius:
			# Check for weakspot/headshot
			var is_weakspot: bool = HitZones.hit_zone(target, x, y) == "head"
			target.take_damage(_hit_with_weakspot(is_weakspot), x, y)
			if punch_through > 0:
				punch_through -= 1
			else:
				land()
				return

	if segment_length_sq > 0.0:
		# Skip segment check if start check already hit (prevents double damage on hitscan)
		if not active:
			return
		for target in bodies:
			if not _is_alive(target):
				continue
			var offset_x: float = target.x - x
			var offset_y: float = target.y - y
			var projection := clampf((offset_x * move_x + offset_y * move_y) / segment_length_sq, 0.0, 1.0)
			var closest_x := x + projection * move_x
			var closest_y := y + projection * move_y
			var hit_radius := radius + _radius_of(target)
			var diff_x: float = target.x - closest_x
			var diff_y: float = target.y - closest_y

			if diff_x * diff_x + diff_y * diff_y <= hit_radius * hit_radius:
				# Check for weakspot/headshot
				var is_weakspot: bool = HitZones.hit_zone(target, closest_x, closest_y) == "head"
				target.take_damage(_hit_with_weakspot(is_weakspot), closest_x, closest_y)

				if punch_through > 0:
					punch_through -= 1
				else:
					x = closest_x
					y = closest_y
					if is_hitscan:
						hitscan_timer = hitscan_duration
					else:
						active = false
					return

	x = next_x
	y = next_y
	distance_travelled += travelled

	# Check collision at end position (catch tunneling where segment missed but end is inside)
	for target in bodies:
		if not _is_alive(target):
			continue
		var end_offset_x: float = target.x - x
		var end_offset_y: float = target.y - y
		var hit_radius := radius + _radius_of(target)
		if end_offset_x * end_offset_x + end_offset_y * end_offset_y <= hit_radius * hit_radius:
			# Check for weakspot/headshot
			var is_weakspot: bool = HitZones.hit_zone(target, x, y) == "head"
			target.take_damage(_hit_with_weakspot(is_weakspot), x, y)
			if punch_through > 0:
				punch_through -= 1
			else:
				land()
				return

	# Stopped by a wall or prop
	if hit_wall:
		land()
		return

	# Out of range: a hitscan still shows its tracer on a miss
	if distance_travelled >= max_distance:
		land()


## The shot is spent: a hitscan keeps its tracer for a moment (faded at the top of update), anything else ends.
func land() -> void:
	if is_hitscan:
		hitscan_timer = hitscan_duration
	else:
		active = false


## Draws into a CanvasItem (call from its _draw). A spent shot is never drawn.
func draw(canvas: CanvasItem) -> void:
	if not active:
		return
	var c := Color(color)
	if is_hitscan:
		# Fading tracer line
		c.a = maxf(0.0, hitscan_timer / hitscan_duration)
		canvas.draw_line(Vector2(start_x, start_y), Vector2(x, y), c, radius)
	else:
		canvas.draw_circle(Vector2(x, y), radius, c)
