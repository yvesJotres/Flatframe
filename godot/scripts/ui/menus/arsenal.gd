class_name ArsenalScreen
extends Control

# Loadout screen, port of the core of src/ui/menus/arsenal.js: the four equipment slots, a swap list
# per slot, and the info and stats panel. Mods, fusion, upgrades, and the frame model are not ported yet.

signal back_requested
signal sign_out_requested

const BG_COLOR := Color("#0a0a0c")
const PANEL_BG := Color(11.0 / 255.0, 14.0 / 255.0, 22.0 / 255.0, 0.6)  # COLORS.PANEL_BG
const STROKE := Color(1.0, 1.0, 1.0, 0.12)                             # COLORS.STROKE
const TEXT := Color("#ffffff")
const TEXT_DIM := Color("#9aa0b4")
const ACCENT := Color("#ff6b35")
const FRAME_GREEN := Color("#4ade80")                                  # the frame's in-game colour

const MARGIN := 96.0
const CARD_W := 300.0
const CARD_H := 84.0
const CARD_GAP := 12.0
const CARD_TOP := 120.0
const ROW_H := 56.0
const ROW_W := 380.0
const PANEL_W := 340.0
const PANEL_H := 420.0

var view := "main"          # "main" or "swap"
var focus := 0             # index into Loadout.SLOTS
var swap_focus := 0        # index into swap_items
var swap_items: Array = []
var hovered := -1          # card (main) or row (swap) under the pointer


var mods_panel: ModsPanel
var user_panel: UserPanel


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	mods_panel = ModsPanel.new()
	add_child(mods_panel)
	user_panel = UserPanel.new()
	add_child(user_panel)


func _process(_delta: float) -> void:
	mods_panel.visible = view == "mods"
	user_panel.visible = view == "profile"
	queue_redraw()


func _open_mods() -> void:
	view = "mods"
	mods_panel.open(Loadout.SLOTS[focus])


func _apply_profile_result(result: String) -> void:
	if result == "sign_out":
		Auth.sign_out()
		view = "main"
		sign_out_requested.emit()
	elif result == "close":
		view = "main"


func _open_profile() -> void:
	view = "profile"
	user_panel.open_screen()


func _profile_button_rect() -> Rect2:
	var p := _panel_rect()
	return Rect2(p.position.x + 16.0, p.position.y + p.size.y - 96.0, PANEL_W - 32.0, 36.0)


func _mods_button_rect() -> Rect2:
	var p := _panel_rect()
	return Rect2(p.position.x + 16.0, p.position.y + p.size.y - 52.0, PANEL_W - 32.0, 36.0)


# Starts the screen on the main view. Called by the menu each time it opens.
func open_screen() -> void:
	view = "main"
	focus = 0
	hovered = -1


func _card_rect(i: int) -> Rect2:
	return Rect2(MARGIN, CARD_TOP + i * (CARD_H + CARD_GAP), CARD_W, CARD_H)


func _row_rect(i: int) -> Rect2:
	return Rect2(MARGIN, CARD_TOP + i * ROW_H, ROW_W, ROW_H - 6.0)


func _panel_rect() -> Rect2:
	return Rect2(size.x - PANEL_W - MARGIN, CARD_TOP, PANEL_W, PANEL_H)


func _back_rect() -> Rect2:
	return Rect2(MARGIN, size.y - 64.0, 120.0, 36.0)


func _open_slot(i: int) -> void:
	view = "swap"
	focus = i
	swap_items = Loadout.items(Loadout.SLOTS[i])
	swap_focus = 0
	for k in range(swap_items.size()):
		if swap_items[k].get("name", "") == Loadout.equipped[Loadout.SLOTS[i]]:
			swap_focus = k
	hovered = -1


func _equip(index: int) -> void:
	if index < 0 or index >= swap_items.size():
		return
	var slot: String = Loadout.SLOTS[focus]
	Loadout.equipped[slot] = swap_items[index].get("name", "")
	if slot == "melee":
		Sounds.play("melee_equip1")
	elif slot == "primary" or slot == "secondary":
		Sounds.play("ranged_equip1")
	view = "main"
	hovered = -1


func _unhandled_input(event: InputEvent) -> void:
	if not is_visible_in_tree():
		return
	var key := event as InputEventKey
	if not (key and key.pressed and not key.echo):
		return
	var handled := true
	if view == "profile":
		_apply_profile_result(user_panel.handle_key(key.keycode))
		get_viewport().set_input_as_handled()
		return
	if view == "mods":
		if mods_panel.handle_key(key.keycode) == "back":
			view = "main"
		get_viewport().set_input_as_handled()
		return
	if view == "main":
		match key.keycode:
			KEY_UP, KEY_W:
				focus = (focus - 1 + Loadout.SLOTS.size()) % Loadout.SLOTS.size()
			KEY_DOWN, KEY_S:
				focus = (focus + 1) % Loadout.SLOTS.size()
			KEY_ENTER, KEY_KP_ENTER:
				_open_slot(focus)
			KEY_M:
				_open_mods()
			KEY_P:
				_open_profile()
			KEY_ESCAPE:
				back_requested.emit()
			_:
				handled = false
	else:
		match key.keycode:
			KEY_UP, KEY_W:
				swap_focus = maxi(0, swap_focus - 1)
			KEY_DOWN, KEY_S:
				swap_focus = mini(swap_items.size() - 1, swap_focus + 1)
			KEY_ENTER, KEY_KP_ENTER:
				_equip(swap_focus)
			KEY_ESCAPE:
				view = "main"
			_:
				handled = false
	if handled:
		get_viewport().set_input_as_handled()


func _gui_input(event: InputEvent) -> void:
	var motion := event as InputEventMouseMotion
	var click := event as InputEventMouseButton
	if view == "profile":
		if click and click.pressed and click.button_index == MOUSE_BUTTON_LEFT:
			_apply_profile_result(user_panel.handle_click(click.position))
		return
	if view == "mods":
		if click and click.pressed and click.button_index == MOUSE_BUTTON_LEFT:
			if mods_panel.handle_click(click.position) == "back":
				view = "main"
		return
	if motion:
		hovered = -1
		if view == "main":
			for i in range(Loadout.SLOTS.size()):
				if _card_rect(i).has_point(motion.position):
					hovered = i
					focus = i
		else:
			for i in range(swap_items.size()):
				if _row_rect(i).has_point(motion.position):
					hovered = i
					swap_focus = i
	elif click and click.pressed and click.button_index == MOUSE_BUTTON_LEFT:
		if view == "main":
			if _back_rect().has_point(click.position):
				back_requested.emit()
				return
			if _mods_button_rect().has_point(click.position):
				_open_mods()
				return
			if _profile_button_rect().has_point(click.position):
				_open_profile()
				return
			for i in range(Loadout.SLOTS.size()):
				if _card_rect(i).has_point(click.position):
					_open_slot(i)
					return
		else:
			if _back_rect().has_point(click.position):
				view = "main"
				return
			for i in range(swap_items.size()):
				if _row_rect(i).has_point(click.position):
					_equip(i)
					return


# Stats to show for an item: [label, value] pairs. Only fields the data has are listed.
func _stats(item: Dictionary) -> Array:
	var rows: Array = []
	if item.has("damage") and item.damage is Dictionary and item.damage.has("total"):
		rows.append(["Damage", _num(item.damage.total)])
	if item.has("fireRate"):
		rows.append(["Fire rate", _num(item.fireRate)])
	if item.has("magazineSize"):
		rows.append(["Magazine", _num(item.magazineSize)])
	if item.has("reloadTime"):
		rows.append(["Reload", _num(item.reloadTime) + " s"])
	if item.has("criticalChance"):
		rows.append(["Crit chance", _num(float(item.criticalChance) * 100.0) + "%"])
	if item.has("criticalMultiplier"):
		rows.append(["Crit multiplier", _num(item.criticalMultiplier) + "x"])
	if item.has("procChance"):
		rows.append(["Status chance", _num(float(item.procChance) * 100.0) + "%"])
	if item.has("masteryReq"):
		rows.append(["Mastery rank", _num(item.masteryReq)])
	return rows


func _num(v: Variant) -> String:
	return String.num(float(v), 2)


func _wrap(text: String, font: Font, font_size: int, max_w: float) -> PackedStringArray:
	var lines := PackedStringArray()
	var line := ""
	for word in text.split(" ", false):
		var test := word if line == "" else line + " " + word
		if line != "" and font.get_string_size(test, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x > max_w:
			lines.append(line)
			line = word
		else:
			line = test
	if line != "":
		lines.append(line)
	return lines


func _draw() -> void:
	if view == "mods" or view == "profile":
		return   # ModsPanel and UserPanel draw over this screen
	var font := ThemeDB.fallback_font
	draw_rect(Rect2(Vector2.ZERO, size), BG_COLOR)
	draw_string(font, Vector2(MARGIN, 60), "ARSENAL", HORIZONTAL_ALIGNMENT_LEFT, -1, 22, TEXT)

	var slot: String = Loadout.SLOTS[focus]
	if view == "main":
		_draw_cards(font)
	else:
		_draw_swap_list(font)

	# Frame on its pedestal, centre
	var c := Vector2(size.x * 0.5, size.y * 0.42)
	draw_circle(c, 80.0, Color(FRAME_GREEN.r, FRAME_GREEN.g, FRAME_GREEN.b, 0.15))
	draw_arc(c, 80.0, 0.0, TAU, 64, FRAME_GREEN, 2.0)
	var frame_name: String = Loadout.equipped["warframe"]
	var fw := font.get_string_size(frame_name, HORIZONTAL_ALIGNMENT_LEFT, -1, 22).x
	draw_string(font, Vector2(c.x - fw / 2.0, c.y + 120.0), frame_name, HORIZONTAL_ALIGNMENT_LEFT, -1, 22, TEXT)

	_draw_info_panel(font, slot)
	if view == "main":
		var mb := _mods_button_rect()
		draw_rect(mb, Color(0, 0, 0, 0.5))
		draw_rect(mb, STROKE, false, 1.0)
		draw_string(font, mb.position + Vector2(12, 23), "MODS  (M)", HORIZONTAL_ALIGNMENT_LEFT, -1, 14, TEXT)
		var pb := _profile_button_rect()
		draw_rect(pb, Color(0, 0, 0, 0.5))
		draw_rect(pb, STROKE, false, 1.0)
		draw_string(font, pb.position + Vector2(12, 23), "PROFILE  (P)", HORIZONTAL_ALIGNMENT_LEFT, -1, 14, TEXT)

	# Back
	var back := _back_rect()
	draw_rect(back, Color(0, 0, 0, 0.5))
	draw_rect(back, STROKE, false, 1.0)
	draw_string(font, back.position + Vector2(44, 23), "BACK", HORIZONTAL_ALIGNMENT_LEFT, -1, 14, TEXT_DIM)


func _draw_cards(font: Font) -> void:
	for i in range(Loadout.SLOTS.size()):
		var slot: String = Loadout.SLOTS[i]
		var r := _card_rect(i)
		var item: Dictionary = Loadout.equipped_item(slot)
		draw_rect(r, PANEL_BG)
		draw_rect(r, ACCENT if i == focus else STROKE, false, 1.5 if i == focus else 1.0)
		draw_string(font, r.position + Vector2(14, 22), Loadout.SLOT_LABELS[slot], HORIZONTAL_ALIGNMENT_LEFT, -1, 11, TEXT_DIM)
		draw_string(font, r.position + Vector2(14, 48), str(item.get("name", "-")), HORIZONTAL_ALIGNMENT_LEFT, -1, 20, TEXT)
		draw_string(font, r.position + Vector2(14, 68), str(item.get("type", "")), HORIZONTAL_ALIGNMENT_LEFT, -1, 12, TEXT_DIM)
		var art := ArtSlot.texture(slot)
		if art:
			draw_texture_rect(art, Rect2(r.position.x + r.size.x - 70.0, r.position.y + 14.0, 56.0, 56.0), false)


func _draw_swap_list(font: Font) -> void:
	var slot: String = Loadout.SLOTS[focus]
	draw_string(font, Vector2(MARGIN, CARD_TOP - 20.0), "SELECT " + Loadout.SLOT_LABELS[slot],
		HORIZONTAL_ALIGNMENT_LEFT, -1, 14, ACCENT)
	for i in range(swap_items.size()):
		var r := _row_rect(i)
		var it: Dictionary = swap_items[i]
		var is_equipped: bool = it.get("name", "") == Loadout.equipped[slot]
		var is_focus := i == swap_focus
		draw_rect(r, PANEL_BG)
		draw_rect(r, ACCENT if is_focus else STROKE, false, 1.5 if is_focus else 1.0)
		var col := TEXT if is_focus else TEXT_DIM
		draw_string(font, r.position + Vector2(14, 34), str(it.get("name", "")), HORIZONTAL_ALIGNMENT_LEFT, -1, 18, col)
		var tag := "EQUIPPED" if is_equipped else str(it.get("type", ""))
		var tw := font.get_string_size(tag, HORIZONTAL_ALIGNMENT_LEFT, -1, 11).x
		draw_string(font, Vector2(r.position.x + r.size.x - tw - 14, r.position.y + 34),
			tag, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, FRAME_GREEN if is_equipped else TEXT_DIM)


func _draw_info_panel(font: Font, slot: String) -> void:
	var item: Dictionary
	if view == "swap" and swap_items.size() > 0:
		item = swap_items[clampi(swap_focus, 0, swap_items.size() - 1)]
	else:
		item = Loadout.equipped_item(slot)
	var p := _panel_rect()
	draw_rect(p, PANEL_BG)
	draw_rect(p, STROKE, false, 1.0)
	var x := p.position.x + 16.0
	var y := p.position.y + 28.0
	draw_string(font, Vector2(x, y), str(item.get("name", "-")).to_upper(), HORIZONTAL_ALIGNMENT_LEFT, -1, 20, ACCENT)
	draw_string(font, Vector2(x, y + 24), str(item.get("type", "")), HORIZONTAL_ALIGNMENT_LEFT, -1, 13, TEXT_DIM)
	var desc := str(item.get("description", ""))
	var dy := y + 52.0
	for line in _wrap(desc, font, 13, PANEL_W - 32.0):
		draw_string(font, Vector2(x, dy), line, HORIZONTAL_ALIGNMENT_LEFT, -1, 13, TEXT)
		dy += 18.0
	dy += 16.0
	var rows := _stats(item)
	if rows.is_empty():
		draw_string(font, Vector2(x, dy), "No stats in the data yet.", HORIZONTAL_ALIGNMENT_LEFT, -1, 13, TEXT_DIM)
		return
	for row in rows:
		draw_string(font, Vector2(x, dy), row[0], HORIZONTAL_ALIGNMENT_LEFT, -1, 13, TEXT_DIM)
		var vw := font.get_string_size(row[1], HORIZONTAL_ALIGNMENT_LEFT, -1, 13).x
		draw_string(font, Vector2(p.position.x + PANEL_W - 16.0 - vw, dy), row[1], HORIZONTAL_ALIGNMENT_LEFT, -1, 13, TEXT)
		dy += 22.0
