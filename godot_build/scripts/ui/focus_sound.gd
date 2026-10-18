class_name FocusSound
extends RefCounted
## Port of java_build/src/ui/focus_sound.js. One place for the hover sound:
## whenever the focused item changes on any menu, ui_hover plays. Screens call
## FocusSound.track(key) when their focus moves, where key is any value that
## changes with the focus (an index, a name, or a combined string).

static var last = null


# The first call after reset() plays nothing
static func track(key) -> void:
	if key == null:
		return
	if last != null and key != last:
		AudioManager.play("ui_hover")
	last = key


# Call when a screen opens, so opening it does not play a hover sound
static func reset() -> void:
	last = null
