extends SceneTree

# Renders a scene in a real window and saves a screenshot, for comparing with the browser build.
# Run with a window (not --headless):
#   godot --path godot -s res://tests/capture_scene.gd -- <scene path> <output png>
# Example: -- res://scenes/menu.tscn C:/path/menu.png

var frames := 0
var open_method := ""
var scene_node: Node = null
var scene_path := "res://scenes/menu.tscn"
var out_path := "user://capture.png"


func _initialize() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() >= 1:
		scene_path = args[0]
	if args.size() >= 2:
		out_path = args[1]
	var scene: Node = load(scene_path).instantiate()
	root.add_child(scene)
	# Optional third argument: a menu method to open first (for example _open_chart or _open_arsenal).
	# The sign-in gate is skipped for captures only; no password is set or used.
	if args.size() >= 3:
		open_method = args[2]
	scene_node = scene


func _process(_delta: float) -> bool:
	frames += 1
	if frames == 2 and open_method != "" and scene_node is Menu:
		# Scene _ready has run by now, so the menu's login screen exists
		scene_node.in_login = false
		scene_node.login.visible = false
		scene_node.call(open_method)
	# Let layout and the first draw settle before grabbing the frame
	if frames < 15:
		return false
	var img := root.get_texture().get_image()
	var err := img.save_png(out_path)
	print("capture ", "ok" if err == OK else "failed %d" % err, " -> ", out_path)
	quit()
	return true
