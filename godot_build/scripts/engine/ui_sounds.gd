class_name UiSounds
extends RefCounted
## Port of java_build/src/engine/ui_sounds.js. Menu sounds for an action game:
## short and hard-edged, built from clicks, filtered noise and a square-wave
## blip. Generated in code, so they need no audio files.
## hover: a tick. select: a firm confirm. back: a softer, falling tick.


# Builds a mono buffer from a function of time (seconds) returning a sample in -1..1
static func _build(sample_rate: int, duration: float, sample: Callable) -> AudioStreamWAV:
	var sr := float(sample_rate)
	var count := floori(sr * duration)
	var data := PackedFloat32Array()
	data.resize(count)
	for i in count:
		data[i] = sample.call(i / sr)
	return ProceduralSounds.to_wav(data, sample_rate)


# Square wave (a hard, buzzy tone) at frequency f
static func _square(f: float, t: float) -> float:
	return 1.0 if sin(TAU * f * t) >= 0.0 else -1.0


# Noise with a one-pole filter whose cutoff sweeps from c0 to c1 (Hz) over the sound: a moving "whoosh" or "tick".
# The state sits in a one-element array because GDScript lambdas capture variables by value.
static func _filtered_noise(sample_rate: int, duration: float, c0: float, c1: float) -> Callable:
	var state := [0.0]
	var sr := float(sample_rate)
	return func(t: float) -> float:
		var cutoff := c0 + (c1 - c0) * minf(1.0, t / duration)
		var a := 1.0 - exp((-2.0 * PI * cutoff) / sr)
		state[0] += a * ((randf() * 2.0 - 1.0) - state[0])
		return state[0]


static func create_ui_hover(sample_rate: int) -> AudioStreamWAV:
	var duration := 0.035
	var noise := _filtered_noise(sample_rate, duration, 6000.0, 9000.0)
	return _build(sample_rate, duration, func(t: float) -> float:
		var click: float = exp(-t / 0.004) * noise.call(t) * 1.2  # sharp transient
		var tone: float = _square(2400.0, t) * exp(-t / 0.01) * 0.12
		return click + tone
	)


# Select: the same click and square tick as the hover, but bigger: a longer, lower and louder version of it,
# with a deep body under the click so it hits harder.
static func create_ui_select(sample_rate: int) -> AudioStreamWAV:
	var duration := 0.11
	var noise := _filtered_noise(sample_rate, duration, 1500.0, 3000.0)  # darker than the hover click, so no hiss
	return _build(sample_rate, duration, func(t: float) -> float:
		var click: float = exp(-t / 0.007) * noise.call(t) * 1.6  # the hover click, stronger and darker
		var tick: float = _square(320.0, t) * exp(-t / 0.03) * 0.15  # the hover tick, pulled down into the low range
		var body: float = sin(TAU * 110.0 * t) * exp(-t / 0.045) * 0.55  # deep body for the power
		return (click + tick + body) * 0.6  # a little above the hover level, peak kept under full scale
	)


static func create_ui_back(sample_rate: int) -> AudioStreamWAV:
	var duration := 0.09
	var noise := _filtered_noise(sample_rate, duration, 3000.0, 500.0)
	return _build(sample_rate, duration, func(t: float) -> float:
		var tick: float = exp(-t / 0.012) * noise.call(t) * 0.8
		var pitch: float = 700.0 - 300.0 * minf(1.0, t / 0.05)  # falling, lower than select
		var blip: float = _square(pitch, t) * exp(-t / 0.025) * 0.15
		return tick + blip
	)
