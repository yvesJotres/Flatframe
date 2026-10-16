class_name ArsenalScreen
extends Control

# Loadout screen, port of the main view of src/ui/menus/arsenal.js. The screen is drawn in the browser's 800 by 600
# reference frame and scaled to the window, so the positions match the browser's. Left: loadout bar, tabs, and the
# equipment cards (rank under each name). The focused card shows its action menu beside it (SWAP, UPGRADE,
# APPEARANCE). Centre: the frame on its pedestal. Right: info and stats for the focused item. Upgrade and Appearance
# are not built yet, so they open the work-in-progress screen. Mods and the profile keep their own screens.

signal back_requested
signal sign_out_requested

const REF := Vector2(800.0, 600.0)
const BG_COLOR := Color("#0a0c12")
const CARD_FILL := Color("#1a1f2c")
const CARD_FOCUS_FILL := Color("#3a1f1a")
const CARD_STROKE := Color("#3a4358")
const CARD_FOCUS_STROKE := Color("#e0b050")
const GOLD := Color("#f0c060")
const TEXT := Color("#f0e8e0")
const TEXT_DIM := Color("#9aa3bd")
const ACCENT := Color("#ff6b35")
const FRAME_GREEN := Color("#4ade80")
# The Exalted Blade (src/warframe/abilities/excalibur_abilities.js EXALTED_BLADE_WEAPON), shown as a fixed weapon card
const EXALTED_BLADE_ITEM := {
	"name": "Exalted Blade",
	"type": "Dual Swords",
	"description": "Excalibur summons the Exalted Blade with his fourth ability. Its normal attack throws energy waves.",
	"damage": {"impact": 37.5, "puncture": 37.5, "slash": 175.0, "total": 250.0},
	"criticalChance": 0.15,
	"criticalMultiplier": 2.0,
	"procChance": 0.15,
	"fireRate": 1.0,
	"range": 2.8,
}
const DAMAGE_COLOURS := {"impact": Color("#7ab8ff"), "puncture": Color("#ffd166"), "slash": Color("#ff6b6b")}

# Reference-frame layout (800 by 600)
const LEFT := 75.0
const LEFT_W := 215.0
const LOADOUT_Y := 90.0
const TABS_Y := 125.0
const CARDS_Y := 175.0
const CARD_H := 43.0
const FOCUS_CARD_H := 92.0
const CARD_GAP := 8.0
const ACTION_X := 297.0
const ACTION_W := 117.0
const ACTION_H := 28.0
const ACTION_GAP := 3.0
const INFO_RECT := Rect2(525.0, 90.0, 200.0, 100.0)
const STATS_RECT := Rect2(525.0, 350.0, 200.0, 170.0)
const BACK_RECT := Rect2(615.0, 527.0, 110.0, 33.0)
const MODS_RECT := Rect2(525.0, 527.0, 80.0, 33.0)
const AVATAR_RECT := Rect2(75.0, 36.0, 42.0, 42.0)
const INVITE_RECT := Rect2(170.0, 36.0, 42.0, 42.0)
const CURRENCY_RECT := Rect2(577.0, 36.0, 148.0, 33.0)
const TABS := ["LOADOUT", "COMPANION", "GEAR", "VEHICLES"]
const LOADOUT_NAME := "Vanilla"

var view := "main"          # "main" or "swap"
var focus := 0             # index into Loadout.SLOTS
var swap_focus := 0        # index into swap_items
var swap_items: Array = []
var hovered := -1          # card (main) or row (swap) under the pointer

var mods_panel: ModsPanel
var user_panel: UserPanel
var wip: WorkInProgress


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	mods_panel = ModsPanel.new()
	add_child(mods_panel)
	user_panel = UserPanel.new()
	add_child(user_panel)
	wip = WorkInProgress.new()
	add_child(wip)


func _process(_delta: float) -> void:
	mods_panel.visible = view == "mods"
	user_panel.visible = view == "profile"
	queue_redraw()


# Scale and offset that fit the 800 by 600 reference frame into the window, centred
func _scale() -> float:
	return minf(size.x / REF.x, size.y / REF.y)


func _offset() -> Vector2:
	return (size - REF * _scale()) * 0.5


func _to_ref(p: Vector2) -> Vector2:
	return (p - _offset()) / _scale()


func _open_mods() -> void:
	if focus >= Loadout.SLOTS.size():
		return
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


# Starts the screen on the main view. Called by the menu each time it opens.
func open_screen() -> void:
	view = "main"
	focus = 0
	hovered = -1


# Card rects in reference units: the focused card is taller and shows its action menu beside it
func _card_rects() -> Array:
	var rects: Array = []
	var y := CARDS_Y
	for i in range(_card_count()):
		var h := FOCUS_CARD_H if i == focus else CARD_H
		rects.append(Rect2(LEFT, y, LEFT_W, h))
		y += h + CARD_GAP
	return rects


# The Exalted Blade is not a slot: it has no swap, only upgrade and appearance (browser SLOTS)
func _action_names(slot: String) -> Array:
	if slot == "exalted":
		return ["UPGRADE", "APPEARANCE"]
	if slot == "warframe":
		return ["SWAP", "UPGRADE", "APPEARANCE", "ABILITIES"]
	return ["SWAP", "UPGRADE", "APPEARANCE"]


# Cards on the main view: the four loadout slots, then the Exalted Blade (display only, from Excalibur)
func _card_count() -> int:
	return Loadout.SLOTS.size() + 1


func _card_slot(i: int) -> String:
	return Loadout.SLOTS[i] if i < Loadout.SLOTS.size() else "exalted"


func _card_item(i: int) -> Dictionary:
	if i < Loadout.SLOTS.size():
		return Loadout.equipped_item(Loadout.SLOTS[i])
	return EXALTED_BLADE_ITEM



func _action_rect(index: int) -> Rect2:
	var card: Rect2 = _card_rects()[focus]
	return Rect2(ACTION_X, card.position.y + index * (ACTION_H + ACTION_GAP), ACTION_W, ACTION_H)


func _back_rect() -> Rect2:
	return BACK_RECT


func _row_rect(i: int) -> Rect2:
	return Rect2(LEFT, CARDS_Y + i * (CARD_H + CARD_GAP), LEFT_W, CARD_H)


func _open_slot(i: int) -> void:
	if i >= Loadout.SLOTS.size():
		return
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
	var slot: String = _card_slot(focus)
	Loadout.equipped[slot] = swap_items[index].get("name", "")
	if slot == "melee":
		Sounds.play("melee_equip1")
	elif slot == "primary" or slot == "secondary":
		Sounds.play("ranged_equip1")
	view = "main"
	hovered = -1


# Upgrade and Appearance are not built yet: they open the work-in-progress screen
func _open_unbuilt(action: String) -> void:
	wip.open(action, "%s is not built yet." % action.capitalize(), "Check back in a future update.")


func _do_action(action: String) -> void:
	match action:
		"SWAP":
			if focus < Loadout.SLOTS.size():
				_open_slot(focus)
		"UPGRADE", "APPEARANCE", "ABILITIES":
			_open_unbuilt(action)


func _unhandled_input(event: InputEvent) -> void:
	if not is_visible_in_tree() or wip.visible:
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
				focus = (focus - 1 + _card_count()) % _card_count()
			KEY_DOWN, KEY_S:
				focus = (focus + 1) % _card_count()
			KEY_ENTER, KEY_KP_ENTER:
				_do_action("SWAP")
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
	var p := _to_ref(motion.position if motion else click.position)
	if motion:
		hovered = -1
		if view == "main":
			var cards := _card_rects()
			for i in range(cards.size()):
				if cards[i].has_point(p):
					hovered = i
					focus = i
		else:
			for i in range(swap_items.size()):
				if _row_rect(i).has_point(p):
					hovered = i
					swap_focus = i
	elif click and click.pressed and click.button_index == MOUSE_BUTTON_LEFT:
		if view == "main":
			if BACK_RECT.has_point(p):
				back_requested.emit()
				return
			if MODS_RECT.has_point(p):
				_open_mods()
				return
			if AVATAR_RECT.has_point(p):
				_open_profile()
				return
			var cards := _card_rects()
			for i in range(cards.size()):
				if cards[i].has_point(p):
					focus = i
					var actions := _action_names(_card_slot(i))
					for a in range(actions.size()):
						if _action_rect(a).has_point(p):
							_do_action(actions[a])
							return
					_open_slot(i)
					return
		else:
			if BACK_RECT.has_point(p):
				view = "main"
				return
			for i in range(swap_items.size()):
				if _row_rect(i).has_point(p):
					_equip(i)
					return


# Stats to show for an item: [label, value] pairs in the browser's order. Only fields the data has are listed.
func _stats(item: Dictionary) -> Array:
	var rows: Array = []
	if item.has("sprintSpeed"):
		# A Warframe: its base stats from the data (the browser also adds mod bonuses)
		rows.append(["Health", str(int(item.get("health", 0)))])
		rows.append(["Shield", str(int(item.get("shield", 0)))])
		rows.append(["Armor", str(int(item.get("armor", 0)))])
		rows.append(["Energy", str(int(item.get("energy", 0)))])
		rows.append(["Sprint Speed", _num(item.sprintSpeed)])
		return rows
	if item.has("criticalChance"):
		rows.append(["Critical Chance", _num(float(item.criticalChance) * 100.0) + "%"])
	if item.has("criticalMultiplier"):
		rows.append(["Critical Multiplier", _num(item.criticalMultiplier) + "x"])
	if item.has("procChance"):
		rows.append(["Status Chance", _num(float(item.procChance) * 100.0) + "%"])
	if item.has("fireRate"):
		rows.append(["Attack Speed", _num(item.fireRate)])
	if item.has("range"):
		rows.append(["Range", _num(item.range) + " m"])
	if item.has("magazineSize"):
		rows.append(["Magazine", _num(item.magazineSize)])
	if item.has("reloadTime"):
		rows.append(["Reload", _num(item.reloadTime) + " s"])
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


func _rank_text(item_name: String, slot: String) -> String:
	var kind := "frame" if slot == "warframe" else "weapon"
	var rank := Progression.item_rank_of(item_name, kind)
	return "Unranked" if rank == 0 else ("Max Rank" if rank >= Progression.ITEM_MAX_RANK else "Rank %d" % rank)


func _mastery_rank() -> int:
	return int(UserStore.get_profile(UserStore.active_id()).get("masteryRank", 0))


func _draw() -> void:
	if view == "mods" or view == "profile":
		return   # ModsPanel and UserPanel draw over this screen
	var font := ThemeDB.fallback_font
	draw_rect(Rect2(Vector2.ZERO, size), BG_COLOR)
	var k := _scale()
	draw_set_transform(_offset(), 0.0, Vector2(k, k))

	_draw_top_bar(font)
	_draw_loadout_bar(font)
	if view == "main":
		_draw_cards(font)
	else:
		_draw_swap_list(font)
	_draw_pedestal(font)
	_draw_info_panel(font)
	_draw_stats_panel(font)
	_draw_button(BACK_RECT, "BACK", font)
	if view == "main":
		_draw_button(MODS_RECT, "MODS (M)", font)

	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
	if wip.visible:
		wip.size = size
		wip.queue_redraw()


func _draw_button(rect: Rect2, label: String, font: Font) -> void:
	draw_rect(rect, Color(0.04, 0.05, 0.08, 0.9))
	draw_rect(rect, CARD_STROKE, false, 1.0)
	var w := font.get_string_size(label, HORIZONTAL_ALIGNMENT_LEFT, -1, 11).x
	draw_string(font, rect.position + Vector2((rect.size.x - w) * 0.5, rect.size.y * 0.5 + 4.0), label, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, TEXT_DIM)


func _draw_top_bar(font: Font) -> void:
	# Profile avatar, the squad invite (+), and the currencies
	draw_rect(AVATAR_RECT, Color(0.11, 0.09, 0.14))
	draw_rect(AVATAR_RECT, Color("#8a4a5a"), false, 1.0)
	draw_string(font, AVATAR_RECT.position + Vector2(10.0, 27.0), "A", HORIZONTAL_ALIGNMENT_LEFT, -1, 18, FRAME_GREEN)
	draw_rect(INVITE_RECT, Color(0.11, 0.12, 0.16))
	draw_rect(INVITE_RECT, CARD_STROKE, false, 1.0)
	draw_string(font, INVITE_RECT.position + Vector2(14.0, 27.0), "+", HORIZONTAL_ALIGNMENT_LEFT, -1, 18, TEXT)
	draw_rect(CURRENCY_RECT, Color(0.1, 0.11, 0.15))
	draw_rect(CURRENCY_RECT, CARD_STROKE, false, 1.0)
	var balances := Wallet.balances(UserStore.active_id())
	var x := CURRENCY_RECT.position.x + 12.0
	for currency in ["endo", "platinum", "credits"]:
		var text := str(int(balances.get(currency, 0)))
		draw_string(font, Vector2(x, CURRENCY_RECT.position.y + 22.0), text, HORIZONTAL_ALIGNMENT_LEFT, -1, 13, TEXT)
		x += 48.0


func _draw_loadout_bar(font: Font) -> void:
	var bar := Rect2(LEFT, LOADOUT_Y, LEFT_W, 32.0)
	draw_rect(bar, CARD_FILL)
	draw_rect(bar, CARD_STROKE, false, 1.0)
	draw_string(font, bar.position + Vector2(30.0, 21.0), LOADOUT_NAME, HORIZONTAL_ALIGNMENT_LEFT, -1, 13, TEXT)
	draw_string(font, bar.position + Vector2(LEFT_W - 22.0, 21.0), ">>", HORIZONTAL_ALIGNMENT_LEFT, -1, 12, TEXT_DIM)
	var tab_w := (LEFT_W - 3.0 * 5.0) / 4.0
	for i in range(TABS.size()):
		var r := Rect2(LEFT + i * (tab_w + 5.0), TABS_Y, tab_w, 40.0)
		draw_rect(r, CARD_FILL)
		draw_rect(r, CARD_FOCUS_STROKE if i == 0 else CARD_STROKE, false, 1.0)
		var w := font.get_string_size(TABS[i], HORIZONTAL_ALIGNMENT_LEFT, -1, 7).x
		draw_string(font, r.position + Vector2((tab_w - w) * 0.5, 30.0), TABS[i], HORIZONTAL_ALIGNMENT_LEFT, -1, 7, GOLD if i == 0 else TEXT_DIM)


func _draw_cards(font: Font) -> void:
	var cards := _card_rects()
	for i in range(_card_count()):
		var slot: String = _card_slot(i)
		var r: Rect2 = cards[i]
		var item: Dictionary = _card_item(i)
		var is_focus := i == focus
		draw_rect(r, CARD_FOCUS_FILL if is_focus else CARD_FILL)
		draw_rect(r, CARD_FOCUS_STROKE if is_focus else CARD_STROKE, false, 1.5 if is_focus else 1.0)
		var name_text := str(item.get("name", "-")).to_upper()
		draw_string(font, r.position + Vector2(10.0, 19.0), name_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 13, GOLD if is_focus else TEXT)
		draw_string(font, r.position + Vector2(10.0, 33.0), _rank_text(str(item.get("name", "")), slot), HORIZONTAL_ALIGNMENT_LEFT, -1, 9, TEXT_DIM)
		if is_focus:
			var art := ArtSlot.texture(slot)
			if art:
				draw_texture_rect(art, Rect2(r.position.x + r.size.x - 64.0, r.position.y + 18.0, 56.0, 56.0), false)
			_draw_action_menu(font, slot, i)


func _draw_action_menu(font: Font, slot: String, index: int) -> void:
	var actions := _action_names(slot)
	for a in range(actions.size()):
		var r := _action_rect(a)
		draw_rect(r, CARD_FILL)
		draw_rect(r, CARD_STROKE, false, 1.0)
		draw_string(font, r.position + Vector2(10.0, 19.0), actions[a], HORIZONTAL_ALIGNMENT_LEFT, -1, 11, TEXT)


func _draw_swap_list(font: Font) -> void:
	var slot: String = _card_slot(focus)
	draw_string(font, Vector2(LEFT, CARDS_Y - 10.0), "SELECT " + Loadout.SLOT_LABELS[slot], HORIZONTAL_ALIGNMENT_LEFT, -1, 10, ACCENT)
	for i in range(swap_items.size()):
		var r := _row_rect(i)
		var it: Dictionary = swap_items[i]
		var is_equipped: bool = it.get("name", "") == Loadout.equipped[slot]
		var is_focus := i == swap_focus
		draw_rect(r, CARD_FOCUS_FILL if is_focus else CARD_FILL)
		draw_rect(r, CARD_FOCUS_STROKE if is_focus else CARD_STROKE, false, 1.5 if is_focus else 1.0)
		draw_string(font, r.position + Vector2(10.0, 19.0), str(it.get("name", "")).to_upper(), HORIZONTAL_ALIGNMENT_LEFT, -1, 12, GOLD if is_focus else TEXT)
		var tag := "EQUIPPED" if is_equipped else str(it.get("type", ""))
		draw_string(font, r.position + Vector2(10.0, 33.0), tag, HORIZONTAL_ALIGNMENT_LEFT, -1, 9, FRAME_GREEN if is_equipped else TEXT_DIM)


# The frame on its pedestal, in the centre of the screen (the browser's frame figure and its base ring)
func _draw_pedestal(font: Font) -> void:
	var c := Vector2(465.0, 300.0)
	draw_circle(c + Vector2(0.0, 58.0), 52.0, Color(FRAME_GREEN.r, FRAME_GREEN.g, FRAME_GREEN.b, 0.08))
	draw_arc(c + Vector2(0.0, 58.0), 52.0, 0.0, TAU, 48, Color(FRAME_GREEN.r, FRAME_GREEN.g, FRAME_GREEN.b, 0.5), 2.0)
	draw_rect(Rect2(c.x - 22.0, c.y - 44.0, 44.0, 96.0), Color("#e8ecf4"))
	draw_circle(c + Vector2(0.0, -44.0), 22.0, Color("#e8ecf4"))
	var name_text := str(Loadout.equipped.get("warframe", ""))
	var w := font.get_string_size(name_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 11).x
	draw_string(font, Vector2(c.x - w * 0.5, 425.0), name_text.to_upper(), HORIZONTAL_ALIGNMENT_LEFT, -1, 11, TEXT_DIM)


func _draw_info_panel(font: Font) -> void:
	var item: Dictionary
	var slot: String = _card_slot(focus)
	if view == "swap" and swap_items.size() > 0:
		item = swap_items[clampi(swap_focus, 0, swap_items.size() - 1)]
	else:
		item = _card_item(focus)
	var p := INFO_RECT
	draw_rect(p, CARD_FILL)
	draw_rect(p, CARD_STROKE, false, 1.0)
	var x := p.position.x + 12.0
	draw_string(font, Vector2(x, p.position.y + 22.0), str(item.get("name", "-")).to_upper(), HORIZONTAL_ALIGNMENT_LEFT, -1, 15, GOLD)
	var rank := _rank_text(str(item.get("name", "")), slot)
	draw_string(font, Vector2(x, p.position.y + 40.0), rank, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, TEXT)
	var mr := "MR %d" % _mastery_rank()
	var mw := font.get_string_size(mr, HORIZONTAL_ALIGNMENT_LEFT, -1, 10).x
	draw_string(font, Vector2(p.end.x - 12.0 - mw, p.position.y + 40.0), mr, HORIZONTAL_ALIGNMENT_LEFT, -1, 10, TEXT_DIM)
	var dy := p.position.y + 58.0
	for line in _wrap(str(item.get("description", "")), font, 9, p.size.x - 24.0):
		draw_string(font, Vector2(x, dy), line, HORIZONTAL_ALIGNMENT_LEFT, -1, 9, TEXT_DIM)
		dy += 12.0


func _draw_stats_panel(font: Font) -> void:
	var item: Dictionary
	var slot: String = _card_slot(focus)
	if view == "swap" and swap_items.size() > 0:
		item = swap_items[clampi(swap_focus, 0, swap_items.size() - 1)]
	else:
		item = _card_item(focus)
	var p := STATS_RECT
	draw_rect(p, CARD_FILL)
	draw_rect(p, CARD_STROKE, false, 1.0)
	var x := p.position.x + 10.0
	var y := p.position.y + 18.0
	var damage: Dictionary = item.get("damage", {}) if item.get("damage") is Dictionary else {}
	if damage.has("total"):
		draw_string(font, Vector2(x, y), "DAMAGE", HORIZONTAL_ALIGNMENT_LEFT, -1, 10, GOLD)
		var total := "%d" % int(round(float(damage.total)))
		var tw := font.get_string_size(total, HORIZONTAL_ALIGNMENT_LEFT, -1, 14).x
		draw_string(font, Vector2(p.end.x - 10.0 - tw, y), total, HORIZONTAL_ALIGNMENT_LEFT, -1, 14, TEXT)
		y += 10.0
		var bar_w := p.size.x - 20.0
		var sum := 0.0
		for t in ["impact", "puncture", "slash"]:
			sum += float(damage.get(t, 0.0))
		var bx := x
		for t in ["impact", "puncture", "slash"]:
			var share := float(damage.get(t, 0.0)) / maxf(sum, 0.001)
			draw_rect(Rect2(bx, y, bar_w * share, 4.0), DAMAGE_COLOURS[t])
			bx += bar_w * share
		y += 12.0
		var parts := ""
		for t in ["impact", "puncture", "slash"]:
			parts += "%s %d  " % [t.capitalize(), int(round(float(damage.get(t, 0.0))))]
		draw_string(font, Vector2(x, y), parts.strip_edges(), HORIZONTAL_ALIGNMENT_LEFT, -1, 9, TEXT_DIM)
		y += 16.0
	var rows := _stats(item)
	if rows.is_empty():
		draw_string(font, Vector2(x, y), "No stats in the data yet.", HORIZONTAL_ALIGNMENT_LEFT, -1, 10, TEXT_DIM)
		return
	for row in rows:
		draw_string(font, Vector2(x, y), row[0], HORIZONTAL_ALIGNMENT_LEFT, -1, 10, TEXT_DIM)
		var vw := font.get_string_size(row[1], HORIZONTAL_ALIGNMENT_LEFT, -1, 10).x
		draw_string(font, Vector2(p.end.x - 10.0 - vw, y), row[1], HORIZONTAL_ALIGNMENT_LEFT, -1, 10, GOLD)
		y += 14.0
