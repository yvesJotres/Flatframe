class_name ExcaliburAbilities
extends RefCounted

# Excalibur's abilities 2-4 and the shared helpers. Port of src/warframe/abilities/excalibur_abilities.js.
# Ported: the logic and the numbers. Not ported: the energy-javelin and energy-wave drawings, which
# the browser draws with src/engine/energy_visuals.js.

const UNITS_PER_METRE := 15.0

const RADIAL_BLIND := {
	"energy_cost": 50.0,
	"radius": 8.0 * UNITS_PER_METRE,   # wiki: 8 m
	"duration": 7.0,                   # wiki: 7 s
}
const RADIAL_JAVELIN := {
	"energy_cost": 75.0,
	"radius": 15.0 * UNITS_PER_METRE,  # 225 units
	"damage": 500.0,                   # wiki: 500 per javelin, split across Impact, Puncture and Slash
}
const EXALTED_BLADE := {
	"energy_cost": 25.0,
	"drain_per_second": 2.5,           # wiki: 2.5 energy per second while active
}
# The Exalted Blade's normal attack: 37.5 impact + 37.5 puncture + 175 slash (wiki: 250 total)
const EXALTED_BLADE_TOTAL_DAMAGE := 250.0
const EXALTED_WAVE_COOLDOWN := 0.6     # seconds between energy waves (placeholder)


# Spends energy and returns true if the cast went off. Affinity = energy cost, all to the Warframe (wiki).
static func spend(player: Object, cost: float) -> bool:
	if player.energy < cost:
		return false
	player.energy -= cost
	Progression.add_affinity("Excalibur", cost, "frame")
	return true


# Enemies alive within radius of origin, counting each enemy's own radius (excalibur_abilities.js enemiesWithin)
static func enemies_within(origin: Vector2, radius: float, enemies: Array) -> Array:
	var found: Array = []
	for e in enemies:
		if not is_instance_valid(e) or e.dead:
			continue
		if origin.distance_to(e.position) <= radius + e.RADIUS:
			found.append(e)
	return found


# Blinds every enemy in range for the duration (the enemy's own blind state, see enemy.gd apply_blind)
static func cast_radial_blind(player: Object, enemies: Array) -> bool:
	if not spend(player, RADIAL_BLIND.energy_cost):
		return false
	for enemy in enemies_within(player.position, RADIAL_BLIND.radius, enemies):
		enemy.apply_blind(RADIAL_BLIND.duration)
	return true


# Deals the javelin damage to every enemy in range
static func cast_radial_javelin(player: Object, enemies: Array) -> bool:
	if not spend(player, RADIAL_JAVELIN.energy_cost):
		return false
	for enemy in enemies_within(player.position, RADIAL_JAVELIN.radius, enemies):
		enemy.take_damage(RADIAL_JAVELIN.damage)
	return true


# Distance from point p to the segment a-b (excalibur_abilities.js distanceToSegment)
static func distance_to_segment(p: Vector2, a: Vector2, b: Vector2) -> float:
	var d := b - a
	var length_sq := d.length_squared()
	var t := 0.0 if length_sq == 0.0 else clampf((p - a).dot(d) / length_sq, 0.0, 1.0)
	return p.distance_to(a + d * t)
