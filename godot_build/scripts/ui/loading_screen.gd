extends CanvasLayer
## Port of the browser loading screen (java_build/index.html, window.loadingScreen).
## game.gd reports real progress with set_progress() as each load step finishes,
## then calls done() when the game is ready, or fail() if a step breaks.

const MIN_SHOW_MSEC := 700  # stay up long enough that a fast load does not just flash
const FADE_TIME := 0.45

var progress := 0.0
var shown_at := 0
var bar_tween: Tween

@onready var root: Control = $Root
@onready var bar: ProgressBar = $Root/Panel/Bar
@onready var status: Label = $Root/Panel/Status
@onready var error_label: Label = $Root/Panel/Error


func _ready() -> void:
	shown_at = Time.get_ticks_msec()
	bar.max_value = 100.0
	error_label.hide()


# Same as window.loadingScreen.set(p, text): the bar never goes backwards.
# Call it with the fraction of steps actually finished, so the bar shows real work.
func set_progress(value: float, text: String = "") -> void:
	progress = maxf(progress, value)
	# Glide to the new value, like the browser's CSS width transition (0.3s)
	if bar_tween != null and bar_tween.is_valid():
		bar_tween.kill()
	bar_tween = create_tween()
	bar_tween.tween_property(bar, "value", progress * 100.0, 0.3)
	if text != "":
		status.text = text


func done() -> void:
	set_progress(1.0, "Ready")
	var elapsed := Time.get_ticks_msec() - shown_at
	var wait := maxf(0.25, (MIN_SHOW_MSEC - elapsed) / 1000.0)
	await get_tree().create_timer(wait).timeout
	var tween := create_tween()
	tween.tween_property(root, "modulate:a", 0.0, FADE_TIME)
	await tween.finished
	queue_free()


func fail(message: String) -> void:
	status.text = "Failed to load"
	error_label.text = "%s - try reloading." % message
	error_label.show()
