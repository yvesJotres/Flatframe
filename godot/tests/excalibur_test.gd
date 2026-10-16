extends SceneTree

# Checks Excalibur's abilities (src/warframe/abilities/excalibur_abilities.js): the radial abilities, the Exalted Blade
# and its energy waves, the Slash Dash and the dash trail. Run headless from the godot/ folder:
#   godot --headless -s res://tests/excalibur_test.gd

var passes := 0
var failures := 0


func check(condition: bool, label: String) -> void:
	if condition:
		passes += 1
	else:
		failures += 1
		print("FAIL: ", label)


# A stand-in for the Warframe: only the fields the abilities read and write
class FakePlayer extends RefCounted:
	var energy := 100.0
	var position := Vector2.ZERO
	var radius := 16.0
	var velocity := Vector2.ZERO
	var blocked: Callable
	var combo := 1

	func combo_multiplier() -> int:
		return combo


# A stand-in for an enemy: records damage and blinds
class FakeEnemy extends RefCounted:
	const RADIUS := 16.0
	var position := Vector2.ZERO
	var dead := false
	var damage_taken: Array = []
	var blinded := 0.0

	func _init(at: Vector2) -> void:
		position = at

	func take_damage(amount: float, _true_damage: bool = false) -> void:
		damage_taken.append(amount)

	func apply_blind(duration: float) -> void:
		blinded = duration


func total(enemy: FakeEnemy) -> float:
	var sum := 0.0
	for d in enemy.damage_taken:
		sum += d
	return sum


func _initialize() -> void:
	# Radial Blind: 50 energy, 8 m radius, 7 s
	var p := FakePlayer.new()
	var near := FakeEnemy.new(Vector2(100, 0))   # 100 units: inside 120 plus the enemy radius
	var far := FakeEnemy.new(Vector2(300, 0))
	check(ExcaliburAbilities.cast_radial_blind(p, [near, far]), "Radial Blind casts with enough energy")
	check(is_equal_approx(p.energy, 50.0), "Radial Blind costs 50 energy")
	check(near.blinded == 7.0, "an enemy in range is blinded for 7 s")
	check(far.blinded == 0.0, "an enemy out of range is not blinded")
	var low := FakePlayer.new()
	low.energy = 40.0
	check(not ExcaliburAbilities.cast_radial_blind(low, [near]), "Radial Blind does nothing below its cost")
	check(low.energy == 40.0, "a refused cast spends nothing")

	# Radial Javelin: 75 energy, 15 m, 500 damage
	p = FakePlayer.new()
	var jnear := FakeEnemy.new(Vector2(150, 0))  # inside 225 + 16
	var jfar := FakeEnemy.new(Vector2(300, 0))
	check(ExcaliburAbilities.cast_radial_javelin(p, [jnear, jfar]), "Radial Javelin casts with enough energy")
	check(is_equal_approx(p.energy, 25.0), "Radial Javelin costs 75 energy")
	check(total(jnear) == 500.0, "an enemy in range takes 500 from the javelin")
	check(total(jfar) == 0.0, "an enemy out of range takes no javelin damage")

	# Exalted Blade: toggled on for 25 energy, drains 2.5 a second, dismissed when empty
	var blade := ExaltedBlade.new()
	p = FakePlayer.new()
	p.energy = 30.0
	check(blade.toggle(p) and blade.active, "the Exalted Blade is summoned for 25 energy")
	check(is_equal_approx(p.energy, 5.0), "summoning spends 25 energy")
	blade.update(1.0, p)
	check(is_equal_approx(p.energy, 2.5), "the blade drains 2.5 energy a second")
	blade.update(2.0, p)
	check(not blade.active and p.energy == 0.0, "the blade is dismissed when energy runs out")
	p.energy = 50.0
	check(blade.toggle(p) and blade.active, "the blade can be summoned again")
	check(blade.toggle(p) and not blade.active, "a second press dismisses the blade")

	# Energy waves: one per cooldown while summoned, 250 damage at the blade
	blade = ExaltedBlade.new()
	p = FakePlayer.new()
	blade.fire_wave(Vector2.ZERO, 0.0)
	check(blade.waves.is_empty(), "no wave when the blade is not summoned")
	blade.toggle(p)
	blade.fire_wave(Vector2.ZERO, 0.0)
	blade.fire_wave(Vector2.ZERO, 0.0)
	check(blade.waves.size() == 1, "a second wave waits for the cooldown")
	blade.update(ExcaliburAbilities.EXALTED_WAVE_COOLDOWN, p)
	blade.fire_wave(Vector2.ZERO, 0.0)
	check(blade.waves.size() == 2, "a wave fires again after the cooldown")

	var wave_hit := FakeEnemy.new(Vector2(10, 0))
	var wave := EnergyWave.new(Vector2.ZERO, 0.0, 250.0)
	wave.update(0.01, [wave_hit], Callable())
	check(total(wave_hit) == 250.0, "a wave hit at the blade deals the full 250")
	check(is_equal_approx(wave.max_distance, EnergyWave.RANGE - EnergyWave.HIT_RANGE_LOSS), "a hit shortens the wave's range by 15 m")
	var behind := FakeEnemy.new(Vector2(12, 0))
	wave.update(0.01, [behind, wave_hit], Callable())
	check(total(wave_hit) == 250.0 and total(behind) < 250.0 and total(behind) > 0.0, "a wave hits each enemy once, with less damage after the first")

	var walled := EnergyWave.new(Vector2.ZERO, 0.0, 250.0)
	var wall := func(point: Vector2, _radius: float) -> bool: return point.x >= 100.0
	var far_enemy := FakeEnemy.new(Vector2(500, 0))
	for i in 100:
		walled.update(0.05, [far_enemy], wall)
	check(not walled.active and far_enemy.damage_taken.is_empty(), "a wave stops at a wall and hits nothing past it")

	var falloff_wave := EnergyWave.new(Vector2.ZERO, 0.0, 250.0)
	falloff_wave.travelled = EnergyWave.RANGE / 2.0
	check(is_equal_approx(falloff_wave.falloff(), 0.5), "the wave's damage falls off to nothing at its range")

	# Slash Dash: 25 energy, one strike per enemy, locked on in the aim cone
	var dash := SlashDash.new()
	p = FakePlayer.new()
	p.energy = 30.0
	check(dash.activate(p, 0.0) and dash.active, "the Slash Dash starts with 25 energy")
	check(is_equal_approx(p.energy, 5.0), "the Slash Dash costs 25 energy")
	check(not dash.activate(p, 0.0), "the Slash Dash cannot start again while it runs")

	# No target: the dash goes straight for its 20 m range
	dash = SlashDash.new()
	p = FakePlayer.new()
	dash.activate(p, 0.0)
	for i in 200:
		dash.update(0.02, p, [])
	check(not dash.active and is_equal_approx(p.position.x, SlashDash.RANGE), "a straight dash ends at its 20 m range")

	# Locked on: strikes the enemy ahead for the base damage
	dash = SlashDash.new()
	p = FakePlayer.new()
	var target := FakeEnemy.new(Vector2(100, 0))
	dash.activate(p, 0.0)
	for i in 100:
		dash.update(0.02, p, [target])
		if not dash.active:
			break
	check(total(target) == SlashDash.DAMAGE, "a locked dash strikes its target for the base 100")
	check(not dash.active, "the dash ends after the last strike with no enemy in chain range")

	# The combo raises the strike, up to 2.75x
	dash = SlashDash.new()
	p = FakePlayer.new()
	p.combo = 5
	check(is_equal_approx(dash.strike_damage(p), 200.0), "a combo of 5 gives 2x the strike")
	p.combo = 50
	check(is_equal_approx(dash.strike_damage(p), 275.0), "the combo bonus is capped at 2.75x")

	# Dash trail: a point each 6 units, gone after 0.45 s
	var trail := DashTrail.new()
	trail.record(Vector2(0, 0))
	trail.record(Vector2(3, 0))
	trail.record(Vector2(10, 0))
	check(trail.points.size() == 2, "the trail skips points closer than 6 units")
	trail.update(0.5)
	check(trail.points.is_empty(), "trail points fade after 0.45 s")

	# Blind on a real enemy: blind and stun both last the full duration
	var enemy := Enemy.new()
	enemy.apply_blind(7.0)
	check(enemy.blind_timer == 7.0 and enemy.stun_timer == 7.0, "Blind blinds and stuns an enemy for 7 s")
	check(enemy.alert == "unalerted", "Blind returns an enemy to unalerted")
	enemy.free()

	print("%d passed, %d failed" % [passes, failures])
	quit(1 if failures > 0 else 0)
