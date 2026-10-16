extends SceneTree

# Checks the pause menu: Esc opens it and pauses the mission, Resume closes it and unpauses, and Abort asks first.
# Run headless from the godot/ folder:
#   godot --headless -s res://tests/pause_test.gd

var passes := 0
var failures := 0
var game: Game
var step := 0


func _initialize() -> void:
	Game.pending_mission = "exterminate"
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
		check(game.pause != null and not game.pause.visible, "the pause menu starts hidden")
		game.pause.opened.emit()
		check(game.pause.visible and get_tree_paused(), "opening the pause menu pauses the mission")
		game.pause.resumed.emit()
		check(not game.pause.visible and not get_tree_paused(), "resume closes the menu and unpauses")
		game.pause.opened.emit()
		game.pause._choose("abort")
		check(game.pause.confirming_abort, "abort asks for confirmation first")
		game.pause._choose("cancel_abort")
		check(not game.pause.confirming_abort, "keep fighting cancels the abort")
		game.pause.resumed.emit()
	elif step == 5:
		print("%d passed, %d failed" % [passes, failures])
		quit(1 if failures > 0 else 0)
		return true
	return false


func get_tree_paused() -> bool:
	return paused
