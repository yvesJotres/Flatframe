class_name MainMenu
extends Control
## Port of java_build/src/ui/menus/main_menu.js, the landing view. The layout is
## built from scene nodes (scenes/main_menu.tscn), so it can be designed in the
## 2D editor: the shared background, the top bar, the title, and the options.
##
## Input follows the browser menu: Up/Down (or W/S) move through the options and
## wrap around, Up from the first option goes to the top row (the matchmaking
## icon), Down from the top row returns, Left/Right (or A/D) move along the top
## row, Enter or a click chooses, Escape exits. The option buttons handle
## keyboard focus, hover and clicks. Emits option_chosen(action).

signal option_chosen(action: String)

const ACTIONS := ["navigation", "arsenal", "profile", "settings"]
const BOLD_FONT := preload("res://theme/bold_font.tres")
const DESCRIPTIONS := {
	"navigation": "Star Chart · Missions · Progress",
	"arsenal": "Loadout · Weapons · Mods · Warframes",
	"profile": "Mastery · Stats · Appearance · Syndicates",
	"settings": "CUSTOMIZE GAME SETTINGS",
}

@onready var option_buttons: Array[Button] = [
	$Options/Navigation,
	$Options/Arsenal,
	$Options/Profile,
	$Options/Settings,
]
@onready var description: Label = $Options/Description
@onready var top_bar: TopBar = $TopBar


func _ready() -> void:
	FocusSound.reset()  # opening the menu plays no hover sound
	for i in option_buttons.size():
		option_buttons[i].pressed.connect(_on_option_pressed.bind(i))
		option_buttons[i].focus_entered.connect(_on_option_focused.bind(i))
		option_buttons[i].mouse_entered.connect(option_buttons[i].grab_focus)
	top_bar.squad_requested.connect(option_chosen.emit.bind("squad"))
	_set_focus_neighbors()
	option_buttons[0].grab_focus()


# Keyboard order, as in the browser: the options wrap, Up from the first goes to the matchmaking
# icon, and the top row comes back down to the first option
func _set_focus_neighbors() -> void:
	var first := option_buttons[0]
	var last := option_buttons[option_buttons.size() - 1]
	first.focus_neighbor_top = first.get_path_to(top_bar.mode_button)
	last.focus_neighbor_bottom = last.get_path_to(first)

	var top_row: Array[Button] = [top_bar.avatar, top_bar.mode_button, top_bar.invite_button]
	for i in top_row.size():
		var button := top_row[i]
		button.focus_neighbor_top = button.get_path_to(button)
		button.focus_neighbor_bottom = button.get_path_to(first)
		button.focus_neighbor_left = button.get_path_to(top_row[maxi(i - 1, 0)])
		button.focus_neighbor_right = button.get_path_to(top_row[mini(i + 1, top_row.size() - 1)])


func _unhandled_input(event: InputEvent) -> void:
	if not visible:
		return  # hidden while another screen (e.g. the profile or the squad panel) is open

	# W / A / S / D move the focus like the arrow keys
	if event is InputEventKey and event.pressed and not event.echo:
		var side := -1
		match event.keycode:
			KEY_W:
				side = SIDE_TOP
			KEY_S:
				side = SIDE_BOTTOM
			KEY_A:
				side = SIDE_LEFT
			KEY_D:
				side = SIDE_RIGHT
		if side != -1:
			var focused := get_viewport().gui_get_focus_owner()
			if focused != null:
				var next := focused.find_valid_focus_neighbor(side)
				if next != null:
					next.grab_focus()
			get_viewport().set_input_as_handled()
			return

	if event.is_action_pressed("ui_cancel"):
		option_chosen.emit("exit")


func _on_option_pressed(index: int) -> void:
	AudioManager.play("ui_select")
	option_chosen.emit(ACTIONS[index])


func _on_option_focused(index: int) -> void:
	FocusSound.track("option%d" % index)
	# The focused option's label grows from 20 to 22px and turns bold, like the browser's selected option
	for i in option_buttons.size():
		option_buttons[i].add_theme_font_size_override("font_size", 22 if i == index else 20)
		if i == index:
			option_buttons[i].add_theme_font_override("font", BOLD_FONT)
		else:
			option_buttons[i].remove_theme_font_override("font")
	description.text = DESCRIPTIONS[ACTIONS[index]]
