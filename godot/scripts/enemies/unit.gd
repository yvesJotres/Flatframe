class_name UnitEnemy
extends Enemy

# A faction unit with its own health and armour, scaled through the combat port (src/combat/scaling.js).
# Ranged units (Lancer, Trooper) use the shared burst behaviour from Enemy, and throw grenades from 4 to 22 m after a
# 0.6 s windup. Melee units close in and swing their weapon (Butcher's Cleaver); the others close in and hit on contact,
# as the browser does for units that have no weapon.

const METRE := 15.0
const GRENADE_RANGE_M := Vector2(4.0, 22.0)
const GRENADE_WINDUP := 0.6
const GRENADE_COOLDOWN := Vector2(8.0, 14.0)

var unit_name := "Unit"
var faction := "grineer"
var base_hp := 100.0
var base_armor := 0.0
var ranged := false
var melee_damage := 0.0         # swing damage (0 when the unit has no melee attack)
var melee_range := 0.0          # px
var melee_cooldown := 1.0       # seconds between swings
var melee_timer := 0.0
var grenade_timer := 0.0
var grenade_cooldown := 10.0
var windup := 0.0


func _ready() -> void:
	super._ready()
	enemy_name = unit_name
	max_hp = Scaling.scale_stat_by_faction(base_hp, level, "hp", faction)
	hp = max_hp
	armor = Scaling.scale_stat_by_faction(base_armor, level, "armor", faction)
	grenade_cooldown = randf_range(GRENADE_COOLDOWN.x, GRENADE_COOLDOWN.y)


func _engage(delta: float) -> void:
	var distance := position.distance_to(target.global_position)
	if melee_damage > 0.0:
		melee_timer = maxf(0.0, melee_timer - delta)
		if distance <= melee_range:
			facing = (target.global_position - position).angle()
			if melee_timer <= 0.0:
				target.take_damage(melee_damage)
				melee_timer = melee_cooldown
			return
		_chase(delta)
		return
	if not ranged:
		_chase(delta)
		return

	if windup > 0.0:
		windup -= delta
		facing = (target.global_position - position).angle()
		if windup <= 0.0:
			_throw_grenade()
		return
	grenade_timer = minf(grenade_timer + delta, grenade_cooldown)
	var meters := distance / METRE
	if grenade_timer >= grenade_cooldown and meters >= GRENADE_RANGE_M.x and meters <= GRENADE_RANGE_M.y and burst_left == 0:
		windup = GRENADE_WINDUP
		return
	super._engage(delta)


# Lobs a grenade at the Warframe's current position; it detonates after its fuse
func _throw_grenade() -> void:
	var nade := Grenade.new()
	nade.position = position
	nade.target_pos = target.global_position
	nade.from_enemy = true
	get_parent().add_child(nade)
	grenade_timer = 0.0
	grenade_cooldown = randf_range(GRENADE_COOLDOWN.x, GRENADE_COOLDOWN.y)
