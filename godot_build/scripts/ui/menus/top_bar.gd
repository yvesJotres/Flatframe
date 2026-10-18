class_name TopBar
extends Control
## Port of java_build/src/ui/menus/top_bar.js: the squad icons (top left) and
## the currency bar (top right), shared by the menus.
##
## Squad icons: 54x54 boxes, 6px apart. Hovering the profile icon opens a 200px
## username box to its right, and the mode and invite icons slide right by its
## width. The matchmaking list drops under the mode icon while the pointer is on
## the icon or the list, or from the keyboard (Enter on the icon).

signal squad_requested

const ICON := 54.0
const GAP := 6.0
const NAME_W := 200.0
const SIDE_MARGIN := 96.0
const TOP_MARGIN := 46.0
const LIST_W := 255.0
const ROW_H := 42.0
const SYMBOL_FONT := preload("res://theme/symbol_font.tres")

const CURRENCY_ICONS := {
	"credits": "res://assets/icons/credits.webp",
	"platinum": "res://assets/icons/platinum.webp",
	"endo": "res://assets/icons/endo.webp",
}

# Colours from palette.js / theme.js
const PANEL_FILL := Color(0.094, 0.118, 0.173, 0.92)
const PANEL_EDGE := Color(1, 1, 1, 0.08)
const GOLD := Color(1, 0.843, 0.541)
const TITLE := Color(0.941, 0.91, 0.878)
const DROP_FILL := Color(10 / 255.0, 10 / 255.0, 20 / 255.0, 0.94)
const DROP_EDGE := Color(1, 1, 1, 0.12)
const ROW_GLOW := Color(1, 0.42, 0.208, 0.14)

var reveal := 0.0  # 0..1, closed..open, for the username box
var profile_hover := false
var keyboard_list := false  # the matchmaking list was opened from the keyboard

@onready var avatar: AvatarButton = $Avatar
@onready var name_box: Panel = $NameBox
@onready var name_label: Label = $NameBox/NameLabel
@onready var mode_button: Button = $ModeButton
@onready var invite_button: Button = $InviteButton
@onready var mode_list: PanelContainer = $ModeList
@onready var rows: VBoxContainer = $ModeList/Rows
@onready var flask: Control = $Currency/Flask
@onready var currency_box: PanelContainer = $Currency/CurrencyBox
@onready var items: HBoxContainer = $Currency/CurrencyBox/Items


func _ready() -> void:
	name_box.add_theme_stylebox_override("panel", _box(PANEL_FILL, PANEL_EDGE, 1, 14, 0))
	name_box.clip_contents = true
	name_label.text = SquadData.player_name
	name_label.add_theme_font_size_override("font_size", 18)
	name_label.add_theme_color_override("font_color", TITLE)

	_style_icon_button(mode_button, 20, GOLD)
	_style_icon_button(invite_button, 22, TITLE)
	mode_button.text = _glyph_text(SquadData.get_mode()["glyph"])

	mode_list.add_theme_stylebox_override("panel", _box(DROP_FILL, DROP_EDGE, 1, 0, 0))
	mode_list.visible = false
	rows.add_theme_constant_override("separation", 0)

	currency_box.add_theme_stylebox_override("panel", _box(PANEL_FILL, PANEL_EDGE, 1, 14, 0))
	currency_box.custom_minimum_size.y = 42.0
	items.add_theme_constant_override("separation", 16)
	refresh_currency()

	for button in [avatar, mode_button, invite_button]:
		button.mouse_entered.connect(button.grab_focus)
		button.focus_entered.connect(FocusSound.track.bind("top:" + button.name))
	avatar.pressed.connect(_on_squad_pressed)
	invite_button.pressed.connect(_on_squad_pressed)
	mode_button.pressed.connect(_open_keyboard_list)
	_layout()


func _process(delta: float) -> void:
	var mouse := get_global_mouse_position()
	# The username box opens while the pointer is on the profile icon; once open, it stays while on the box too
	profile_hover = avatar.get_global_rect().has_point(mouse) \
		or (profile_hover and name_box.get_global_rect().has_point(mouse))

	# Ease toward the target, about 14 steps a second (the Arsenal's card animation)
	var target := 1.0 if profile_hover else 0.0
	reveal += (target - reveal) * minf(1.0, delta * 14.0)
	if absf(target - reveal) < 0.002:
		reveal = target
	_layout()

	# The matchmaking list shows while the pointer is on the icon or the list itself
	if not keyboard_list:
		var over := mode_button.get_global_rect().has_point(mouse) \
			or (mode_list.visible and mode_list.get_global_rect().has_point(mouse))
		if over and not mode_list.visible:
			_show_list()
		elif not over and mode_list.visible:
			mode_list.visible = false


func _unhandled_input(event: InputEvent) -> void:
	# While the list is open from the keyboard it takes Escape first (the menu underneath does not get it)
	if keyboard_list and event.is_action_pressed("ui_cancel"):
		_close_keyboard_list()
		get_viewport().set_input_as_handled()


# ---- layout ------------------------------------------------------------

func _layout() -> void:
	avatar.position = Vector2(SIDE_MARGIN, TOP_MARGIN)
	avatar.size = Vector2(ICON, ICON)
	# The name box sits flush against the profile icon; the gap is kept after it
	name_box.position = Vector2(SIDE_MARGIN + ICON, TOP_MARGIN)
	name_box.size = Vector2(NAME_W * reveal, ICON)
	name_box.modulate.a = reveal
	name_label.position = Vector2(14.0, 0.0)
	name_label.size = Vector2(NAME_W - 28.0, ICON)
	mode_button.position = Vector2(SIDE_MARGIN + ICON + GAP + NAME_W * reveal, TOP_MARGIN)
	mode_button.size = Vector2(ICON, ICON)
	invite_button.position = Vector2(mode_button.position.x + ICON + GAP, TOP_MARGIN)
	invite_button.size = Vector2(ICON, ICON)
	mode_list.position = Vector2(mode_button.position.x, TOP_MARGIN + ICON)


# A flat box: fill, outline, 2px corners and inner horizontal padding
func _box(fill: Color, edge: Color, edge_width: int, pad_x: float, pad_y: float) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = fill
	style.border_color = edge
	style.set_border_width_all(edge_width)
	style.set_corner_radius_all(2)
	style.content_margin_left = pad_x
	style.content_margin_right = pad_x
	style.content_margin_top = pad_y
	style.content_margin_bottom = pad_y
	return style


# The mode and invite boxes: a panel look, outlined gold while hovered or focused
func _style_icon_button(button: Button, font_px: int, color: Color) -> void:
	button.add_theme_stylebox_override("normal", _box(PANEL_FILL, PANEL_EDGE, 1, 0, 0))
	for style_name in ["hover", "pressed", "focus"]:
		button.add_theme_stylebox_override(style_name, _box(PANEL_FILL, GOLD, 2, 0, 0))
	button.add_theme_font_size_override("font_size", font_px)
	for color_name in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color"]:
		button.add_theme_color_override(color_name, color)


# ---- currency bar ------------------------------------------------------

# Rebuilds the credit, platinum and endo amounts from the wallet
func refresh_currency() -> void:
	for child in items.get_children():
		child.queue_free()
	for currency in Currencies.DISPLAY_CURRENCIES:
		var item := HBoxContainer.new()
		item.add_theme_constant_override("separation", 6)
		var icon := TextureRect.new()
		icon.texture = load(CURRENCY_ICONS[currency])
		icon.custom_minimum_size = Vector2(24, 24)
		icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		item.add_child(icon)
		var amount := Label.new()
		amount.text = Wallet.format(currency)
		amount.add_theme_font_size_override("font_size", 18)
		amount.add_theme_color_override("font_color", TITLE)
		amount.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		item.add_child(amount)
		items.add_child(item)


# ---- squad icons -------------------------------------------------------

func _on_squad_pressed() -> void:
	AudioManager.play("ui_select")
	squad_requested.emit()


# ---- matchmaking list --------------------------------------------------

func _show_list() -> void:
	_build_rows()
	mode_list.visible = true


func _build_rows() -> void:
	for child in rows.get_children():
		rows.remove_child(child)
		child.queue_free()
	var active_id: String = SquadData.get_mode()["id"]
	var buttons: Array[Button] = []
	for mode in SquadData.MATCHMAKING_MODES:
		var on: bool = mode["id"] == active_id
		var row := Button.new()
		row.custom_minimum_size = Vector2(LIST_W, ROW_H)
		row.add_theme_stylebox_override("normal", _box(Color(0, 0, 0, 0), Color(0, 0, 0, 0), 0, 12, 0))
		for style_name in ["hover", "pressed", "focus"]:
			row.add_theme_stylebox_override(style_name, _box(ROW_GLOW, Color(0, 0, 0, 0), 0, 12, 0))

		# The glyph (symbol font) and the label sit side by side; they follow the row's focus colour
		var content := HBoxContainer.new()
		content.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		content.offset_left = 12.0
		content.mouse_filter = Control.MOUSE_FILTER_IGNORE
		content.add_theme_constant_override("separation", 12)
		var glyph := Label.new()
		glyph.text = _glyph_text(mode["glyph"])
		glyph.custom_minimum_size.x = 22.0
		glyph.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		glyph.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		glyph.add_theme_font_override("font", SYMBOL_FONT)
		glyph.add_theme_font_size_override("font_size", 18)
		var label := Label.new()
		label.text = mode["label"]
		label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		label.add_theme_font_size_override("font_size", 14)
		for part in [glyph, label]:
			part.mouse_filter = Control.MOUSE_FILTER_IGNORE
			part.add_theme_color_override("font_color", GOLD if on else TITLE)
			content.add_child(part)
		row.add_child(content)
		row.focus_entered.connect(_tint_row.bind(content, GOLD))
		row.focus_exited.connect(_tint_row.bind(content, GOLD if on else TITLE))
		row.pressed.connect(_on_mode_picked.bind(mode["id"]))
		row.mouse_entered.connect(row.grab_focus)
		row.focus_entered.connect(FocusSound.track.bind("mode:" + mode["id"]))
		rows.add_child(row)
		buttons.append(row)
	# The D-pad / arrow keys wrap around the list
	buttons[0].focus_neighbor_top = buttons[0].get_path_to(buttons[buttons.size() - 1])
	buttons[buttons.size() - 1].focus_neighbor_bottom = buttons[buttons.size() - 1].get_path_to(buttons[0])


# U+FE0E asks for the text (monochrome) look instead of the colour emoji, as the browser draws these symbols
func _glyph_text(glyph: String) -> String:
	return glyph + "︎"


func _tint_row(content: HBoxContainer, color: Color) -> void:
	for part in content.get_children():
		part.add_theme_color_override("font_color", color)


func _on_mode_picked(mode_id: String) -> void:
	SquadData.set_mode(mode_id)
	mode_button.text = _glyph_text(SquadData.get_mode()["glyph"])
	AudioManager.play("ui_select")
	if keyboard_list:
		_close_keyboard_list()
	else:
		_build_rows.call_deferred()


# Enter on the matchmaking icon: the list takes the arrow keys, Enter picks, Escape closes
func _open_keyboard_list() -> void:
	keyboard_list = true
	_show_list()
	var active_id: String = SquadData.get_mode()["id"]
	for i in SquadData.MATCHMAKING_MODES.size():
		if SquadData.MATCHMAKING_MODES[i]["id"] == active_id:
			rows.get_child(i).grab_focus()
			return


func _close_keyboard_list() -> void:
	keyboard_list = false
	mode_list.visible = false
	mode_button.grab_focus()
