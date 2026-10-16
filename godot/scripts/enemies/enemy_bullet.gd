class_name EnemyBullet
extends Node2D

# A round fired by an enemy (the Grakata's damage from the browser's weapon data). It flies straight and hits the
# player on contact; a wall stops it.

const SPEED := 700.0   # src/engine/constants.js DEFAULT_PROJECTILE_SPEED (an autoload name cannot be used in a constant)
const LIFETIME := 3.0
const HIT_RADIUS := 6.0

var velocity := Vector2.ZERO
var damage := 11.0
var target: Player = null
var blocked: Callable
var age := 0.0


func _process(delta: float) -> void:
	age += delta
	if age > LIFETIME:
		queue_free()
		return
	position += velocity * delta
	if blocked.is_valid() and blocked.call(position, 1.0):
		queue_free()
		return
	if target != null and position.distance_to(target.global_position) <= HIT_RADIUS + Player.RADIUS:
		target.take_damage(damage)
		queue_free()
		return
	queue_redraw()


func _draw() -> void:
	draw_line(Vector2.ZERO, -velocity.normalized() * 8.0, Color("#e0453f"), 2.0)
