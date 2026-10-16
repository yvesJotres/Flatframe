class_name WorkInProgress
extends Control

# The work-in-progress screen, shown for a feature that is not built yet (port of src/ui/menus/work_in_progress.js).
# Any click or Esc closes it and calls back to the screen that opened it.

signal closed

var title_text := "WORK IN PROGRESS"
var message_text := "This feature is under development."
var sub_text := "Check back in a future update."


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	visible = false


func open(title: String = "WORK IN PROGRESS", message: String = "This feature is under development.", sub: String = "Check back in a future update.") -> void:
	title_text = title
	message_text = message
	sub_text = sub
	visible = true
	queue_redraw()


func close() -> void:
	visible = false
	closed.emit()


func _gui_input(event: InputEvent) -> void:
	if visible and event is InputEventMouseButton and event.pressed:
		close()
		accept_event()


func _unhandled_input(event: InputEvent) -> void:
	if visible and event is InputEventKey and event.pressed and not event.echo and event.keycode == KEY_ESCAPE:
		close()
		get_viewport().set_input_as_handled()


func _draw() -> void:
	if not visible:
		return
	draw_rect(Rect2(Vector2.ZERO, size), Color(10.0 / 255.0, 10.0 / 255.0, 12.0 / 255.0, 0.95))
	var font := ThemeDB.fallback_font
	var centre := size * 0.5
	draw_string(font, centre + Vector2(-160.0, -40.0), title_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 30, Color("#ff9f43"))
	draw_string(font, centre + Vector2(-200.0, 0.0), message_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 18, Color("#f0e8e0"))
	draw_string(font, centre + Vector2(-200.0, 30.0), sub_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Color("#9aa3bd"))
	draw_string(font, centre + Vector2(-120.0, 90.0), "Click or press Esc to go back", HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Color("#9aa3bd"))
