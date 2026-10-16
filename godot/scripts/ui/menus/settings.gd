class_name SettingsMenu
extends Control

# Options screen, port of src/ui/menus/settings.js. Every option comes from the browser build's settings
# definitions (data/settings_sections.json) and is saved the moment it changes.
# Gamepad rebinding is shown but not editable: the Godot build has no gamepad input yet.
# Keys: 1-8 or Q/E pick a category, W/S pick a row, A/D adjust, Enter toggles, Esc closes.

signal closed

const TEXT := Color("#f0e8e0")
const DIM := Color("#9a9ab0")
const FAINT := Color("#7a7a9a")
const SELECTED := Color("#ffd78a")
const ACCENT := Color("#ff6b35")
const PANEL := Color(24.0 / 255.0, 30.0 / 255.0, 44.0 / 255.0, 0.92)
const PANEL_STROKE := Color(1, 1, 1, 0.08)
const BG := Color("#0a0a0c")
const TRACK := Color(1, 1, 1, 0.12)
const CHIP := Color(1, 1, 1, 0.06)

const MARGIN := 96.0
const PANEL_MAX_W := 760.0
const TOP := 118.0           # the browser's category row starts here
const TAB_H := 44.0
const ROW_H := 31.0          # browser rows are a fixed height
const BUTTON_W := 149.0
const BUTTON_H := 41.0
const BACK_W := 131.0
const BACK_H := 41.0
const SEARCH_W := 260.0
const SEARCH_H := 33.0
const TAB_ICONS := ["kbd", "pad", "gear", "smile", "window", "play", "speaker", "access"]

var sections: Array = []
var section_index := 0
var row_index := 0
var dragging: Dictionary = {}   # the slider item being dragged, {} when none


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	sections = Settings.sections()
	visible = false


func open_screen() -> void:
	sections = Settings.sections()
	section_index = 0
	row_index = 0
	dragging = {}
	visible = true


func _process(_delta: float) -> void:
	if visible:
		queue_redraw()


func _section() -> Dictionary:
	return sections[section_index] if section_index < sections.size() else {}


func _items() -> Array:
	return _section().get("items", [])


func _panel_rect() -> Rect2:
	var w := minf(PANEL_MAX_W, size.x - MARGIN * 2.0)
	return Rect2((size.x - w) / 2.0, TOP, w, size.y - TOP - 110.0)


func _search_rect() -> Rect2:
	var p := _panel_rect()
	return Rect2(p.position.x + p.size.x - SEARCH_W, TOP, SEARCH_W, SEARCH_H)


func _tab_rects() -> Array:
	var p := _panel_rect()
	var gap := 6.0
	var count := maxi(1, sections.size())
	var tab_w := (p.size.x - gap * (count - 1)) / count
	var out: Array = []
	for i in range(sections.size()):
		out.append(Rect2(p.position.x + i * (tab_w + gap), TOP + 40.0, tab_w, TAB_H))
	return out


func _row_rects() -> Array:
	var p := _panel_rect()
	var list_y := TOP + 40.0 + TAB_H + 16.0
	var out: Array = []
	for i in range(_items().size()):
		out.append(Rect2(p.position.x, list_y + i * ROW_H, p.size.x, ROW_H - 3.0))
	return out


func _control_x() -> float:
	return _panel_rect().position.x + _panel_rect().size.x * 0.5


func _track_rect() -> Rect2:
	var p := _panel_rect()
	return Rect2(_control_x(), 0, p.size.x * 0.5 - 90.0, 0)


func _confirm_rect() -> Rect2:
	var b := _back_rect()
	return Rect2(b.position.x - 12.0 - BUTTON_W * 2.0 - 12.0, b.position.y, BUTTON_W, BUTTON_H)


func _defaults_rect() -> Rect2:
	var b := _back_rect()
	return Rect2(b.position.x - 12.0 - BUTTON_W, b.position.y, BUTTON_W, BUTTON_H)


func _back_rect() -> Rect2:
	return Rect2(size.x - MARGIN - BACK_W, size.y - 87.0, BACK_W, BACK_H)


func _snap(item: Dictionary, v: float) -> float:
	var step := float(item.get("step", 1.0))
	var lo := float(item.get("min", 0.0))
	var hi := float(item.get("max", 1.0))
	var stepped := roundf((v - lo) / step) * step + lo
	return snappedf(clampf(stepped, lo, hi), 0.001)


func _set_value(item: Dictionary, value: Variant) -> void:
	Settings.set_value(str(item.key), value)


func _toggle(item: Dictionary) -> void:
	_set_value(item, not bool(Settings.get_value(str(item.key))))


func _cycle(item: Dictionary, dir: int) -> void:
	var opts: Array = item.get("options", [])
	if opts.is_empty():
		return
	var i := opts.find(Settings.get_value(str(item.key)))
	_set_value(item, opts[posmod(i + dir, opts.size())])


func _adjust(item: Dictionary, dir: int) -> void:
	match item.get("type", ""):
		"slider":
			var v: float = float(Settings.get_value(str(item.key))) + dir * float(item.get("step", 1.0))
			_set_value(item, _snap(item, v))
		"toggle":
			_toggle(item)
		"choice":
			_cycle(item, dir)


func _drag_to(x: float) -> void:
	if dragging.is_empty():
		return
	var track := _track_rect()
	var t := clampf((x - track.position.x) / track.size.x, 0.0, 1.0)
	var lo := float(dragging.get("min", 0.0))
	var hi := float(dragging.get("max", 1.0))
	_set_value(dragging, _snap(dragging, lo + t * (hi - lo)))


func _unhandled_input(event: InputEvent) -> void:
	if not is_visible_in_tree():
		return
	var key := event as InputEventKey
	if not (key and key.pressed and not key.echo):
		return
	var handled := true
	var items := _items()
	match key.keycode:
		KEY_ESCAPE:
			visible = false
			closed.emit()
		KEY_Q:
			section_index = posmod(section_index - 1, sections.size())
			row_index = 0
		KEY_E:
			section_index = posmod(section_index + 1, sections.size())
			row_index = 0
		KEY_W, KEY_UP:
			if not items.is_empty():
				row_index = posmod(row_index - 1, items.size())
		KEY_S, KEY_DOWN:
			if not items.is_empty():
				row_index = posmod(row_index + 1, items.size())
		KEY_A, KEY_LEFT:
			if not items.is_empty():
				_adjust(items[row_index], -1)
		KEY_D, KEY_RIGHT:
			if not items.is_empty():
				_adjust(items[row_index], 1)
		KEY_ENTER, KEY_KP_ENTER:
			if not items.is_empty():
				var item: Dictionary = items[row_index]
				if item.get("type", "") != "slider":
					_adjust(item, 1)
		_:
			handled = false
			if key.keycode >= KEY_1 and key.keycode <= KEY_8:
				var n := key.keycode - KEY_1
				if n < sections.size():
					section_index = n
					row_index = 0
	if handled:
		get_viewport().set_input_as_handled()


func _gui_input(event: InputEvent) -> void:
	var motion := event as InputEventMouseMotion
	var click := event as InputEventMouseButton
	if motion and not dragging.is_empty():
		_drag_to(motion.position.x)
		return
	if click and not click.pressed and click.button_index == MOUSE_BUTTON_LEFT:
		dragging = {}
		return
	if not (click and click.pressed and click.button_index == MOUSE_BUTTON_LEFT):
		return
	var at := click.position
	if _back_rect().has_point(at) or _confirm_rect().has_point(at):
		visible = false
		closed.emit()
		return
	if _defaults_rect().has_point(at):
		Settings.reset(str(_section().get("id", "")))
		return
	var tabs := _tab_rects()
	for i in range(tabs.size()):
		if tabs[i].has_point(at):
			section_index = i
			row_index = 0
			return
	var rows := _row_rects()
	var items := _items()
	for i in range(rows.size()):
		if not rows[i].has_point(at):
			continue
		row_index = i
		var item: Dictionary = items[i]
		match item.get("type", ""):
			"slider":
				dragging = item
				_drag_to(at.x)
			"toggle":
				_toggle(item)
			"choice":
				_pick_choice(item, at.x)
		return


# Tap on a segment picks that option; tap elsewhere on the row cycles
func _pick_choice(item: Dictionary, x: float) -> void:
	var opts: Array = item.get("options", [])
	var start := _control_x()
	var seg_w := (_track_rect().size.x + 74.0) / opts.size()
	var i := int(floor((x - start) / seg_w))
	if i >= 0 and i < opts.size():
		_set_value(item, opts[i])
	else:
		_cycle(item, 1)


func _draw() -> void:
	if not visible:
		return
	var font := ThemeDB.fallback_font
	draw_rect(Rect2(Vector2.ZERO, size), BG)
	MenuChrome.draw_corners(self, size)
	MenuChrome.draw_top_bar(self, size, font, Wallet.balances(UserStore.active_id()))
	MenuChrome.draw_close(self, size)
	MenuChrome.draw_letter_spaced(self, font, Vector2(294.0, 84.0), "OPTIONS", 26, 6.0, TEXT)

	var p := _panel_rect()
	var current: String = _section().get("label", "")
	draw_string(font, Vector2(p.position.x, TOP + 15.0), current, HORIZONTAL_ALIGNMENT_LEFT, -1, 15, TEXT)

	# Search box, right of the heading
	var sr := _search_rect()
	draw_rect(sr, PANEL)
	draw_rect(sr, PANEL_STROKE, false, 1.0)
	draw_string(font, sr.position + Vector2(16.0, 22.0), "SEARCH...", HORIZONTAL_ALIGNMENT_LEFT, -1, 13, FAINT)
	var lens := sr.position + Vector2(sr.size.x - 22.0, 14.0)
	draw_arc(lens, 5.0, 0.0, TAU, 16, DIM, 1.5)
	draw_line(lens + Vector2(4, 4), lens + Vector2(8, 8), DIM, 1.5)

	# Category tabs: icon only, the chosen one lit with a warm fill
	var tabs := _tab_rects()
	for i in range(tabs.size()):
		var r: Rect2 = tabs[i]
		var active := i == section_index
		draw_rect(r, Color(ACCENT.r, ACCENT.g, ACCENT.b, 0.14) if active else PANEL)
		draw_rect(r, SELECTED if active else PANEL_STROKE, false, 1.5 if active else 1.0)
		_draw_tab_icon(i, r.get_center(), SELECTED if active else DIM)

	# Rows
	var items := _items()
	var rows := _row_rects()
	for i in range(rows.size()):
		var r: Rect2 = rows[i]
		var item: Dictionary = items[i]
		var selected := i == row_index
		draw_rect(r, PANEL)
		draw_rect(r, SELECTED if selected else PANEL_STROKE, false, 1.5 if selected else 1.0)
		var cy := r.position.y + r.size.y / 2.0
		draw_string(font, Vector2(r.position.x + 16.0, cy + 5.0), str(item.get("label", "")),
			HORIZONTAL_ALIGNMENT_LEFT, -1, 14, SELECTED if selected else TEXT)
		var value: Variant = Settings.get_value(str(item.get("key", "")))
		match item.get("type", ""):
			"slider":
				_draw_slider(font, item, value, r)
			"toggle":
				_draw_toggle(font, value, cy)
			"choice":
				_draw_choice(font, item, value, cy)
			"binding":
				_draw_binding(font, item, cy)

	# Bottom buttons
	_draw_button(font, _confirm_rect(), "CONFIRM")
	_draw_button(font, _defaults_rect(), "DEFAULTS")
	_draw_button(font, _back_rect(), "BACK")


func _draw_slider(font: Font, item: Dictionary, value: Variant, r: Rect2) -> void:
	var lo := float(item.get("min", 0.0))
	var hi := float(item.get("max", 1.0))
	var t := clampf((float(value) - lo) / (hi - lo), 0.0, 1.0)
	var track := _track_rect()
	var y := r.position.y + r.size.y / 2.0
	draw_rect(Rect2(track.position.x, y - 3.0, track.size.x, 6.0), TRACK)
	draw_rect(Rect2(track.position.x, y - 3.0, track.size.x * t, 6.0), ACCENT)
	draw_circle(Vector2(track.position.x + track.size.x * t, y), 9.0, SELECTED)
	var text := "%d%%" % roundi(float(value) * 100.0) if item.get("format", "") == "percent" else str(value)
	var tw := font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, 14).x
	draw_string(font, Vector2(r.position.x + r.size.x - 16.0 - tw, y + 5.0), text, HORIZONTAL_ALIGNMENT_LEFT, -1, 14, TEXT)


func _draw_toggle(font: Font, on: Variant, cy: float) -> void:
	# Browser style: an orange track with a dark knob on the right when on; a grey track with a light knob when off
	var x := _control_x()
	draw_rect(Rect2(x, cy - 10.0, 40.0, 20.0), ACCENT if on else TRACK)
	draw_circle(Vector2(x + (30.0 if on else 10.0), cy), 8.0, Color("#0a0a0c") if on else Color("#c9c9d4"))
	draw_string(font, Vector2(x + 52.0, cy + 5.0), "ON" if on else "OFF", HORIZONTAL_ALIGNMENT_LEFT, -1, 13,
		SELECTED if on else FAINT)


# Simple icon for each category (the browser uses symbols; these are drawn shapes for the same idea)
func _draw_tab_icon(index: int, c: Vector2, col: Color) -> void:
	match TAB_ICONS[index % TAB_ICONS.size()]:
		"kbd":
			draw_rect(Rect2(c.x - 11.0, c.y - 6.0, 22.0, 12.0), col, false, 1.5)
		"pad":
			draw_rect(Rect2(c.x - 11.0, c.y - 6.0, 22.0, 12.0), col, false, 1.5)
			draw_circle(c, 2.0, col)
		"gear":
			draw_arc(c, 7.0, 0.0, TAU, 24, col, 2.0)
			draw_circle(c, 2.5, col)
		"smile":
			draw_arc(c, 8.0, 0.0, TAU, 24, col, 1.5)
			draw_circle(c + Vector2(-3, -2), 1.2, col)
			draw_circle(c + Vector2(3, -2), 1.2, col)
		"window":
			draw_rect(Rect2(c.x - 8.0, c.y - 8.0, 16.0, 16.0), col, false, 1.5)
		"play":
			draw_colored_polygon(PackedVector2Array([c + Vector2(-5, -7), c + Vector2(8, 0), c + Vector2(-5, 7)]), col)
		"speaker":
			draw_colored_polygon(PackedVector2Array([c + Vector2(-8, -3), c + Vector2(-3, -3), c + Vector2(2, -7), c + Vector2(2, 7), c + Vector2(-3, 3), c + Vector2(-8, 3)]), col)
		_:
			draw_arc(c, 8.0, 0.0, TAU, 24, col, 1.5)


func _draw_choice(font: Font, item: Dictionary, value: Variant, cy: float) -> void:
	var opts: Array = item.get("options", [])
	if opts.is_empty():
		return
	var x := _control_x()
	var w := _track_rect().size.x + 74.0
	var seg_w := w / opts.size()
	for i in range(opts.size()):
		var active: bool = opts[i] == value
		var sx := x + i * seg_w
		draw_rect(Rect2(sx + 1.0, cy - 15.0, seg_w - 2.0, 30.0), Color(ACCENT.r, ACCENT.g, ACCENT.b, 0.3) if active else CHIP)
		var label := str(opts[i])
		var lw := font.get_string_size(label, HORIZONTAL_ALIGNMENT_LEFT, -1, 13).x
		draw_string(font, Vector2(sx + (seg_w - lw) / 2.0, cy + 5.0), label, HORIZONTAL_ALIGNMENT_LEFT, -1, 13,
			SELECTED if active else DIM)


func _draw_binding(font: Font, item: Dictionary, cy: float) -> void:
	var x := _control_x()
	var w := _track_rect().size.x + 74.0
	draw_rect(Rect2(x, cy - 15.0, w, 30.0), CHIP)
	draw_string(font, Vector2(x + 12.0, cy + 5.0), "Gamepad: not available yet", HORIZONTAL_ALIGNMENT_LEFT, -1, 13, FAINT)


func _draw_button(font: Font, r: Rect2, label: String) -> void:
	draw_rect(r, PANEL)
	draw_rect(r, PANEL_STROKE, false, 1.0)
	var lw := font.get_string_size(label, HORIZONTAL_ALIGNMENT_LEFT, -1, 14).x
	draw_string(font, Vector2(r.position.x + (r.size.x - lw) / 2.0, r.position.y + r.size.y / 2.0 + 5.0), label,
		HORIZONTAL_ALIGNMENT_LEFT, -1, 14, TEXT)
