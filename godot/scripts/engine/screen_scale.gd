extends Node

# The browser's canvas sizing (src/game.js resizeCanvas): the canvas is as big as the window, drawn 1:1, so menus
# keep their pixel sizes and only the space around them changes. Short windows (under 600 px tall) draw the UI
# smaller: uiScale = max(0.75, height / 560), and the canvas is the window size divided by it.
# Registered as the `ScreenScale` autoload. Every resize sets the window's content size to match.

const SHORT_HEIGHT := 600
const SHORT_REFERENCE := 560.0
const MIN_SCALE := 0.75

var ui_scale := 1.0


func _ready() -> void:
	get_tree().root.size_changed.connect(_apply)
	_apply()


static func scale_for_height(height: float) -> float:
	return 1.0 if height >= SHORT_HEIGHT else maxf(MIN_SCALE, height / SHORT_REFERENCE)


func _apply() -> void:
	var win := get_window()
	var window_size := Vector2(win.size)
	if window_size.x <= 0.0 or window_size.y <= 0.0:
		return
	ui_scale = scale_for_height(window_size.y)
	win.content_scale_size = Vector2i(roundi(window_size.x / ui_scale), roundi(window_size.y / ui_scale))
