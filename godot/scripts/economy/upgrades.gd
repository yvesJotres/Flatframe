class_name ItemUpgrades
extends RefCounted

# Orokin Catalyst (doubles a weapon's mod capacity) and Orokin Reactor (doubles a Warframe's). Each can go on one item
# only and cannot be removed once installed. Both cost 20 Platinum. Port of src/economy/item_upgrades.js.

const UPGRADES := {
	"catalyst": {"name": "Orokin Catalyst", "applies_to": "weapon", "price": {"platinum": 20}, "multiplier": 2.0},
	"reactor": {"name": "Orokin Reactor", "applies_to": "warframe", "price": {"platinum": 20}, "multiplier": 2.0},
}

# Unused copies the player holds, and the upgrades installed on each item (item name -> Array of upgrade ids)
static var owned := {"catalyst": 0, "reactor": 0}
static var installed := {}


# Buys one copy with Platinum. False when the player cannot pay.
static func buy(upgrade_id: String, profile_id: String) -> bool:
	if not Wallet.spend(profile_id, UPGRADES[upgrade_id].price):
		return false
	owned[upgrade_id] += 1
	return true


# Puts one owned copy on an item of the given kind ("weapon" or "warframe"). False when it cannot go there.
static func install(item_name: String, upgrade_id: String, kind: String) -> bool:
	if UPGRADES[upgrade_id].applies_to != kind:
		return false
	if owned[upgrade_id] <= 0:
		return false
	var list: Array = installed.get(item_name, [])
	if list.has(upgrade_id):
		return false
	list.append(upgrade_id)
	installed[item_name] = list
	owned[upgrade_id] -= 1
	return true


static func has(item_name: String, upgrade_id: String) -> bool:
	return installed.get(item_name, []).has(upgrade_id)


# Mod capacity for an item at its rank, doubled by each installed Catalyst or Reactor
static func capacity(item_name: String, mastery_rank: int) -> float:
	var cap := float(15 + maxi(0, mastery_rank) / 2)
	for id in UPGRADES:
		if has(item_name, id):
			cap *= UPGRADES[id].multiplier
	return cap
