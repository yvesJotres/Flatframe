class_name TileArt
extends RefCounted

# High-definition tiles for generated missions: steel floor panels and bevelled wall blocks. A port of
# src/engine/map/tile_art.js (drawMapTiles and the floor and wall tile drawing). Only tiles inside the view are drawn.
# Colours and the per-tile variation are fixed, so the map looks the same from frame to frame.

const FLOOR_BASE := Color("#1a1f2c")
const FLOOR_PANEL := Color("#222839")
const FLOOR_SEAM := Color(8.0 / 255.0, 10.0 / 255.0, 16.0 / 255.0, 0.85)
const FLOOR_GLINT := Color(120.0 / 255.0, 140.0 / 255.0, 185.0 / 255.0, 0.10)
const WALL_TOP := Color("#5a6686")
const WALL_FACE := Color("#343c52")
const WALL_BOTTOM := Color("#1b2030")
const WALL_EDGE := Color("#9aa8cc")
const WALL_SHADOW := Color(5.0 / 255.0, 7.0 / 255.0, 12.0 / 255.0, 0.7)
const WALL_INSET := Color(0, 0, 0, 0.18)
const RIVET := Color("#c3cde6")


# A stable pseudo-random value in 0..1 for a tile (the same hash as tile_art.js tileNoise)
static func tile_noise(gx: int, gy: int) -> float:
	var h := EarthMap._imul(gx, 374761393) + EarthMap._imul(gy, 668265263)
	h = EarthMap._imul(h ^ (h >> 13), 1274126177)
	return float((h ^ (h >> 16)) & EarthMap.MASK) / 4294967295.0


# Draws the tiles of a map inside the view. walls is a Dictionary whose keys are Vector2i grid cells.
static func draw_map(canvas: CanvasItem, tile_size: float, walls: Dictionary, bounds: Vector2, view: Rect2) -> void:
	var t := int(tile_size)
	var max_x := int(ceil(bounds.x / tile_size)) - 1
	var max_y := int(ceil(bounds.y / tile_size)) - 1
	var gx0 := maxi(0, int(floor(view.position.x / tile_size)))
	var gx1 := mini(max_x, int(floor(view.end.x / tile_size)))
	var gy0 := maxi(0, int(floor(view.position.y / tile_size)))
	var gy1 := mini(max_y, int(floor(view.end.y / tile_size)))
	for gy in range(gy0, gy1 + 1):
		for gx in range(gx0, gx1 + 1):
			var x := gx * tile_size
			var y := gy * tile_size
			if walls.has(Vector2i(gx, gy)):
				_draw_wall(canvas, x, y, tile_size, gx, gy, walls)
			else:
				_draw_floor(canvas, x, y, tile_size, gx, gy)
	var _unused := t


static func _draw_floor(canvas: CanvasItem, x: float, y: float, t: float, gx: int, gy: int) -> void:
	canvas.draw_rect(Rect2(x, y, t, t), FLOOR_BASE)
	var inset := t * 0.06
	var panel := Rect2(x + inset, y + inset, t - inset * 2.0, t - inset * 2.0)
	canvas.draw_rect(panel, FLOOR_PANEL)
	canvas.draw_rect(panel, FLOOR_SEAM, false, maxf(1.0, t * 0.03))
	canvas.draw_rect(Rect2(panel.position.x, panel.position.y, panel.size.x, maxf(1.0, t * 0.03)), FLOOR_GLINT)
	if tile_noise(gx, gy) > 0.5:
		canvas.draw_circle(Vector2(x + t * 0.2, y + t * 0.8), t * 0.025, WALL_SHADOW)


# A wall block: lit top fading to a dark bottom, an inset panel, bright bevels on sides facing open floor, and rivets
static func _draw_wall(canvas: CanvasItem, x: float, y: float, t: float, gx: int, gy: int, walls: Dictionary) -> void:
	var steps := 8
	for i in range(steps):
		var f0 := float(i) / steps
		var f1 := float(i + 1) / steps
		var c := _gradient3(WALL_TOP, WALL_FACE, WALL_BOTTOM, (f0 + f1) / 2.0)
		canvas.draw_rect(Rect2(x, y + t * f0, t, t * (f1 - f0) + 0.5), c)
	var inset := t * 0.12
	var panel := Rect2(x + inset, y + inset, t - inset * 2.0, t - inset * 2.0)
	canvas.draw_rect(panel, WALL_INSET)
	canvas.draw_rect(panel, WALL_SHADOW, false, maxf(1.0, t * 0.03))

	var bevel := maxf(2.0, t * 0.07)
	var edges := [
		[Vector2i(0, -1), Rect2(x, y, t, bevel)],
		[Vector2i(0, 1), Rect2(x, y + t - bevel, t, bevel)],
		[Vector2i(-1, 0), Rect2(x, y, bevel, t)],
		[Vector2i(1, 0), Rect2(x + t - bevel, y, bevel, t)],
	]
	for edge in edges:
		var neighbour: Vector2i = Vector2i(gx, gy) + edge[0]
		var open := not walls.has(neighbour)
		canvas.draw_rect(edge[1], WALL_EDGE if open else WALL_SHADOW)

	var r := maxf(1.0, t * 0.03)
	for p in [Vector2(0.22, 0.22), Vector2(0.78, 0.22), Vector2(0.22, 0.78), Vector2(0.78, 0.78)]:
		canvas.draw_circle(Vector2(x + t * p.x, y + t * p.y), r, RIVET)


# Three-stop vertical gradient at position f (0 top, 1 bottom)
static func _gradient3(a: Color, b: Color, c: Color, f: float) -> Color:
	if f < 0.5:
		return a.lerp(b, f * 2.0)
	return b.lerp(c, (f - 0.5) * 2.0)
