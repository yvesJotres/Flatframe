class_name ProfileMenu
extends Control
## Port of java_build/src/ui/menus/profile.js. Skeleton: the four tabs switch
## their panels, and BACK or Escape emits closed. The tab contents are not
## ported yet (see the placeholder labels in scenes/profile_menu.tscn).

signal closed

var active_tab := 0

@onready var tab_buttons: Array[Button] = [
	$Tabs/Overview,
	$Tabs/Stats,
	$Tabs/Loadout,
	$Tabs/Appearance,
]
@onready var panels: Array[Control] = [
	$Content/Overview,
	$Content/Stats,
	$Content/Loadout,
	$Content/Appearance,
]
@onready var back_button: Button = $Back


func _ready() -> void:
	for i in tab_buttons.size():
		tab_buttons[i].pressed.connect(show_tab.bind(i))
	back_button.pressed.connect(close)
	show_tab(0)


func open() -> void:
	visible = true
	show_tab(0)
	tab_buttons[0].grab_focus()


func close() -> void:
	visible = false
	closed.emit()


func show_tab(index: int) -> void:
	active_tab = index
	for i in panels.size():
		panels[i].visible = i == index


func _unhandled_input(event: InputEvent) -> void:
	if visible and event.is_action_pressed("ui_cancel"):
		close()
