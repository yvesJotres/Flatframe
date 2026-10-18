extends Control
## Port of the STARFIELD effect in java_build/src/engine/visual_effects.js:
## small squares that twinkle. Positions wrap around the screen and drift with
## the offset.

const COUNT := 120
const DRIFT_SPEED := 10.0  # how fast the field drifts sideways with the menu offset
const X_SPACING := 937.0  # spread of star x positions (prime, so the stars do not line up)
const Y_SPACING := 1297.0
const SIZES := [0.5, 1.0, 1.5]  # cycles through the three sizes
const TWINKLE_SPEED := 2.0
const ALPHA_BASE := 0.3
const ALPHA_RANGE := 0.35

var time := 0.0
var offset := 0.0


func _draw() -> void:
	var w := size.x
	var h := size.y
	if w <= 0.0 or h <= 0.0:
		return
	for i in COUNT:
		var sx := fposmod(i * X_SPACING + offset * DRIFT_SPEED, w)
		var sy := fposmod(i * Y_SPACING, h)
		var star_size: float = SIZES[i % SIZES.size()]
		var alpha := maxf(0.0, ALPHA_BASE + ALPHA_RANGE * sin(time * TWINKLE_SPEED + i))
		draw_rect(Rect2(sx, sy, star_size, star_size), Color(1, 1, 1, alpha))
