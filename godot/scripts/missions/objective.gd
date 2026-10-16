class_name CryoPod
extends Node2D

# The objective of Defense and Dark Sector Defense (port of src/missions/objective.js). It cannot move. Enemies that
# reach it damage it; when its health runs out, the mission is lost. Armour reduces each hit, as on the browser.

const RADIUS := 34.0
const HIT_FLASH := 0.2

var health: HealthComponent
var alive := true
var hit_timer := 0.0


func _init(max_hp: float = 4000.0, armor: float = 240.0) -> void:
	health = HealthComponent.new({"maxHp": max_hp, "maxShield": 0, "armor": armor}, false)


func take_damage(amount: float) -> void:
	health.take_damage(amount, 0.0)
	hit_timer = HIT_FLASH
	if health.hp <= 0.0:
		alive = false
	queue_redraw()


func _process(delta: float) -> void:
	hit_timer = maxf(0.0, hit_timer - delta)
	queue_redraw()


func _draw() -> void:
	# The pod glows in the objective colour (red while it is hit, grey once it is broken), with its level dropping as it takes damage
	var colour := Color("#8f7bff") if alive else Color("#4a4f63")
	if alive and hit_timer > 0.0:
		colour = Color("#ff6b6b")
	var frac := clampf(health.hp / health.max_hp, 0.0, 1.0)
	draw_circle(Vector2.ZERO, RADIUS * 1.4, Color(colour.r, colour.g, colour.b, 0.16))
	draw_rect(Rect2(-RADIUS * 0.55, -RADIUS * 1.3, RADIUS * 1.1, RADIUS * 2.6), Color(0.1, 0.12, 0.18))
	draw_rect(Rect2(-RADIUS * 0.5, -RADIUS * 1.25 + RADIUS * 2.5 * (1.0 - frac), RADIUS * 1.0, RADIUS * 2.5 * frac), colour)
	draw_rect(Rect2(-RADIUS * 0.55, -RADIUS * 1.3, RADIUS * 1.1, RADIUS * 2.6), colour, false, 2.0)
