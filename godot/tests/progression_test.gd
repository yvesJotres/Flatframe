extends SceneTree

# Checks the progression rules (src/progression/progression.js): mastery and item ranks, the kill curve and the
# Affinity split. Run headless from the godot/ folder:
#   godot --headless -s res://tests/progression_test.gd

var passes := 0
var failures := 0


func check(condition: bool, label: String) -> void:
	if condition:
		passes += 1
	else:
		failures += 1
		print("FAIL: ", label)


func _initialize() -> void:
	check(Progression.mastery_xp_for_rank(1) == 2500 and Progression.mastery_xp_for_rank(2) == 10000, "mastery XP is 2500 × rank²")
	check(Progression.mastery_rank_from_xp(2499) == 0 and Progression.mastery_rank_from_xp(2500) == 1, "mastery rank 1 at 2500 XP")
	check(Progression.mastery_rank_from_xp(10**9) == Progression.MASTERY_MAX_RANK, "mastery rank is capped at 30")
	check(Progression.item_rank_from_affinity(999.0, "frame") == 0 and Progression.item_rank_from_affinity(1000.0, "frame") == 1, "a Warframe reaches rank 1 at 1000 Affinity")
	check(Progression.item_rank_from_affinity(500.0, "weapon") == 1, "a weapon needs half the Affinity of a Warframe")
	check(is_equal_approx(Progression.kill_affinity("Trooper", 1), 100.0 * 1.1425), "a Trooper kill at level 1 gives 100 × 1.1425")
	check(Progression.kill_affinity("Unlisted", 5) == 0.0, "enemies not listed give no Affinity")
	check(is_equal_approx(Progression.kill_affinity("Crewman", 4), 50.0 * (1.0 + 0.1425 * 2.0)), "the level term uses the square root of the level")
	print("%d passed, %d failed" % [passes, failures])
	quit(1 if failures > 0 else 0)
