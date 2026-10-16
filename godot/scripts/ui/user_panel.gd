class_name UserPanel
extends Control

# Profile panel: shows who is signed in and signs them out. Port of src/ui/user_panel.js.
# Accounts switch by signing out and signing in again, so every switch needs the password.
# ArsenalScreen forwards input to this panel (it owns input for the whole screen).

signal closed

const TEXT := Color("#f0e8e0")
const DIM := Color("#9a9ab0")
const SELECTED := Color("#ffd78a")
const ACCENT := Color("#ff6b35")
const BOX_BG := Color(10.0 / 255.0, 10.0 / 255.0, 20.0 / 255.0, 0.97)
const BUTTON_FILL := Color(1.0, 107.0 / 255.0, 53.0 / 255.0, 0.18)
const BUTTON_BORDER := Color(1.0, 107.0 / 255.0, 53.0 / 255.0, 0.6)
const BOX_W := 360.0
const BOX_H := 210.0

var signed_in_name := "—"


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	visible = false


func open_screen() -> void:
	var profile := UserStore.get_profile(UserStore.active_id())
	signed_in_name = str(profile.get("displayName", "—"))
	visible = true


func _box() -> Rect2:
	return Rect2(size.x / 2.0 - BOX_W / 2.0, size.y / 2.0 - BOX_H / 2.0, BOX_W, BOX_H)


func _sign_out_rect() -> Rect2:
	var b := _box()
	return Rect2(b.position.x + 20.0, b.position.y + 116.0, 140.0, 36.0)


func _close_rect() -> Rect2:
	var b := _box()
	return Rect2(b.position.x + b.size.x - 140.0, b.position.y + b.size.y - 56.0, 120.0, 36.0)


# Returns "sign_out", "close", or "" when nothing was chosen
func handle_key(keycode: int) -> String:
	if keycode == KEY_ESCAPE:
		return "close"
	return ""


# Returns "sign_out", "close", or "" (a click outside the box closes it)
func handle_click(point: Vector2) -> String:
	if _sign_out_rect().has_point(point):
		return "sign_out"
	if _close_rect().has_point(point) or not _box().has_point(point):
		return "close"
	return ""


func _draw() -> void:
	if not visible:
		return
	var font := ThemeDB.fallback_font
	draw_rect(Rect2(Vector2.ZERO, size), Color(0.0, 0.0, 0.0, 0.6))
	var b := _box()
	draw_rect(b, BOX_BG)
	draw_rect(b, Color(ACCENT.r, ACCENT.g, ACCENT.b, 0.5), false, 1.0)
	draw_string(font, b.position + Vector2(20, 36), "PROFILE", HORIZONTAL_ALIGNMENT_LEFT, -1, 16, SELECTED)
	draw_string(font, b.position + Vector2(20, 70), "SIGNED IN AS", HORIZONTAL_ALIGNMENT_LEFT, -1, 12, DIM)
	draw_string(font, b.position + Vector2(20, 98), signed_in_name, HORIZONTAL_ALIGNMENT_LEFT, -1, 20, TEXT)

	var out := _sign_out_rect()
	draw_rect(out, BUTTON_FILL)
	draw_rect(out, BUTTON_BORDER, false, 1.0)
	draw_string(font, out.position + Vector2(22, 23), "SIGN OUT", HORIZONTAL_ALIGNMENT_LEFT, -1, 14, SELECTED)

	var close := _close_rect()
	draw_rect(close, BUTTON_FILL)
	draw_rect(close, BUTTON_BORDER, false, 1.0)
	draw_string(font, close.position + Vector2(30, 23), "CLOSE", HORIZONTAL_ALIGNMENT_LEFT, -1, 14, SELECTED)
