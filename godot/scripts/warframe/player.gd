class_name Player
extends Node2D

# Warframe-style player: WASD movement, mouse aim, primary weapon fire and reload.
# Values mirror src/warframe/player.js and src/weapons/weapon.js where the JS defines them.

const RADIUS := 16.0
const MOVE_SPEED := 400.0       # src/warframe/player.js moveSpeed
const ACCELERATION := 3600.0    # player.js acceleration (px/s²)
const DECELERATION := 4800.0    # player.js deceleration (px/s²)
const MAX_HP := 100.0
const PROJECTILE_SPEED := 700.0   # constants.js DEFAULT_PROJECTILE_SPEED (an autoload name cannot be used in a constant)
const PROJECTILE_LIFETIME := 2.0

var velocity := Vector2.ZERO            # px/s, eased toward the input (player.js velocity)
var max_hp := MAX_HP   # set by the mission from the frame's base health and its mods
var max_shield := 0.0  # set by the mission from the frame's base shield and its mods
var max_armor := 0.0   # set by the mission from the frame's base armor and its mods
var health: HealthComponent
var time_since_damage := INF            # seconds since the shield last took damage (player.js timeSinceDamage)
var shield_recharge_bonus := 0.0        # from mods such as Fast Deflection (player.js shieldRechargeBonus)
var shield_recharge_delay_reduction := 0.0   # capped at 80% when used (player.js shieldRechargeDelayReduction)

# Bleed-out and revive, port of src/warframe/player.js
var alive := true
var is_bleeding_out := false
var awaiting_revive := false        # the bleed-out timer has run out: only the self-revive works now
var bleedout_timer := 0.0
var revive_hold_time := 0.0         # seconds X has been held
var revives_remaining := 4
var awaiting_pulse := 0.0

# Energy, shown on the HUD. Starts at the browser build's STARTING_ENERGY (50); no regeneration yet.
var energy := 50.0
var weapon: Dictionary = {}
# Both weapons the Warframe carries (1 = primary, 2 = secondary). Each keeps its own ammo.
var slots: Dictionary = {"primary": {"data": {}, "ammo": 0}, "secondary": {"data": {}, "ammo": 0}}
var active_slot := "primary"
# Melee (E): a swing at the enemies in front of the Warframe (src/weapons/melee_weapon.js, quick attack)
var melee: Dictionary = {}
var melee_cooldown := 0.0
var heavy_cooldown := 0.0
var combo_count := 0          # melee hits in a row (melee_weapon.js comboCount)
var combo_timer := 0.0        # seconds left before the combo resets (COMBO_RESET_MS = 5 s)
var swing_flash := 0.0        # seconds the swing arc stays on screen
var swing_reach := 0.0
var swing_half_arc := 0.0
var shot_serial := 0           # counts shots, so enemies can tell a new shot from an old one
var shot_pos := Vector2.ZERO
const PARRY_DAMAGE_TAKEN := 0.1   # parry: 90% damage reduction (melee_weapon.js parryDamageReduction)
const HEAVY_MULTIPLIER := 2.0     # the melee heavy attack's damage_multiplier (Skana attack data)
const STEALTH_MULTIPLIER := 2.0   # unranked stealth damage bonus (stealth.js stealthMultiplier)
const GROUND_FINISHER_MULTIPLIER := 4.0   # combat/stealth.js: ground finishers deal 400% as true damage
var parrying := false
const MELEE_RANGE_METRES := 2.5
const UNITS_PER_METRE := 15.0
var key_was_down := {}
var ammo := 0
var reload_left := 0.0
var fire_cooldown := 0.0
var aim_dir := Vector2.RIGHT
var bounds := Vector2(1600, 1200)
var blocked: Callable   # set by the mission: true when a circle at a point touches a wall

# Parkour (src/warframe/jump.js, player.js crouch and jump)
var jump := JumpState.new()
var radius := RADIUS            # RADIUS standing, JumpState.CROUCH_RADIUS crouched
var sight_factor := 1.0         # enemies see a crouched Warframe from less far
var crouching := false
var shift_was_down := false
var slash_dash := SlashDash.new()        # ability 1 (src/warframe/abilities/excalibur_abilities.js)
var exalted_blade := ExaltedBlade.new()  # ability 4
var dash_trail := DashTrail.new()
var bullet_visual_timer := 0.0  # seconds left on the bullet jump's trail
var bullet_origin := Vector2.ZERO

# Sets both weapons (with their mods applied) and starts on the primary
func set_weapons(primary: Dictionary, secondary: Dictionary) -> void:
	slots.primary = {"data": primary, "ammo": int(primary.get("magazineSize", 30))}
	slots.secondary = {"data": secondary, "ammo": int(secondary.get("magazineSize", 12))}
	switch_to("primary", true)

# Makes a slot the active weapon, keeping each weapon's ammo. Switching cancels a reload.
func switch_to(slot: String, force: bool = false) -> void:
	if slot == active_slot and not force:
		return
	if not force:
		slots[active_slot].ammo = ammo
	active_slot = slot
	weapon = slots[slot].data
	ammo = int(slots[slot].ammo)
	reload_left = 0.0

# Quick melee swing: the enemies inside the arc in front of the aim take the melee weapon's total damage
# Combo multiplier for heavy attacks (melee_weapon.js getComboMultiplier): 1 under 20 hits, then one more per 20, up to 12
func combo_multiplier() -> int:
	if combo_count < 20:
		return 1
	return mini(12, combo_count / 20 + 1)

func melee_swing(heavy: bool = false) -> int:
	if melee.is_empty() or (heavy and heavy_cooldown > 0.0) or (not heavy and melee_cooldown > 0.0):
		return -1
	if heavy:
		heavy_cooldown = 1.0 / maxf(float(melee.get("fireRate", 1.0)), 0.001) * 2.0
		melee_cooldown = heavy_cooldown
	var attacks: Array = melee.get("attacks", [])
	var attack: Dictionary = attacks[0] if attacks.size() > 0 else {}
	melee_cooldown = 1.0 / maxf(float(melee.get("fireRate", 1.0)), 0.001)
	var reach := float(attack.get("range", MELEE_RANGE_METRES)) * UNITS_PER_METRE
	var half_arc := deg_to_rad(float(attack.get("blocking_angle", 45.0))) / 2.0
	var damage := float(melee.get("damage", {}).get("total", 0.0))
	if heavy:
		damage *= HEAVY_MULTIPLIER * combo_multiplier()
	swing_flash = 0.15
	swing_reach = reach
	swing_half_arc = half_arc
	var hits := 0
	for enemy in get_tree().get_nodes_in_group("enemies"):
		if enemy.dead:
			continue
		var to_enemy: Vector2 = enemy.position - position
		if to_enemy.length() > reach + enemy.RADIUS:
			continue
		if absf(aim_dir.angle_to(to_enemy)) <= half_arc:
			if enemy.is_downed():
				# Ground finisher: 400% of the normal attack as true damage (combat/stealth.js GROUND_FINISHER_MULTIPLIER)
				enemy.take_damage(damage * GROUND_FINISHER_MULTIPLIER, true)
				hits += 1
				continue
			# Stealth: an enemy that has not noticed the Warframe takes the stealth bonus
			var hit := damage * (STEALTH_MULTIPLIER if enemy.alert == "unalerted" else 1.0)
			enemy.take_damage(hit)
			if heavy:
				enemy.knock_down()   # placeholder trigger (melee_weapon.js): a heavy attack knocks the enemy down
			hits += 1
	if heavy:
		combo_count = 0
	else:
		combo_count += hits
		combo_timer = 5.0
	# While the Exalted Blade is summoned, each swing sends an energy wave along the aim
	exalted_blade.fire_wave(position, aim_dir.angle())
	return hits


# G throws a grenade at the mouse position (src/weapons/grenade.js)
func throw_grenade() -> void:
	var g := Grenade.new()
	g.position = global_position
	g.target_pos = get_global_mouse_position()
	get_parent().add_child(g)

func _check_weapon_keys() -> void:
	var grenade_down := Input.is_physical_key_pressed(KEY_G)
	if grenade_down and not key_was_down.get(KEY_G, false):
		throw_grenade()
	key_was_down[KEY_G] = grenade_down
	var melee_down := Input.is_physical_key_pressed(KEY_E)
	if melee_down and not key_was_down.get(KEY_E, false):
		melee_swing()
	key_was_down[KEY_E] = melee_down
	var heavy_down := Input.is_mouse_button_pressed(MOUSE_BUTTON_MIDDLE)
	if heavy_down and not key_was_down.get(MOUSE_BUTTON_MIDDLE, false):
		melee_swing(true)
	key_was_down[MOUSE_BUTTON_MIDDLE] = heavy_down
	parrying = Input.is_mouse_button_pressed(MOUSE_BUTTON_RIGHT)
	# F swaps between the primary and the secondary (src/warframe/weapon_switch.js). Keys 1-4 are the abilities.
	var f_down := Input.is_physical_key_pressed(KEY_F)
	if f_down and not key_was_down.get(KEY_F, false):
		switch_to("secondary" if active_slot == "primary" else "primary")
	key_was_down[KEY_F] = f_down


# Keys 1-4: Excalibur's abilities (src/warframe/player.js). Each acts on the press, not while held.
func _check_abilities() -> void:
	var enemies := get_tree().get_nodes_in_group("enemies")
	var k1 := Input.is_physical_key_pressed(KEY_1)
	if k1 and not key_was_down.get(KEY_1, false):
		slash_dash.activate(self, aim_dir.angle())
	key_was_down[KEY_1] = k1
	var k2 := Input.is_physical_key_pressed(KEY_2)
	if k2 and not key_was_down.get(KEY_2, false):
		ExcaliburAbilities.cast_radial_blind(self, enemies)
	key_was_down[KEY_2] = k2
	var k3 := Input.is_physical_key_pressed(KEY_3)
	if k3 and not key_was_down.get(KEY_3, false):
		ExcaliburAbilities.cast_radial_javelin(self, enemies)
	key_was_down[KEY_3] = k3
	var k4 := Input.is_physical_key_pressed(KEY_4)
	if k4 and not key_was_down.get(KEY_4, false):
		exalted_blade.toggle(self)
	key_was_down[KEY_4] = k4

func _ready() -> void:
	health = HealthComponent.new({"maxHp": max_hp, "maxShield": max_shield, "armor": max_armor}, true)
	ammo = int(weapon.get("magazineSize", 30))


func _process(delta: float) -> void:
	health.update(delta)
	if not alive:
		return
	if is_bleeding_out:
		_update_downed(delta)
		queue_redraw()
		return
	recharge_shield(delta)
	if health.is_dead():
		return
	_check_weapon_keys()
	_check_abilities()
	_move(delta)
	exalted_blade.update(delta, self)
	exalted_blade.update_waves(delta, get_tree().get_nodes_in_group("enemies"), blocked)
	if slash_dash.active and exalted_blade.active:
		dash_trail.record(position)
	dash_trail.update(delta)
	_aim()
	fire_cooldown = max(0.0, fire_cooldown - delta)
	if reload_left > 0.0:
		reload_left -= delta
		if reload_left <= 0.0:
			ammo = int(weapon.get("magazineSize", 30))
	melee_cooldown = maxf(0.0, melee_cooldown - delta)
	heavy_cooldown = maxf(0.0, heavy_cooldown - delta)
	swing_flash = maxf(0.0, swing_flash - delta)
	if combo_timer > 0.0:
		combo_timer -= delta
		if combo_timer <= 0.0:
			combo_count = 0
	if Input.is_key_pressed(KEY_R) and reload_left <= 0.0 and ammo < int(weapon.get("magazineSize", 30)):
		reload_left = float(weapon.get("reloadTime", 2.0))
		Sounds.play("reload")
	if Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT):
		_try_fire()
	queue_redraw()


func _move(delta: float) -> void:
	var dir := Vector2.ZERO
	if Input.is_key_pressed(KEY_W): dir.y -= 1.0
	if Input.is_key_pressed(KEY_S): dir.y += 1.0
	if Input.is_key_pressed(KEY_A): dir.x -= 1.0
	if Input.is_key_pressed(KEY_D): dir.x += 1.0

	# Crouch (held Ctrl): smaller hitbox, and enemies see it from less far (enemy.js sightFactor)
	crouching = Input.is_key_pressed(KEY_CTRL)
	radius = JumpState.CROUCH_RADIUS if crouching else JumpState.STAND_RADIUS
	sight_factor = JumpState.CROUCH_SIGHT_FACTOR if crouching else 1.0

	# Jump (Shift): hop, double jump, or bullet jump when crouched. Acts on the press, not while held.
	var shift_down := Input.is_key_pressed(KEY_SHIFT)
	if shift_down and not shift_was_down:
		var kind := jump.press(dir, aim_dir, crouching)
		if kind == "bullet":
			bullet_visual_timer = 0.15
			bullet_origin = position   # the blast happens where the jump began (wiki)
	shift_was_down = shift_down
	var landing := jump.update(delta)
	if landing == "bullet":
		_blast_on_landing()
	if bullet_visual_timer > 0.0:
		bullet_visual_timer -= delta

	if slash_dash.active:
		# The Slash Dash moves the Warframe itself (slash_dash.update), so WASD and the jump do not
		slash_dash.update(delta, self, get_tree().get_nodes_in_group("enemies"))
		return
	if jump.airborne:
		# The jump carries the player; WASD does not steer it
		velocity = Vector2(jump.vx, jump.vy)
	else:
		# Velocity eases toward the input, per axis, as player.js does
		var target := dir.normalized() * MOVE_SPEED if dir != Vector2.ZERO else Vector2.ZERO
		var rate := (ACCELERATION if dir != Vector2.ZERO else DECELERATION) * delta
		velocity.x = move_toward(velocity.x, target.x, rate)
		velocity.y = move_toward(velocity.y, target.y, rate)
	_step(velocity * delta)


# Moves by step, sliding along walls: each axis is tried on its own
func _step(step: Vector2) -> void:
	if not blocked.is_valid() or not blocked.call(position + Vector2(step.x, 0.0), radius):
		position.x += step.x
	if not blocked.is_valid() or not blocked.call(position + Vector2(0.0, step.y), radius):
		position.y += step.y
	position = position.clamp(Vector2(radius, radius), bounds - Vector2(radius, radius))


# A bullet jump's blast (wiki): 100 damage within 3 m of where the jump began, falling off toward the edge.
# The guaranteed Blast proc is not applied yet, as in player.js.
func _blast_on_landing() -> void:
	var origin := bullet_origin
	for e in get_tree().get_nodes_in_group("enemies"):
		if e.dead:
			continue
		var dist: float = e.position.distance_to(origin)
		var reach: float = JumpState.BLAST_RADIUS + e.RADIUS
		if dist > reach:
			continue
		var falloff: float = 1.0 - (1.0 - JumpState.BLAST_MIN_FRACTION) * (dist / reach)
		e.take_damage(JumpState.BLAST_DAMAGE * falloff)


func _aim() -> void:
	if get_viewport() == null:   # headless tests have no viewport to read the mouse from
		return
	var to_mouse := get_global_mouse_position() - global_position
	if to_mouse.length() > 1.0:
		aim_dir = to_mouse.normalized()


func _try_fire() -> void:
	if fire_cooldown > 0.0 or reload_left > 0.0:
		return
	if ammo <= 0:
		reload_left = float(weapon.get("reloadTime", 2.0))
		return
	ammo -= 1
	var fire_rate := float(weapon.get("fireRate", 8.0))
	fire_cooldown = 1.0 / max(fire_rate, 0.001)
	var proj := Projectile.new()
	proj.position = global_position + aim_dir * RADIUS
	proj.velocity = aim_dir * PROJECTILE_SPEED
	proj.damage = float(weapon.get("damage", {}).get("total", 10.0))
	proj.proc_chance = float(weapon.get("procChance", 0.0))
	shot_serial += 1
	shot_pos = global_position
	proj.damage_weights = _damage_weights(weapon)
	proj.lifetime = PROJECTILE_LIFETIME
	get_parent().add_child(proj)


# Damage by type from the weapon's damage block, without the total (the weights for a proc)
func _damage_weights(w: Dictionary) -> Dictionary:
	var out := {}
	for k in w.get("damage", {}):
		if k != "total" and float(w.damage[k]) > 0.0:
			out[k] = float(w.damage[k])
	return out

func take_damage(amount: float) -> void:
	# Downed players take no damage (player.js takeDamage)
	if not alive or is_bleeding_out:
		return
	# Shields, shield gate and armor reduction all live in HealthComponent (src/combat/health.js port)
	var old_shield := health.shield
	if parrying and melee.size() > 0:
		amount *= PARRY_DAMAGE_TAKEN
	health.take_damage(amount)
	# Only a hit that actually took shield restarts the recharge delay
	if health.shield < old_shield:
		time_since_damage = 0.0
	if health.is_dead():
		if revives_remaining > 0:
			# Lethal damage drops the player to 1 hp and starts the 20 s bleed-out
			is_bleeding_out = true
			awaiting_revive = false
			bleedout_timer = 20.0
			health.hp = 1.0
		else:
			alive = false


# Port of the downed state in player.js. The body can only aim while bleeding out (the JS fires the secondary).
func _update_downed(delta: float) -> void:
	if not awaiting_revive:
		bleedout_timer -= delta
	if Input.is_key_pressed(KEY_X):
		revive_hold_time += delta
		if revive_hold_time >= 2.0 and revives_remaining > 0:
			_complete_self_revive()
			return
	else:
		revive_hold_time = 0.0
	if revives_remaining <= 0:
		alive = false
		is_bleeding_out = false
		return
	if bleedout_timer <= 0.0:
		if not awaiting_revive:
			awaiting_revive = true
		awaiting_pulse += delta
		return
	_aim()


func _complete_self_revive() -> void:
	revives_remaining -= 1
	is_bleeding_out = false
	awaiting_revive = false
	revive_hold_time = 0.0
	Sounds.play("revive")
	health.hp = max_hp
	health.shield = max_shield
	time_since_damage = 0.0


# Port of the shield recharge in src/warframe/player.js. A partly full shield recharges after 1 s without
# damage; a fully depleted one after 4 s. Recharge is (15 + 0.05 x max shield) x (1 + bonus) per second.
func recharge_shield(dt: float) -> void:
	var reduction := minf(0.8, shield_recharge_delay_reduction)
	time_since_damage += dt
	var delay := (4.0 if health.shield <= 0.0 else 1.0) * (1.0 - reduction)
	if time_since_damage < delay or health.shield >= health.max_shield or not health.can_regenerate_shield():
		return
	var regen := (15.0 + 0.05 * health.max_shield) * (1.0 + shield_recharge_bonus) * dt
	# Recharge during the gate invulnerability window ends it
	if health.shield_gate_timer > 0.0:
		health.shield_gate_timer = 0.0
		health.shield_gate_invulnerable = false
	health.shield = minf(health.max_shield, health.shield + regen)
	if health.shield > health.max_shield_since_last_gate:
		health.max_shield_since_last_gate = health.shield


func _draw() -> void:
	if awaiting_revive:
		# Body is gone: a pulsing X where the player went down (player.js draw)
		var pulse := 0.55 + 0.45 * sin(awaiting_pulse * 4.0)
		draw_line(Vector2(-10, -10), Vector2(10, 10), Color(1.0, 0.31, 0.31, pulse), 4.0)
		draw_line(Vector2(10, -10), Vector2(-10, 10), Color(1.0, 0.31, 0.31, pulse), 4.0)
		draw_string(ThemeDB.fallback_font, Vector2(-80, 30), "HOLD X TO SELF-REVIVE", HORIZONTAL_ALIGNMENT_CENTER, 160, 12, Color(1, 1, 1, pulse))
		return
	var col := Color("4ade80") if alive and not is_bleeding_out else Color(0.4, 0.4, 0.4)
	draw_circle(Vector2.ZERO, RADIUS, col)
	if swing_flash > 0.0:
		var a0 := aim_dir.angle() - swing_half_arc
		draw_arc(Vector2.ZERO, swing_reach, a0, a0 + swing_half_arc * 2.0, 16, Color(1, 1, 1, swing_flash / 0.15), 3.0)
	if is_bleeding_out:
		draw_string(ThemeDB.fallback_font, Vector2(-80, 30), "BLEEDING OUT", HORIZONTAL_ALIGNMENT_CENTER, 160, 12, Color("#ff6b35"))
		return
	draw_line(Vector2.ZERO, aim_dir * (RADIUS + 10.0), Color.WHITE, 2.0)
