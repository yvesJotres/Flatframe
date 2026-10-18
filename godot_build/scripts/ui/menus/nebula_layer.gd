extends Control
## Port of the NEBULA effect in java_build/src/engine/visual_effects.js: slow
## coloured clouds behind the menus, three soft glows drifting on different
## paths. The node's material blends additively (the browser's "lighter").

const CLOUDS := 3
const PHASE_STEP := 2.1
const X_DRIFT := 0.3
const Y_DRIFT := 0.4
const X_BASE := 0.2
const Y_BASE := 0.3
const RADIUS_FRACTION := 0.35
# THEME.menuTints: orange, blue, green
const COLORS := [
	Color(255 / 255.0, 107 / 255.0, 53 / 255.0, 0.04),
	Color(58 / 255.0, 143 / 255.0, 206 / 255.0, 0.03),
	Color(122 / 255.0, 184 / 255.0, 0.0, 0.03),
]

var offset := 0.0
var glow: GradientTexture2D


func _ready() -> void:
	# White in the middle, fading to transparent at the edge; each cloud tints it with its own colour
	var gradient := Gradient.new()
	gradient.colors = PackedColorArray([Color(1, 1, 1, 1), Color(1, 1, 1, 0)])
	glow = GradientTexture2D.new()
	glow.gradient = gradient
	glow.fill = GradientTexture2D.FILL_RADIAL
	glow.fill_from = Vector2(0.5, 0.5)
	glow.fill_to = Vector2(1.0, 0.5)
	glow.width = 256
	glow.height = 256


func _draw() -> void:
	var w := size.x
	var h := size.y
	for i in CLOUDS:
		var phase := offset + i * PHASE_STEP
		var x := w * (X_BASE + X_DRIFT * sin(phase * 0.3))
		var y := h * (Y_BASE + Y_DRIFT * cos(phase * 0.2))
		var r := maxf(w, h) * RADIUS_FRACTION
		draw_texture_rect(glow, Rect2(x - r, y - r, r * 2.0, r * 2.0), false, COLORS[i])
