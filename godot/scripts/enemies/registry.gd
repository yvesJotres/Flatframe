class_name EnemyUnits
extends RefCounted

# The faction units by name, as src/enemies/registry.js lists them. Each entry is the browser's base health and armour
# (before faction scaling) and whether the unit fires (ranged). Crewman has its own script (enemy_crewman.gd).

const UNITS := {
	"MOA": {"faction": "corpus", "hp": 250.0, "armor": 100.0, "ranged": false},
	"Shield Osprey": {"faction": "corpus", "hp": 120.0, "armor": 50.0, "ranged": false},
	"Charger": {"faction": "infested", "hp": 300.0, "armor": 50.0, "ranged": false},
	"Leaper": {"faction": "infested", "hp": 150.0, "armor": 20.0, "ranged": false},
	"Runner": {"faction": "infested", "hp": 100.0, "armor": 0.0, "ranged": false},
	"Lancer": {"faction": "grineer", "hp": 100.0, "armor": 100.0, "ranged": true},
	"Trooper": {"faction": "grineer", "hp": 120.0, "armor": 150.0, "ranged": true,
		"shotgun": {"pellets": 5, "damage": 52.5 + 8.75 + 8.75, "rate": 2.5, "spread_deg": 11.0, "range_m": 30.0}},
	"Butcher": {"faction": "grineer", "hp": 50.0, "armor": 200.0, "ranged": false,
		"melee": {"damage": 23.55 + 23.55 + 109.9, "rate": 0.833, "range_m": 1.7}},
}


static func create(unit: String) -> UnitEnemy:
	var data: Dictionary = UNITS[unit]
	var enemy := UnitEnemy.new()
	enemy.unit_name = unit
	enemy.faction = data.faction
	enemy.base_hp = data.hp
	enemy.base_armor = data.armor
	enemy.ranged = data.ranged
	if data.has("shotgun"):
		# Sobek (Trooper): pellets of the Sobek's total damage at its own rate, out to 30 m (wiki; falloff not applied yet)
		var s: Dictionary = data.shotgun
		enemy.pellets = s.pellets
		enemy.bullet_damage = s.damage
		enemy.fire_rate = s.rate
		enemy.aim_spread = deg_to_rad(s.spread_deg)
		enemy.engage_range = s.range_m * 15.0
	if data.has("melee"):
		# Butcher's Cleaver: the normal attack's damage (sum of its types), its rate and reach (wiki values)
		var m: Dictionary = data.melee
		enemy.melee_damage = m.damage
		enemy.melee_cooldown = 1.0 / m.rate
		enemy.melee_range = m.range_m * 15.0
	return enemy
