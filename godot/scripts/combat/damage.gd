class_name DamageMath
extends RefCounted

# Armor reduction, port of src/combat/damage.js.
# Players use armor / (armor + 300); enemies use 90% x armor / 2700, capped at 2700 armor.


static func player_reduction(armor: float = 0.0) -> float:
	return armor / (armor + 300.0)


static func enemy_reduction(armor: float = 0.0) -> float:
	var capped := clampf(armor, 0.0, 2700.0)
	return 0.9 * (capped / 2700.0)


static func reduce_damage(damage: float, armor: float = 0.0, is_player: bool = false) -> float:
	var reduction := player_reduction(armor) if is_player else enemy_reduction(armor)
	return damage * (1.0 - reduction)
