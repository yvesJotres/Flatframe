class_name Grenade
extends Node2D

# A thrown grenade (port of src/weapons/grenade.js). It flies to the aim point, then detonates after the fuse.
# The blast hits every enemy in range, with damage falling off to a quarter at the edge.

const FLIGHT_SPEED := 360.0
const MIN_DAMAGE_FRACTION := 0.25
const BLAST_RADIUS := 60.0   # 4 m at 15 units per metre
const FUSE := 1.4
const DAMAGE := 400.0
const EXPLOSION_SECONDS := 0.25

var target_pos := Vector2.ZERO
var damage := DAMAGE
var from_enemy := false   # enemy grenades hurt the Warframe instead of enemies
var age := 0.0
var exploded := false
var explosion_timer := 0.0


func _process(delta: float) -> void:
	if exploded:
		explosion_timer -= delta
		if explosion_timer <= 0.0:
			queue_free()
		queue_redraw()
		return
	age += delta
	var to_target := target_pos - position
	var step := FLIGHT_SPEED * delta
	if to_target.length() > step:
		position += to_target.normalized() * step
	else:
		position = target_pos
	if age >= FUSE:
		_explode()
	queue_redraw()


func _explode() -> void:
	exploded = true
	explosion_timer = EXPLOSION_SECONDS
	if from_enemy:
		var player: Player = get_parent().get("player")
		if player != null:
			var dist := player.global_position.distance_to(position)
			var reach := BLAST_RADIUS + Player.RADIUS
			if dist <= reach:
				player.take_damage(damage * (1.0 - (1.0 - MIN_DAMAGE_FRACTION) * (dist / reach)))
		return
	for enemy in get_tree().get_nodes_in_group("enemies"):
		if enemy.dead:
			continue
		var dist: float = enemy.position.distance_to(position)
		var reach := BLAST_RADIUS + Enemy.RADIUS
		if dist > reach:
			continue
		var falloff := 1.0 - (1.0 - MIN_DAMAGE_FRACTION) * (dist / reach)
		enemy.take_damage(damage * falloff)


func _draw() -> void:
	if exploded:
		var alpha := maxf(0.0, explosion_timer / EXPLOSION_SECONDS)
		draw_circle(Vector2.ZERO, BLAST_RADIUS, Color(1.0, 170.0 / 255.0, 60.0 / 255.0, 0.5 * alpha))
	else:
		var pulse := 0.5 + 0.5 * sin(age * 18.0)
		draw_arc(target_pos - position, BLAST_RADIUS, 0.0, TAU, 48, Color(1.0, 90.0 / 255.0, 60.0 / 255.0, 0.35 + 0.4 * pulse), 2.0)
		draw_circle(Vector2.ZERO, 5.0, Color("#ffb347"))
