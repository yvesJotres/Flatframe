class_name HitZones
extends RefCounted

# Head and body hit zones, port of src/combat/hitzones.js.
# Offsets are multiples of the enemy radius from its centre (y grows downward, negative is up).

const HEAD_OFFSET_Y := -0.6
const HEAD_RADIUS_SCALE := 0.3
const BODY_TOP := -0.2
const BODY_BOTTOM := 0.5
const BODY_RADIUS_SCALE := 0.45


static func _distance_to_segment(p: Vector2, a: Vector2, b: Vector2) -> float:
	var ab := b - a
	var length_sq := ab.length_squared()
	var t := 0.0 if length_sq == 0.0 else clampf((p - a).dot(ab) / length_sq, 0.0, 1.0)
	return p.distance_to(a + ab * t)


# Returns "head", "body", or "" when the point misses both
static func hit_zone(enemy_pos: Vector2, enemy_radius: float, point: Vector2) -> String:
	var head_r := HEAD_RADIUS_SCALE * enemy_radius
	if point.distance_to(enemy_pos + Vector2(0.0, HEAD_OFFSET_Y * enemy_radius)) <= head_r:
		return "head"
	var body_r := BODY_RADIUS_SCALE * enemy_radius
	var top := enemy_pos + Vector2(0.0, BODY_TOP * enemy_radius)
	var bottom := enemy_pos + Vector2(0.0, BODY_BOTTOM * enemy_radius)
	if _distance_to_segment(point, top, bottom) <= body_r:
		return "body"
	return ""
