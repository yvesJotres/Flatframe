extends SceneTree

# Checks the parkour rules (src/warframe/jump.js): hop, double jump, bullet jump and their landing rules.
# Run headless from the godot/ folder:
#   godot --headless -s res://tests/parkour_test.gd

var passes := 0
var failures := 0


func check(condition: bool, label: String) -> void:
	if condition:
		passes += 1
	else:
		failures += 1
		print("FAIL: ", label)


# Steps the jump in small slices until it lands, returning the landing kind and the distance covered
func fly(jump: JumpState, dt: float = 0.001) -> Array:
	var distance := 0.0
	var landed := ""
	var guard := 0
	while landed == "" and guard < 100000:
		var v := Vector2(jump.vx, jump.vy)
		distance += v.length() * dt
		landed = jump.update(dt)
		guard += 1
	return [landed, distance]


func _initialize() -> void:
	var j := JumpState.new()
	check(j.press(Vector2.RIGHT, Vector2.UP, false) == "hop", "a hop when standing and not crouched")
	var hop := fly(j)
	check(hop[0] == "hop", "a hop lands as a hop")
	check(is_equal_approx(hop[1], JumpState.HOP_SPEED * JumpState.HOP_SECONDS), "a hop covers 600 units/s for 0.3 s (12 m)")

	j = JumpState.new()
	j.press(Vector2.RIGHT, Vector2.UP, false)
	check(j.press(Vector2.RIGHT, Vector2.UP, false) == "double", "a second press in the air is a double jump")
	check(j.press(Vector2.RIGHT, Vector2.UP, false) == "", "a third press in the air does nothing")
	fly(j)
	check(j.jumps_left == 1, "landing restores the double jump")

	j = JumpState.new()
	check(j.press(Vector2.ZERO, Vector2.UP, false) == "hop", "standing still hops where you aim")
	check(is_equal_approx(j.vy, -JumpState.HOP_SPEED), "the aimed hop moves up when aiming up")

	j = JumpState.new()
	check(j.press(Vector2.ZERO, Vector2.RIGHT, true) == "bullet", "crouch then jump is a bullet jump")
	check(j.press(Vector2.RIGHT, Vector2.UP, false) == "", "no double jump after a bullet jump")
	var bullet := fly(j)
	check(bullet[0] == "bullet", "a bullet jump lands as a bullet jump")
	check(absf(bullet[1] - JumpState.BULLET_DISTANCE) < 0.5, "a bullet jump covers 210 units (14 m), within the 1 ms step")
	check(j.bullet_ready, "landing restores the bullet jump")
	check(j.press(Vector2.ZERO, Vector2.RIGHT, true) == "bullet", "a second bullet jump after landing")

	j = JumpState.new()
	j.press(Vector2.ZERO, Vector2.RIGHT, true)
	check(j.press(Vector2.ZERO, Vector2.RIGHT, true) == "", "no bullet jump again in the air")
	fly(j)
	check(j.press(Vector2.ZERO, Vector2.RIGHT, true) == "bullet", "the bullet jump needs the ground before it can repeat")

	j = JumpState.new()
	j.press(Vector2.ZERO, Vector2.RIGHT, true)
	check(j.bullet_active and not j.bullet_ready, "a bullet jump in flight is active and not ready")

	print("%d passed, %d failed" % [passes, failures])
	quit(1 if failures > 0 else 0)
