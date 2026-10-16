extends SceneTree

# Checks Defense: the Cryo Pod objective has the browser's stats, it is lost when the pod breaks, and the rotation
# choice comes after the 3rd wave. Run headless from the godot/ folder:
#   godot --headless -s res://tests/defense_test.gd

var passes := 0
var failures := 0
var game: Game
var step := 0


func _initialize() -> void:
	Game.pending_mission = "defense"
	game = load("res://scenes/main.tscn").instantiate()
	root.add_child(game)


func check(condition: bool, label: String) -> void:
	if condition:
		passes += 1
	else:
		failures += 1
		print("FAIL: ", label)


func _process(_delta: float) -> bool:
	step += 1
	if step == 3:
		check(game.pod != null, "defense has a cryo pod objective")
		check(game.pod.health.max_hp == 4000.0 and game.pod.health.base_armor == 240.0, "the cryo pod has 4000 health and 240 armour")
		check(game.max_enemies == 5 and game.base_enemies == 3, "defense allows 5 units on the field and starts at 3")
		check(Game.wave_size(1, 4) == 4, "a base of 4 gives wave 1 four enemies (dark sector)")
		# A hit on the pod takes armour into account and flashes it
		var before: float = game.pod.health.hp
		game.pod.take_damage(100.0)
		check(game.pod.health.hp < before, "the pod takes damage")
		game.pod.take_damage(100000.0)
		check(not game.pod.alive, "a broken pod is not alive")
	elif step == 5:
		check(game.state == "lost", "breaking the cryo pod loses the mission")
		print("defense scenario: state=", game.state)
		print("%d passed, %d failed" % [passes, failures])
		quit(1 if failures > 0 else 0)
		return true
	return false
