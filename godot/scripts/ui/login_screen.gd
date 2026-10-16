class_name LoginScreen
extends Control

# Sign-in screen, port of src/ui/login_screen.js. Shown until someone is signed in, and it covers the menu.
# It is drawn to match the DOM layout: 380 px wide box, 42 px fields, 48 px button.

signal signed_in

const PALETTE_TEXT := Color("#f0e8e0")
const PALETTE_DIM := Color("#9a9ab0")
const PALETTE_FAINT := Color("#7a7a9a")
const PALETTE_ACCENT := Color("#ff6b35")
const PALETTE_SELECTED := Color("#ffd78a")
const PALETTE_DANGER := Color("#f0a0a0")
const PALETTE_SUCCESS := Color("#9af0b0")
const PALETTE_SOFT := Color("#c7cddf")
const FIELD_BG := Color("#0a0a14")
const FIELD_BORDER := Color(1, 1, 1, 0.15)
const BUTTON_FILL := Color(1.0, 107.0 / 255.0, 53.0 / 255.0, 0.2)
const BUTTON_BORDER := Color(1.0, 107.0 / 255.0, 53.0 / 255.0, 0.7)
const BOX_W := 380.0
const FIELD_H := 42.0
const BUTTON_H := 48.0
const EYE_W := 44.0
const USER_MAX := UserStore.MAX_NAME_LENGTH
const PASS_MAX := 64

var user_text := UserStore.ADMIN_NAME
var pass_text := ""
var focus := 0          # 0 = username, 1 = password
var reveal := false
var remember := true
var message := ""
var message_color := PALETTE_DANGER


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	visible = false


func open_screen() -> void:
	user_text = UserStore.ADMIN_NAME
	pass_text = ""
	focus = 0
	message = ""
	visible = true


func _process(_delta: float) -> void:
	if visible:
		queue_redraw()


func _top() -> float:
	return size.y / 2.0 - 230.0


func _left() -> float:
	return size.x / 2.0 - BOX_W / 2.0


func _user_rect() -> Rect2:
	return Rect2(_left(), _top() + 118.0, BOX_W, FIELD_H)


func _pass_rect() -> Rect2:
	return Rect2(_left(), _top() + 188.0, BOX_W, FIELD_H)


func _eye_rect() -> Rect2:
	var p := _pass_rect()
	return Rect2(p.position.x + p.size.x - EYE_W, p.position.y, EYE_W, p.size.y)


func _check_rect() -> Rect2:
	return Rect2(_left(), _top() + 276.0, 16.0, 16.0)


func _check_label_rect() -> Rect2:
	return Rect2(_left() + 24.0, _top() + 276.0, BOX_W - 24.0, 18.0)


func _button_rect() -> Rect2:
	return Rect2(_left(), _top() + 314.0, BOX_W, BUTTON_H)


func _unhandled_input(event: InputEvent) -> void:
	if not visible:
		return
	var key := event as InputEventKey
	if not (key and key.pressed and not key.echo):
		return
	var handled := true
	match key.keycode:
		KEY_TAB:
			focus = 1 - focus
		KEY_BACKSPACE:
			_edit_focused(func(t: String) -> String: return t.left(maxi(0, t.length() - 1)))
		KEY_ENTER, KEY_KP_ENTER:
			_submit()
		_:
			handled = false
			if key.unicode >= 32:
				_type_char(char(key.unicode))
				handled = true
	if handled:
		get_viewport().set_input_as_handled()


func _type_char(c: String) -> void:
	if focus == 0:
		if user_text.length() < USER_MAX:
			user_text += c
	elif pass_text.length() < PASS_MAX:
		pass_text += c


func _edit_focused(edit: Callable) -> void:
	if focus == 0:
		user_text = edit.call(user_text)
	else:
		pass_text = edit.call(pass_text)


func _gui_input(event: InputEvent) -> void:
	var click := event as InputEventMouseButton
	if not (click and click.pressed and click.button_index == MOUSE_BUTTON_LEFT):
		return
	var at := click.position
	if _user_rect().has_point(at):
		focus = 0
	elif _eye_rect().has_point(at):
		reveal = not reveal
		focus = 1
	elif _pass_rect().has_point(at):
		focus = 1
	elif _check_rect().has_point(at) or _check_label_rect().has_point(at):
		remember = not remember
	elif _button_rect().has_point(at):
		_submit()


func _submit() -> void:
	var id := UserStore.user_id_by_name(user_text)
	if id == "":
		_set_message("No user with that name", false)
		return
	var result := Auth.sign_in(id, pass_text, remember)
	if not result.get("ok", false):
		_set_message(str(result.get("error", "Sign-in failed")), false)
		pass_text = ""
		focus = 1
		return
	_set_message("Signed in", true)
	visible = false
	signed_in.emit()


func _set_message(text: String, success: bool) -> void:
	message = text
	message_color = PALETTE_SUCCESS if success else PALETTE_DANGER


func _draw() -> void:
	var font := ThemeDB.fallback_font
	# Background: dark radial glow from the upper left (the DOM uses a radial gradient)
	draw_rect(Rect2(Vector2.ZERO, size), Color("#020205"))
	var glow := Vector2(size.x * 0.3, size.y * 0.2)
	for i in range(12):
		var r := size.x * (0.9 - i * 0.06)
		draw_circle(glow, r, Color(0.08, 0.094, 0.149, 0.09))

	var top := _top()
	var left := _left()
	_draw_spaced(font, Vector2(size.x / 2.0, top + 30.0), "FLATFRAME", 34, 4.0, PALETTE_TEXT)
	_draw_spaced(font, Vector2(size.x / 2.0, top + 62.0), "SIGN IN", 11, 4.0, PALETTE_ACCENT)

	# Username
	draw_string(font, Vector2(left, top + 110.0), "USERNAME", HORIZONTAL_ALIGNMENT_LEFT, -1, 12, PALETTE_DIM)
	_draw_field(font, _user_rect(), user_text, focus == 0, false)

	# Password, with the show/hide toggle
	draw_string(font, Vector2(left, top + 180.0), "PASSWORD", HORIZONTAL_ALIGNMENT_LEFT, -1, 12, PALETTE_DIM)
	var shown := pass_text
	if not reveal:
		shown = ""
		for _i in range(pass_text.length()):
			shown += "•"
	_draw_field(font, _pass_rect(), shown, focus == 1, true)
	_draw_eye(_eye_rect())

	draw_string(font, Vector2(left, top + 256.0 + 12.0), "First sign-in sets the password.",
		HORIZONTAL_ALIGNMENT_LEFT, -1, 12, PALETTE_FAINT)

	# Auto login checkbox
	var check := _check_rect()
	draw_rect(check, FIELD_BG)
	draw_rect(check, FIELD_BORDER, false, 1.0)
	if remember:
		draw_rect(check.grow(-3.0), PALETTE_ACCENT)
	draw_string(font, Vector2(left + 24.0, top + 276.0 + 13.0), "Auto login (stay signed in)",
		HORIZONTAL_ALIGNMENT_LEFT, -1, 14, PALETTE_SOFT)

	# Sign in button
	var btn := _button_rect()
	draw_rect(btn, BUTTON_FILL)
	draw_rect(btn, BUTTON_BORDER, false, 1.0)
	_draw_spaced(font, btn.position + Vector2(btn.size.x / 2.0, 30.0), "SIGN IN", 16, 1.0, PALETTE_SELECTED)

	# Message
	if message != "":
		var mw := font.get_string_size(message, HORIZONTAL_ALIGNMENT_LEFT, -1, 15).x
		draw_string(font, Vector2(size.x / 2.0 - mw / 2.0, top + 396.0), message, HORIZONTAL_ALIGNMENT_LEFT, -1, 15, message_color)


func _draw_field(font: Font, r: Rect2, text: String, focused: bool, _is_password: bool) -> void:
	draw_rect(r, FIELD_BG)
	draw_rect(r, PALETTE_ACCENT if focused else FIELD_BORDER, false, 1.0)
	var inner := Vector2(r.position.x + 12.0, r.position.y + 27.0)
	draw_string(font, inner, text, HORIZONTAL_ALIGNMENT_LEFT, r.size.x - 24.0 - (EYE_W if _is_password else 0.0), 16, PALETTE_TEXT)
	if focused:
		var tw := font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, 16).x
		var cx := inner.x + tw + 1.0
		draw_line(Vector2(cx, r.position.y + 10.0), Vector2(cx, r.position.y + r.size.y - 10.0), PALETTE_TEXT, 1.0)


func _draw_eye(r: Rect2) -> void:
	var c := r.get_center()
	draw_arc(c, 8.0, PI * 0.15, PI * 0.85, 12, PALETTE_DIM, 1.5)
	draw_arc(c + Vector2(0, -2.0), 8.0, PI * 1.15, PI * 1.85, 12, PALETTE_DIM, 1.5)
	draw_circle(c, 3.0, PALETTE_DIM)


func _draw_spaced(font: Font, center: Vector2, text: String, font_size: int, spacing: float, color: Color) -> void:
	var total := 0.0
	for i in range(text.length()):
		total += font.get_string_size(text[i], HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x
		if i < text.length() - 1:
			total += spacing
	var x := center.x - total / 2.0
	for i in range(text.length()):
		draw_string(font, Vector2(x, center.y), text[i], HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, color)
		x += font.get_string_size(text[i], HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x + spacing
