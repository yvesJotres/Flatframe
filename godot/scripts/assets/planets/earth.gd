class_name EarthMap
extends RefCounted

# Earth's globe, a port of EFFECTS[PLANET_EARTH] in src/engine/visual_effects.js.
# The globe surface (ocean, land, ice, shade and rim) is drawn by a canvas shader (globe.gdshader) that samples
# a land mask baked from the coastline rings (assets/earth_land_mask.png). The clouds and the outline are drawn
# by GDScript on top. Seeded weather (seed 7) is generated exactly as the browser does.

const LAND_PATH := "res://data/earth_land.json"
const EARTH_PATH := "res://data/earth.json"
const MASK_PATH := "res://assets/earth_land_mask.png"
const SHADER_PATH := "res://scripts/assets/planets/globe.gdshader"
const RAD := PI / 180.0
const TILT := -0.32            # EARTH_SPIN.tilt
const SPIN_LAND := 5.0         # degrees per second
const SPIN_CLOUDS := 4.0
const COVER_SPEED := 0.2
const COVER_MIN := 0.45
const WEATHER_SEED := 7
const WEATHER_COUNT := 320
const WEATHER_STORMS := 6
const WEATHER_STORM_ARMS := 36
const MASK := 0xffffffff

static var _colors: Dictionary = {}
static var _blobs: Array = []
static var _mask: Texture2D = null
static var _material: ShaderMaterial = null


static func _ensure() -> void:
	if _colors.is_empty():
		var earth = JSON.parse_string(FileAccess.get_file_as_string(EARTH_PATH))
		_colors = earth.get("colors", {}) if earth is Dictionary else {}
	if _blobs.is_empty():
		_blobs = make_weather()


static func _colour(token: String, fallback: String) -> Color:
	return Palette.parse(str(_colors.get(token, fallback)))


# The globe's shader material, with the colours from earth.js and the land mask bound. Created once.
static func globe_material() -> ShaderMaterial:
	if _material == null:
		_ensure()
		var shader: Shader = load(SHADER_PATH)
		_material = ShaderMaterial.new()
		_material.shader = shader
		_material.set_shader_parameter("land_mask", load(MASK_PATH))
		_material.set_shader_parameter("ocean_light", _colour("oceanLight", "#3d8fe0"))
		_material.set_shader_parameter("ocean_mid", _colour("oceanMid", "#1b5fb4"))
		_material.set_shader_parameter("ocean_deep", _colour("oceanDeep", "#07245a"))
		_material.set_shader_parameter("land_colour", _colour("land", "#4c9a52"))
		_material.set_shader_parameter("ice_colour", _colour("ice", "#e8f2ff"))
		_material.set_shader_parameter("rim_colour", _colour("rim", "rgba(120,180,255,0.35)"))
		_material.set_shader_parameter("tilt", TILT)
	return _material


# Spin of the land in degrees at a given time (seconds), as the browser computes it
static func land_spin(time: float) -> float:
	return fmod(time * SPIN_LAND, 360.0)


# 32-bit multiply, as Math.imul
static func _imul(a: int, b: int) -> int:
	var al := a & 0xffff
	var ah := (a >> 16) & 0xffff
	var bl := b & 0xffff
	var bh := (b >> 16) & 0xffff
	return (al * bl + (((ah * bl + al * bh) & 0xffff) << 16)) & MASK


# The seeded generator from visual_effects.js, same values as the browser
class Rng:
	extends RefCounted
	var a := 0

	func _init(seed_value: int) -> void:
		a = seed_value & EarthMap.MASK

	func next() -> float:
		a = (a + 0x6d2b79f5) & EarthMap.MASK
		var x := a
		x = EarthMap._imul(x ^ (x >> 15), x | 1)
		var m := EarthMap._imul(x ^ (x >> 7), x | 61)
		x = (x ^ ((x + m) & EarthMap.MASK)) & EarthMap.MASK
		return float((x ^ (x >> 14)) & EarthMap.MASK) / 4294967296.0


static func _cloud_density(lat: float) -> float:
	var a := absf(lat)
	var equator := exp(-pow(a / 12.0, 2.0))
	var storms := 0.6 * exp(-pow((a - 50.0) / 15.0, 2.0))
	return minf(1.0, maxf(0.15, equator + storms))


# Cloud blobs as { lon, lat, w, h, a, phase } in degrees (w, h are half sizes), in the same order as the browser
static func make_weather() -> Array:
	var rng := Rng.new(WEATHER_SEED)
	var blobs: Array = []
	while blobs.size() < WEATHER_COUNT:
		var lon := rng.next() * 360.0 - 180.0
		var lat := asin(rng.next() * 2.0 - 1.0) * 180.0 / PI
		if rng.next() > _cloud_density(lat):
			continue
		var w := 4.0 + rng.next() * 10.0
		var h := 1.5 + rng.next() * 3.0
		var a := 0.35 + rng.next() * 0.4
		var phase := rng.next() * TAU
		blobs.append({"lon": lon, "lat": lat, "w": w, "h": h, "a": a, "phase": phase})
	for _s in range(WEATHER_STORMS):
		var cx := rng.next() * 360.0 - 180.0
		var cy := (rng.next() * 2.0 - 1.0) * 45.0
		for i in range(WEATHER_STORM_ARMS):
			var u := float(i) / WEATHER_STORM_ARMS
			var ang := u * PI * 4.0
			var rad := 2.0 + u * 12.0
			var w2 := 3.0 + rng.next() * 3.0
			var phase2 := rng.next() * TAU
			blobs.append({"lon": cx + cos(ang) * rad, "lat": cy + sin(ang) * rad * 0.6, "w": w2, "h": 2.0, "a": 0.75, "phase": phase2})
	return blobs


# Colour at distance d along a radial gradient with stops [[pos, color], ...]
static func _radial(d: float, r0: float, r1: float, stops: Array) -> Color:
	var t := clampf((d - r0) / (r1 - r0), 0.0, 1.0)
	if t <= float(stops[0][0]):
		return stops[0][1]
	for i in range(stops.size() - 1):
		var p0: float = stops[i][0]
		var p1: float = stops[i + 1][0]
		if t <= p1:
			var f := (t - p0) / (p1 - p0)
			var c0: Color = stops[i][1]
			var c1: Color = stops[i + 1][1]
			return Color(lerpf(c0.r, c1.r, f), lerpf(c0.g, c1.g, f), lerpf(c0.b, c1.b, f), lerpf(c0.a, c1.a, f))
	return stops[stops.size() - 1][1]


static func _project(lon: float, lat: float, centre_deg: float) -> Vector3:
	var lam := (lon - centre_deg) * RAD
	var phi := lat * RAD
	return Vector3(cos(phi) * sin(lam), sin(phi), cos(phi) * cos(lam))


# The clouds, drawn over the globe surface. Each is an ellipse on the sphere, shown only when it faces the viewer.
static func draw_clouds(canvas: CanvasItem, center: Vector2, r: float, time: float) -> void:
	_ensure()
	var cloud_spin := fmod(time * SPIN_CLOUDS, 360.0)
	for c in _blobs:
		var lam := (float(c.lon) - cloud_spin) * RAD
		var phi := float(c.lat) * RAD
		var facing := cos(phi) * cos(lam)
		if facing <= 0.05:
			continue
		var cover := COVER_MIN + (1.0 - COVER_MIN) * (0.5 + 0.5 * sin(time * COVER_SPEED + float(c.phase)))
		var v := _project(float(c.lon), float(c.lat), cloud_spin)
		var rx := (float(c.w) / 90.0) * r * maxf(0.3, facing)
		var ry := (float(c.h) / 90.0) * r
		var alpha := float(c.a) * cover * minf(1.0, facing * 2.0)
		canvas.draw_set_transform(center + Vector2(r * v.x, -r * v.y).rotated(TILT), TILT, Vector2(rx, ry))
		canvas.draw_circle(Vector2.ZERO, 1.0, Color(1, 1, 1, alpha))
	canvas.draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)


static func draw_outline(canvas: CanvasItem, center: Vector2, r: float) -> void:
	_ensure()
	canvas.draw_arc(center, r, 0.0, TAU, 96, _colour("outline", "rgba(140,190,255,0.5)"), 1.5)
