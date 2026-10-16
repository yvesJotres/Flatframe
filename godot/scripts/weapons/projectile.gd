class_name Projectile
extends Node2D

# A straight-flying bullet. Hits the first enemy in the "enemies" group it touches.

const HIT_RADIUS := 3.0

var velocity := Vector2.ZERO
var damage := 10.0
var proc_chance := 0.0          # the weapon's procChance (per shot)
var damage_weights: Dictionary = {}   # damage by type, for picking a proc
var lifetime := 2.0


func _process(delta: float) -> void:
	position += velocity * delta
	lifetime -= delta
	if lifetime <= 0.0:
		queue_free()
		return
	for enemy in get_tree().get_nodes_in_group("enemies"):
		if enemy.dead:
			continue
		if position.distance_to(enemy.position) <= HIT_RADIUS + Enemy.RADIUS:
			enemy.take_damage(damage)
			if randf() < proc_chance:
				enemy.apply_proc(damage_weights, damage)
			queue_free()
			return
	var mission := get_parent()
	if mission.has_method("hit_container") and mission.hit_container(position, damage):
		queue_free()
		return
	queue_redraw()


func _draw() -> void:
	draw_line(Vector2.ZERO, -velocity.normalized() * 8.0, Color.YELLOW, 2.0)
