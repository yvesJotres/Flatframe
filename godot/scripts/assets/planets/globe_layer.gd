class_name GlobeLayer
extends Node2D

# One layer of the star chart's globe. Three layers sit behind the chart's own drawing (negative z_index):
#   BACKGROUND: the space gradient (star_chart.js drawSpaceBackground)
#   SURFACE:    the globe surface, drawn by globe.gdshader on a quad
#   CLOUDS:     clouds and the outline, drawn with plain draw calls
# The owning StarChart sets center, radius, time and background_size each frame.

enum Kind { BACKGROUND, SURFACE, CLOUDS }

const STOPS_CENTER := Color("#0a0a14")
const STOPS_MID := Color("#06060a")
const STOPS_EDGE := Color("#030305")

var kind := Kind.SURFACE
var center := Vector2.ZERO
var radius := 100.0
var time := 0.0
var background_size := Vector2.ZERO

static var _background: ImageTexture = null
static var _background_size := Vector2i.ZERO
static var _white: ImageTexture = null


func _ready() -> void:
	if kind == Kind.SURFACE:
		material = EarthMap.globe_material()
	z_index = -2 if kind == Kind.BACKGROUND else -1


func _draw() -> void:
	match kind:
		Kind.BACKGROUND:
			_draw_background()
		Kind.SURFACE:
			_draw_surface()
		Kind.CLOUDS:
			EarthMap.draw_clouds(self, center, radius, time)
			EarthMap.draw_outline(self, center, radius)


func _draw_surface() -> void:
	var side: float = ceil(radius * 2.0) + 2.0
	var quad := Rect2(center - Vector2(side, side) / 2.0, Vector2(side, side))
	var shader_material := material as ShaderMaterial
	shader_material.set_shader_parameter("radius", radius)
	shader_material.set_shader_parameter("spin_deg", EarthMap.land_spin(time))
	draw_texture_rect(_one_pixel(), quad, false)


# The space gradient: a radial gradient from 20% of the width and 30% of the height, out to the larger side.
# It is baked once per size, since it does not move.
func _draw_background() -> void:
	var s := Vector2i(int(background_size.x), int(background_size.y))
	if s.x <= 0 or s.y <= 0:
		return
	if _background == null or _background_size != s:
		var img := Image.create(s.x, s.y, false, Image.FORMAT_RGBA8)
		var origin := Vector2(s.x * 0.2, s.y * 0.3)
		var reach := maxf(s.x, s.y)
		var stops := [[0.0, STOPS_CENTER], [0.4, STOPS_MID], [1.0, STOPS_EDGE]]
		for py in range(s.y):
			for px in range(s.x):
				var d := Vector2(px + 0.5, py + 0.5).distance_to(origin)
				img.set_pixel(px, py, EarthMap._radial(d, 0.0, reach, stops))
		_background = ImageTexture.create_from_image(img)
		_background_size = s
	draw_texture(_background, Vector2.ZERO)


# A 1×1 white texture: the shader ignores the texture and uses the quad's UV, so any texture works
static func _one_pixel() -> ImageTexture:
	if _white == null:
		var img := Image.create(1, 1, false, Image.FORMAT_RGBA8)
		img.set_pixel(0, 0, Color.WHITE)
		_white = ImageTexture.create_from_image(img)
	return _white
