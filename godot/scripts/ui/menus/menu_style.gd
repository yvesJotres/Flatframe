class_name MenuChrome
extends RefCounted

# The frame every full-screen menu shares in the browser build: the corner brackets, the top bar (profile,
# globe and plus buttons, currency bar), and the close button. Numbers follow the browser layout at 1024x768.

const ACCENT := Color("#ff6b35")
const ACCENT_LINE := Color(1.0, 107.0 / 255.0, 53.0 / 255.0, 0.5)
const TEXT := Color("#f0e8e0")
const DIM := Color("#9a9ab0")
const PANEL := Color(24.0 / 255.0, 30.0 / 255.0, 44.0 / 255.0, 0.92)
const PANEL_STROKE := Color(1, 1, 1, 0.08)
const SELECTED := Color("#ffd78a")
const FRAME_GREEN := Color("#4ade80")

const MARGIN := 96.0
const TOP := 46.0
const BOX := 54.0
const CORNER_INSET := 24.0
const CORNER_LEN := 46.0


static func draw_corners(canvas: CanvasItem, size: Vector2) -> void:
	var i := CORNER_INSET
	var l := CORNER_LEN
	var pts := [
		[Vector2(i, i), Vector2(i + l, i), Vector2(i, i + l)],
		[Vector2(size.x - i, i), Vector2(size.x - i - l, i), Vector2(size.x - i, i + l)],
		[Vector2(i, size.y - i), Vector2(i + l, size.y - i), Vector2(i, size.y - i - l)],
		[Vector2(size.x - i, size.y - i), Vector2(size.x - i - l, size.y - i), Vector2(size.x - i, size.y - i - l)],
	]
	for corner in pts:
		canvas.draw_line(corner[0], corner[1], ACCENT_LINE, 2.0)
		canvas.draw_line(corner[0], corner[2], ACCENT_LINE, 2.0)


# Profile box, globe box, plus box (with its underline), and the currency bar on the right
static func draw_top_bar(canvas: CanvasItem, size: Vector2, font: Font, balances: Dictionary) -> void:
	var avatar := Rect2(MARGIN, TOP, BOX, BOX)
	canvas.draw_rect(avatar, Color(0.25, 0.14, 0.18, 0.9))
	canvas.draw_rect(avatar, Color(1, 1, 1, 0.12), false, 1.0)
	var c := avatar.get_center()
	canvas.draw_colored_polygon(PackedVector2Array([c + Vector2(0, -14), c + Vector2(11, 12), c + Vector2(0, 6), c + Vector2(-11, 12)]), FRAME_GREEN)

	var globe := Rect2(MARGIN + 60.0, TOP, BOX, BOX)
	canvas.draw_rect(globe, PANEL)
	canvas.draw_arc(globe.get_center(), 10.0, 0.0, TAU, 24, SELECTED, 1.5)
	canvas.draw_line(globe.get_center() + Vector2(-10, 0), globe.get_center() + Vector2(10, 0), SELECTED, 1.0)

	var plus := Rect2(MARGIN + 120.0, TOP, BOX, BOX)
	canvas.draw_rect(plus, PANEL)
	canvas.draw_line(plus.get_center() + Vector2(-7, 0), plus.get_center() + Vector2(7, 0), TEXT, 2.0)
	canvas.draw_line(plus.get_center() + Vector2(0, -7), plus.get_center() + Vector2(0, 7), TEXT, 2.0)
	canvas.draw_line(Vector2(plus.position.x, plus.end.y + 2.0), Vector2(plus.end.x, plus.end.y + 2.0), TEXT, 2.0)

	# Currency bar: flask box, then Credits, Platinum and Endo
	var bar_w := 240.0
	var bar_x := size.x - MARGIN - bar_w
	canvas.draw_rect(Rect2(bar_x - 44.0, TOP, 40.0, BOX - 14.0), PANEL)
	canvas.draw_rect(Rect2(bar_x, TOP, bar_w, BOX - 14.0), PANEL)
	var labels := [["credits", "CR"], ["platinum", "PL"], ["endo", "EN"]]
	var x := bar_x + 14.0
	for pair in labels:
		canvas.draw_circle(Vector2(x + 6.0, TOP + 19.0), 6.0, DIM)
		var amount := str(int(balances.get(pair[0], 0)))
		canvas.draw_string(font, Vector2(x + 18.0, TOP + 25.0), amount, HORIZONTAL_ALIGNMENT_LEFT, -1, 16, TEXT)
		x += 76.0


static func close_rect(size: Vector2) -> Rect2:
	return Rect2(size.x - MARGIN + 6.0, TOP, 34.0, 34.0)


static func draw_close(canvas: CanvasItem, size: Vector2) -> void:
	var r := close_rect(size)
	canvas.draw_rect(r, PANEL)
	canvas.draw_rect(r, Color(ACCENT.r, ACCENT.g, ACCENT.b, 0.5), false, 1.0)
	var c := r.get_center()
	canvas.draw_line(c + Vector2(-7, -7), c + Vector2(7, 7), ACCENT, 2.5)
	canvas.draw_line(c + Vector2(-7, 7), c + Vector2(7, -7), ACCENT, 2.5)


static func draw_letter_spaced(canvas: CanvasItem, font: Font, pos: Vector2, text: String, font_size: int,
		spacing: float, color: Color) -> void:
	var x := pos.x
	for i in range(text.length()):
		canvas.draw_string(font, Vector2(x, pos.y), text[i], HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, color)
		x += font.get_string_size(text[i], HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x + spacing
