extends SceneTree

# Frame-time measurement for Phase 0 of PORT_PLAN.md. Runs a scene for a fixed number of frames and prints the
# average and worst frame time. Run with a window (not --headless), so the renderer is active:
#   godot --path godot -s res://tests/measure_frames.gd -- <scene path> [method to open] [frames]
# Example: -- res://scenes/menu.tscn _open_chart 600

var scene_path := "res://scenes/menu.tscn"
var open_method := ""
var frames_wanted := 600
var frames := 0
var last_ms := 0
var worst := 0.0
var total := 0.0
var scene_node: Node = null


func _initialize() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() >= 1:
		scene_path = args[0]
	if args.size() >= 2:
		open_method = args[1]
	if args.size() >= 3:
		frames_wanted = int(args[2])
	# Vsync would cap the frame rate and hide the real cost, so measure without it
	DisplayServer.window_set_vsync_mode(DisplayServer.VSYNC_DISABLED)
	scene_node = load(scene_path).instantiate()
	root.add_child(scene_node)
	last_ms = Time.get_ticks_usec()


func _process(_delta: float) -> bool:
	var now := Time.get_ticks_usec()
	frames += 1
	if frames == 2 and open_method != "" and scene_node.has_method(open_method):
		scene_node.call(open_method)
	# Skip the first frames: they include scene start-up and shader compilation
	if frames > 30:
		var ms := (now - last_ms) / 1000.0
		total += ms
		worst = maxf(worst, ms)
	last_ms = now
	if frames >= frames_wanted:
		var measured := frames_wanted - 30
		print("scene %s %s: avg %.2f ms (%.0f fps), worst %.2f ms over %d frames" % [
			scene_path, open_method, total / measured, 1000.0 / (total / measured), worst, measured])
		quit()
		return true
	return false
