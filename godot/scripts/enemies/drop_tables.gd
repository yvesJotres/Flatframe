class_name DropTables
extends RefCounted

# What each enemy can drop, from the Warframe wiki. Chances are per kill. An enemy with no entry drops nothing.
# Port of src/enemies/drop_tables.js. Rows are {type, chance} plus the mod name (type "mod"), or the Endo amount
# (type "endo"). Type "region" is one of the current region's resources, picked at random.

const REGION_RESOURCES := ["ferrite", "rubedo", "neurodes", "detonite_ampule"]

const MOD_IDS := {
	"Vitality": "/Lotus/Upgrades/Mods/Utility/VitalityMod",
	"Redirection": "/Lotus/Upgrades/Mods/Utility/RedirectionMod",
	"Steel Fiber": "/Lotus/Upgrades/Mods/Utility/SteelFiberMod",
	"Ammo Drum": "/Lotus/Upgrades/Mods/Weapon/AmmoDrumMod",
	"Fury": "/Lotus/Upgrades/Mods/Melee/FuryMod",
	"No Return": "/Lotus/Upgrades/Mods/Pistol/NoReturnMod",
}

const ENEMY_DROP_TABLES := {
	"Crewman": [
		{"type": "mod", "name": "Ammo Drum", "chance": 0.0076}, {"type": "mod", "name": "Reach", "chance": 0.0076},
		{"type": "mod", "name": "Fury", "chance": 0.0022}, {"type": "mod", "name": "No Return", "chance": 0.0022},
		{"type": "mod", "name": "Reaping Spiral", "chance": 0.0022},
		{"type": "endo", "amount": 15, "chance": 0.0076}, {"type": "endo", "amount": 80, "chance": 0.0006},
		{"type": "region", "chance": 0.07},
	],
	"Lancer": [
		{"type": "mod", "name": "Pressure Point", "chance": 0.0114}, {"type": "mod", "name": "Heavy Trauma", "chance": 0.0001},
		{"type": "mod", "name": "Vitality", "chance": 0.0114}, {"type": "mod", "name": "Heated Charge", "chance": 0.0033},
		{"type": "mod", "name": "Diamond Skin", "chance": 0.0033}, {"type": "mod", "name": "Streamline", "chance": 0.0001},
		{"type": "mod", "name": "Iron Phoenix", "chance": 0.0001},
		{"type": "endo", "amount": 80, "chance": 0.0001}, {"type": "region", "chance": 0.07},
	],
	"Butcher": [
		{"type": "mod", "name": "Flow", "chance": 0.0003}, {"type": "mod", "name": "Smite Grineer", "chance": 0.0017},
		{"type": "mod", "name": "Point Strike", "chance": 0.0057}, {"type": "mod", "name": "Fast Hands", "chance": 0.0057},
		{"type": "mod", "name": "Reflex Coil", "chance": 0.0017}, {"type": "mod", "name": "North Wind", "chance": 0.0017},
		{"type": "mod", "name": "Pressure Point", "chance": 0.0057},
		{"type": "endo", "amount": 15, "chance": 0.0057}, {"type": "endo", "amount": 50, "chance": 0.0017},
		{"type": "endo", "amount": 80, "chance": 0.0003}, {"type": "region", "chance": 0.07},
	],
	"Trooper": [
		{"type": "mod", "name": "Melee Prowess", "chance": 0.0057}, {"type": "mod", "name": "Shocking Touch", "chance": 0.0033},
		{"type": "mod", "name": "Pistol Gambit", "chance": 0.0057}, {"type": "mod", "name": "Disruptor", "chance": 0.0057},
		{"type": "mod", "name": "Lingering Torment", "chance": 0.0057}, {"type": "mod", "name": "Sundering Weave", "chance": 0.0033},
		{"type": "endo", "amount": 80, "chance": 0.0006}, {"type": "region", "chance": 0.07},
	],
	"Shield Osprey": [
		{"type": "mod", "name": "Hawk Eye", "chance": 0.0022}, {"type": "mod", "name": "Shotgun Barrage", "chance": 0.0022},
		{"type": "mod", "name": "Shock Absorbers", "chance": 0.0003},
		{"type": "endo", "amount": 15, "chance": 0.0228}, {"type": "endo", "amount": 50, "chance": 0.0022},
		{"type": "endo", "amount": 80, "chance": 0.0003}, {"type": "region", "chance": 0.07},
	],
	"Charger": [
		{"type": "mod", "name": "Convulsion", "chance": 0.0022}, {"type": "mod", "name": "Speed Trigger", "chance": 0.0022},
		{"type": "mod", "name": "Regen", "chance": 0.0057}, {"type": "mod", "name": "Calculated Redirection", "chance": 0.0057},
		{"type": "mod", "name": "Rupture", "chance": 0.0057}, {"type": "mod", "name": "Fracturing Wind", "chance": 0.0022},
		{"type": "endo", "amount": 15, "chance": 0.0057}, {"type": "endo", "amount": 80, "chance": 0.0006},
		{"type": "region", "chance": 0.07},
	],
	"Leaper": [
		{"type": "mod", "name": "Assault Mode", "chance": 0.0114}, {"type": "mod", "name": "Cleanse Infested", "chance": 0.0022},
		{"type": "mod", "name": "Fatal Acceleration", "chance": 0.0022}, {"type": "mod", "name": "Spinning Needle", "chance": 0.0022},
		{"type": "mod", "name": "Seismic Palm", "chance": 0.0006},
		{"type": "endo", "amount": 15, "chance": 0.0114}, {"type": "region", "chance": 0.07},
	],
}


# The mod's id: its data id when it has one, otherwise a placeholder id from its name
static func mod_id_for(mod_name: String) -> String:
	return MOD_IDS.get(mod_name, "/Lotus/Upgrades/Mods/Wiki/" + mod_name.replace(" ", ""))


# Rolls one kill's table drops. Each row rolls on its own chance. Returns drops as {type, amount, ...}.
static func roll(enemy_name: String) -> Array:
	var out: Array = []
	for row in ENEMY_DROP_TABLES.get(enemy_name, []):
		if randf() >= float(row.chance):
			continue
		match row.type:
			"mod":
				out.append({"type": "mod", "amount": 1, "unique": mod_id_for(row.name), "name": row.name})
			"endo":
				out.append({"type": "endo", "amount": int(row.amount)})
			"region":
				out.append({"type": "resource", "amount": 1, "currency": REGION_RESOURCES[randi() % REGION_RESOURCES.size()]})
	return out
