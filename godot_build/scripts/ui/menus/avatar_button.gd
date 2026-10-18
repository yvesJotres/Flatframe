class_name AvatarButton
extends Button
## The profile icon from java_build/src/ui/menus/menu_style.js
## (drawProfileAndInvite + drawFrameGlyph): a diagonal gradient box with the
## Warframe-style arrow, outlined gold while hovered or focused.

const GRADIENT_FROM := Color("#2a3550")
const GRADIENT_TO := Color("#5a2f3a")
const FRAME_GREEN := Color("#4ade80")
const GOLD := Color(1, 0.843, 0.541)
const PIP := Color(1, 1, 1, 0.18)


func _ready() -> void:
	# The box is drawn here, so the default button boxes are empty
	for style_name in ["normal", "hover", "pressed", "focus", "disabled"]:
		add_theme_stylebox_override(style_name, StyleBoxEmpty.new())
	mouse_entered.connect(queue_redraw)
	mouse_exited.connect(queue_redraw)
	focus_entered.connect(queue_redraw)
	focus_exited.connect(queue_redraw)


func _draw() -> void:
	var w := size.x
	var h := size.y
	# Diagonal gradient: top-left is the start colour, bottom-right the end colour
	var mid := GRADIENT_FROM.lerp(GRADIENT_TO, 0.5)
	draw_polygon(
		PackedVector2Array([Vector2(0, 0), Vector2(w, 0), Vector2(w, h), Vector2(0, h)]),
		PackedColorArray([GRADIENT_FROM, mid, GRADIENT_TO, mid]),
	)

	# Gold outline while the pointer is over the icon (or it has keyboard focus)
	var lit := is_hovered() or has_focus()
	var width := 2.0 if lit else 1.0
	var inset := width / 2.0
	draw_rect(Rect2(inset, inset, w - width, h - width), GOLD if lit else PIP, false, width)

	_draw_frame_glyph(Vector2(w / 2.0, h / 2.0 + 1.0), w * 0.55)


# The Warframe-style arrow, pointing up, in the frame green with a white outline
func _draw_frame_glyph(center: Vector2, glyph_size: float) -> void:
	var s := glyph_size / 32.0
	var points := PackedVector2Array()
	# The canvas code draws the arrow pointing right, then rotates it by -90 degrees: (x, y) -> (y, -x)
	for p in [Vector2(20, 0), Vector2(-12, -12), Vector2(-6, 0), Vector2(-12, 12)]:
		points.append(center + Vector2(p.y, -p.x) * s)
	draw_colored_polygon(points, FRAME_GREEN)
	var outline := points.duplicate()
	outline.append(points[0])
	draw_polyline(outline, Color.WHITE, 2.0, true)
