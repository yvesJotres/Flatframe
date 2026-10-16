class_name TileGenerator
extends RefCounted

# Procedural mission map from room tiles. A port of src/missions/generator/tile_generator.js (wiki Tile Set rules):
# rooms connect through doors in a tree, each room has a role (start, connector, intermediate, objective, dead end,
# exit, spawn), props go in dead ends and combat rooms, and gates close some doorways. The random calls happen in the
# same order as the browser, so a given seed gives the same map.

const TILE_SIZE := 96
const ROOM_W := 7
const ROOM_H := 5
const MID_X := 3
const MID_Y := 2
const GATE_CHANCE := 0.5
const GATE_THICKNESS := 8.0
const LOCKER_LONG := 64.0
const LOCKER_DEEP := 44.0
const CONTAINER_SIZE := 56.0
const DEAD_LOCKER_CHANCE := 0.05
const CONTAINER_KINDS := [["reinforced", 0.005], ["rare", 0.02], ["uncommon", 0.2]]
const DIRS := {
	"n": {"dx": 0, "dy": -1, "opposite": "s"},
	"s": {"dx": 0, "dy": 1, "opposite": "n"},
	"e": {"dx": 1, "dy": 0, "opposite": "w"},
	"w": {"dx": -1, "dy": 0, "opposite": "e"},
}
const DIR_ORDER := ["n", "s", "e", "w"]
const SHAPE_CELLS := {
	"start": [[1, 1], [1, ROOM_H - 2], [ROOM_W - 2, ROOM_H - 2]],
	"intermediate": [[1, 1], [2, 1], [1, ROOM_H - 2], [2, ROOM_H - 2], [ROOM_W - 2, 1], [ROOM_W - 2, ROOM_H - 2]],
	"objective": [[1, 1], [ROOM_W - 2, 1], [1, ROOM_H - 2], [ROOM_W - 2, ROOM_H - 2], [2, 1], [ROOM_W - 3, 1], [2, ROOM_H - 2], [ROOM_W - 3, ROOM_H - 2]],
}


static func key(gx: int, gy: int) -> String:
	return "%d,%d" % [gx, gy]


static func _is_cross(i: int, j: int) -> bool:
	return i == MID_X or j == MID_Y


static func _interior_cells() -> Array:
	var cells: Array = []
	for j in range(1, ROOM_H - 1):
		for i in range(1, ROOM_W - 1):
			cells.append([i, j])
	return cells


static func _template_walls(role: String) -> Array:
	if role == "connector":
		return _interior_cells().filter(func(c: Array) -> bool: return not _is_cross(c[0], c[1]))
	if role == "spawn":
		return _interior_cells().filter(func(c: Array) -> bool:
			return not _is_cross(c[0], c[1]) and not (c[0] >= 2 and c[0] <= ROOM_W - 3 and c[1] >= 1 and c[1] <= ROOM_H - 2))
	return SHAPE_CELLS.get(role, [])


static func _border_cells(room: Dictionary) -> Array:
	var cells: Array = []
	var doors: Array = room.doors
	for j in range(ROOM_H):
		for i in range(ROOM_W):
			if not (i == 0 or j == 0 or i == ROOM_W - 1 or j == ROOM_H - 1):
				continue
			var gap := (i == 0 and j == MID_Y and doors.has("w")) \
				or (i == ROOM_W - 1 and j == MID_Y and doors.has("e")) \
				or (j == 0 and i == MID_X and doors.has("n")) \
				or (j == ROOM_H - 1 and i == MID_X and doors.has("s"))
			if not gap:
				cells.append([i, j])
	return cells


static func _shuffle(list: Array, rand: EarthMap.Rng) -> Array:
	var a := list.duplicate()
	for i in range(a.size() - 1, 0, -1):
		var k := int(floor(rand.next() * (i + 1)))
		var tmp = a[i]
		a[i] = a[k]
		a[k] = tmp
	return a


static func _pick_kind(table: Array, rand: EarthMap.Rng, fallback: String) -> String:
	var roll := rand.next()
	var acc := 0.0
	for entry in table:
		acc += float(entry[1])
		if roll < acc:
			return str(entry[0])
	return fallback


# Builds the room tree. Each room: { gx, gy, role, doors (Array, insertion order), parent, depth }
static func build_room_tree(room_count: int, seed_value: int) -> Array:
	var rand := EarthMap.Rng.new(seed_value)
	var rooms: Array = []
	var by_key: Dictionary = {}
	var add := func(gx: int, gy: int, parent: Dictionary, dir: String) -> Dictionary:
		var room := {"gx": gx, "gy": gy, "role": "connector", "doors": [], "parent": parent,
			"depth": (parent.depth + 1) if not parent.is_empty() else 0}
		rooms.append(room)
		by_key[key(gx, gy)] = room
		if not parent.is_empty():
			if not parent.doors.has(dir):
				parent.doors.append(dir)
			if not room.doors.has(DIRS[dir].opposite):
				room.doors.append(DIRS[dir].opposite)
		return room

	var start: Dictionary = add.call(0, 0, {}, "")
	start.role = "start"

	var guard := 0
	while rooms.size() < room_count and guard < room_count * 50:
		guard += 1
		var parent: Dictionary = rooms[int(floor(rand.next() * rooms.size()))]
		var options: Array = []
		for d in DIR_ORDER:
			var nx: int = parent.gx + DIRS[d].dx
			var ny: int = parent.gy + DIRS[d].dy
			if not by_key.has(key(nx, ny)) and not parent.doors.has(d):
				options.append(d)
		if options.is_empty():
			continue
		var dir: String = options[int(floor(rand.next() * options.size()))]
		add.call(parent.gx + DIRS[dir].dx, parent.gy + DIRS[dir].dy, parent, dir)

	_assign_roles(rooms, rand)
	return rooms


# Sorts rooms by depth, deepest first. Equal depths keep their order (as the browser's stable sort does).
static func _sorted_by_depth(rooms: Array) -> Array:
	var indexed: Array = []
	for i in range(rooms.size()):
		indexed.append([rooms[i], i])
	indexed.sort_custom(func(a: Array, b: Array) -> bool:
		if a[0].depth != b[0].depth:
			return a[0].depth > b[0].depth
		return a[1] < b[1])
	var out: Array = []
	for pair in indexed:
		out.append(pair[0])
	return out


static func _assign_roles(rooms: Array, rand: EarthMap.Rng) -> void:
	var leaves: Array = rooms.filter(func(r: Dictionary) -> bool: return r.role != "start" and r.doors.size() == 1)
	leaves = _sorted_by_depth(leaves)
	if leaves.size() > 0:
		leaves[0].role = "objective"
	if leaves.size() > 1:
		leaves[1].role = "exit"
	for i in range(2, leaves.size()):
		leaves[i].role = "dead end"
	var candidates: Array = rooms.filter(func(r: Dictionary) -> bool: return not (r.role in ["start", "objective", "exit"]))
	candidates = _sorted_by_depth(candidates)
	if candidates.size() > 0:
		candidates[0].role = "spawn"
	for room in rooms:
		if room.role == "connector" and room.doors.size() > 1:
			room.role = "intermediate" if rand.next() < 0.4 else "connector"


static func _container_rect(origin: Vector2, i: int, j: int) -> Dictionary:
	var t := float(TILE_SIZE)
	return {"x": origin.x + i * t + (t - CONTAINER_SIZE) / 2.0, "y": origin.y + j * t + (t - CONTAINER_SIZE) / 2.0,
		"w": CONTAINER_SIZE, "h": CONTAINER_SIZE}


static func _corners() -> Array:
	return [[1, 1], [ROOM_W - 2, 1], [1, ROOM_H - 2], [ROOM_W - 2, ROOM_H - 2]]


# Props for one room. Returns { entities, used } where used is a Dictionary of cell keys.
static func _room_props(room: Dictionary, origin: Vector2, rand: EarthMap.Rng, next_id: Callable) -> Dictionary:
	var entities: Array = []
	var used: Dictionary = {}
	var t := float(TILE_SIZE)

	if room.role == "objective" or room.role == "exit":
		entities.append({"id": next_id.call("pad"), "type": "pad",
			"role": "exit" if room.role == "exit" else "objective",
			"x": origin.x + MID_X * t + t / 2.0, "y": origin.y + MID_Y * t + t / 2.0})
		used[key(MID_X, MID_Y)] = true

	if room.role == "dead end":
		var facing: String = room.doors[0]
		var locker_row := 4
		var vertical: bool = facing == "n" or facing == "s"
		var interior := (ROOM_W if vertical else ROOM_H) - 2
		var span := interior * t
		var margin := 8.0
		var pitch := LOCKER_LONG + (span - 2.0 * margin - locker_row * LOCKER_LONG) / (locker_row - 1)
		var row_start := t + margin
		for k in range(locker_row):
			var along := row_start + k * pitch
			var r: Dictionary
			if facing == "n":
				r = {"x": origin.x + along, "y": origin.y + (ROOM_H - 1) * t - LOCKER_DEEP, "w": LOCKER_LONG, "h": LOCKER_DEEP}
			elif facing == "s":
				r = {"x": origin.x + along, "y": origin.y + t, "w": LOCKER_LONG, "h": LOCKER_DEEP}
			elif facing == "e":
				r = {"x": origin.x + t, "y": origin.y + along, "w": LOCKER_DEEP, "h": LOCKER_LONG}
			else:
				r = {"x": origin.x + (ROOM_W - 1) * t - LOCKER_DEEP, "y": origin.y + along, "w": LOCKER_DEEP, "h": LOCKER_LONG}
			var kind := "black" if rand.next() < DEAD_LOCKER_CHANCE else ("green" if rand.next() < 0.5 else "red")
			var locker := {"id": next_id.call("locker"), "type": "locker", "kind": kind, "facing": facing}
			locker.merge(r)
			entities.append(locker)
		var span_cells := (ROOM_W if vertical else ROOM_H) - 2
		for tt in range(1, span_cells + 1):
			var cell: Array
			if facing == "n":
				cell = [tt, ROOM_H - 2]
			elif facing == "s":
				cell = [tt, 1]
			elif facing == "e":
				cell = [1, tt]
			else:
				cell = [ROOM_W - 2, tt]
			used[key(cell[0], cell[1])] = true
		var container_count := 2 + int(floor(rand.next() * 2))
		var free_corners: Array = []
		for c in _shuffle(_corners(), rand):
			if not used.has(key(c[0], c[1])):
				free_corners.append(c)
		for c in free_corners.slice(0, container_count):
			var cr := _container_rect(origin, c[0], c[1])
			var container := {"id": next_id.call("container"), "type": "container",
				"kind": _pick_kind(CONTAINER_KINDS, rand, "common")}
			container.merge(cr)
			entities.append(container)
			used[key(c[0], c[1])] = true
	elif room.role == "intermediate":
		var shape_walls: Dictionary = {}
		for c in _template_walls(room.role):
			shape_walls[key(c[0], c[1])] = true
		var spots: Array = []
		for c in [[ROOM_W - 3, 1], [ROOM_W - 3, ROOM_H - 2]]:
			if not _is_cross(c[0], c[1]) and not shape_walls.has(key(c[0], c[1])):
				spots.append(c)
		for c in _shuffle(spots, rand).slice(0, 2):
			if rand.next() < 0.5:
				continue
			var cr2 := _container_rect(origin, c[0], c[1])
			var container2 := {"id": next_id.call("container"), "type": "container",
				"kind": _pick_kind(CONTAINER_KINDS, rand, "common")}
			container2.merge(cr2)
			entities.append(container2)
			used[key(c[0], c[1])] = true
	return {"entities": entities, "used": used}


static func _generate_once(room_count: int, seed_value: int) -> Dictionary:
	var rooms := build_room_tree(room_count, seed_value)
	var rand := EarthMap.Rng.new(seed_value * 7919 + 13)
	var min_x := 1 << 30
	var min_y := 1 << 30
	var max_x := -(1 << 30)
	var max_y := -(1 << 30)
	for r in rooms:
		min_x = mini(min_x, r.gx)
		min_y = mini(min_y, r.gy)
		max_x = maxi(max_x, r.gx)
		max_y = maxi(max_y, r.gy)
	var room_w_px := float(ROOM_W * TILE_SIZE)
	var room_h_px := float(ROOM_H * TILE_SIZE)
	var counter := [0]
	var next_id := func(prefix: String) -> String:
		counter[0] += 1
		return "%s%d" % [prefix, counter[0] - 1]
	var walls: Array = []
	var entities: Array = []
	var spawn_points: Array = []
	var t := float(TILE_SIZE)

	for room in rooms:
		var origin := Vector2((room.gx - min_x) * room_w_px, (room.gy - min_y) * room_h_px)
		var cells: Array = _border_cells(room)
		cells.append_array(_template_walls(room.role))
		for c in cells:
			walls.append({"x": origin.x + c[0] * t, "y": origin.y + c[1] * t})
		var props := _room_props(room, origin, rand, next_id)
		entities.append_array(props.entities)
		room["cell_origin"] = origin
		if room.role == "spawn":
			var blocked: Dictionary = {}
			for c in _template_walls(room.role):
				blocked[key(c[0], c[1])] = true
			for c in _interior_cells():
				if blocked.has(key(c[0], c[1])) or props.used.has(key(c[0], c[1])):
					continue
				spawn_points.append({"x": origin.x + c[0] * t + t / 2.0, "y": origin.y + c[1] * t + t / 2.0, "room": room.role})

	# Gates close some doorways (east and south only, so each doorway is handled once)
	var gate_rand := EarthMap.Rng.new(seed_value * 104729 + 7)
	for room in rooms:
		for dir in ["e", "s"]:
			if not room.doors.has(dir):
				continue
			var other := _room_at(rooms, room.gx + DIRS[dir].dx, room.gy + DIRS[dir].dy)
			if other.is_empty():
				continue
			var forced: bool = room.role == "spawn" or other.role == "spawn"
			if not forced and gate_rand.next() >= GATE_CHANCE:
				continue
			var o: Vector2 = room.cell_origin
			var bar: Dictionary
			if dir == "e":
				bar = {"x": o.x + ROOM_W * t - GATE_THICKNESS / 2.0, "y": o.y + MID_Y * t, "w": GATE_THICKNESS, "h": t, "orientation": "v"}
			else:
				bar = {"x": o.x + MID_X * t, "y": o.y + ROOM_H * t - GATE_THICKNESS / 2.0, "w": t, "h": GATE_THICKNESS, "orientation": "h"}
			var gate := {"id": next_id.call("gate"), "type": "gate"}
			gate.merge(bar)
			entities.append(gate)

	var start := _room_with_role(rooms, "start")
	var objective_spot := Vector2.ZERO
	var has_objective := false
	for e in entities:
		if e.type == "pad" and e.role == "objective":
			objective_spot = Vector2(e.x, e.y)
			has_objective = true
			break
	var room_out: Array = []
	for r in rooms:
		room_out.append({"x": r.gx - min_x, "y": r.gy - min_y, "role": r.role, "doors": r.doors,
			"rect": {"x": r.cell_origin.x, "y": r.cell_origin.y, "w": room_w_px, "h": room_h_px}})
	var start_origin: Vector2 = start.cell_origin
	return {
		"generated": true,
		"objectiveSpot": {"x": objective_spot.x, "y": objective_spot.y} if has_objective else null,
		"bounds": {"width": (max_x - min_x + 1) * room_w_px, "height": (max_y - min_y + 1) * room_h_px},
		"tileSize": TILE_SIZE,
		"walls": walls,
		"playerStart": {"x": start_origin.x + MID_X * t + t / 2.0, "y": start_origin.y + MID_Y * t + t / 2.0},
		"entities": entities,
		"spawnPoints": spawn_points,
		"rooms": room_out,
	}


static func _room_at(rooms: Array, gx: int, gy: int) -> Dictionary:
	for r in rooms:
		if r.gx == gx and r.gy == gy:
			return r
	return {}


static func _room_with_role(rooms: Array, role: String) -> Dictionary:
	for r in rooms:
		if r.role == role:
			return r
	return {}


# Checks a map: every room and prop reachable from the start on foot, nothing in a wall or on another prop, and
# spawn points on reachable floor. Returns a list of problems (empty when the map is good).
static func validate(map: Dictionary) -> Array:
	var problems: Array = []
	var t := float(map.tileSize)
	var wall_set: Dictionary = {}
	for w in map.walls:
		wall_set[key(int(round(w.x / t)), int(round(w.y / t)))] = true
	var gw := int(round(map.bounds.width / t))
	var gh := int(round(map.bounds.height / t))
	var sx := int(floor(map.playerStart.x / t))
	var sy := int(floor(map.playerStart.y / t))
	if wall_set.has(key(sx, sy)):
		problems.append("player starts inside a wall")
	var reached: Dictionary = {key(sx, sy): true}
	var queue: Array = [[sx, sy]]
	while not queue.is_empty():
		var cur: Array = queue.pop_front()
		for d in [[1, 0], [-1, 0], [0, 1], [0, -1]]:
			var nx: int = cur[0] + d[0]
			var ny: int = cur[1] + d[1]
			if nx < 0 or ny < 0 or nx >= gw or ny >= gh:
				continue
			var k := key(nx, ny)
			if wall_set.has(k) or reached.has(k):
				continue
			reached[k] = true
			queue.append([nx, ny])

	for room in map.rooms:
		var cx: int = room.x * ROOM_W + MID_X
		var cy: int = room.y * ROOM_H + MID_Y
		if not reached.has(key(cx, cy)):
			problems.append("room %s is not reachable" % room.role)

	var props: Array = []
	for e in map.entities:
		if e.has("w"):
			props.append(e)
	for e in map.entities:
		var cell: Array
		if e.has("w"):
			cell = [int(floor((e.x + e.w / 2.0) / t)), int(floor((e.y + e.h / 2.0) / t))]
		else:
			cell = [int(floor(e.x / t)), int(floor(e.y / t))]
		if wall_set.has(key(cell[0], cell[1])):
			problems.append("%s %s sits in a wall" % [e.type, e.id])
		if not reached.has(key(cell[0], cell[1])):
			problems.append("%s %s is not reachable" % [e.type, e.id])
		if e.type == "locker":
			var d: Dictionary = DIRS[e.facing]
			if not reached.has(key(cell[0] + d.dx, cell[1] + d.dy)):
				problems.append("locker %s has no open floor in front of it" % e.id)
	for a in range(props.size()):
		for b in range(a + 1, props.size()):
			if _overlaps(props[a], props[b]):
				problems.append("%s overlaps %s" % [props[a].id, props[b].id])
	for p in map.spawnPoints:
		var pc := [int(floor(p.x / t)), int(floor(p.y / t))]
		if wall_set.has(key(pc[0], pc[1])) or not reached.has(key(pc[0], pc[1])):
			problems.append("a spawn point is not on reachable floor")
		for e in props:
			if p.x >= e.x and p.x <= e.x + e.w and p.y >= e.y and p.y <= e.y + e.h:
				problems.append("a spawn point is inside a prop")
				break
	if map.spawnPoints.is_empty():
		problems.append("no spawn points")
	return problems


static func _overlaps(a: Dictionary, b: Dictionary) -> bool:
	return a.x < b.x + b.w and a.x + a.w > b.x and a.y < b.y + b.h and a.y + a.h > b.y


# Full mission map. Tries the seed and the next ones until the map passes validation (it should on the first try).
static func generate_mission_map(room_count: int = 8, seed_value: int = 1) -> Dictionary:
	var map: Dictionary = {}
	for attempt in range(20):
		map = _generate_once(room_count, seed_value + attempt)
		map.seed = seed_value + attempt
		if validate(map).is_empty():
			return map
	return map
