extends SceneTree

# Checks the work-in-progress screen: it opens with its text, and Esc or a click closes it and calls back.
# Run headless from the godot/ folder:
#   godot --headless -s res://tests/wip_test.gd

var passes := 0
var failures := 0
var screen: WorkInProgress
var closed_calls := 0


func _initialize() -> void:
	screen = WorkInProgress.new()
	screen.closed.connect(func(): closed_calls += 1)
	root.add_child(screen)
	screen.open("SIMULACRUM", "Under development.", "Soon.")
	if not (screen.visible and screen.title_text == "SIMULACRUM"):
		failures += 1
		print("FAIL: the screen opens with its title")
	else:
		passes += 1
	screen.close()
	if closed_calls == 1 and not screen.visible:
		passes += 1
	else:
		failures += 1
		print("FAIL: closing hides the screen and calls back once")
	print("%d passed, %d failed" % [passes, failures])
	quit(1 if failures > 0 else 0)
