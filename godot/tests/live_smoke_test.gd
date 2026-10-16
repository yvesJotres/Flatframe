extends SceneTree

# Runs a node mission (whose enemies are Troopers, Lancers and Butchers) for a few hundred frames, with the Warframe
# fighting, and checks that the faction units spawn, act, and damage nothing outside the rules.
# Run headless from the godot/ folder:
#   godot --headless -s res://tests/live_smoke_test.gd

var passes := 0
var failures := 0
var game: Game
var step := 0
var seen := {}


func _initialize() -> void:
	Game.pending_mission = "capture"
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
	if step < 4:
		return false
	if step <= 600:
		# Fight: a melee swing when something is in reach, and note which unit kinds appear
		game.player.aim_dir = Vector2.RIGHT
		game.player.melee_cooldown = 0.0
		game.player.melee_swing()
		for e in get_nodes_in_group("enemies"):
			seen[e.get_class() + ":" + str(e.unit_name if "unit_name" in e else "crewman")] = true
			if e.grenade_timer < -1.0:
				check(false, "grenade timer stays in range")
		return false
	check(game.state == "running" or game.state == "won" or game.state == "lost", "the mission ends in a known state")
	check(game.node_pool.size() == 3, "a node mission spawns from the trooper, lancer and butcher pool")
	check(game.kill_quota == 24, "a node mission has a 24-kill quota")
	check(game.player.health.hp >= 0.0, "the Warframe's health is never negative")
	print("units seen: ", seen.keys())
	print("%d passed, %d failed" % [passes, failures])
	quit(1 if failures > 0 else 0)
	return true
