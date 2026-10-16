class_name CurrencyToast
extends Control

# Pop-ups that say what was just gained or spent ("+45 Credits"), over the top of the screen (port of
# src/ui/currency_toast.js). They come from Wallet.pending_changes, so loot, rewards and purchases show at once.

const SHOW_SECONDS := 1.8
const FADE_SECONDS := 0.45
const NAMES := {"credits": "Credits", "platinum": "Platinum", "endo": "Endo", "ferrite": "Ferrite", "rubedo": "Rubedo", "neurodes": "Neurodes", "detonite_ampule": "Detonite Ampule", "standing": "Standing"}

var toasts: Array = []   # {text, colour, time}


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE


func _process(delta: float) -> void:
	for change in Wallet.pending_changes:
		var delta_amount: int = change.delta
		var name := str(NAMES.get(change.currency, change.currency.capitalize()))
		var sign := "+" if delta_amount > 0 else "−"
		toasts.append({
			"text": "%s%d %s" % [sign, absi(delta_amount), name],
			"colour": Color("#7ddc7d") if delta_amount > 0 else Color("#ff6b6b"),
			"time": 0.0,
		})
	Wallet.pending_changes.clear()
	for t in toasts:
		t.time += delta
	toasts = toasts.filter(func(t): return t.time < SHOW_SECONDS + FADE_SECONDS)
	queue_redraw()


func _draw() -> void:
	var font := ThemeDB.fallback_font
	var y := 96.0
	for t in toasts:
		var alpha: float = 1.0 if t.time <= SHOW_SECONDS else 1.0 - (t.time - SHOW_SECONDS) / FADE_SECONDS
		var width := 180.0
		var box := Rect2(size.x * 0.5 - width * 0.5, y, width, 30.0)
		draw_rect(box, Color(0.04, 0.04, 0.08, 0.85 * alpha))
		draw_rect(box, Color(1.0, 107.0 / 255.0, 53.0 / 255.0, 0.5 * alpha), false, 1.0)
		draw_string(font, box.position + Vector2(12.0, 21.0), t.text, HORIZONTAL_ALIGNMENT_LEFT, -1, 16, Color(t.colour, alpha))
		y += 36.0
