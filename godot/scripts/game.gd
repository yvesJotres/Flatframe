class_name Game
extends Node2D

# Mission scene. Runs Exterminate (src/missions/missions.js 'exterminate') or Survival ('survival').
# The star chart sets pending_mission before it changes to this scene.

static var pending_mission := "exterminate"

const MAP_PATH := "res://data/maps/exterminate_ship.json"

# Exterminate
const KILL_QUOTA := 33   # E Prime (missions.js exterminate_e_prime)
const MAX_ENEMIES := 5

# Survival (missions.js survival; src/game.js SURVIVAL)
const SURVIVAL_MAX_ENEMIES := 6
const SURVIVAL_BASE_ENEMIES := 3
const SURVIVAL_ENEMIES_PER_WAVE := 2
const WAVE_BREAK := 3.0

# Defense and Dark Sector Defense (missions.js): an open arena with an objective to protect, endless waves, and an
# extraction choice after every 3 waves. Health and armour are the browser's objective stats.
const DEFENSE_MODES := {
	"defense": {"health": 4000.0, "armor": 240.0, "max": 5, "base": 3},
	"dark_sector_defense": {"health": 5000.0, "armor": 100.0, "max": 6, "base": 4},
}
const ARENA_SIZE := Vector2(1600.0, 1200.0)
const ROTATION_WAVES := 3
const POD_RANGE := 40.0        # an enemy this close (centre to centre, less its radius) hits the objective
const POD_DPS := 14.0          # contact damage per second: the enemy's contact rate times the Cryo Pod threat (1.4)
const EXTRACT_AT := 300.0
const LIFE_DECAY_PER_SECOND := 1.0 / 1.5
const CAPSULE_GAIN := 30.0
const CAPSULE_EVERY := 90.0
const MAX_CAPSULES := 8
const DRAIN_SECONDS := 300.0
const PICKUP_RADIUS := 40.0
const PAD_INSET := 160.0

const SPAWN_INTERVAL := 1.1
const SPAWN_MIN_DISTANCE := 300.0

# Palette from src/assets/colors.js and the canvas draws in src/game.js
const BG_COLOR := Color("#0a0a0c")
const CAPSULE_COLOR := Color("#01d8ff")   # COLORS.LOOT_ENERGY
const EXTRACT_COLOR := Color("#43b306")   # COLORS.EXTRACTION
const TILE_SIZE := 96.0           # the generator's tile size (tile_generator.js TILE_SIZE)
const GRID_STEP := 15.0          # UNITS_PER_METER: 1 m
const GRID_MAJOR_STEP := 75.0    # every 5 m

var mode := "exterminate"
var bounds := Vector2(1600, 1200)
var player: Player
var kills := 0
var spawn_timer := 0.0
var state := "running"   # running | won | lost
var pod: CryoPod = null          # the objective of Defense and Dark Sector Defense (null otherwise)
var max_enemies := MAX_ENEMIES
var kill_quota := KILL_QUOTA
var node_pool: Array = []        # the faction units a node mission spawns (empty for Exterminate: crewman)

# Earth node types with no rules of their own (missions.js NODE_TYPES): they play Exterminate's kill quota as a
# placeholder, with 24 kills, six units on the field, and troopers, lancers and butchers
const NODE_TYPES := ["interception", "mobile_defense", "excavation", "capture", "spy", "rescue", "sabotage",
	"shrine_defense", "dark_sector_excavation", "open_world", "assassination"]
const NODE_KILL_QUOTA := 24
const NODE_MAX_ENEMIES := 6
const NODE_POOL := ["Trooper", "Lancer", "Butcher"]
var base_enemies := SURVIVAL_BASE_ENEMIES
var choice_open := false         # after a rotation, the player extracts or continues
var choice_key_was := {}
var pause: PauseMenu = null     # Esc: the pause menu (the tree is paused while it is open)
var hud: Hud
var elapsed := 0.0

# Survival state
var wave := 1
var wave_spawned := 0
var wave_total := 3
var wave_timer := 0.0
var life_support := 100.0
var next_capsule_at := CAPSULE_EVERY
var capsules: Array = []          # Vector2 positions of life support capsules
var drain_started_at := -1.0      # elapsed time when the health drain began, -1 when not draining
var extraction := Vector2.ZERO
var walls: Dictionary = {}      # wall cells, keys Vector2i (filled in from the map data)
var spawn_points: Array = []    # enemy spawn points from the generated map
var gates: Array = []           # MissionGate, from the map
var lockers: Array = []         # MissionLocker, from the map
var containers: Array = []      # MissionContainer, from the map
var room_rects: Array = []      # pixel rectangles of the map's rooms (enemies hear shots in their own room)
var last_shot_serial := 0
var nav: AStarGrid2D            # grid pathfinding over the walls (one cell per tile)
var drops: Array = []           # loot on the floor: {type, amount, pos}
var x_was_down := false         # interact key edge detection


# Enemies in one wave: 3 at wave 1, +2 each wave (missions.js waveSize)
static func wave_size(wave_number: int, base: int = SURVIVAL_BASE_ENEMIES) -> int:
	return base + maxi(0, wave_number - 1) * SURVIVAL_ENEMIES_PER_WAVE


func _ready() -> void:
	Sounds.stop_music()
	mode = pending_mission
	# The mission map is generated from room tiles, as in the browser (the seed is random each run)
	var map := TileGenerator.generate_mission_map(8, _mission_seed())
	bounds = Vector2(map.bounds.width, map.bounds.height)
	if NODE_TYPES.has(mode):
		kill_quota = NODE_KILL_QUOTA
		max_enemies = NODE_MAX_ENEMIES
		node_pool = NODE_POOL
	var arena: Dictionary = DEFENSE_MODES.get(mode, {})
	if not arena.is_empty():
		# The arena is open floor with no rooms, gates or containers (the browser's arena.json)
		map.walls = []
		map.entities = []
		map.rooms = []
		map.spawnPoints = []
		bounds = ARENA_SIZE
		max_enemies = arena.max
		base_enemies = arena.base
	for w in map.walls:
		walls[Vector2i(roundi(w.x / TileGenerator.TILE_SIZE), roundi(w.y / TileGenerator.TILE_SIZE))] = true
	spawn_points = map.spawnPoints
	nav = AStarGrid2D.new()
	nav.region = Rect2i(0, 0, int(round(bounds.x / TileGenerator.TILE_SIZE)), int(round(bounds.y / TileGenerator.TILE_SIZE)))
	nav.cell_size = Vector2(TileGenerator.TILE_SIZE, TileGenerator.TILE_SIZE)
	nav.diagonal_mode = AStarGrid2D.DIAGONAL_MODE_NEVER
	nav.update()
	for w in map.walls:
		var wc := Vector2i(roundi(w.x / TileGenerator.TILE_SIZE), roundi(w.y / TileGenerator.TILE_SIZE))
		if nav.is_in_boundsv(wc):
			nav.set_point_solid(wc, true)
	for r in map.rooms:
		room_rects.append(Rect2(r.rect.x, r.rect.y, r.rect.w, r.rect.h))
	for e in map.entities:
		if e.type == "gate":
			gates.append(MissionGate.new(e))
		elif e.type == "locker":
			lockers.append(MissionLocker.new(e))
		elif e.type == "container":
			containers.append(MissionContainer.new(e))
	var start := Vector2(map.playerStart.x, map.playerStart.y)
	if not arena.is_empty():
		start = Vector2(bounds.x * 0.5, bounds.y * 0.85)
		pod = CryoPod.new(arena.health, arena.armor)
		pod.position = bounds * 0.5
		add_child(pod)
	# Survival's extraction pad sits in the corner on the far side of the player (src/game.js extractionPointFor)
	extraction = Vector2(bounds.x - PAD_INSET if start.x < bounds.x / 2.0 else PAD_INSET,
		bounds.y - PAD_INSET if start.y < bounds.y / 2.0 else PAD_INSET)
	wave_total = wave_size(wave, base_enemies)

	# The primary chosen in the Arsenal (Braton by default), with its installed mods applied
	var weapon := ModEffects.apply_to_weapon(Loadout.equipped_item("primary"),
		ModEffects.weapon_bonuses(Mods.installed_mods("primary"), "primary"))
	# The frame's base health, shield and armor, with its installed mods (wiki: mods add a percentage)
	var frame := Loadout.equipped_item("warframe")
	var frame_bonus := ModEffects.frame_bonuses(Mods.installed_mods("warframe"))
	player = preload("res://scripts/warframe/player.gd").new()
	player.max_hp = roundf(float(frame.get("health", Player.MAX_HP)) * (1.0 + frame_bonus.health / 100.0))
	player.max_shield = roundf(float(frame.get("shield", 0.0)) * (1.0 + frame_bonus.shield / 100.0))
	player.max_armor = roundf(float(frame.get("armor", 0.0)) * (1.0 + frame_bonus.armor / 100.0))
	var secondary := ModEffects.apply_to_weapon(Loadout.equipped_item("secondary"),
		ModEffects.weapon_bonuses(Mods.installed_mods("secondary"), "secondary"))
	player.set_weapons(weapon, secondary)
	player.melee = ModEffects.apply_to_weapon(Loadout.equipped_item("melee"), ModEffects.empty_weapon_bonuses())
	player.bounds = bounds
	player.blocked = is_blocked
	player.position = start
	add_child(player)
	# The camera follows the player and stays inside the map (the browser camera lerps to the player)
	var camera := Camera2D.new()
	camera.position_smoothing_enabled = true
	camera.position_smoothing_speed = 8.0
	camera.limit_left = 0
	camera.limit_top = 0
	camera.limit_right = int(bounds.x)
	camera.limit_bottom = int(bounds.y)
	player.add_child(camera)
	camera.make_current()

	# HUD lives on a CanvasLayer so it stays fixed to the screen
	var layer := CanvasLayer.new()
	add_child(layer)
	hud = Hud.new()
	hud.game = self
	layer.add_child(hud)
	hud.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)

	# Esc opens the pause menu, which pauses the tree (Resume, Restart, Options, Abort)
	pause = PauseMenu.new()
	pause.mission_name = mode.replace("_", " ").capitalize()
	layer.add_child(pause)
	pause.opened.connect(func():
		pause.open(pause.mission_name)
		get_tree().paused = true)
	pause.resumed.connect(func():
		pause.close()
		get_tree().paused = false)
	pause.restarted.connect(func():
		get_tree().paused = false
		get_tree().reload_current_scene())
	pause.aborted.connect(func():
		get_tree().paused = false
		get_tree().change_scene_to_file("res://scenes/menu.tscn"))


func _process(delta: float) -> void:
	if state != "running":
		if Input.is_key_pressed(KEY_ENTER):
			get_tree().reload_current_scene()
		return
	elapsed += delta
	for g in gates:
		g.update(delta, player.position)
	_update_interact()
	_update_containers(delta)
	_update_hearing()
	_update_drops()
	if not player.alive:
		state = "lost"
	elif DEFENSE_MODES.has(mode):
		_update_defense(delta)
	elif mode == "survival":
		_update_survival(delta)
	elif mode == "simulacrum":
		# Sandbox (missions.js simulacrum): no quota and no spawning on its own. F spawns one enemy (the browser's manual spawn)
		var f_down := Input.is_physical_key_pressed(KEY_F)
		if f_down and not choice_key_was.get(KEY_F, false):
			_spawn_enemy()
		choice_key_was[KEY_F] = f_down
	elif kills >= kill_quota:
		state = "won"
	else:
		spawn_timer -= delta
		if spawn_timer <= 0.0 and get_tree().get_nodes_in_group("enemies").size() < max_enemies:
			_spawn_enemy()
			spawn_timer = SPAWN_INTERVAL
	queue_redraw()


func _update_survival(delta: float) -> void:
	life_support = maxf(0.0, life_support - delta * LIFE_DECAY_PER_SECOND)

	# Capsules drop near the player every 90 s, up to 8 at a time
	if elapsed >= next_capsule_at and capsules.size() < MAX_CAPSULES:
		next_capsule_at += CAPSULE_EVERY
		var side := -240.0 if randf() < 0.5 else 240.0
		capsules.append(Vector2(
			clampf(player.position.x + side, 16.0, bounds.x - 16.0),
			clampf(player.position.y + (randf() - 0.5) * 240.0, 16.0, bounds.y - 16.0)))
	for i in range(capsules.size() - 1, -1, -1):
		if player.position.distance_to(capsules[i]) <= PICKUP_RADIUS:
			life_support = minf(100.0, life_support + CAPSULE_GAIN)
			capsules.remove_at(i)

	# After the 5 minutes, empty life support drains health to 5 hp over 5 minutes
	if life_support <= 0.0 and elapsed >= EXTRACT_AT:
		if drain_started_at < 0.0:
			drain_started_at = elapsed
		var hc := player.health
		hc.hp = maxf(5.0, hc.hp - (hc.max_hp - 5.0) * delta / DRAIN_SECONDS)

	if life_support <= 0.0 and elapsed < EXTRACT_AT:
		state = "lost"   # empty before extraction: lost at once
	elif drain_started_at >= 0.0 and elapsed - drain_started_at >= DRAIN_SECONDS:
		state = "lost"
	elif elapsed >= EXTRACT_AT and player.position.distance_to(extraction) <= PICKUP_RADIUS:
		state = "won"
	else:
		_update_waves(delta)


# Defense: the objective takes damage from enemies that reach it, waves run as in Survival, and every 3 waves the
# player chooses to extract (Y) or continue (N). The mission is lost when the objective breaks.
func _update_defense(delta: float) -> void:
	if not pod.alive:
		state = "lost"
		return
	for e in get_tree().get_nodes_in_group("enemies"):
		if e.position.distance_to(pod.position) <= POD_RANGE + e.RADIUS + CryoPod.RADIUS:
			pod.take_damage(POD_DPS * delta)
	if choice_open:
		_update_rotation_choice()
		return
	_update_waves(delta)


# Y extracts with the reward (the mission is won), N continues to the next rotation
func _update_rotation_choice() -> void:
	for key in [KEY_Y, KEY_N]:
		var down := Input.is_physical_key_pressed(key)
		if down and not choice_key_was.get(key, false):
			if key == KEY_Y:
				state = "won"
			else:
				choice_open = false
				_advance_wave()
		choice_key_was[key] = down


# Waves: spawn the wave's enemies, then a 3 s break after the field is clear
func _update_waves(delta: float) -> void:
	var alive := get_tree().get_nodes_in_group("enemies").size()
	if wave_spawned < wave_total:
		spawn_timer -= delta
		if spawn_timer <= 0.0 and alive < max_enemies:
			_spawn_enemy()
			wave_spawned += 1
			spawn_timer = SPAWN_INTERVAL
	elif alive == 0:
		wave_timer += delta
		if wave_timer >= WAVE_BREAK:
			wave_timer = 0.0
			if DEFENSE_MODES.has(mode) and wave % ROTATION_WAVES == 0:
				choice_open = true   # the rotation is done: extract or continue
			else:
				_advance_wave()


func _advance_wave() -> void:
	wave += 1
	wave_total = wave_size(wave, base_enemies)
	wave_spawned = 0
	spawn_timer = 0.0


# The layout seed: "-- seed=N" on the command line fixes it (to match the browser's ?seed=N); otherwise it is random
func _mission_seed() -> int:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("seed="):
			return int(arg.trim_prefix("seed="))
	return randi() % 2147483647 + 1

# Enemies arrive from the map's spawn points, away from the player when there is a choice
# A shot that reaches a container damages it (called by Projectile). True when the shot is used up.
func hit_container(p: Vector2, damage: float) -> bool:
	for c in containers:
		if not c.broken() and c.rect.grow(2.0).has_point(p):
			c.take_damage(damage)
			return true
	return false

# Breaking a container drops its loot
func _update_containers(delta: float) -> void:
	for c in containers:
		if c.flash > 0.0:
			c.flash = maxf(0.0, c.flash - delta)
		if c.broken() and not c.has_meta("dropped"):
			c.set_meta("dropped", true)
			drops.append_array(c.roll_drops())

# The player picks up drops by walking over them
func _update_drops() -> void:
	var i := drops.size() - 1
	while i >= 0:
		var d: Dictionary = drops[i]
		if player.alive and player.position.distance_to(d.pos) <= 24.0:
			_apply_drop(d)
			drops.remove_at(i)
		i -= 1

func _apply_drop(d: Dictionary) -> void:
	match d.type:
		"health":
			player.health.hp = minf(player.max_hp, player.health.hp + 40.0 * d.amount)
		"ammo":
			player.ammo = mini(int(player.weapon.get("magazineSize", 0)), player.ammo + d.amount * 10)
		"energy":
			player.energy = minf(150.0, player.energy + 25.0)
		"endo":
			Wallet.add(UserStore.active_id(), "endo", d.amount)
		"resource":
			Wallet.add(UserStore.active_id(), d.currency, d.amount)
		"mod":
			# A mod is owned at rank 0 once (owned_mods.js); a second copy adds nothing yet
			if not Mods.owned_ranks.has(d.unique):
				Mods.owned_ranks[d.unique] = 0


# A shot is heard by the enemies in the same room as the shot (ai_behavior.js hearing)
func _update_hearing() -> void:
	if player.shot_serial == last_shot_serial:
		return
	last_shot_serial = player.shot_serial
	var room := _room_index_at(player.shot_pos)
	if room < 0:
		return
	for e in get_tree().get_nodes_in_group("enemies"):
		if _room_index_at(e.position) == room:
			e.hear_noise(player.shot_pos)

func _room_index_at(p: Vector2) -> int:
	for i in range(room_rects.size()):
		if room_rects[i].has_point(p):
			return i
	return -1

func _circle_hits_rect(p: Vector2, radius: float, r: Rect2) -> bool:
	var nearest := Vector2(clampf(p.x, r.position.x, r.end.x), clampf(p.y, r.position.y, r.end.y))
	return nearest.distance_to(p) < radius

# X opens the nearest locker in range (once per press, and not while the Warframe is down)
func _update_interact() -> void:
	var down := Input.is_key_pressed(KEY_X)
	if down and not x_was_down and not player.is_bleeding_out and state == "running":
		var best: MissionLocker = null
		var best_d := INF
		for l in lockers:
			if l.prompt() == "" or not l.in_range(player.position):
				continue
			var d: float = l.distance_to(player.position)
			if d < best_d:
				best = l
				best_d = d
		if best != null:
			best.interact()
	x_was_down = down

# Containers in the browser's colours (drawContainer): body by kind, a trim, and a health bar when hurt
func _draw_containers() -> void:
	var bodies := {"common": Color("#7a7f6a"), "uncommon": Color("#9a8f55"), "rare": Color("#d4af37"), "reinforced": Color("#8f9bb0")}
	for c in containers:
		if c.broken():
			continue
		var r: Rect2 = c.rect
		draw_rect(r, Color(1, 1, 1, 0.6) if c.flash > 0.0 else bodies.get(c.kind, bodies.common))
		draw_rect(r, Color("#1b1f29"), false, 2.0)
		var frac := clampf(c.hp / c.max_hp, 0.0, 1.0)
		if frac < 1.0:
			draw_rect(Rect2(r.position.x, r.position.y - 8.0, r.size.x, 4.0), Color(0, 0, 0, 0.5))
			draw_rect(Rect2(r.position.x, r.position.y - 8.0, r.size.x * frac, 4.0), Color("#cc2a28"))

# Loot on the floor: a small coloured dot per item
func _draw_drops() -> void:
	var colours := {"credits": Color("#ffd700"), "ammo": Color("#44aaff"), "secondary_ammo": Color("#ffaa44"), "energy": Color("#01d8ff"), "health": Color("#cc2a28"), "endo": Color("#e0b43a"), "mod": Color("#c77dff"), "resource": Color("#7fc8e8")}
	for d in drops:
		draw_circle(d.pos, 5.0, colours.get(d.type, Color.WHITE))

# Gates and lockers, drawn over the floor in the browser's colours (drawGate and drawLocker)
func _draw_props() -> void:
	for g in gates:
		var r: Rect2 = g.rect
		if g.open:
			draw_rect(r, Color(1.0, 176.0 / 255.0, 32.0 / 255.0, 0.35), false, 1.5)
		else:
			draw_rect(r, Color("#3a4358"))
			draw_rect(r, Color("#1a1408"), false, 1.0)
			var step := maxf(6.0, maxf(r.size.x, r.size.y) / 6.0)
			var along := maxf(r.size.x, r.size.y)
			var s := 0.0
			while s < along:
				if g.orientation == "v":
					draw_line(Vector2(r.position.x, r.position.y + s), Vector2(r.end.x, r.position.y + s + r.size.x), Color("#ffb020"), 3.0)
				else:
					draw_line(Vector2(r.position.x + s, r.position.y), Vector2(r.position.x + s + r.size.y, r.end.y), Color("#ffb020"), 3.0)
				s += step
	var font := ThemeDB.fallback_font
	for l in lockers:
		var r2: Rect2 = l.rect
		var body := Color("#12151c") if l.opened else Color("#3b4252")
		draw_rect(r2, body)
		draw_rect(r2, Color("#1b1f29"), false, 2.0)
		var light := Color("#2a2d36")
		if l.kind == "green":
			light = Color("#3fd17a")
		elif l.kind == "red":
			light = Color("#e0453f")
		draw_circle(r2.get_center(), 4.0, light)
		if l.in_range(player.position) and l.prompt() != "":
			var pw := font.get_string_size(l.prompt(), HORIZONTAL_ALIGNMENT_LEFT, -1, 12).x
			draw_string(font, Vector2(r2.get_center().x - pw / 2.0, r2.position.y - 6.0), l.prompt(), HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color.WHITE)
func _spawn_enemy() -> void:
	var pos := Vector2.ZERO
	for _attempt in range(20):
		if spawn_points.is_empty():
			pos = Vector2(randf_range(16.0, bounds.x - 16.0), randf_range(16.0, bounds.y - 16.0))
		else:
			var sp: Dictionary = spawn_points[randi() % spawn_points.size()]
			pos = Vector2(sp.x, sp.y)
		if pos.distance_to(player.position) >= SPAWN_MIN_DISTANCE:
			break
	var enemy: Enemy = CrewmanEnemy.new()   # the Exterminate enemy pool is crewman only (missions.js enemyPool)
	if not node_pool.is_empty():
		enemy = EnemyUnits.create(node_pool[randi() % node_pool.size()])
	enemy.level = 1 + kills / 8       # spawner.js: level = 1 + floor(kills / levelPerKills)
	enemy.position = pos
	enemy.target = player
	enemy.bounds = bounds
	enemy.blocked = is_blocked
	enemy.nav = nav
	var room_index := _room_index_at(pos)
	if room_index >= 0:
		enemy.room_rect = room_rects[room_index]
	enemy.died.connect(_on_enemy_died)
	add_child(enemy)

# True when a circle of the given radius around p touches a wall cell (the browser's tile walls)
func is_blocked(p: Vector2, radius: float = 16.0) -> bool:
	for c in containers:
		if not c.broken() and _circle_hits_rect(p, radius, c.rect):
			return true
	for g in gates:
		if not g.open and _circle_hits_rect(p, radius, g.rect):
			return true
	var t := float(TileGenerator.TILE_SIZE)
	var x0 := floori((p.x - radius) / t)
	var x1 := floori((p.x + radius) / t)
	var y0 := floori((p.y - radius) / t)
	var y1 := floori((p.y + radius) / t)
	for gy in range(y0, y1 + 1):
		for gx in range(x0, x1 + 1):
			if walls.has(Vector2i(gx, gy)):
				return true
	return false


func _on_enemy_died(enemy: Enemy) -> void:
	kills += 1
	# Affinity for the kill goes to the Warframe and the primary (weapon kill; ability kills are not made yet)
	var frame_name := str(Loadout.equipped_item("warframe").get("name", ""))
	var weapon_name := str(Loadout.equipped_item("primary").get("name", ""))
	Progression.award_kill(enemy.enemy_name, enemy.level, frame_name, weapon_name)
	# Table drops (Endo, mods, region resources) lie where the enemy fell, to be picked up
	for d in DropTables.roll(enemy.enemy_name):
		d["pos"] = enemy.position + Vector2((randf() - 0.5) * 40.0, (randf() - 0.5) * 40.0)
		drops.append(d)


func _draw() -> void:
	if choice_open:
		var font := ThemeDB.fallback_font
		draw_string(font, player.position + Vector2(-200.0, -110.0), "Rotation done: [Y] extract with rewards   [N] continue", HORIZONTAL_ALIGNMENT_LEFT, -1, 16, Color.WHITE)
	# The browser draws the map tiles over its grid, so the tiles are all that shows
	# Only the tiles the camera can see are drawn (the browser draws the view, not the whole map)
	var inv := get_canvas_transform().affine_inverse()
	var top_left := inv * Vector2.ZERO
	var view := Rect2(top_left, (inv * get_viewport_rect().size) - top_left)
	TileArt.draw_map(self, TILE_SIZE, walls, bounds, view)
	_draw_props()
	_draw_containers()
	_draw_drops()
