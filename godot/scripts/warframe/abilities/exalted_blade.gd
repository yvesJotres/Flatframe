class_name ExaltedBlade
extends RefCounted

# Excalibur's Exalted Blade (ability 4). Port of the ExaltedBlade class in excalibur_abilities.js.
# Channelled: press 4 to summon, press again (or run out of energy) to dismiss. While summoned it drains energy,
# and each melee attack sends an energy wave along the aim.

var active := false
var cooldown := 0.0   # seconds until the next energy wave
var waves: Array = []  # energy waves in flight


# A melee attack of the summoned blade sends an energy wave along the aim (wiki: normal attacks emit one)
func fire_wave(origin: Vector2, angle: float) -> void:
	if not active or cooldown > 0.0:
		return
	cooldown = ExcaliburAbilities.EXALTED_WAVE_COOLDOWN
	waves.append(EnergyWave.new(origin, angle, ExcaliburAbilities.EXALTED_BLADE_TOTAL_DAMAGE))


func update_waves(delta: float, enemies: Array, blocked: Callable) -> void:
	for wave in waves:
		wave.update(delta, enemies, blocked)
	waves = waves.filter(func(w): return w.active)


# Summons or dismisses the blade. Returns true if the press did something.
func toggle(player: Object) -> bool:
	if active:
		active = false
		return true
	if not ExcaliburAbilities.spend(player, ExcaliburAbilities.EXALTED_BLADE.energy_cost):
		return false
	active = true
	return true


func update(delta: float, player: Object) -> void:
	cooldown = maxf(0.0, cooldown - delta)
	if not active:
		return
	var drain: float = ExcaliburAbilities.EXALTED_BLADE.drain_per_second * delta
	if player.energy < drain:
		player.energy = 0.0
		active = false
		return
	player.energy -= drain
