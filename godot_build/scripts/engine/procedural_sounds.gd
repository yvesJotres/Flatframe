class_name ProceduralSounds
extends RefCounted
## Port of java_build/src/engine/procedural_sounds.js. Procedurally generated
## sound effects, used when no sound file is in the manifest. Each generator
## takes a sample rate and returns an AudioStreamWAV (Godot's AudioBuffer).

# One-pole lowpass: cheap enough to run per sample at generation time.
static func lowpass(prev: float, x: float, cutoff: float, sample_rate: float) -> float:
	var a := 1.0 - exp((-2.0 * PI * cutoff) / sample_rate)
	return prev + a * (x - prev)


# Gunshot layers, summed then soft-clipped:
#   crack  - very short, bright noise transient (the "snap")
#   body   - lowpassed noise with a quick decay (the "bang")
#   thump  - low sine whose pitch drops fast (the weight)
#   tail   - darker noise that rings out (the room)
#   clip   - optional short mechanical click after the shot (bolt/clip feel)
#   echo   - optional single delayed repeat (a sense of space)
const GUNSHOT_PROFILES := {
	# The original generic gunshot, used by every weapon without its own profile.
	"default": {
		"duration": 0.25,
		"crackGain": 0.6, "crackDecay": 0.004,
		"bodyGain": 0.7, "bodyDecay": 0.022,
		"thumpFrom": 155, "thumpTo": 45, "thumpSweep": 0.018, "thumpGain": 0.8, "thumpDecay": 0.05,
		"tailGain": 0.25, "tailDecay": 0.07,
		"clip": null,
		"echo": null,
	},
	# Braton: fast automatic rifle (~8.75 shots/s), so the shot is short enough not to
	# smear into the next one. Mechanical clip click and a light echo give it its character.
	# Whip-crack: a very sharp, bright transient with a second 'snap' from the tip,
	# almost no low thump, and a dry tail (no echo).
	"braton": {
		"duration": 0.12,
		"crackCutoff": 3000, "crackGain": 1.0, "crackDecay": 0.0025,
		"bodyGain": 0.25, "bodyDecay": 0.008,
		"thumpFrom": 220, "thumpTo": 90, "thumpSweep": 0.01, "thumpGain": 0.25, "thumpDecay": 0.015,
		"tailGain": 0.05, "tailDecay": 0.02,
		"snap": {"at": 0.018, "gain": 0.9, "decay": 0.002, "cutoff": 4000},
		"clip": {"at": 0.035, "gain": 0.12, "decay": 0.006, "freq": 900},
		"echo": null,
	},
}


# Wraps mono float samples (-1..1) as 16-bit PCM in an AudioStreamWAV
static func to_wav(samples: PackedFloat32Array, sample_rate: int) -> AudioStreamWAV:
	var pcm := PackedByteArray()
	pcm.resize(samples.size() * 2)
	for i in samples.size():
		pcm.encode_s16(i * 2, roundi(clampf(samples[i], -1.0, 1.0) * 32767.0))
	var stream := AudioStreamWAV.new()
	stream.format = AudioStreamWAV.FORMAT_16_BITS
	stream.mix_rate = sample_rate
	stream.stereo = false
	stream.data = pcm
	return stream


static func create_gunshot(sample_rate: int, p: Dictionary = GUNSHOT_PROFILES["default"]) -> AudioStreamWAV:
	var sr := float(sample_rate)
	var count := floori(sr * p["duration"])
	var data := PackedFloat32Array()
	data.resize(count)

	var body_lp := 0.0
	var tail_lp := 0.0
	var clip_lp := 0.0
	var crack_prev := 0.0
	var snap_prev := 0.0
	var phase := 0.0
	var clip_phase := 0.0

	for i in count:
		var t := i / sr
		var noise := randf() * 2.0 - 1.0

		# Crack: noise through a crude highpass (x - lowpass(x)) for brightness.
		crack_prev = lowpass(crack_prev, noise, p.get("crackCutoff", 1200.0), sr)
		var crack: float = (noise - crack_prev) * exp(-t / p["crackDecay"]) * p["crackGain"]

		var snap := 0.0
		if p.get("snap") != null and t >= p["snap"]["at"]:
			snap_prev = lowpass(snap_prev, noise, p["snap"]["cutoff"], sr)
			snap = (noise - snap_prev) * exp(-(t - p["snap"]["at"]) / p["snap"]["decay"]) * p["snap"]["gain"]

		body_lp = lowpass(body_lp, noise, 2500.0, sr)
		var body: float = body_lp * exp(-t / p["bodyDecay"]) * p["bodyGain"]

		var freq: float = p["thumpTo"] + (p["thumpFrom"] - p["thumpTo"]) * exp(-t / p["thumpSweep"])
		phase += (TAU * freq) / sr
		var thump: float = sin(phase) * exp(-t / p["thumpDecay"]) * p["thumpGain"]

		tail_lp = lowpass(tail_lp, noise, 600.0, sr)
		var tail: float = tail_lp * exp(-t / p["tailDecay"]) * p["tailGain"]

		var clip := 0.0
		if p.get("clip") != null and t >= p["clip"]["at"]:
			var dt: float = t - p["clip"]["at"]
			clip_lp = lowpass(clip_lp, noise, 1500.0, sr)
			clip_phase += (TAU * p["clip"]["freq"]) / sr
			var click: float = clip_lp * 0.6 + sin(clip_phase) * 0.4
			clip = click * exp(-dt / p["clip"]["decay"]) * p["clip"]["gain"]

		var mix: float = crack * 0.6 + snap * 0.6 + body + thump + tail + clip
		data[i] = tanh(mix * 1.4) * 0.8  # soft clip keeps the peaks punchy, not harsh

	# Echo runs over the finished shot; each repeat feeds the next, so it decays naturally.
	if p.get("echo") != null:
		var d := floori(p["echo"]["delay"] * sr)
		for i in range(d, count):
			data[i] += data[i - d] * p["echo"]["gain"]
	return to_wav(data, sample_rate)


# Parry: metallic 'ting' with a descending pitch.
static func create_parry(sample_rate: int) -> AudioStreamWAV:
	var sr := float(sample_rate)
	var duration := 0.15
	var count := floori(sr * duration)
	var data := PackedFloat32Array()
	data.resize(count)
	for i in count:
		var t := i / sr
		var freq := 2000.0 + 1500.0 * exp(-t * 30.0)  # descending pitch
		var tone := sin(TAU * freq * t)
		var decay := exp(-t * 15.0)
		data[i] = tone * decay * 0.3
	return to_wav(data, sample_rate)


# Countdown tick: a short, bright click (a clock or stopwatch tick).
static func create_countdown_tick(sample_rate: int) -> AudioStreamWAV:
	var sr := float(sample_rate)
	var duration := 0.04
	var count := floori(sr * duration)
	var data := PackedFloat32Array()
	data.resize(count)
	for i in count:
		var t := i / sr
		var tone := sin(TAU * 1800.0 * t)
		data[i] = tone * exp(-t / 0.008) * 0.5
	return to_wav(data, sample_rate)
