class_name PrimaryWeapon
extends Weapon
## Port of java_build/src/weapons/primary_weapon.js. The primary weapon
## table, filled once from the weapons data. Call init_primary_weapons()
## before creating a PrimaryWeapon, the same as the JS version.

const DEFAULT_PRIMARY := "Braton"

# Filled in place (not reassigned) so scripts that captured this dictionary early, like the Arsenal, see the data
static var PRIMARY_WEAPONS := {}
static var initialized := false


static func init_primary_weapons() -> Dictionary:
	if initialized:
		return PRIMARY_WEAPONS
	return init_from_data(DataLoader.get_by_chunk("weapons", "primary-rifle"))


# Builds the table from already-loaded weapon data, so the loading screen can report each step
static func init_from_data(weapons: Array) -> Dictionary:
	for w in weapons:
		PRIMARY_WEAPONS[w["name"]] = WeaponAdapter.adapt_weapon(w)
	initialized = true
	return PRIMARY_WEAPONS


static func _stats_for(weapon_name: String) -> Dictionary:
	assert(initialized, "Call init_primary_weapons() before creating PrimaryWeapon")
	var found = PRIMARY_WEAPONS.get(weapon_name)
	assert(found != null, "Unknown primary weapon: %s" % weapon_name)
	return found


func _init(weapon_name_in: String = DEFAULT_PRIMARY) -> void:
	super(_stats_for(weapon_name_in))
	category = "primary"
