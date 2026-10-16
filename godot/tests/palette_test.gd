extends SceneTree

# Checks the colour tokens (src/assets/colors.js, exported to data/colors.json): lookup, the rgba form, and the
# fallback for an unknown token. Run headless from the godot/ folder:
#   godot --headless -s res://tests/palette_test.gd

var passes := 0
var failures := 0


func check(condition: bool, label: String) -> void:
	if condition:
		passes += 1
	else:
		failures += 1
		print("FAIL: ", label)


func _initialize() -> void:
	check(Palette.get_color("HEALTH").is_equal_approx(Color("#cc2a28")), "HEALTH is the browser's #cc2a28")
	check(Palette.get_color("SHIELDS").is_equal_approx(Color("#01d8ff")), "SHIELDS is the browser's #01d8ff")
	check(Palette.get_color("NOT_A_TOKEN").is_equal_approx(Color("#ff00ff")), "an unknown token falls back to magenta")
	check(Palette.parse("rgba(120,180,255,0.35)").is_equal_approx(Color(120.0 / 255.0, 180.0 / 255.0, 255.0 / 255.0, 0.35)), "an rgba() colour parses its four channels")
	check(Palette.parse("#000000").is_equal_approx(Color.BLACK), "a hex colour parses")
	print("%d passed, %d failed" % [passes, failures])
	quit(1 if failures > 0 else 0)
