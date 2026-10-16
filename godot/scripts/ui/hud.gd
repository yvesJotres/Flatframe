class_name Hud
extends Control

# Heads-up display, laid out to match the browser build's mission HUD (captured at 1024×768).
# Colours come from src/assets/colors.js. Positions are the browser's, read from its screenshot.

const ACCENT := Color("#ff6b35")          # COLORS.ACCENT
const TEXT := Color("#ffffff")            # COLORS.TEXT
const TEXT_DIM := Color("#9aa0b4")        # COLORS.TEXT_DIM
const TEXT_GREY := Color("#808080")       # COLORS.TEXT_DISABLED
const HEALTH := Color("#cc2a28")          # COLORS.HEALTH
const SHIELDS := Color("#01d8ff")         # COLORS.SHIELDS
const ARMOR := Color("#e0a635")           # COLORS.ARMOR
const ENERGY := Color("#6fd3ff")          # style.css .energy-fill
const RETICLE := Color("#ffffff")         # COLORS.RETICLE
const WIN := Color("#4ade80")
const LOSE := Color("#f87171")
const TRACK := Color(0.0, 0.0, 0.0, 0.5)  # style.css: missing bar = black @ 50%
const PANEL := Color(24.0 / 255.0, 30.0 / 255.0, 44.0 / 255.0, 0.92)

const MARGIN := 30.0
const ABILITIES := [["SD", 25], ["RB", 50], ["RJ", 75], ["EB", 25]]   # the browser's four slots and costs

var game: Game


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE


func _process(_delta: float) -> void:
	queue_redraw()


func _draw() -> void:
	if game == null or game.player == null:
		return
	var font := ThemeDB.fallback_font
	var vp := get_viewport_rect().size
	var p := game.player
	var h: HealthComponent = p.health

	if game.mode == "survival":
		_draw_survival_banner(font)
	else:
		MenuChrome.draw_letter_spaced(self, font, Vector2(MARGIN, 36.0), "EXTERMINATE", 12, 3.0, ACCENT)
		draw_string(font, Vector2(MARGIN, 60.0), "Eliminated %d / %d" % [game.kills, game.kill_quota],
			HORIZONTAL_ALIGNMENT_LEFT, -1, 17, TEXT)

	_draw_vitals(font, vp, p, h)
	_draw_ammo(font, vp, p)
	_draw_debug(font, p)

	# Reticle at the mouse
	draw_arc(get_viewport().get_mouse_position(), 8.0, 0.0, TAU, 24, RETICLE, 1.5)

	# Bleed-out, centred above the result text
	if p.is_bleeding_out and game.state == "running":
		var bleed := "DOWNED - HOLD X TO REVIVE" if p.awaiting_revive else "BLEEDING OUT  %d s" % ceili(p.bleedout_timer)
		var bw := font.get_string_size(bleed, HORIZONTAL_ALIGNMENT_LEFT, -1, 22).x
		draw_string(font, Vector2((vp.x - bw) / 2.0, vp.y / 2.0 - 40.0), bleed, HORIZONTAL_ALIGNMENT_LEFT, -1, 22, ACCENT)

	# Mission result, centred
	var message := ""
	var colour := TEXT
	match game.state:
		"won":
			message = "MISSION COMPLETE"
			colour = WIN
		"lost":
			message = "DOWNED"
			colour = LOSE
	if message != "":
		var msg_w := font.get_string_size(message, HORIZONTAL_ALIGNMENT_LEFT, -1, 28).x
		draw_string(font, Vector2((vp.x - msg_w) / 2.0, vp.y / 2.0), message, HORIZONTAL_ALIGNMENT_LEFT, -1, 28, colour)
		var hint := "Press Enter to restart"
		var hint_w := font.get_string_size(hint, HORIZONTAL_ALIGNMENT_LEFT, -1, 16).x
		draw_string(font, Vector2((vp.x - hint_w) / 2.0, vp.y / 2.0 + 28), hint, HORIZONTAL_ALIGNMENT_LEFT, -1, 16, TEXT_DIM)


func _draw_survival_banner(font: Font) -> void:
	draw_string(font, Vector2(MARGIN, 36.0), "SURVIVAL", HORIZONTAL_ALIGNMENT_LEFT, -1, 22, ACCENT)
	draw_string(font, Vector2(MARGIN, 60.0), "Wave %d" % game.wave, HORIZONTAL_ALIGNMENT_LEFT, -1, 16, TEXT_DIM)
	draw_string(font, Vector2(MARGIN, 82.0), "LIFE SUPPORT %d%%" % ceili(game.life_support),
		HORIZONTAL_ALIGNMENT_LEFT, -1, 16, TEXT)
	var t := int(game.elapsed)
	draw_string(font, Vector2(MARGIN, 104.0), "%d:%02d / 5:00" % [t / 60, t % 60], HORIZONTAL_ALIGNMENT_LEFT, -1, 14, TEXT_DIM)
	if game.elapsed >= Game.EXTRACT_AT:
		draw_string(font, Vector2(MARGIN, 126.0), "EXTRACT TO WIN", HORIZONTAL_ALIGNMENT_LEFT, -1, 14, ACCENT)


# Shield and health numbers and bars at the top right, the frame's name and armor under them
func _draw_vitals(font: Font, vp: Vector2, p: Player, h: HealthComponent) -> void:
	var right := vp.x - MARGIN
	var shield_text := str(ceili(h.shield))
	var health_text := str(ceili(h.hp))
	var health_w := font.get_string_size(health_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 34).x
	draw_string(font, Vector2(right - health_w, 52.0), health_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 34, HEALTH)
	var shield_w := font.get_string_size(shield_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 34).x
	draw_string(font, Vector2(right - 70.0 - shield_w, 52.0), shield_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 34, SHIELDS)

	# Shield bar (cyan) on the left of the pair, health bar (red) on the right, both ending at the right margin
	var bar_y := 74.0
	var shield_x := right - 200.0
	var health_x := right - 102.0
	draw_rect(Rect2(shield_x, bar_y, 98.0, 9.0), TRACK)
	if h.max_shield > 0.0:
		draw_rect(Rect2(shield_x, bar_y, 98.0 * clampf(h.shield / h.max_shield, 0.0, 1.0), 9.0), SHIELDS)
	draw_rect(Rect2(health_x, bar_y, 102.0, 9.0), TRACK)
	draw_rect(Rect2(health_x, bar_y, 102.0 * clampf(h.hp / h.max_hp, 0.0, 1.0), 9.0), HEALTH)

	var frame_name := str(Loadout.equipped.get("warframe", "")).to_upper()
	var frame_text := "%s [0]" % frame_name
	var fw := font.get_string_size(frame_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 14).x
	draw_string(font, Vector2(right - fw, 102.0), frame_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 14, TEXT_GREY)

	if h.current_armor > 0.0:
		var armor_text := "ARMOR %d" % ceili(h.current_armor)
		var box := Rect2(right - 86.0, 116.0, 86.0, 16.0)
		draw_rect(box, PANEL)
		draw_string(font, box.position + Vector2(5.0, 12.0), armor_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 10, ARMOR)


# Ammo in large numbers at the bottom right, then the weapon, energy, and the four ability slots
func _draw_ammo(font: Font, vp: Vector2, p: Player) -> void:
	var right := vp.x - MARGIN
	var mag := int(p.weapon.get("magazineSize", 0))
	var ammo_text := str(p.ammo)
	var of_text := " / %d" % mag
	var of_w := font.get_string_size(of_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 26).x
	draw_string(font, Vector2(right - of_w, vp.y - 141.0), of_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 26, TEXT_GREY)
	var ammo_w := font.get_string_size(ammo_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 52).x
	draw_string(font, Vector2(right - of_w - ammo_w, vp.y - 141.0), ammo_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 52, TEXT)
	if p.reload_left > 0.0:
		var rl_w := font.get_string_size("RELOADING", HORIZONTAL_ALIGNMENT_LEFT, -1, 12).x
		draw_string(font, Vector2(right - rl_w, vp.y - 168.0), "RELOADING", HORIZONTAL_ALIGNMENT_LEFT, -1, 12, ACCENT)

	var weapon_name := str(p.weapon.get("name", "")).to_upper()
	var weapon_text := "%s [0]" % weapon_name
	var ww := font.get_string_size(weapon_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 14).x
	draw_string(font, Vector2(right - ww, vp.y - 122.0), weapon_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 14, TEXT)

	# Energy: bar then the value, right aligned
	var energy_x := right - 285.0
	draw_rect(Rect2(energy_x, vp.y - 95.0, 201.0, 5.0), TRACK)
	var max_energy := 150.0
	draw_rect(Rect2(energy_x, vp.y - 95.0, 201.0 * clampf(p.energy / max_energy, 0.0, 1.0), 5.0), ENERGY)
	var energy_text := "ENERGY %d" % ceili(p.energy)
	var ew := font.get_string_size(energy_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 10).x
	draw_string(font, Vector2(right - ew, vp.y - 84.0), energy_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 10, TEXT_DIM)

	# Four ability slots: key number, name, cost
	var slot_x := [803.0, 854.0, 902.0, 954.0]
	var slot_w := [36.0, 38.0, 38.0, 38.0]
	for i in range(ABILITIES.size()):
		var box := Rect2(slot_x[i], vp.y - 68.0, slot_w[i], 36.0)
		draw_rect(box, PANEL)
		draw_rect(box, Color(1, 1, 1, 0.12), false, 1.0)
		draw_string(font, box.position + Vector2(3.0, 9.0), str(i + 1), HORIZONTAL_ALIGNMENT_LEFT, -1, 8, TEXT_DIM)
		draw_string(font, box.position + Vector2(9.0, 19.0), ABILITIES[i][0], HORIZONTAL_ALIGNMENT_LEFT, -1, 12, TEXT_GREY)
		draw_string(font, box.position + Vector2(9.0, 31.0), str(ABILITIES[i][1]), HORIZONTAL_ALIGNMENT_LEFT, -1, 10, TEXT_DIM)


# POS and ANGLE read-out at the bottom left (the browser's showDebugInfo setting)
func _draw_debug(font: Font, p: Player) -> void:
	var vp := get_viewport_rect().size
	var angle := roundi(wrapf(rad_to_deg(p.aim_dir.angle()), 0.0, 360.0))
	draw_string(font, Vector2(28.0, vp.y - 66.0), "POS %d, %d" % [roundi(p.position.x), roundi(p.position.y)],
		HORIZONTAL_ALIGNMENT_LEFT, -1, 10, TEXT_DIM)
	draw_string(font, Vector2(28.0, vp.y - 54.0), "ANGLE %d°" % angle, HORIZONTAL_ALIGNMENT_LEFT, -1, 10, TEXT_DIM)
