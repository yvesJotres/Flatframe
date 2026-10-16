class_name StarChart
extends Control

# Earth star chart, port of the node layout and mission panel in src/ui/menus/star_chart.js.
# Only Exterminate nodes launch: that is the one mode the Godot slice runs.

signal back_requested
signal launch_requested(mission_name: String)

const BG_COLOR := Color("#0a0a0c")
const PANEL_BG := Color(11.0 / 255.0, 14.0 / 255.0, 22.0 / 255.0, 0.6)  # COLORS.PANEL_BG
const STROKE := Color(1.0, 1.0, 1.0, 0.12)                             # COLORS.STROKE
const ROUTE_COLOR := Color("#3a3f4d")
const ACCENT := Color("#ff6b35")
const TEXT := Color("#ffffff")
const TEXT_DIM := Color("#9aa0b4")
const TEXT_DISABLED := Color("#808080")
const GRINEER := Color("#e85d2a")                                      # Earth's faction in star_chart.js
const WIN := Color("#4ade80")

const MARGIN := 96.0
const PANEL_W := 340.0
const PLANET_MAX_RADIUS := 260.0
const NODE_HIT_RADIUS := 12.0
const COUNTDOWN_SECONDS := 5.0
const LAUNCHABLE_TYPES := ["Exterminate"]

# name, type, level, pos (fraction of the planet radius from its centre, y grows downward)
var nodes: Array = [
	{"name": "E Prime", "type": "Exterminate", "level": "1-3", "pos": Vector2(-0.88, -0.08)},
	{"name": "Mariana", "type": "Exterminate", "level": "1-3", "pos": Vector2(-0.69, -0.45)},
	{"name": "Gaia", "type": "Interception", "level": "1-6", "pos": Vector2(-0.24, 0.21)},
	{"name": "Lith", "type": "Defense", "level": "1-6", "pos": Vector2(-0.39, -0.77)},
	{"name": "Erpo", "type": "Mobile Defense", "level": "1-6", "pos": Vector2(1.02, 0.55)},
	{"name": "Everest", "type": "Excavation", "level": "1-6", "pos": Vector2(0.45, -0.31)},
	{"name": "Mantle", "type": "Capture", "level": "2-4", "pos": Vector2(-0.45, -0.20)},
	{"name": "Cambria", "type": "Spy", "level": "2-4", "pos": Vector2(-0.55, 0.62)},
	{"name": "Eurasia", "type": "Mobile Defense", "level": "3-5", "pos": Vector2(0.13, -0.85)},
	{"name": "Pacific", "type": "Rescue", "level": "3-6", "pos": Vector2(0.68, 1.00)},
	{"name": "Cervantes", "type": "Sabotage", "level": "4-6", "pos": Vector2(0.90, -0.07)},
	{"name": "Saya's Visions", "type": "Shrine Defense", "level": "5-15", "pos": Vector2(0.06, -0.02)},
	{"name": "Coba", "type": "Dark Sector Defense", "level": "6-16", "pos": Vector2(0.78, -0.43)},
	{"name": "Tikal", "type": "Dark Sector Excavation", "level": "6-16", "pos": Vector2(0.14, 0.24)},
	{"name": "Plains of Eidolon", "type": "Open World", "level": "10-30", "pos": Vector2(0.04, -0.55)},
	{"name": "Oro", "type": "Assassination", "level": "20-25", "pos": Vector2(0.47, 0.52)},
	{"name": "Cetus", "type": "Hub", "level": "0-0", "pos": Vector2(-0.22, -0.34)},
]

# Routes between nodes, in the order the route runs (from EARTH_ROUTES in star_chart.js)
var routes: Array = [
	["E Prime", "Mariana", "Lith", "Eurasia"],
	["Mariana", "Mantle", "Cetus", "Saya's Visions"],
	["Cetus", "Plains of Eidolon", "Everest", "Cervantes", "Erpo", "Oro"],
	["Coba", "Everest"],
	["Mantle", "Gaia", "Pacific"],
	["Cambria", "Gaia"],
	["Tikal", "Oro"],
]

var selected := -1
var hovered := -1
var countdown := -1.0   # seconds left before launch; negative when not counting down
var pending_name := ""  # the node (or "Survival") the running countdown will launch
var _layers: Array = []   # the globe layers (background, surface, clouds)


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP
	# The globe's layers sit behind this node's own drawing: background, surface (shader), clouds
	for kind in [GlobeLayer.Kind.BACKGROUND, GlobeLayer.Kind.SURFACE, GlobeLayer.Kind.CLOUDS]:
		var layer := GlobeLayer.new()
		layer.kind = kind
		add_child(layer)
		_layers.append(layer)


func _process(delta: float) -> void:
	for layer in _layers:
		layer.center = _planet_center()
		layer.radius = _planet_radius()
		layer.time = Time.get_ticks_msec() / 1000.0
		layer.background_size = size
		layer.queue_redraw()
	if countdown >= 0.0:
		countdown -= delta
		if countdown < 0.0:
			countdown = -1.0
			launch_requested.emit(pending_name)
	queue_redraw()


func _unhandled_input(event: InputEvent) -> void:
	if not is_visible_in_tree():
		return
	var key := event as InputEventKey
	if key and key.pressed and not key.echo and key.keycode == KEY_ESCAPE:
		if countdown >= 0.0:
			countdown = -1.0
		else:
			back_requested.emit()
		get_viewport().set_input_as_handled()


# Layout from planetLayout() in star_chart.js: centre at 50% / 52%, radius min(30% of height, 18% of width)
func _planet_center() -> Vector2:
	return Vector2(size.x * 0.5, size.y * 0.52)


func _planet_radius() -> float:
	return minf(size.y * 0.30, size.x * 0.18)


# Scale factor k = r / 324 (k is 1 at 1080p)
func _scale_k() -> float:
	return _planet_radius() / 324.0


func _node_pos(index: int) -> Vector2:
	return _planet_center() + nodes[index].pos * _planet_radius()


func _index_of(node_name: String) -> int:
	for i in range(nodes.size()):
		if nodes[i].name == node_name:
			return i
	return -1


func _node_at(point: Vector2) -> int:
	for i in range(nodes.size()):
		if nodes[i].type == "Hub":
			continue
		if point.distance_to(_node_pos(i)) <= NODE_HIT_RADIUS:
			return i
	return -1


# Atmosphere glow: from the planet's edge out to 80 scaled pixels, blue for Earth
func _draw_halo(c: Vector2, r: float) -> void:
	var reach := 80.0 * _scale_k()
	var inner := Palette.parse("rgba(110,175,255,0.30)")
	var outer := Palette.parse("rgba(110,175,255,0.10)")
	var stops := [[0.0, inner], [0.5, outer], [1.0, Color(outer.r, outer.g, outer.b, 0.0)]]
	var steps := int(ceil(reach))
	for i in range(steps):
		var d := r + i + 0.5
		var colour := EarthMap._radial(d - r, 0.0, reach, stops)
		draw_arc(c, d, 0.0, TAU, 128, colour, 1.5)


# Progress ring: the share of Earth's missions completed by the active profile (gold, from -90 degrees)
func _draw_progress_ring(c: Vector2, r: float) -> void:
	var nodes_list := nodes.filter(func(n: Dictionary) -> bool: return n.type != "Hub")
	var completed: Array = UserStore.get_profile(UserStore.active_id()).get("completedNodes", [])
	var done := 0
	for n in nodes_list:
		if completed.has("Earth:" + str(n.name)):
			done += 1
	if done == 0 or nodes_list.is_empty():
		return
	var progress := float(done) / float(nodes_list.size())
	var k := _scale_k()
	draw_arc(c, r + 14.0 * k, -PI / 2.0, -PI / 2.0 + TAU * progress, 96, Color("#ffd700"), 2.0)


# "EARTH" above the planet, letter-spaced (14 k px), bold 34 k px
func _draw_earth_label(c: Vector2, r: float) -> void:
	var k := _scale_k()
	var font := ThemeDB.fallback_font
	var text := "EARTH"
	var font_size := int(round(34.0 * k))
	var spacing := 14.0 * k
	var total := 0.0
	for i in range(text.length()):
		total += font.get_string_size(text[i], HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x
	total += spacing * (text.length() - 1)
	var x := c.x - total / 2.0
	var y := c.y - r - 46.0 * k + font_size * 0.35
	for i in range(text.length()):
		draw_string(font, Vector2(x, y), text[i], HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, TEXT)
		x += font.get_string_size(text[i], HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x + spacing


func _panel_rect() -> Rect2:
	var h := minf(400.0, size.y - 68.0)
	return Rect2(size.x - PANEL_W - MARGIN, 60.0, PANEL_W, h)


func _button_rect() -> Rect2:
	var p := _panel_rect()
	return Rect2(p.position.x + 16.0, p.position.y + p.size.y - 56.0, PANEL_W - 32.0, 40.0)


func _back_rect() -> Rect2:
	return Rect2(MARGIN, size.y - 64.0, 120.0, 36.0)


# Survival has no node on the Earth chart (the browser build has none either), so the slice offers it here
func _survival_rect() -> Rect2:
	return Rect2(size.x - MARGIN - 220.0, size.y - 64.0, 220.0, 36.0)


func _selected_is_launchable() -> bool:
	return selected >= 0 and nodes[selected].type in LAUNCHABLE_TYPES


func _gui_input(event: InputEvent) -> void:
	var motion := event as InputEventMouseMotion
	var click := event as InputEventMouseButton
	if motion:
		hovered = _node_at(motion.position)
	elif click and click.pressed and click.button_index == MOUSE_BUTTON_LEFT:
		var at := click.position
		if _survival_rect().has_point(at):
			if countdown >= 0.0:
				countdown = -1.0
			else:
				pending_name = "Survival"
				countdown = COUNTDOWN_SECONDS
		elif _back_rect().has_point(at) and countdown < 0.0:
			back_requested.emit()
		elif selected >= 0 and _button_rect().has_point(at):
			if countdown >= 0.0:
				countdown = -1.0
			elif _selected_is_launchable():
				pending_name = nodes[selected].name
				countdown = COUNTDOWN_SECONDS
		elif countdown < 0.0:
			var hit := _node_at(at)
			if hit >= 0:
				selected = hit


func _draw() -> void:
	var font := ThemeDB.fallback_font

	# Planet
	var c := _planet_center()
	var r := _planet_radius()
	_draw_halo(c, r)
	_draw_progress_ring(c, r)
	_draw_earth_label(c, r)

	# Routes
	for route in routes:
		for i in range(route.size() - 1):
			var a := _index_of(route[i])
			var b := _index_of(route[i + 1])
			if a >= 0 and b >= 0:
				draw_line(_node_pos(a), _node_pos(b), ROUTE_COLOR, 1.5)

	# Nodes
	for i in range(nodes.size()):
		var n: Dictionary = nodes[i]
		var p := _node_pos(i)
		if n.type == "Hub":
			draw_circle(p, 4.0, STROKE)
			continue
		var col := TEXT_DIM
		if i == selected:
			col = ACCENT
		elif i == hovered:
			col = TEXT
		draw_circle(p, 7.0, col)
		draw_string(font, p + Vector2(-40, 22), n.name, HORIZONTAL_ALIGNMENT_LEFT, 80, 11, col)

	# Title
	draw_string(font, Vector2(MARGIN, 52), "EARTH", HORIZONTAL_ALIGNMENT_LEFT, -1, 22, TEXT)

	# Mission panel
	var panel := _panel_rect()
	draw_rect(panel, PANEL_BG)
	draw_rect(panel, STROKE, false, 1.0)
	var px := panel.position.x + 16.0
	var py := panel.position.y + 28.0
	if selected < 0:
		draw_string(font, Vector2(px, py), "Select a mission", HORIZONTAL_ALIGNMENT_LEFT, -1, 16, TEXT_DIM)
	else:
		var n: Dictionary = nodes[selected]
		draw_string(font, Vector2(px, py), n.name.to_upper(), HORIZONTAL_ALIGNMENT_LEFT, -1, 20, ACCENT)
		draw_string(font, Vector2(px, py + 26), n.type, HORIZONTAL_ALIGNMENT_LEFT, -1, 14, TEXT)
		draw_string(font, Vector2(px, py + 48), "Level " + n.level, HORIZONTAL_ALIGNMENT_LEFT, -1, 14, TEXT_DIM)

		var btn := _button_rect()
		var label := "LAUNCH"
		var label_col := ACCENT
		if countdown >= 0.0:
			label = "LAUNCHING IN %d  (click to cancel)" % ceili(countdown)
			label_col = WIN
		elif not _selected_is_launchable():
			label = "NOT PORTED YET"
			label_col = TEXT_DISABLED
		draw_rect(btn, Color(0, 0, 0, 0.5))
		draw_rect(btn, label_col, false, 1.5)
		var lw := font.get_string_size(label, HORIZONTAL_ALIGNMENT_LEFT, -1, 14).x
		draw_string(font, Vector2(btn.position.x + (btn.size.x - lw) / 2.0, btn.position.y + 25.0), label,
			HORIZONTAL_ALIGNMENT_LEFT, -1, 14, label_col)

	# Back
	var back := _back_rect()
	draw_rect(back, Color(0, 0, 0, 0.5))
	draw_rect(back, STROKE, false, 1.0)
	draw_string(font, back.position + Vector2(44, 23), "BACK", HORIZONTAL_ALIGNMENT_LEFT, -1, 14, TEXT_DIM)

	# Survival launch (slice only)
	var sv := _survival_rect()
	draw_rect(sv, Color(0, 0, 0, 0.5))
	draw_rect(sv, ACCENT, false, 1.0)
	var sv_label := "SURVIVAL (SLICE)"
	if countdown >= 0.0 and pending_name == "Survival":
		sv_label = "LAUNCHING IN %d  (click to cancel)" % ceili(countdown)
	var sv_w := font.get_string_size(sv_label, HORIZONTAL_ALIGNMENT_LEFT, -1, 13).x
	draw_string(font, Vector2(sv.position.x + (sv.size.x - sv_w) / 2.0, sv.position.y + 23.0), sv_label,
		HORIZONTAL_ALIGNMENT_LEFT, -1, 13, ACCENT)
