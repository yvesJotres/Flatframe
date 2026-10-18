extends Control
## Godot counterpart of java_build/src/game.js: the entry point that loads
## the weapon and warframe data, sets up the menus, and runs the frame loop.
## Stubs mark the steps still to port; the order follows game.js.

var primary_weapon: PrimaryWeapon

@onready var loading = $LoadingScreen


func _ready() -> void:
	# game.js: initPrimaryWeapons, initSecondaryWeapons, initMeleeWeapons,
	# initWarframes, initMods, startAccount (loading screen steps).
	var ok := await _load_data()
	if not ok:
		return
	# game.js: resizeCanvas and the uiScale rules for short screens.
	_setup_screen()
	# game.js: menu music and the audio unlock on the first input.
	_setup_audio()
	# game.js: installDebugCheats and the start-up screen.
	_show_start_screen()
	loading.done()


func _process(_delta: float) -> void:
	# game.js: advanceGameClock, updateEnemies, and the draw pass.
	# Only the mission loop runs this; menus are not ported yet.
	pass


# Runs each real load step in order. The bar moves only when a step has finished,
# so it shows actual progress. Returns false (and shows the error) if a step fails.
func _load_data() -> bool:
	var total := 3.0
	var index = DataLoader.load_index()
	if index == null:
		loading.fail("Could not read the data index")
		return false
	loading.set_progress(1.0 / total, "Reading primary weapons...")
	await get_tree().process_frame

	# game.js: initPrimaryWeapons()
	var weapons = DataLoader.get_by_chunk("weapons", "primary-rifle")
	if weapons == null or weapons.is_empty():
		loading.fail("Could not read the primary weapons")
		return false
	loading.set_progress(2.0 / total, "Building primary weapon stats...")
	await get_tree().process_frame

	PrimaryWeapon.init_from_data(weapons)
	primary_weapon = PrimaryWeapon.new()
	loading.set_progress(1.0, "Preparing the Origin System...")
	print("[game] primary weapon: %s, magazine %d" % [primary_weapon.weapon_name, primary_weapon.magazine])
	return true


func _setup_screen() -> void:
	pass


func _setup_audio() -> void:
	pass


func _show_start_screen() -> void:
	# game.js: the landing menu is the first screen after loading.
	var menu = preload("res://scenes/main_menu.tscn").instantiate()
	add_child(menu)
	var profile = preload("res://scenes/profile_menu.tscn").instantiate()
	profile.visible = false
	add_child(profile)
	var squad = preload("res://scenes/squad_panel.tscn").instantiate()
	add_child(squad)
	menu.option_chosen.connect(func(action: String) -> void:
		print("[game] menu: %s" % action)
		if action == "profile":
			menu.visible = false
			profile.open()
		elif action == "squad":
			menu.visible = false
			squad.open("big")
	)
	profile.closed.connect(func() -> void:
		menu.visible = true
		menu.option_buttons[2].grab_focus()
	)
	squad.closed.connect(func() -> void:
		menu.visible = true
		menu.top_bar.avatar.grab_focus()
	)
