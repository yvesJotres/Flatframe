class_name MenuBackground
extends Control
## The shared menu background: the radial space gradient, the drifting nebula
## clouds and the twinkling starfield. Time advances like the browser menu:
## anim_time in seconds, and the drift offset by 0.02 per frame at 60 fps.

var anim_time := 0.0
var bg_offset := 0.0

@onready var gradient: ColorRect = $Gradient
@onready var nebula: Control = $Nebula
@onready var stars: Control = $Stars


func _ready() -> void:
	resized.connect(_on_resized)
	_on_resized()


func _on_resized() -> void:
	(gradient.material as ShaderMaterial).set_shader_parameter("size", size)


func _process(delta: float) -> void:
	anim_time += delta
	bg_offset += 0.02 * 60.0 * delta
	nebula.offset = bg_offset
	stars.time = anim_time
	stars.offset = bg_offset
	nebula.queue_redraw()
	stars.queue_redraw()
