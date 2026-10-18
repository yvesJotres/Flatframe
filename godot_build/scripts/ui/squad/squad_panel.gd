class_name SquadPanel
extends Control
## Port of the squad panel in java_build/src/ui/squad.js. Two sizes, one scene:
##   "big"   the main menu version: wide, centred, two member columns
##   "small" the in-game version: narrow, opened under the squad icon
## The panel never gets taller than 90% of the screen; it scrolls instead,
## like the browser's maxHeight: 90vh with overflow-y auto.
## Data comes from SquadData.

signal closed

# Sizes from squad.js, in pixels
const SIZES := {
	"big": {"width": 760, "title": 22, "name": 18, "label": 13, "tile": 76, "tile_font": 30, "button": 15, "pad": 26, "gap": 12, "columns": 2},
	"small": {"width": 360, "title": 15, "name": 14, "label": 11, "tile": 44, "tile_font": 18, "button": 12, "pad": 16, "gap": 8, "columns": 1},
}

# Colours from palette.js and theme.js (squad entries)
const MAX_HEIGHT_FRACTION := 0.9
const COLOR_SCRIM := Color(0, 0, 0, 0.6)
const COLOR_MODAL := Color(10 / 255.0, 10 / 255.0, 20 / 255.0, 0.97)
const COLOR_MODAL_EDGE := Color(1, 0.42, 0.208, 0.5)
const COLOR_CARD := Color(18 / 255.0, 18 / 255.0, 30 / 255.0, 0.9)
const COLOR_CARD_EDGE := Color(1, 1, 1, 0.08)
const COLOR_TILE := Color(0.19, 0.18, 0.25)
const COLOR_TILE_YOU := Color(0.23, 0.2, 0.28)
const COLOR_TILE_EDGE := Color(1, 1, 1, 0.2)
const COLOR_TILE_EDGE_YOU := Color(1, 0.843, 0.541, 0.6)
const COLOR_INPUT := Color(10 / 255.0, 10 / 255.0, 20 / 255.0)
const COLOR_INPUT_EDGE := Color(1, 1, 1, 0.15)
const COLOR_BUTTON := Color(1, 0.42, 0.208, 0.18)
const COLOR_BUTTON_EDGE := Color(1, 0.42, 0.208, 0.6)
const COLOR_TEXT := Color(0.941, 0.91, 0.878)
const COLOR_SELECTED := Color(1, 0.843, 0.541)
const COLOR_DIM := Color(0.604, 0.604, 0.69)
const COLOR_ACCENT := Color(1, 0.42, 0.208)
const COLOR_ERROR := Color(0.941, 0.627, 0.627)
const COLOR_OK := Color(0.604, 0.941, 0.69)

var size_mode := "small"

@onready var scrim: ColorRect = $Scrim
@onready var body: PanelContainer = $Body
@onready var scroll: ScrollContainer = $Body/Scroll
@onready var content: VBoxContainer = $Body/Scroll/Content
@onready var title_label: Label = $Body/Scroll/Content/Title
@onready var members_grid: GridContainer = $Body/Scroll/Content/Members
@onready var add_label: Label = $Body/Scroll/Content/AddLabel
@onready var name_input: LineEdit = $Body/Scroll/Content/Form/NameInput
@onready var add_button: Button = $Body/Scroll/Content/Form/AddButton
@onready var message: Label = $Body/Scroll/Content/Message
@onready var close_button: Button = $Body/Scroll/Content/CloseButton


func _ready() -> void:
	visible = false
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	name_input.max_length = SquadData.MAX_NAME
	name_input.placeholder_text = "Player name"
	add_button.pressed.connect(_on_add_pressed)
	name_input.text_submitted.connect(func(_text: String) -> void: _on_add_pressed())
	close_button.pressed.connect(close)
	scrim.gui_input.connect(_on_scrim_input)
	get_viewport().size_changed.connect(_fit_height)


# Opens the panel. anchor is the squad icon's box, in this control's pixels, for "small".
func open(mode: String = "small", anchor: Rect2 = Rect2(96, 46, 42, 42)) -> void:
	size_mode = mode
	visible = true
	scrim.color = COLOR_SCRIM
	_apply_style()
	_position(anchor)
	_set_message("")
	_render()


func close() -> void:
	visible = false
	closed.emit()


func _unhandled_input(event: InputEvent) -> void:
	if visible and event.is_action_pressed("ui_cancel"):
		close()


# A flat box in the browser's style: fill, outline, corner radius, and inner padding
func _box(fill: Color, edge: Color, edge_width: int, radius: int, pad_x: float, pad_y: float) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = fill
	style.set_border_width_all(edge_width)
	style.border_color = edge
	style.set_corner_radius_all(radius)
	style.content_margin_left = pad_x
	style.content_margin_right = pad_x
	style.content_margin_top = pad_y
	style.content_margin_bottom = pad_y
	return style


func _apply_style() -> void:
	var s: Dictionary = SIZES[size_mode]
	var gap: int = s["gap"]

	body.custom_minimum_size.x = minf(s["width"], size.x * 0.92)
	body.add_theme_stylebox_override("panel", _box(COLOR_MODAL, COLOR_MODAL_EDGE, 1, 6, s["pad"], s["pad"]))

	content.add_theme_constant_override("separation", gap)
	members_grid.columns = s["columns"]
	members_grid.add_theme_constant_override("h_separation", gap)
	members_grid.add_theme_constant_override("v_separation", gap)

	title_label.add_theme_font_size_override("font_size", s["title"])
	title_label.add_theme_color_override("font_color", COLOR_SELECTED)
	add_label.add_theme_font_size_override("font_size", s["label"])
	add_label.add_theme_color_override("font_color", COLOR_DIM)

	name_input.add_theme_font_size_override("font_size", s["button"] + 1)
	name_input.add_theme_color_override("font_color", COLOR_TEXT)
	name_input.add_theme_stylebox_override("normal", _box(COLOR_INPUT, COLOR_INPUT_EDGE, 1, 4, gap, gap / 2.0))
	name_input.add_theme_stylebox_override("focus", _box(COLOR_INPUT, COLOR_ACCENT, 1, 4, gap, gap / 2.0))

	for button in [add_button, close_button]:
		_style_button(button, s["button"], gap)
	message.add_theme_font_size_override("font_size", 13)


# Orange button used by ADD, CLOSE and REMOVE in the browser
func _style_button(button: Button, font_px: int, gap: int) -> void:
	var normal := _box(COLOR_BUTTON, COLOR_BUTTON_EDGE, 1, 4, gap, gap / 2.0)
	button.add_theme_stylebox_override("normal", normal)
	button.add_theme_stylebox_override("hover", normal)
	button.add_theme_stylebox_override("pressed", normal)
	button.add_theme_stylebox_override("focus", normal)
	button.add_theme_color_override("font_color", COLOR_SELECTED)
	button.add_theme_font_size_override("font_size", font_px)


# Centred for "big"; under the anchor, converted to this control's space, for "small"
func _position(anchor: Rect2) -> void:
	if size_mode == "big":
		# Anchor to the centre and grow both ways, so the panel is centred whatever its size
		body.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
		body.grow_horizontal = Control.GROW_DIRECTION_BOTH
		body.grow_vertical = Control.GROW_DIRECTION_BOTH
	else:
		body.set_anchors_and_offsets_preset(Control.PRESET_TOP_LEFT)
		body.grow_horizontal = Control.GROW_DIRECTION_END
		body.grow_vertical = Control.GROW_DIRECTION_END
		body.position = anchor.position + Vector2(0, anchor.size.y + 8)


func _render() -> void:
	var s: Dictionary = SIZES[size_mode]
	title_label.text = "SQUAD  %d/%d" % [SquadData.get_members().size(), SquadData.MAX_SQUAD]
	for child in members_grid.get_children():
		child.queue_free()
	for m in SquadData.get_members():
		members_grid.add_child(_member_card(m, s))
	call_deferred("_fit_height")


# Caps the panel at 90% of the screen height; longer content scrolls
func _fit_height() -> void:
	var pad: int = SIZES[size_mode]["pad"]
	var max_h := get_viewport_rect().size.y * MAX_HEIGHT_FRACTION - pad * 2
	scroll.custom_minimum_size.y = minf(content.get_combined_minimum_size().y, max_h)


# One squad member: a tile with the initial, the name, and REMOVE for invited members
func _member_card(m: Dictionary, s: Dictionary) -> PanelContainer:
	var gap: int = s["gap"]
	var card := PanelContainer.new()
	card.add_theme_stylebox_override("panel", _box(COLOR_CARD, COLOR_CARD_EDGE, 1, 4, gap, gap))
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", gap)
	card.add_child(row)

	var tile := PanelContainer.new()
	tile.custom_minimum_size = Vector2(s["tile"], s["tile"])
	var tile_fill := COLOR_TILE_YOU if m["you"] else COLOR_TILE
	var tile_edge := COLOR_TILE_EDGE_YOU if m["you"] else COLOR_TILE_EDGE
	tile.add_theme_stylebox_override("panel", _box(tile_fill, tile_edge, 1, 4, 0, 0))
	var initial := Label.new()
	initial.text = String(m["name"]).substr(0, 1).to_upper()
	initial.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	initial.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	initial.add_theme_font_size_override("font_size", s["tile_font"])
	initial.add_theme_color_override("font_color", COLOR_TEXT)
	tile.add_child(initial)
	row.add_child(tile)

	var text := VBoxContainer.new()
	text.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var name_label := Label.new()
	name_label.text = m["name"]
	name_label.add_theme_font_size_override("font_size", s["name"])
	name_label.add_theme_color_override("font_color", COLOR_TEXT)
	name_label.clip_text = true
	text.add_child(name_label)
	var status := Label.new()
	status.text = "YOU" if m["you"] else "INVITED"
	status.add_theme_font_size_override("font_size", s["label"])
	status.add_theme_color_override("font_color", COLOR_ACCENT if m["you"] else COLOR_DIM)
	text.add_child(status)
	row.add_child(text)

	if not m["you"]:
		var remove := Button.new()
		remove.text = "REMOVE"
		_style_button(remove, s["button"], gap)
		remove.pressed.connect(_on_remove_pressed.bind(m["id"], m["name"]))
		row.add_child(remove)
	return card


func _on_remove_pressed(member_id: String, member_name: String) -> void:
	if SquadData.remove_member(member_id):
		_set_message("%s left the squad" % member_name, false)
	_render()


func _on_add_pressed() -> void:
	# Solo means no squad, so members can't be added until the matchmaking mode changes
	if SquadData.get_mode()["id"] == "solo":
		_set_message("You are in SOLO mode. Change the matchmaking mode to add members.")
		return
	var result := SquadData.invite(name_input.text)
	if not result["ok"]:
		_set_message(result["error"])
		return
	name_input.clear()
	_set_message("%s was added" % result["member"]["name"], false)
	_render()


func _set_message(text: String, is_error: bool = true) -> void:
	message.text = text
	message.add_theme_color_override("font_color", COLOR_ERROR if is_error else COLOR_OK)


# A click on the dark backdrop closes the panel, like the browser's backdropClose
func _on_scrim_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		close()
