class_name JumpState
extends RefCounted

# Jumping for the Warframe. Port of src/warframe/jump.js (wiki: Maneuvers).
#   - Jump (Shift): a short hop in the direction you move, or where you aim when standing still.
#   - Double jump: a second jump while in the air. Landing restores it.
#   - Bullet jump: crouch (Ctrl), then jump. It launches toward your aim and slows over the flight.
#     A blast of 100 damage within 3 m of where the jump began, on landing.
#     It can't be repeated until you touch the ground, and a double jump can't follow it.
# Placeholders are the same as the JS: hop and double jump distances, bullet distance (forum reference),
# blast falloff floor, and crouch sizes.

const HOP_SECONDS := 0.3
const HOP_SPEED := 600.0          # units/s
const DOUBLE_SPEED := 480.0       # placeholder, a little shorter than the hop
const BULLET_SPEED := 217.5       # units/s: 14.5 m/s initial speed (wiki)
const BULLET_DISTANCE := 210.0    # units: 14 m (forum reference)
const BLAST_RADIUS := 45.0        # units: 3 m
const BLAST_DAMAGE := 100.0       # Blast damage, from the wiki
const BLAST_MIN_FRACTION := 0.25  # damage at the blast's edge as a fraction of the centre (placeholder)
const STAND_RADIUS := 16.0
const CROUCH_RADIUS := 11.0       # placeholder
const CROUCH_SIGHT_FACTOR := 0.5  # enemies see a crouched Warframe from half the distance (placeholder)
const CROUCH_SQUASH := 0.7        # the figure is drawn at 70% height while crouched

var time_left := 0.0        # seconds of jump left
var vx := 0.0
var vy := 0.0
var jumps_left := 1         # a double jump is available once per landing
var bullet_ready := true    # a bullet jump needs the ground first
var bullet_active := false
var bullet_dir := Vector2.ZERO
var bullet_seconds := 1.0


var airborne: bool:
	get:
		return time_left > 0.0


# Starts a jump. move is the movement direction (may be zero); aim is the aim direction.
# Returns "hop", "double", "bullet", or "" when nothing happens.
func press(move: Vector2, aim: Vector2, crouching: bool) -> String:
	var moving := move != Vector2.ZERO
	var u := move if moving else aim
	var n := u.normalized() if u.length() > 0.0 else Vector2.RIGHT

	if airborne:
		if jumps_left > 0 and not bullet_active:
			_start(n * DOUBLE_SPEED, HOP_SECONDS)
			jumps_left = 0
			return "double"
		return ""

	if crouching and bullet_ready:
		# Bullet jump: toward the aim at BULLET_SPEED, slowing linearly so it covers BULLET_DISTANCE
		var aim_n := aim.normalized() if aim.length() > 0.0 else Vector2.RIGHT
		bullet_dir = aim_n
		bullet_seconds = (2.0 * BULLET_DISTANCE) / BULLET_SPEED
		_start(bullet_dir * BULLET_SPEED, bullet_seconds)
		bullet_active = true
		bullet_ready = false
		jumps_left = 0
		return "bullet"

	_start(n * HOP_SPEED, HOP_SECONDS)
	jumps_left = 1
	bullet_active = false
	return "hop"


func _start(v: Vector2, seconds: float) -> void:
	vx = v.x
	vy = v.y
	time_left = seconds


# Advances the jump by dt. Returns "bullet" or "hop" on the frame the jump ends, otherwise "".
func update(dt: float) -> String:
	if not airborne:
		return ""
	time_left -= dt
	if time_left > 0.0:
		if bullet_active:
			# The bullet jump slows linearly from BULLET_SPEED to 0
			var f := time_left / bullet_seconds
			vx = bullet_dir.x * BULLET_SPEED * f
			vy = bullet_dir.y * BULLET_SPEED * f
		return ""
	time_left = 0.0
	vx = 0.0
	vy = 0.0
	var landed := "bullet" if bullet_active else "hop"
	bullet_active = false
	bullet_ready = true   # touching the ground restores the bullet jump and the double jump
	jumps_left = 1
	return landed
