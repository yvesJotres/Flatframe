class_name Menu
extends Control

# Landing menu, port of the landing view in src/ui/menus/main_menu.js.
# Navigation opens the star chart. Arsenal, Profile and Options are not ported yet.

const BG_COLOR := Color("#0a0a0c")
const TEXT := Color("#ffffff")
const TEXT_DIM := Color("#9aa0b4")
const TEXT_MUTED := Color("#808080")
const ACCENT := Color("#ff6b35")
const MARGIN := 96.0
const ROW_SPACING := 55.0
const ROW_HALF_HEIGHT := 22.0
const ROW_WIDTH := 320.0

const OPTIONS := ["Navigation", "Arsenal", "Profile", "Options"]
const DESCRIPTIONS := [
	"Choose a mission on the star chart.",
	"Arsenal is not ported yet.",
	"Profile is not ported yet.",
	"Options is not ported yet.",
]

var selected := 0
var hovered := -1
var in_chart := false
var in_arsenal := false
var in_login := false
var in_sub := false
var profile: ProfileScreen
var settings_menu: SettingsMenu
var login: LoginScreen
var autosave_left := Account.AUTOSAVE_SECONDS
var chart: StarChart
var arsenal: ArsenalScreen


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	chart = StarChart.new()
	chart.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	chart.visible = false
	add_child(chart)
	chart.back_requested.connect(_close_chart)
	chart.launch_requested.connect(_launch)
	arsenal = ArsenalScreen.new()
	arsenal.visible = false
	add_child(arsenal)
	arsenal.back_requested.connect(_close_arsenal)
	arsenal.sign_out_requested.connect(_on_sign_out)
	profile = ProfileScreen.new()
	profile.visible = false
	add_child(profile)
	profile.closed.connect(_close_sub)
	settings_menu = SettingsMenu.new()
	settings_menu.visible = false
	add_child(settings_menu)
	settings_menu.closed.connect(_close_sub)

	# Accounts: load the saved state, then ask for sign-in unless a session is still active
	Account.start()
	Sounds.play_music("launcher_music")
	login = LoginScreen.new()
	add_child(login)
	login.signed_in.connect(_on_signed_in)
	if not Auth.is_signed_in():
		in_login = true
		login.open_screen()


func _on_sign_out() -> void:
	_close_arsenal()
	in_login = true
	login.open_screen()


func _on_signed_in() -> void:
	in_login = false
	Account.save()


# Saves on a timer, and when the window closes (storage.js installAutoSave)
func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_CLOSE_REQUEST:
		Account.save()
		get_tree().quit()


func _process(delta: float) -> void:
	autosave_left -= delta
	if autosave_left <= 0.0:
		autosave_left = Account.AUTOSAVE_SECONDS
		Account.save()
	queue_redraw()


func _option_y(index: int) -> float:
	return size.y / 2.0 + 20.0 + index * ROW_SPACING


func _option_at(point: Vector2) -> int:
	for i in range(OPTIONS.size()):
		var y := _option_y(i)
		if point.x >= MARGIN and point.x <= MARGIN + ROW_WIDTH and point.y > y - ROW_HALF_HEIGHT and point.y < y + ROW_HALF_HEIGHT:
			return i
	return -1


func _activate(index: int) -> void:
	if OPTIONS[index] == "Navigation":
		_open_chart()
	elif OPTIONS[index] == "Arsenal":
		_open_arsenal()
	elif OPTIONS[index] == "Profile":
		_open_sub(profile)
	elif OPTIONS[index] == "Options":
		_open_sub(settings_menu)


func _open_settings() -> void:
	_open_sub(settings_menu)


func _open_profile_screen() -> void:
	_open_sub(profile)


# Profile and Options are full screens with their own input, like the Arsenal
func _open_sub(screen: Control) -> void:
	in_sub = true
	if screen is ProfileScreen:
		screen.open_screen()
	else:
		screen.open_screen()
	screen.visible = true


func _close_sub() -> void:
	in_sub = false
	profile.visible = false
	settings_menu.visible = false


func _open_arsenal() -> void:
	in_arsenal = true
	arsenal.open_screen()
	arsenal.visible = true


func _close_arsenal() -> void:
	in_arsenal = false
	arsenal.visible = false


func _open_chart() -> void:
	in_chart = true
	chart.visible = true
	chart.hovered = -1


func _close_chart() -> void:
	in_chart = false
	chart.visible = false
	chart.countdown = -1.0


func _launch(mission_name: String) -> void:
	Game.pending_mission = "survival" if mission_name == "Survival" else "exterminate"
	get_tree().change_scene_to_file("res://scenes/main.tscn")


func _unhandled_input(event: InputEvent) -> void:
	if in_chart or in_arsenal or in_login or in_sub:
		return
	var key := event as InputEventKey
	if key and key.pressed and not key.echo:
		match key.keycode:
			KEY_UP, KEY_W:
				selected = (selected - 1 + OPTIONS.size()) % OPTIONS.size()
			KEY_DOWN, KEY_S:
				selected = (selected + 1) % OPTIONS.size()
			KEY_ENTER, KEY_KP_ENTER:
				_activate(selected)
			KEY_ESCAPE:
				get_tree().quit()


func _gui_input(event: InputEvent) -> void:
	if in_chart or in_arsenal or in_login or in_sub:
		return
	var motion := event as InputEventMouseMotion
	var click := event as InputEventMouseButton
	if motion:
		hovered = _option_at(motion.position)
		if hovered >= 0:
			selected = hovered
	elif click and click.pressed and click.button_index == MOUSE_BUTTON_LEFT:
		var hit := _option_at(click.position)
		if hit >= 0:
			selected = hit
			_activate(hit)


func _draw() -> void:
	if in_chart or in_arsenal or in_login or in_sub:
		return
	var font := ThemeDB.fallback_font
	draw_rect(Rect2(Vector2.ZERO, size), BG_COLOR)

	# Title, right-aligned on the same margin as the menu
	var title := "FLATFRAME"
	var tw := font.get_string_size(title, HORIZONTAL_ALIGNMENT_LEFT, -1, 56).x
	var title_y := size.y * 0.22 + 85.0
	draw_string(font, Vector2(size.x - MARGIN - tw, title_y), title, HORIZONTAL_ALIGNMENT_LEFT, -1, 56, TEXT)
	var sub := "ORIGIN SYSTEM"
	var sw := font.get_string_size(sub, HORIZONTAL_ALIGNMENT_LEFT, -1, 14).x
	draw_string(font, Vector2(size.x - MARGIN - sw, title_y + 30.0), sub, HORIZONTAL_ALIGNMENT_LEFT, -1, 14, ACCENT)
	var ver := "v1.6.0  |  WARFRAME-INSPIRED"
	var vw := font.get_string_size(ver, HORIZONTAL_ALIGNMENT_LEFT, -1, 12).x
	draw_string(font, Vector2(size.x - MARGIN - vw, title_y + 50.0), ver, HORIZONTAL_ALIGNMENT_LEFT, -1, 12, TEXT_MUTED)

	# Options
	for i in range(OPTIONS.size()):
		var y := _option_y(i)
		var is_selected := i == selected
		if is_selected:
			draw_rect(Rect2(MARGIN - 16.0, y - 14.0, 4.0, 28.0), ACCENT)
		draw_string(font, Vector2(MARGIN, y + 9.0), OPTIONS[i], HORIZONTAL_ALIGNMENT_LEFT, -1, 26,
			TEXT if is_selected else TEXT_DIM)

	# Description of the selected option
	draw_string(font, Vector2(MARGIN, _option_y(OPTIONS.size()) + 30.0), DESCRIPTIONS[selected],
		HORIZONTAL_ALIGNMENT_LEFT, -1, 14, TEXT_DIM)
