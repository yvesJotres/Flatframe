class_name PauseMenu
extends Control

# The pause menu, shown over a mission when Esc is pressed (port of src/ui/menus/pause_menu.js). Resume, Restart,
# Options, and Abort. Abort asks first: it forfeits the loot. The mission under it is paused while it is open.

signal opened
signal resumed
signal restarted
signal aborted

const OPTIONS := [
	{"label": "Resume", "action": "resume", "description": "Return to the mission"},
	{"label": "Restart Mission", "action": "restart", "description": "Start this mission over"},
	{"label": "Options", "action": "settings", "description": "Customize game settings"},
	{"label": "Abort Mission", "action": "abort", "description": "Leave without rewards", "danger": true},
]
const ABORT_OPTIONS := [
	{"label": "Keep Fighting", "action": "cancel_abort", "description": "Return to the mission"},
	{"label": "Abort Anyway", "action": "abort", "description": "Leave and lose all loot from this mission", "danger": true},
]

var mission_name := ""
var confirming_abort := false
var selected := 0
var settings: SettingsMenu = null


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS   # keeps working while the mission is paused
	visible = false
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP


func open(name_of_mission: String) -> void:
	mission_name = name_of_mission
	visible = true
	confirming_abort = false
	selected = 0
	queue_redraw()


func close() -> void:
	visible = false
	confirming_abort = false


func _active() -> Array:
	return ABORT_OPTIONS if confirming_abort else OPTIONS


func _unhandled_input(event: InputEvent) -> void:
	if not visible:
		if event is InputEventKey and event.pressed and not event.echo and event.keycode == KEY_ESCAPE:
			opened.emit()
			get_viewport().set_input_as_handled()
		return
	if settings != null:
		return
	if not (event is InputEventKey and event.pressed and not event.echo):
		return
	var options := _active()
	match event.keycode:
		KEY_ESCAPE:
			if confirming_abort:
				confirming_abort = false
				selected = 0
			else:
				resumed.emit()
		KEY_UP, KEY_W:
			selected = (selected - 1 + options.size()) % options.size()
		KEY_DOWN, KEY_S:
			selected = (selected + 1) % options.size()
		KEY_ENTER, KEY_KP_ENTER, KEY_SPACE:
			_choose(options[selected].action)
		_:
			return
	get_viewport().set_input_as_handled()
	queue_redraw()


func _choose(action: String) -> void:
	match action:
		"resume":
			resumed.emit()
		"restart":
			restarted.emit()
		"abort":
			if confirming_abort:
				aborted.emit()
			else:
				confirming_abort = true
				selected = 0
		"cancel_abort":
			confirming_abort = false
			selected = 0
		"settings":
			_open_settings()


func _open_settings() -> void:
	settings = SettingsMenu.new()
	add_child(settings)
	settings.closed.connect(func():
		settings.queue_free()
		settings = null)


func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Color(0.0, 0.0, 0.0, 0.55))
	var font := ThemeDB.fallback_font
	var centre := size * 0.5
	var title := "ABORT MISSION?" if confirming_abort else "PAUSED"
	draw_string(font, centre + Vector2(-120.0, -140.0), title, HORIZONTAL_ALIGNMENT_LEFT, -1, 32, Color.WHITE)
	if mission_name != "":
		draw_string(font, centre + Vector2(-120.0, -110.0), mission_name, HORIZONTAL_ALIGNMENT_LEFT, -1, 16, Color("#9aa3bd"))
	var options := _active()
	for i in range(options.size()):
		var row := Rect2(centre.x - 160.0, centre.y - 60.0 + i * 52.0, 320.0, 40.0)
		var colour := Color("#ff6b6b") if options[i].get("danger", false) else Color("#f0e8e0")
		draw_rect(row, Color(0.1, 0.12, 0.18, 0.9))
		draw_rect(row, colour if i == selected else Color("#3a4358"), false, 2.0 if i == selected else 1.0)
		draw_string(font, row.position + Vector2(16.0, 26.0), options[i].label, HORIZONTAL_ALIGNMENT_LEFT, -1, 18, colour)
	if selected >= 0 and selected < options.size():
		draw_string(font, centre + Vector2(-160.0, 60.0 + options.size() * 52.0), options[selected].description, HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Color("#9aa3bd"))
