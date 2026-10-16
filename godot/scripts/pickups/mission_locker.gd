class_name MissionLocker
extends RefCounted

# A storage locker (port of Locker in src/pickups/lootable.js). Green opens once when used. Red is locked and
# black never opens. The loot tables are not ported yet, so an opened locker gives nothing for now.

const INTERACT_RANGE := 70.0   # px from the locker's edge

var rect: Rect2
var kind: String
var facing: String
var opened := false


func _init(entity: Dictionary) -> void:
	rect = Rect2(entity.x, entity.y, entity.w, entity.h)
	kind = str(entity.kind)
	facing = str(entity.get("facing", "n"))


func centre() -> Vector2:
	return rect.get_center()


func distance_to(p: Vector2) -> float:
	return Vector2(
		maxf(maxf(rect.position.x - p.x, 0.0), p.x - rect.end.x),
		maxf(maxf(rect.position.y - p.y, 0.0), p.y - rect.end.y)).length()


func in_range(p: Vector2) -> bool:
	return distance_to(p) <= INTERACT_RANGE


# What the prompt says, or "" for a locker that can't be used any more or ever (as prompt() in the browser)
func prompt() -> String:
	if kind == "black" or opened:
		return ""
	return "LOCKED" if kind == "red" else "[X] OPEN"


# Interact: a green locker opens once. Returns true when it opened.
func interact() -> bool:
	if kind == "green" and not opened:
		opened = true
		return true
	return false
