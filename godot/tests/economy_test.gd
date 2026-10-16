extends SceneTree

# Checks the economy rules that do not touch the player's wallet or save: fusion costs, Orokin upgrades (install
# rules and capacity), and what can be sold. Run headless from the godot/ folder:
#   godot --headless -s res://tests/economy_test.gd

var passes := 0
var failures := 0


func check(condition: bool, label: String) -> void:
	if condition:
		passes += 1
	else:
		failures += 1
		print("FAIL: ", label)


func _initialize() -> void:
	check(Fusion.cost_to_next_rank(0).endo == 500 and Fusion.cost_to_next_rank(0).credits == 1000, "rank 1 costs 500 Endo and 1000 Credits")
	check(Fusion.cost_to_next_rank(10).endo == 0, "a mod at its top rank has no fusion cost")
	check(Selling.can_sell("mod") and not Selling.can_sell("resource"), "mods sell and resources do not")

	# Upgrades: a copy must be owned, it goes on the right kind of item, and only once per item
	ItemUpgrades.owned = {"catalyst": 1, "reactor": 0}
	ItemUpgrades.installed = {}
	check(not ItemUpgrades.install("Braton", "catalyst", "warframe"), "a Catalyst does not go on a Warframe")
	check(ItemUpgrades.install("Braton", "catalyst", "weapon"), "a Catalyst goes on a weapon")
	check(ItemUpgrades.owned.catalyst == 0, "installing uses up the copy")
	check(not ItemUpgrades.install("Braton", "catalyst", "weapon"), "a Catalyst is needed once per item")
	check(ItemUpgrades.capacity("Braton", 0) == 30.0, "a Catalyst doubles a rank 0 weapon's capacity (15 to 30)")
	check(ItemUpgrades.capacity("Excalibur", 0) == 15.0, "other items keep their capacity")
	quit(1 if failures > 0 else 0)
	print("%d passed, %d failed" % [passes, failures])
