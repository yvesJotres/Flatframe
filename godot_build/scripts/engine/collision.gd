extends Node
## Port of java_build/src/engine/collision.js. Registered as the autoload
## `Collision`, so the player, enemies, projectiles and the spawner all read
## the same world. Wall tiles are on a grid (tile_size px), given by their
## top-left corners. Solids are rectangles { x, y, w, h } (top-left corner).
## Circles (units) are pushed out of whatever they overlap; segments (bullets)
## stop at the first thing they hit. Entities passed in need x, y and radius.

var tile_size := 0.0
var tiles := {}  # Vector2i -> true
var solids := []


func _ready() -> void:
	clear()


func clear() -> void:
	tile_size = 0.0
	tiles = {}
	solids = []


# Walls: tiles given by their top-left pixel corners (multiples of tile_size)
func set_tiles(size: float, wall_positions: Array = []) -> void:
	tile_size = size
	tiles = {}
	for w in wall_positions:
		tiles[Vector2i(floori(w["x"] / size + 1e-6), floori(w["y"] / size + 1e-6))] = true


func add_solid(rect: Dictionary) -> Dictionary:
	solids.append(rect)
	return rect


func remove_solid(rect: Dictionary) -> void:
	var i := solids.find(rect)
	if i >= 0:
		solids.remove_at(i)


func has_tile(gx: int, gy: int) -> bool:
	return tiles.has(Vector2i(gx, gy))


# True when a point is inside a wall tile or a solid
func is_solid_at(x: float, y: float) -> bool:
	if tile_size > 0.0 and has_tile(floori(x / tile_size), floori(y / tile_size)):
		return true
	for s in solids:
		if x >= s["x"] and x <= s["x"] + s["w"] and y >= s["y"] and y <= s["y"] + s["h"]:
			return true
	return false


# Boxes a circle at (x, y) with this radius might touch
func boxes_near(x: float, y: float, radius: float) -> Array:
	var boxes := []
	var ts := tile_size
	if ts > 0.0:
		var g0x := floori((x - radius) / ts)
		var g1x := floori((x + radius) / ts)
		var g0y := floori((y - radius) / ts)
		var g1y := floori((y + radius) / ts)
		for gx in range(g0x, g1x + 1):
			for gy in range(g0y, g1y + 1):
				if has_tile(gx, gy):
					boxes.append({"x": gx * ts, "y": gy * ts, "w": ts, "h": ts, "gx": gx, "gy": gy})
	for s in solids:
		if x + radius >= s["x"] and x - radius <= s["x"] + s["w"] and y + radius >= s["y"] and y - radius <= s["y"] + s["h"]:
			boxes.append(s)
	return boxes


# Pushes a unit out of walls and solids. Returns true if it had to move.
func resolve_circle(entity, radius = null) -> bool:
	if radius == null:
		radius = entity.get("radius")
		if radius == null:
			radius = 16.0
	if tile_size <= 0.0 and solids.is_empty():
		return false
	var moved := false
	for _pass in 4:
		var pushed := false
		var ts := tile_size
		var ex := floori(entity.x / ts) if ts > 0.0 else 0
		var ey := floori(entity.y / ts) if ts > 0.0 else 0
		for box in boxes_near(entity.x, entity.y, radius):
			var cx := clampf(entity.x, box["x"], box["x"] + box["w"])
			var cy := clampf(entity.y, box["y"], box["y"] + box["h"])
			var dx: float = entity.x - cx
			var dy: float = entity.y - cy
			var d2 := dx * dx + dy * dy
			if d2 >= radius * radius:
				continue
			# A corner shared by two wall tiles is not a real corner: the flat wall in front handles it
			if box.has("gx") and box["gx"] != ex and box["gy"] != ey and (has_tile(box["gx"], ey) or has_tile(ex, box["gy"])):
				continue
			if d2 > 1e-9:
				var d := sqrt(d2)
				var push: float = radius - d
				entity.x += (dx / d) * push
				entity.y += (dy / d) * push
			else:
				# The centre is inside the box: leave through the nearest side
				var left: float = entity.x - box["x"]
				var right: float = box["x"] + box["w"] - entity.x
				var top: float = entity.y - box["y"]
				var bottom: float = box["y"] + box["h"] - entity.y
				var m := minf(minf(left, right), minf(top, bottom))
				if m == left:
					entity.x = box["x"] - radius
				elif m == right:
					entity.x = box["x"] + box["w"] + radius
				elif m == top:
					entity.y = box["y"] - radius
				else:
					entity.y = box["y"] + box["h"] + radius
			pushed = true
			moved = true
		if not pushed:
			break
	return moved


# Where a segment first enters an axis-aligned box, as a fraction 0..1 along the segment, or null
static func _segment_box(x0: float, y0: float, x1: float, y1: float, box: Dictionary):
	var t_min := 0.0
	var t_max := 1.0
	var axes := [
		[x0, x1 - x0, box["x"], box["x"] + box["w"]],
		[y0, y1 - y0, box["y"], box["y"] + box["h"]],
	]
	for axis in axes:
		var start: float = axis[0]
		var delta: float = axis[1]
		var lo: float = axis[2]
		var hi: float = axis[3]
		if delta == 0.0:
			if start < lo or start > hi:
				return null
			continue
		var t1 := (lo - start) / delta
		var t2 := (hi - start) / delta
		t_min = maxf(t_min, minf(t1, t2))
		t_max = minf(t_max, maxf(t1, t2))
		if t_min > t_max:
			return null
	return t_min


# The first wall or solid a segment meets: { x, y, t } with t the fraction along the segment, or null
func raycast(x0: float, y0: float, x1: float, y1: float):
	if x0 == x1 and y0 == y1:
		return null
	if is_solid_at(x0, y0):
		return {"x": x0, "y": y0, "t": 0.0}
	var best = null
	var ts := tile_size
	if ts > 0.0 and tiles.size() > 0:
		var dx := x1 - x0
		var dy := y1 - y0
		var gx := floori(x0 / ts)
		var gy := floori(y0 / ts)
		var step_x := 1 if dx > 0.0 else -1
		var step_y := 1 if dy > 0.0 else -1
		var t_delta_x: float = absf(ts / dx) if dx != 0.0 else INF
		var t_delta_y: float = absf(ts / dy) if dy != 0.0 else INF
		var t_max_x: float = (((gx + 1) * ts - x0) if dx > 0.0 else (x0 - gx * ts)) / absf(dx) if dx != 0.0 else INF
		var t_max_y: float = (((gy + 1) * ts - y0) if dy > 0.0 else (y0 - gy * ts)) / absf(dy) if dy != 0.0 else INF
		for _guard in 10000:
			var t: float
			if t_max_x < t_max_y:
				gx += step_x
				t = t_max_x
				t_max_x += t_delta_x
			else:
				gy += step_y
				t = t_max_y
				t_max_y += t_delta_y
			if t > 1.0:
				break
			if has_tile(gx, gy):
				best = {"x": x0 + dx * t, "y": y0 + dy * t, "t": t}
				break
	for s in solids:
		var t = _segment_box(x0, y0, x1, y1, s)
		if t != null and (best == null or t < best["t"]):
			best = {"x": x0 + (x1 - x0) * t, "y": y0 + (y1 - y0) * t, "t": t}
	return best
