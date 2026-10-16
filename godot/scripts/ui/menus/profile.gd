class_name ProfileScreen
extends Control

# Profile screen, port of src/ui/menus/profile.js: four tabs (Overview, Stats, Loadout, Appearance).
# The name, Mastery Rank and loadout are the signed-in profile's. The stats and appearance numbers are the
# browser build's placeholders, copied as they are. Item rank is 0 until the progression curve is ported.

signal closed

const TEXT := Color("#f0e8e0")
const DIM := Color("#9a9ab0")
const FAINT := Color("#7a7a9a")
const SELECTED := Color("#ffd78a")
const ACCENT := Color("#ff6b35")
const GOLD := Color("#ffd78a")
const UTILITY := Color("#8fd0ff")
const DEFENSE := Color("#9af0b0")
const PANEL := Color(24.0 / 255.0, 30.0 / 255.0, 44.0 / 255.0, 0.92)
const PANEL_STROKE := Color(1, 1, 1, 0.08)
const BG := Color("#0a0a0c")
const CHIP := Color(1, 1, 1, 0.06)

const MARGIN := 96.0
const TOP := 110.0
const TAB_H := 40.0
const BACK_W := 120.0
const BACK_H := 36.0
const TABS := ["overview", "stats", "loadout", "appearance"]
const TAB_LABELS := {"overview": "OVERVIEW", "stats": "STATS", "loadout": "LOADOUT", "appearance": "APPEARANCE"}
const MAX_MASTERY := 30

var tab := "overview"


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	visible = false


func open_screen() -> void:
	tab = "overview"
	visible = true


func _process(_delta: float) -> void:
	if visible:
		queue_redraw()


func _tab_rects() -> Array:
	var tab_w := (size.x - MARGIN * 2.0) / TABS.size()
	var out: Array = []
	for i in range(TABS.size()):
		out.append(Rect2(MARGIN + i * tab_w, TOP, tab_w - 4.0, TAB_H))
	return out


func _back_rect() -> Rect2:
	return Rect2(size.x - MARGIN - BACK_W, size.y - 64.0, BACK_W, BACK_H)


func _panel_rect(panel_w: float) -> Rect2:
	return Rect2((size.x - panel_w) / 2.0, TOP + TAB_H + 14.0, panel_w, size.y - TOP - TAB_H - 14.0 - 100.0)


func _profile() -> Dictionary:
	return UserStore.get_profile(UserStore.active_id())


func _unhandled_input(event: InputEvent) -> void:
	if not is_visible_in_tree():
		return
	var key := event as InputEventKey
	if not (key and key.pressed and not key.echo):
		return
	var handled := true
	match key.keycode:
		KEY_ESCAPE:
			visible = false
			closed.emit()
		KEY_1: tab = "overview"
		KEY_2: tab = "stats"
		KEY_3: tab = "loadout"
		KEY_4: tab = "appearance"
		KEY_A, KEY_LEFT, KEY_D, KEY_RIGHT:
			var step := 1 if key.keycode == KEY_D or key.keycode == KEY_RIGHT else -1
			tab = TABS[posmod(TABS.find(tab) + step, TABS.size())]
		_:
			handled = false
	if handled:
		get_viewport().set_input_as_handled()


func _gui_input(event: InputEvent) -> void:
	var click := event as InputEventMouseButton
	if not (click and click.pressed and click.button_index == MOUSE_BUTTON_LEFT):
		return
	if _back_rect().has_point(click.position):
		visible = false
		closed.emit()
		return
	var tabs := _tab_rects()
	for i in range(tabs.size()):
		if tabs[i].has_point(click.position):
			tab = TABS[i]


func _draw() -> void:
	if not visible:
		return
	var font := ThemeDB.fallback_font
	draw_rect(Rect2(Vector2.ZERO, size), BG)
	MenuChrome.draw_corners(self, size)
	MenuChrome.draw_top_bar(self, size, font, Wallet.balances(UserStore.active_id()))
	MenuChrome.draw_close(self, size)

	var tabs := _tab_rects()
	for i in range(tabs.size()):
		var r: Rect2 = tabs[i]
		var active: bool = TABS[i] == tab
		draw_rect(r, PANEL)
		draw_rect(r, SELECTED if active else PANEL_STROKE, false, 1.5 if active else 1.0)
		var label: String = TAB_LABELS[TABS[i]]
		var lw := font.get_string_size(label, HORIZONTAL_ALIGNMENT_LEFT, -1, 13).x
		draw_string(font, Vector2(r.position.x + (r.size.x - lw) / 2.0, r.position.y + 25.0), label,
			HORIZONTAL_ALIGNMENT_LEFT, -1, 13, SELECTED if active else DIM)

	match tab:
		"overview": _draw_overview(font)
		"stats": _draw_stats(font)
		"loadout": _draw_loadout(font)
		"appearance": _draw_appearance(font)

	draw_rect(_back_rect(), PANEL)
	draw_rect(_back_rect(), PANEL_STROKE, false, 1.0)
	draw_string(font, _back_rect().position + Vector2(44, 23), "BACK", HORIZONTAL_ALIGNMENT_LEFT, -1, 14, TEXT)


func _draw_overview(font: Font) -> void:
	var p := _panel_rect(720.0)
	draw_rect(p, PANEL)
	draw_rect(p, PANEL_STROKE, false, 1.0)

	# Avatar box with a placeholder mark (the JS draws a glyph here)
	var av := Rect2(p.position.x + 56.0, p.position.y + 40.0, 262.0, 262.0)
	draw_rect(av, CHIP)
	draw_rect(av, ACCENT, false, 2.0)
	var k := 60.0
	draw_line(av.position + Vector2(k, k), av.end - Vector2(k, k), ACCENT, 3.0)
	draw_line(av.position + Vector2(av.size.x - k, k), av.position + Vector2(k, av.size.y - k), ACCENT, 3.0)

	var info_x := av.end.x + 40.0
	var name := str(_profile().get("displayName", "Tenno")).to_upper()
	draw_string(font, Vector2(info_x, av.position.y + 30.0), name, HORIZONTAL_ALIGNMENT_LEFT, -1, 24, TEXT)
	draw_string(font, Vector2(info_x, av.position.y + 70.0), "Mastery Rank", HORIZONTAL_ALIGNMENT_LEFT, -1, 14, DIM)

	# Mastery Rank ring: arc filled by rank out of 30
	var rank := int(_profile().get("masteryRank", 0))
	var ring_c := Vector2(info_x + 60.0, av.position.y + 120.0)
	draw_arc(ring_c, 50.0, 0.0, TAU, 64, CHIP, 4.0)
	draw_arc(ring_c, 50.0, -PI / 2.0, -PI / 2.0 + (float(rank) / MAX_MASTERY) * TAU, 64, ACCENT, 4.0)
	var rank_text := str(rank)
	var rw := font.get_string_size(rank_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 40).x
	draw_string(font, Vector2(ring_c.x - rw / 2.0, ring_c.y + 14.0), rank_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 40, ACCENT)

	# Placeholder summary (the browser build's numbers, not real data yet)
	var stats := [["MISSIONS COMPLETED", "847"], ["ENEMIES ELIMINATED", "12,843"], ["PLAYTIME", "342h"], ["CREDITS EARNED", "4.2M"]]
	var stat_y := p.position.y + p.size.y - 120.0
	for i in range(stats.size()):
		var sx := p.position.x + 40.0 + i * 115.0
		draw_string(font, Vector2(sx, stat_y), stats[i][0], HORIZONTAL_ALIGNMENT_LEFT, 110, 10, DIM)
		draw_string(font, Vector2(sx, stat_y + 28.0), stats[i][1], HORIZONTAL_ALIGNMENT_LEFT, 110, 18, TEXT)


func _draw_stats(font: Font) -> void:
	var p := _panel_rect(700.0)
	draw_rect(p, PANEL)
	draw_rect(p, PANEL_STROKE, false, 1.0)
	draw_string(font, Vector2(p.position.x + 30.0, p.position.y + 40.0), "COMBAT STATISTICS", HORIZONTAL_ALIGNMENT_LEFT,
		-1, 18, UTILITY)

	# Placeholder numbers from the browser build
	var categories := [
		{"name": "OFFENSE", "color": ACCENT, "stats": [["Total Damage Dealt", "2.4B"], ["Headshots", "12,843"],
			["Critical Hits", "89,234"], ["Status Procs", "156,789"], ["Melee Kills", "34,567"]]},
		{"name": "DEFENSE", "color": DEFENSE, "stats": [["Damage Taken", "45.2M"], ["Times Downed", "234"],
			["Revives", "89"], ["Shield Gated", "1,234"], ["Health Restored", "8.9M"]]},
		{"name": "UTILITY", "color": UTILITY, "stats": [["Abilities Cast", "234,567"], ["Energy Used", "45.6M"],
			["Hacks Completed", "1,234"], ["Distance Traveled", "4,231km"], ["Resources Collected", "2.1M"]]},
	]
	for ci in range(categories.size()):
		var cat: Dictionary = categories[ci]
		var cx := p.position.x + 30.0 + ci * 220.0
		var cy := p.position.y + 90.0
		draw_rect(Rect2(cx, cy + 10.0, 200.0, 380.0), CHIP)
		draw_rect(Rect2(cx, cy + 10.0, 200.0, 380.0), Color(cat.color.r, cat.color.g, cat.color.b, 0.3), false, 1.0)
		draw_string(font, Vector2(cx + 100.0 - 40.0, cy), cat.name, HORIZONTAL_ALIGNMENT_LEFT, -1, 12, cat.color)
		for si in range(cat.stats.size()):
			var sy: float = cy + 30.0 + si * 70.0
			draw_string(font, Vector2(cx + 20.0, sy), cat.stats[si][0], HORIZONTAL_ALIGNMENT_LEFT, 180, 12, DIM)
			draw_string(font, Vector2(cx + 20.0, sy + 28.0), cat.stats[si][1], HORIZONTAL_ALIGNMENT_LEFT, 180, 18, TEXT)


func _draw_loadout(font: Font) -> void:
	var p := _panel_rect(800.0)
	draw_rect(p, PANEL)
	draw_rect(p, PANEL_STROKE, false, 1.0)
	draw_string(font, Vector2(p.position.x + 30.0, p.position.y + 40.0), "CURRENT LOADOUT", HORIZONTAL_ALIGNMENT_LEFT,
		-1, 18, UTILITY)

	# The equipped items from the session loadout. Rank is 0 until affinity and the progression curve are ported.
	var slots := [
		["WARFRAME", Loadout.equipped.get("warframe", "")],
		["PRIMARY", Loadout.equipped.get("primary", "")],
		["SECONDARY", Loadout.equipped.get("secondary", "")],
		["MELEE", Loadout.equipped.get("melee", "")],
	]
	for i in range(slots.size()):
		var sy: float = p.position.y + 90.0 + i * 95.0
		var row := Rect2(p.position.x + 30.0, sy, p.size.x - 60.0, 80.0)
		draw_rect(row, CHIP)
		draw_rect(row, PANEL_STROKE, false, 1.0)
		draw_string(font, Vector2(row.position.x + 70.0, sy + 25.0), slots[i][0], HORIZONTAL_ALIGNMENT_LEFT, -1, 11, DIM)
		draw_string(font, Vector2(row.position.x + 70.0, sy + 50.0), str(slots[i][1]), HORIZONTAL_ALIGNMENT_LEFT, -1, 16, TEXT)
		draw_string(font, Vector2(row.position.x + 70.0, sy + 70.0), "RANK 0", HORIZONTAL_ALIGNMENT_LEFT, -1, 12, ACCENT)


func _draw_appearance(font: Font) -> void:
	var p := _panel_rect(600.0)
	draw_rect(p, PANEL)
	draw_rect(p, PANEL_STROKE, false, 1.0)
	draw_string(font, Vector2(p.position.x + 30.0, p.position.y + 40.0), "APPEARANCE CUSTOMIZATION",
		HORIZONTAL_ALIGNMENT_LEFT, -1, 18, GOLD)

	# Placeholder options from the browser build; the first one in each group is the selected one
	var groups := [
		["WARFRAME COLORS", ["Primary", "Secondary", "Tertiary", "Accent", "Energy", "Emissive"]],
		["ATTACHMENTS", ["Helmet", "Chest", "Shoulders", "Legs", "Armour", "Syandana"]],
		["OPERATOR", ["Face", "Hair", "Accessories", "Clothing", "Armor", "Amp"]],
		["UI THEME", ["Classic", "Dark Sector", "TennoGen", "Prime", "Corpus", "Grineer", "Infested"]],
	]
	for gi in range(groups.size()):
		var gy: float = p.position.y + 90.0 + gi * 70.0
		draw_string(font, Vector2(p.position.x + 30.0, gy), groups[gi][0], HORIZONTAL_ALIGNMENT_LEFT, -1, 12, GOLD)
		var items: Array = groups[gi][1]
		for ii in range(items.size()):
			var chip := Rect2(p.position.x + 30.0 + ii * 90.0, gy + 25.0, 80.0, 30.0)
			var first := ii == 0
			draw_rect(chip, Color(ACCENT.r, ACCENT.g, ACCENT.b, 0.7) if first else CHIP)
			draw_rect(chip, GOLD, false, 1.0)
			var label: String = items[ii]
			var lw := font.get_string_size(label, HORIZONTAL_ALIGNMENT_LEFT, -1, 11).x
			draw_string(font, Vector2(chip.position.x + (chip.size.x - lw) / 2.0, chip.position.y + 20.0), label,
				HORIZONTAL_ALIGNMENT_LEFT, -1, 11, TEXT)
