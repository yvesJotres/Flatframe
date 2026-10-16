class_name CrewmanEnemy
extends Enemy

# Corpus Crewman: a port of src/enemies/corpus/crewman.js. It fires its Dera almost continuously instead of in
# bursts, moves between tactic phases (advance, cover run, covered with peek and blind fire), and lobs grenades
# when the target is 4 to 22 m away. Flanking spots are not ported yet (no navmesh flank search), so the phases
# that would flank fall back to advancing.

const SHOT_DAMAGE := 7.0               # wiki: each Dera shot is 7 damage (75% puncture, 15% slash, 10% impact)
const GRENADE_DAMAGE := 400.0          # Blast
const SHOT_HP := 90.0                  # base health before faction scaling
const DERA_FIRE_RATE := 11.25          # rounds per second (src/data/weapons: Dera fireRate)

const AIM_SPREAD := Vector2(1.5, 4.0)    # degrees: aimed fire in the open
const BLIND_SPREAD := Vector2(8.0, 14.0) # degrees: blind fire over cover

const ADVANCE_SEC := Vector2(2.0, 4.0)
const FLANK_SEC := Vector2(1.5, 3.0)
const COVER_RUN_SEC := Vector2(1.5, 3.0)
const COVERED_SEC := Vector2(4.0, 7.0)
const PEEK_SEC := Vector2(1.5, 2.5)
const BLIND_SEC := Vector2(1.0, 2.0)

const GRENADE_RANGE_M := Vector2(4.0, 22.0)
const GRENADE_WINDUP := 0.6
const STATIONARY_SPEED := 25.0         # units per second; a target slower than this counts as standing still
const METRE := 15.0
const ARRIVE_DISTANCE := 14.0

var phase := "advance"
var tactic_timer := 0.0
var spot := Vector2.INF
var resume_phase := ""
var blind := false
var sub_timer := 0.0
var spread_deg := AIM_SPREAD
var fire_accum := 0.0
var grenade_timer := 0.0
var grenade_cooldown := 10.0
var focus_speed := 0.0
var last_focus := Vector2.ZERO
var has_last_focus := false


func _ready() -> void:
	super._ready()
	enemy_name = "Crewman"
	max_hp = Scaling.scale_stat_by_faction(SHOT_HP, level, "hp", "corpus")
	hp = max_hp
	armor = Scaling.scale_stat_by_faction(0.0, level, "armor", "corpus")
	bullet_damage = SHOT_DAMAGE
	grenade_cooldown = randf_range(8.0, 14.0)
	tactic_timer = randf_range(ADVANCE_SEC.x, ADVANCE_SEC.y)


func _engage(delta: float) -> void:
	var focus := target.global_position
	var distance := position.distance_to(focus)
	_track_focus(delta, focus)
	if phase == "throw":
		_throw_grenade(delta, focus)
		return

	# Grenades come more often from cover and when the target stands still
	var rate := (2.0 if phase == "covered" else 1.0) * (1.5 if focus_speed < STATIONARY_SPEED else 1.0)
	grenade_timer = minf(grenade_timer + delta * rate, grenade_cooldown)
	var meters := distance / METRE
	if grenade_timer >= grenade_cooldown and meters >= GRENADE_RANGE_M.x and meters <= GRENADE_RANGE_M.y:
		resume_phase = phase
		phase = "throw"
		tactic_timer = GRENADE_WINDUP
		return

	match phase:
		"advance":
			_advance(delta, focus)
		"covered":
			_covered(delta, focus)
		_:
			_move_and_shoot(delta, focus)


# Smoothed speed of whoever is being shot at
func _track_focus(delta: float, focus: Vector2) -> void:
	if has_last_focus and delta > 0.0:
		var speed := last_focus.distance_to(focus) / delta
		focus_speed += (speed - focus_speed) * minf(1.0, delta * 3.0)
	else:
		focus_speed = 0.0
	last_focus = focus
	has_last_focus = true


# Close in while firing. When the timer runs out, pick the next position.
func _advance(delta: float, focus: Vector2) -> void:
	_chase(delta)
	_shoot(delta)
	tactic_timer -= delta
	if tactic_timer <= 0.0:
		_relocate()


# Running to cover (or a flank), firing along the way
func _move_and_shoot(delta: float, focus: Vector2) -> void:
	_follow_path(delta, spot, 0.9)
	_turn_to(delta, (focus - position).angle())
	_shoot(delta)
	tactic_timer -= delta
	var arrived := spot != Vector2.INF and position.distance_to(spot) < ARRIVE_DISTANCE
	if not arrived and tactic_timer > 0.0:
		return
	if phase == "cover" and arrived:
		_enter_cover()
	else:
		_start_advance()


# Planted behind cover: aimed fire when peeking, blind fire (wider spread) in between
func _covered(delta: float, focus: Vector2) -> void:
	_turn_to(delta, (focus - position).angle())
	_shoot(delta)
	sub_timer -= delta
	if sub_timer <= 0.0:
		blind = not blind
		var window := BLIND_SEC if blind else PEEK_SEC
		sub_timer = randf_range(window.x, window.y)
		spread_deg = BLIND_SPREAD if blind else AIM_SPREAD
	tactic_timer -= delta
	if tactic_timer <= 0.0:
		_relocate()


# Wind up, then lob a grenade at the target's current position
func _throw_grenade(delta: float, focus: Vector2) -> void:
	_turn_to(delta, (focus - position).angle())
	tactic_timer -= delta
	if tactic_timer > 0.0:
		return
	var nade := Grenade.new()
	nade.position = position
	nade.target_pos = focus
	nade.damage = GRENADE_DAMAGE
	nade.from_enemy = true
	get_parent().add_child(nade)
	grenade_timer = 0.0
	grenade_cooldown = randf_range(8.0, 14.0)
	phase = resume_phase if resume_phase != "" else "advance"
	if phase == "advance":
		tactic_timer = randf_range(ADVANCE_SEC.x, ADVANCE_SEC.y)


# Pick the next position: cover most of the time (70%), otherwise keep advancing
func _relocate() -> void:
	path_points.clear()
	spread_deg = AIM_SPREAD
	blind = false
	if randf() < 0.7:
		var cover := _find_cover()
		if cover != Vector2.INF:
			phase = "cover"
			spot = cover
			tactic_timer = randf_range(COVER_RUN_SEC.x, COVER_RUN_SEC.y)
			return
	var flank := _find_flank_spot(target.global_position)
	if flank != Vector2.INF and randf() < 0.6:
		phase = "flank"
		spot = flank
		tactic_timer = randf_range(FLANK_SEC.x, FLANK_SEC.y)
		return
	_start_advance()


func _start_advance() -> void:
	phase = "advance"
	spot = Vector2.INF
	tactic_timer = randf_range(ADVANCE_SEC.x, ADVANCE_SEC.y)
	path_points.clear()


func _enter_cover() -> void:
	phase = "covered"
	tactic_timer = randf_range(COVERED_SEC.x, COVERED_SEC.y)
	blind = false
	sub_timer = randf_range(PEEK_SEC.x, PEEK_SEC.y)
	spread_deg = AIM_SPREAD


# Fires the Dera continuously at the fire rate. Each round gets a random spread inside the current window.
func _shoot(delta: float) -> void:
	fire_accum += delta * DERA_FIRE_RATE
	while fire_accum >= 1.0:
		fire_accum -= 1.0
		aim_spread = deg_to_rad(randf_range(spread_deg.x, spread_deg.y))
		_fire()


# Turns toward an angle at the turn rate, without moving
func _turn_to(delta: float, angle: float) -> void:
	facing = facing + clampf(wrapf(angle - facing, -PI, PI), -TURN_RATE * delta, TURN_RATE * delta)
