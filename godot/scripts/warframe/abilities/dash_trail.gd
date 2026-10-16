class_name DashTrail
extends RefCounted

# The ribbon Excalibur leaves while the Slash Dash runs with the Exalted Blade summoned.
# Port of DashTrail in excalibur_abilities.js (the state only; the ribbon's drawing is not ported).

const SECONDS := 0.45   # how long each point stays visible
const SPACING := 6.0    # units: a new point is recorded at least this far from the last one

var points: Array = []  # { position: Vector2, age: float }, oldest first


# Records the position while the dash runs
func record(pos: Vector2) -> void:
	if not points.is_empty() and points[-1].position.distance_to(pos) < SPACING:
		return
	points.append({"position": pos, "age": 0.0})


func update(delta: float) -> void:
	for p in points:
		p.age += delta
	points = points.filter(func(p): return p.age < SECONDS)
