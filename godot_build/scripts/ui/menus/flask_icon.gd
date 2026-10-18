extends Control
## The foundry flask from drawCurrencyBar in java_build/src/ui/menus/top_bar.js:
## a 42x42 box left of the currency box. It is lit (gold outline, orange dot)
## when something is ready to craft.

const PANEL_FILL := Color(0.094, 0.118, 0.173, 0.92)
const PANEL_EDGE := Color(1, 1, 1, 0.08)
const ACCENT_FAINT := Color(1, 0.42, 0.208, 0.12)
const GOLD := Color(1, 0.843, 0.541)
const HINT := Color(0.565, 0.565, 0.69)
const ACCENT := Color(1, 0.42, 0.208)

var foundry_ready := false:
	set(value):
		foundry_ready = value
		queue_redraw()


func _draw() -> void:
	var box := StyleBoxFlat.new()
	box.bg_color = ACCENT_FAINT if foundry_ready else PANEL_FILL
	box.border_color = GOLD if foundry_ready else PANEL_EDGE
	box.set_border_width_all(2 if foundry_ready else 1)
	box.set_corner_radius_all(2)
	draw_style_box(box, Rect2(Vector2.ZERO, size))

	var fx := size.x / 2.0
	var cy := size.y / 2.0
	var s := 12.0  # the flask is 24x24
	var outline := PackedVector2Array([
		Vector2(fx - s * 0.3, cy - s), Vector2(fx + s * 0.3, cy - s),
		Vector2(fx + s * 0.3, cy - s * 0.2), Vector2(fx + s, cy + s),
		Vector2(fx - s, cy + s), Vector2(fx - s * 0.3, cy - s * 0.2),
		Vector2(fx - s * 0.3, cy - s),
	])
	draw_polyline(outline, GOLD if foundry_ready else HINT, 1.5, true)
	if foundry_ready:
		draw_circle(Vector2(size.x - 6.0, 6.0), 4.0, ACCENT)
