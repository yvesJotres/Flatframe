class_name ModsPanel
extends Control

# Mod placement for one equipment item: installed slots on the left, owned mods that fit on the right.
# Port of the mod part of src/ui/menus/arsenal.js. ArsenalScreen owns input and passes it on.

const BG_COLOR := Color("#0a0a0c")
const PANEL_BG := Color(11.0 / 255.0, 14.0 / 255.0, 22.0 / 255.0, 0.6)
const STROKE := Color(1.0, 1.0, 1.0, 0.12)
const TEXT := Color("#ffffff")
const TEXT_DIM := Color("#9aa0b4")
const ACCENT := Color("#ff6b35")
const WARN := Color("#f87171")

const MARGIN := 96.0
const SLOT_X := MARGIN
const SLOT_W := 360.0
const SLOT_H := 40.0
const SLOT_TOP := 140.0
const INV_X := MARGIN + 380.0
const INV_W := 460.0
const INV_H := 46.0
const INV_TOP := 140.0

var slot := "primary"
var col := 0           # 0 = installed slots, 1 = owned mods
var slot_index := 0
var inv_index := 0
var inventory: Array = []
var message := ""


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE


func open(slot_id: String) -> void:
	slot = slot_id
	col = 0
	slot_index = 0
	inv_index = 0
	message = ""
	inventory = Mods.owned_for(slot)


# Returns "back" when the screen should close, otherwise "".
func handle_key(keycode: int) -> String:
	match keycode:
		KEY_LEFT, KEY_A:
			col = 0
		KEY_RIGHT, KEY_D:
			col = 1
		KEY_UP, KEY_W:
			if col == 0:
				slot_index = maxi(0, slot_index - 1)
			else:
				inv_index = maxi(0, inv_index - 1)
		KEY_DOWN, KEY_S:
			if col == 0:
				slot_index = mini(Mods.slot_count(slot) - 1, slot_index + 1)
			else:
				inv_index = mini(maxi(0, inventory.size() - 1), inv_index + 1)
		KEY_ENTER, KEY_KP_ENTER:
			_activate()
		KEY_ESCAPE:
			return "back"
	return ""


# Returns "back" when the back button is clicked, otherwise "".
func handle_click(point: Vector2) -> String:
	for i in range(Mods.slot_count(slot)):
		if _slot_rect(i).has_point(point):
			col = 0
			slot_index = i
			return ""
	for j in range(inventory.size()):
		if _inv_rect(j).has_point(point):
			col = 1
			inv_index = j
			_install_selected()
			return ""
	if _back_rect().has_point(point):
		return "back"
	return ""


func _activate() -> void:
	if col == 0:
		Mods.remove(slot, slot_index)
		message = "Removed."
	else:
		_install_selected()


func _install_selected() -> void:
	if inventory.is_empty():
		return
	var mod: Dictionary = inventory[inv_index]
	if Mods.install(slot, slot_index, mod):
		message = "Installed %s." % mod.get("name", "mod")
	else:
		message = Mods.reject_reason(slot, slot_index, mod)


func _slot_rect(i: int) -> Rect2:
	return Rect2(SLOT_X, SLOT_TOP + i * (SLOT_H + 6.0), SLOT_W, SLOT_H)


func _inv_rect(j: int) -> Rect2:
	return Rect2(INV_X, INV_TOP + j * (INV_H + 6.0), INV_W, INV_H)


func _back_rect() -> Rect2:
	return Rect2(MARGIN, size.y - 64.0, 120.0, 36.0)


func _draw() -> void:
	var font := ThemeDB.fallback_font
	draw_rect(Rect2(Vector2.ZERO, size), BG_COLOR)

	var item_name: String = Loadout.equipped.get(slot, "")
	draw_string(font, Vector2(MARGIN, 60), "MODS  " + item_name.to_upper(), HORIZONTAL_ALIGNMENT_LEFT, -1, 22, TEXT)
	var used := Mods.used_capacity(slot)
	var cap := Mods.capacity()
	draw_string(font, Vector2(MARGIN, 92), "Capacity %d / %d" % [used, cap], HORIZONTAL_ALIGNMENT_LEFT, -1, 14,
		WARN if used > cap else TEXT_DIM)

	draw_string(font, Vector2(SLOT_X, SLOT_TOP - 14.0), "INSTALLED", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, TEXT_DIM)
	for i in range(Mods.slot_count(slot)):
		var r := _slot_rect(i)
		var focused := col == 0 and i == slot_index
		var m := Mods.mod_at(slot, i)
		draw_rect(r, PANEL_BG)
		draw_rect(r, ACCENT if focused else STROKE, false, 1.5 if focused else 1.0)
		draw_string(font, r.position + Vector2(12, 24), "%d  %s" % [i + 1, Mods.slot_kind(slot, i).to_upper()],
			HORIZONTAL_ALIGNMENT_LEFT, -1, 11, TEXT_DIM)
		if m.is_empty():
			draw_string(font, r.position + Vector2(110, 25), "Empty", HORIZONTAL_ALIGNMENT_LEFT, -1, 14, TEXT_DIM)
		else:
			draw_string(font, r.position + Vector2(110, 25), str(m.get("name", "")), HORIZONTAL_ALIGNMENT_LEFT, -1, 14, TEXT)
			var dtxt := "%d" % Mods.drain(m)
			var dw := font.get_string_size(dtxt, HORIZONTAL_ALIGNMENT_LEFT, -1, 13).x
			draw_string(font, Vector2(r.position.x + r.size.x - dw - 12, r.position.y + 25), dtxt,
				HORIZONTAL_ALIGNMENT_LEFT, -1, 13, TEXT)

	draw_string(font, Vector2(INV_X, INV_TOP - 14.0), "OWNED MODS", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, TEXT_DIM)
	if inventory.is_empty():
		draw_string(font, Vector2(INV_X, INV_TOP + 20.0), "No owned mods fit this item.", HORIZONTAL_ALIGNMENT_LEFT,
			-1, 14, TEXT_DIM)
	for j in range(inventory.size()):
		var m: Dictionary = inventory[j]
		var r := _inv_rect(j)
		var focused := col == 1 and j == inv_index
		draw_rect(r, PANEL_BG)
		draw_rect(r, ACCENT if focused else STROKE, false, 1.5 if focused else 1.0)
		draw_string(font, r.position + Vector2(12, 20), str(m.get("name", "")), HORIZONTAL_ALIGNMENT_LEFT, -1, 15, TEXT)
		var lines: Array = Mods.effect_lines(m)
		var effect := ", ".join(PackedStringArray(lines)) if not lines.is_empty() else ""
		draw_string(font, r.position + Vector2(12, 38), effect, HORIZONTAL_ALIGNMENT_LEFT, INV_W - 90.0, 12, TEXT_DIM)
		var dtxt := "Drain %d" % Mods.drain(m)
		var dw := font.get_string_size(dtxt, HORIZONTAL_ALIGNMENT_LEFT, -1, 12).x
		draw_string(font, Vector2(r.position.x + r.size.x - dw - 12, r.position.y + 20), dtxt,
			HORIZONTAL_ALIGNMENT_LEFT, -1, 12, TEXT_DIM)

	if message != "":
		draw_string(font, Vector2(MARGIN, size.y - 96.0), message, HORIZONTAL_ALIGNMENT_LEFT, -1, 14, TEXT)

	var back := _back_rect()
	draw_rect(back, Color(0, 0, 0, 0.5))
	draw_rect(back, STROKE, false, 1.0)
	draw_string(font, back.position + Vector2(44, 23), "BACK", HORIZONTAL_ALIGNMENT_LEFT, -1, 14, TEXT_DIM)
