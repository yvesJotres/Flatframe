class_name MissionGate
extends RefCounted

# A gate across a doorway (port of Gate in src/pickups/lootable.js). It opens by itself while the Warframe is near
# and closes a couple of seconds after the Warframe leaves. Closed, it is solid.

const OPEN_RANGE := 96.0   # units (about 6 m)
const HOLD_SECONDS := 2.0  # placeholder in the browser too

var rect: Rect2
var orientation: String
var open := false
var hold := 0.0


func _init(entity: Dictionary) -> void:
	rect = Rect2(entity.x, entity.y, entity.w, entity.h)
	orientation = str(entity.get("orientation", "h"))


func distance_to(p: Vector2) -> float:
	return Vector2(
		maxf(maxf(rect.position.x - p.x, 0.0), p.x - rect.end.x),
		maxf(maxf(rect.position.y - p.y, 0.0), p.y - rect.end.y)).length()


# Called every frame with the player's position. Returns whether the gate is open now.
func update(delta: float, player_pos: Vector2) -> bool:
	if distance_to(player_pos) <= OPEN_RANGE:
		hold = HOLD_SECONDS
	else:
		hold = maxf(0.0, hold - delta)
	open = hold > 0.0
	return open
