extends Node
## Headless check of the main menu scene. Run with:
##   godot --headless --path godot_build res://tests/main_menu_test.tscn

var failures := 0
var chosen: Array[String] = []


func check(name: String, ok: bool, detail: String = "") -> void:
	if ok:
		print("PASS  ", name)
	else:
		failures += 1
		print("FAIL  ", name, "  ", detail)


func press(action: String) -> void:
	var down := InputEventAction.new()
	down.action = action
	down.pressed = true
	Input.parse_input_event(down)
	var up := InputEventAction.new()
	up.action = action
	up.pressed = false
	Input.parse_input_event(up)


func frames(count: int = 2) -> void:
	for i in count:
		await get_tree().process_frame


func focus_name() -> String:
	var owner := get_viewport().gui_get_focus_owner()
	return owner.name if owner != null else "<none>"


func _ready() -> void:
	_run.call_deferred()


func _run() -> void:
	var menu: MainMenu = load("res://scenes/main_menu.tscn").instantiate()
	add_child(menu)
	menu.option_chosen.connect(func(action: String) -> void: chosen.append(action))
	await frames(3)

	check("four option buttons", menu.option_buttons.size() == 4)
	check("first option focused on open", focus_name() == "Navigation", focus_name())
	check("description follows focus", menu.description.text == "Star Chart · Missions · Progress", menu.description.text)

	# Top bar contents
	var bar: TopBar = menu.top_bar
	check("three currency items", bar.items.get_child_count() == 3, str(bar.items.get_child_count()))
	var texts: Array[String] = []
	for item in bar.items.get_children():
		texts.append((item.get_child(1) as Label).text)
	check("wallet start amounts (credits 0, platinum 50, endo 0)", texts == ["0", "50", "0"], str(texts))
	check("mode icon shows the PUBLIC glyph", bar.mode_button.text == "🌐︎", bar.mode_button.text)
	check("username box is closed until hovered", bar.name_box.size.x == 0.0, str(bar.name_box.size.x))

	# Layout matches the browser's pixel positions
	check("avatar at 96,46 and 54x54", bar.avatar.position == Vector2(96, 46) and bar.avatar.size == Vector2(54, 54))
	check("mode icon 6px after avatar", bar.mode_button.position.x == 96 + 54 + 6, str(bar.mode_button.position.x))
	check("invite icon 6px after mode icon", bar.invite_button.position.x == bar.mode_button.position.x + 60)

	# Keyboard: down moves through the options, and wraps from the last to the first
	press("ui_down")
	await frames()
	check("down -> Arsenal", focus_name() == "Arsenal", focus_name())
	press("ui_down")
	press("ui_down")
	await frames()
	check("down x2 -> Settings", focus_name() == "Settings", focus_name())
	press("ui_down")
	await frames()
	check("down from last wraps to Navigation", focus_name() == "Navigation", focus_name())

	# Up from the first option goes to the matchmaking icon, down returns
	press("ui_up")
	await frames()
	check("up from first -> matchmaking icon", focus_name() == "ModeButton", focus_name())
	press("ui_left")
	await frames()
	check("left -> profile icon", focus_name() == "Avatar", focus_name())
	press("ui_right")
	press("ui_right")
	await frames()
	check("right x2 -> invite", focus_name() == "InviteButton", focus_name())
	press("ui_right")
	await frames()
	check("right at the end stays on invite", focus_name() == "InviteButton", focus_name())
	press("ui_down")
	await frames()
	check("down from top row -> first option", focus_name() == "Navigation", focus_name())

	# Choosing
	press("ui_accept")
	await frames()
	check("Enter chooses navigation", chosen == ["navigation"], str(chosen))

	# Matchmaking list from the keyboard
	press("ui_up")
	await frames()
	press("ui_accept")
	await frames(2)
	check("Enter on mode icon opens the list", bar.mode_list.visible and bar.rows.get_child_count() == 5, str(bar.rows.get_child_count()))
	check("list starts on the current mode", get_viewport().gui_get_focus_owner() == bar.rows.get_child(0), focus_name())
	press("ui_down")
	await frames()
	press("ui_accept")
	await frames(2)
	check("picking FRIENDS ONLY changes the mode", SquadData.get_mode()["id"] == "friends", SquadData.get_mode()["id"])
	check("list closes and focus returns to the icon", not bar.mode_list.visible and focus_name() == "ModeButton", focus_name())
	check("icon shows the new glyph", bar.mode_button.text == "☺︎", bar.mode_button.text)

	# Squad icons request the squad panel
	var squad_requests := [0]
	bar.squad_requested.connect(func() -> void: squad_requests[0] += 1)
	bar.invite_button.pressed.emit()
	check("invite icon requests the squad panel", squad_requests[0] == 1)

	print("")
	print("FAILURES: ", failures)
	get_tree().quit(1 if failures > 0 else 0)
