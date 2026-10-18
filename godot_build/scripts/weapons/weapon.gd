class_name Weapon
extends RefCounted
## Port of java_build/src/weapons/weapon.js. The base weapon: ammo, reload,
## spread, mod bonuses and firing. Stats come from WeaponAdapter.adapt_weapon().
## Sound calls go through the AudioManager autoload.

var stats: Dictionary
var weapon_name := ""
var magazine := 0
var ammo := 0
var ammo_max := 0
var ammo_reserve := 0
var ammo_pickup := 0
var reload_speed := 1.0
var melee_cooldown := 1000.0  # ms
var last_fire_time := 0.0
var fire_accumulator := 0.0
var trigger_held := false
var reloading := false
var reload_remaining := 0.0
var category := ""

var attack: Dictionary
var fire_rate := 1.0
var damage := {}
var ammo_cost := 1
var multishot := 1.0
var punch_through := 0
var weapon_range := 300.0  # named weapon_range: "range" is a built-in in GDScript
var min_spread := 0.0
var max_spread := 0.0
var current_spread := 0.0
var crit_chance := 0.0
var crit_multiplier := 1.0
var falloff = null  # { start, end, minMultiplier } in meters, see falloff_multiplier()
var status_chance := 0.0
var shot_type := "projectile"


func _init(stats_in: Dictionary) -> void:
	stats = stats_in
	weapon_name = stats.get("name")
	magazine = stats.get("magazine")
	ammo = magazine
	ammo_max = _or(stats.get("ammoMax"), magazine)
	ammo_reserve = ammo_max
	ammo_pickup = _or(stats.get("ammoPickup"), 0)
	reload_speed = stats.get("reload")
	melee_cooldown = float(_or(stats.get("meleeCooldown"), 1.0)) * 1000.0
	set_attack(_or(stats.get("attack"), stats))


static func _or(value, fallback):
	return fallback if value == null else value


static func _sum(values: Dictionary) -> float:
	var total := 0.0
	for key in values:
		total += values[key]
	return total


func set_attack(new_attack: Dictionary) -> void:
	attack = new_attack
	fire_rate = attack["fireRate"]
	damage = attack["damage"].duplicate()
	ammo_cost = _or(attack.get("ammoCost"), 1)
	multishot = _or(attack.get("multishot"), 1)
	punch_through = _or(attack.get("punchThrough"), 0)
	weapon_range = _or(attack.get("range"), 300)
	min_spread = _or(attack.get("minSpread"), 0)
	max_spread = _or(attack.get("maxSpread"), min_spread)
	crit_chance = _or(attack.get("critChance"), 0)
	crit_multiplier = _or(attack.get("critMultiplier"), 1)
	falloff = attack.get("falloff")
	status_chance = _or(attack.get("statusChance"), 0)
	shot_type = _or(attack.get("shotType"), "projectile")
	current_spread = min_spread


func total_damage() -> float:
	return _sum(damage)


# Equipped mods add percent bonuses on top of the base stats, e.g. Serration +165% is x2.65 damage
func apply_mods(mods: Array = [], mod_category: String = "") -> void:
	var b := ModEffects.weapon_mod_bonuses(mods, mod_category)
	var pct := func(value: float) -> float: return 1.0 + value / 100.0
	for key in damage.keys():
		damage[key] *= pct.call(b["damage"])
	crit_chance += b["critChance"] / 100.0
	crit_multiplier *= pct.call(b["critDamage"])
	status_chance += b["statusChance"] / 100.0
	fire_rate *= pct.call(b["fireRate"])
	reload_speed /= pct.call(b["reloadSpeed"])
	var old_magazine := magazine
	magazine = roundi(old_magazine * pct.call(b["magazine"]))
	if ammo == old_magazine:
		ammo = magazine  # a full magazine stays full


func update(dt: float, firing := false) -> void:
	if not firing:
		trigger_held = false
		fire_accumulator = 0.0

	current_spread = maxf(min_spread, current_spread - Constants.SPREAD_RECOVERY_DEG_PER_SEC * dt)

	if not reloading:
		return
	reload_remaining -= dt
	if reload_remaining > 0.0:
		return

	var needed := magazine - ammo
	var loaded := mini(needed, ammo_reserve)
	ammo += loaded
	ammo_reserve -= loaded
	reloading = false
	reload_remaining = 0.0


func fire(player, target, dt: float, projectiles: Array = [], options: Dictionary = {}) -> void:
	if reloading:
		return

	var interval := 1.0 / fire_rate
	if not trigger_held:
		trigger_held = true
		fire_accumulator = interval
	fire_accumulator += dt
	if fire_accumulator < interval:
		return
	fire_accumulator -= interval

	if ammo < ammo_cost:
		start_reload()
		return

	var aim_x: float = target.x - player.x
	var aim_y: float = target.y - player.y
	var aim_distance := Vector2(aim_x, aim_y).length()
	if aim_distance == 0.0:
		return

	ammo -= ammo_cost
	last_fire_time = Time.get_ticks_msec()
	_play_sound(_or(stats.get("sound"), "gunshot"), 0.35)

	var base_x := aim_x / aim_distance
	var base_y := aim_y / aim_distance
	var pellets := roll_pellet_count(multishot)
	var max_distance := weapon_range * Constants.UNITS_PER_METER
	var projectile_speed: float = float(Constants.HITSCAN_SPEED) if shot_type == "hit-scan" else 5000.0
	var muzzle_offset := 20.0

	for _i in pellets:
		var spread_sign := -1.0 if randf() < 0.5 else 1.0
		var spread_rad := (current_spread * PI / 180.0) * randf() * spread_sign
		var direction := rotate_direction(base_x, base_y, spread_rad)
		var hit := roll_hit(aim_distance / Constants.UNITS_PER_METER)
		hit["sourceX"] = player.x
		hit["sourceY"] = player.y

		var projectile_options := {
			"speed": projectile_speed,
			"maxDistance": max_distance,
			"punchThrough": punch_through,
			"targets": options.get("targets"),
		}
		if options.get("color") != null:
			projectile_options["color"] = options["color"]
		projectiles.append(Projectile.new(
			player.x + direction.x * muzzle_offset,
			player.y + direction.y * muzzle_offset,
			direction.x,
			direction.y,
			hit,
			projectile_options,
		))

	current_spread = minf(max_spread, current_spread + (max_spread - min_spread) * 0.2)


func roll_hit(distance_meters := 0.0) -> Dictionary:
	var crit := randf() < crit_chance
	var multiplier := (crit_multiplier if crit else 1.0) * falloff_multiplier(falloff, distance_meters)
	var impact: float = damage.get("impact", 0.0) * multiplier
	var puncture: float = damage.get("puncture", 0.0) * multiplier
	var slash: float = damage.get("slash", 0.0) * multiplier
	var heat: float = damage.get("heat", 0.0) * multiplier
	var total := impact + puncture + slash + heat
	var base_total := _sum(damage)

	var status = null
	if base_total > 0.0 and randf() < status_chance:
		var roll := randf() * base_total
		var impact_share: float = damage.get("impact", 0.0)
		var puncture_share: float = damage.get("puncture", 0.0)
		var slash_share: float = damage.get("slash", 0.0)
		if roll < impact_share:
			status = "impact"
		elif roll < impact_share + puncture_share:
			status = "puncture"
		elif roll < impact_share + puncture_share + slash_share:
			status = "slash"
		else:
			status = "heat"

	# Bleed (wiki): each tick uses the base damage with the critical multiplier on crit hits,
	# and ignores the falloff and the physical/elemental bonuses
	var proc_base := base_total * (crit_multiplier if crit else 1.0)
	return {
		"impact": impact,
		"puncture": puncture,
		"slash": slash,
		"heat": heat,
		"total": total,
		"baseTotal": base_total,
		"procBase": proc_base,
		"crit": crit,
		"status": status,
	}


func start_reload() -> void:
	if reloading or ammo >= magazine or ammo_reserve <= 0:
		return
	reloading = true
	reload_remaining = reload_speed
	_play_sound(_or(stats.get("reloadSound"), "reload"), 0.7)


func _play_sound(sound_name: String, volume: float) -> void:
	AudioManager.play(sound_name, volume)


# Damage falloff: full damage up to `start` metres, a linear drop to `minMultiplier` at `end`, then flat.
# Weapons without falloff data always return 1.
static func falloff_multiplier(falloff_data, distance_meters: float) -> float:
	if falloff_data == null:
		return 1.0
	var start: float = falloff_data["start"]
	var end: float = falloff_data["end"]
	var min_multiplier: float = falloff_data["minMultiplier"]
	if distance_meters <= start:
		return 1.0
	if distance_meters >= end:
		return min_multiplier
	var t := (distance_meters - start) / (end - start)
	return 1.0 - (1.0 - min_multiplier) * t


# Wiki: the whole part of multishot is always fired, and the fraction is the chance of one extra projectile
# (2.8 fires 2 projectiles, with an 80% chance of a third). At least one projectile always fires.
static func roll_pellet_count(multishot_value: float) -> int:
	var whole := maxi(1, floori(multishot_value))
	var fraction := multishot_value - floorf(multishot_value)
	return whole + (1 if fraction > 0.0 and randf() < fraction else 0)


static func rotate_direction(x: float, y: float, angle: float) -> Vector2:
	var cos_a := cos(angle)
	var sin_a := sin(angle)
	return Vector2(x * cos_a - y * sin_a, x * sin_a + y * cos_a)
