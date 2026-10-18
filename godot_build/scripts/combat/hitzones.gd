class_name HitZones
extends RefCounted
## Port of java_build/src/combat/hitzones.js. Hit zones for enemies: a head
## (a circle) and a body (a capsule). Hitting the head counts as a headshot.
## Offsets are in multiples of the enemy's radius, measured from its centre
## (y grows downward, so negative is up).

const HEAD := {"offsetY": -0.6, "radiusScale": 0.3}  # head circle above the centre
const BODY := {"top": -0.2, "bottom": 0.5, "radiusScale": 0.45}  # capsule: a slim, tall segment with round ends


static func _distance_to_segment(px: float, py: float, ax: float, ay: float, bx: float, by: float) -> float:
	var dx := bx - ax
	var dy := by - ay
	var length_sq := dx * dx + dy * dy
	var t := 0.0 if length_sq == 0.0 else clampf(((px - ax) * dx + (py - ay) * dy) / length_sq, 0.0, 1.0)
	return Vector2(px - (ax + dx * t), py - (ay + dy * t)).length()


# Which zone a point is in: "head", "body", or null when it misses both
static func hit_zone(enemy, px: float, py: float):
	var r = enemy.get("radius")
	if r == null:
		r = 16.0
	var head_r: float = HEAD["radiusScale"] * r
	if Vector2(px - enemy.x, py - (enemy.y + HEAD["offsetY"] * r)).length() <= head_r:
		return "head"
	var body_r: float = BODY["radiusScale"] * r
	if _distance_to_segment(px, py, enemy.x, enemy.y + BODY["top"] * r, enemy.x, enemy.y + BODY["bottom"] * r) <= body_r:
		return "body"
	return null
