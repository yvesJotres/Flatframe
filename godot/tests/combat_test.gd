extends SceneTree

# Headless tests for the ported combat math.
# Run from the godot/ folder:
#   godot --headless -s res://tests/combat_test.gd
# Exit code 0 means every check passed.

var passes := 0
var failures := 0


func check(condition: bool, label: String) -> void:
	if condition:
		passes += 1
	else:
		failures += 1
		print("FAIL: ", label)


func near(a: float, b: float, eps: float = 0.0001) -> bool:
	return absf(a - b) < eps


func _init() -> void:
	test_damage_math()
	test_damage_types()
	test_scaling()
	test_critical()
	test_health()
	test_status_manager()
	test_status_effects()
	test_loadout_data()
	test_mod_placement()
	test_mod_effects()
	test_player_health()
	test_shield_recharge()
	test_bleed_out_and_revive()
	test_survival_waves()
	test_earth_weather_rng()
	test_map_generator()
	test_account_crypto()
	test_account_sections()
	test_settings_sections()
	test_enemy_status_ticks()
	test_hit_zones()
	print("%d passed, %d failed" % [passes, failures])
	quit(1 if failures > 0 else 0)


func test_damage_math() -> void:
	check(near(DamageMath.player_reduction(300.0), 0.5), "player reduction at 300 armor is 50%")
	check(near(DamageMath.enemy_reduction(2700.0), 0.9), "enemy reduction at 2700 armor is 90%")
	check(near(DamageMath.enemy_reduction(5000.0), 0.9), "enemy armor is capped at 2700")
	check(near(DamageMath.reduce_damage(100.0, 0.0, false), 100.0), "no armor means no reduction")
	check(near(DamageMath.reduce_damage(100.0, 300.0, true), 50.0), "player 300 armor halves damage")


func test_damage_types() -> void:
	check(near(DamageTypes.get_faction_multiplier("grineer", "impact"), 1.5), "grineer weak to impact")
	check(near(DamageTypes.get_faction_multiplier("grineer", "puncture"), 1.0), "unlisted type is neutral")
	check(near(DamageTypes.get_faction_multiplier("nobody", "impact"), 1.0), "unknown faction is neutral")
	check(DamageTypes.combine_elements([DamageTypes.HEAT, DamageTypes.COLD]) == [DamageTypes.BLAST], "heat+cold is blast")
	check(DamageTypes.combine_elements([DamageTypes.HEAT]).is_empty(), "single element does not combine")


func test_scaling() -> void:
	check(near(Scaling.scale_stat_by_faction(100.0, 1.0, "hp", "grineer"), 100.0), "level 1 hp is base")
	check(Scaling.scale_stat_by_faction(10.0, 1.0, "armor", "grineer") == 200.0, "armor clamps to minimum 200")
	check(Scaling.scale_stat_by_faction(5000.0, 1.0, "armor", "grineer") == 2700.0, "armor clamps to maximum 2700")
	check(Scaling.scale_stat_by_faction(100.0, 1.0, "armor", "grineer") == 200.0, "zero-level armor uses the floor")
	check(Scaling.scale_stat_by_faction(100.0, 10.0, "hp", "corpus") > 100.0, "hp grows with level")
	check(Scaling.scale_stat_by_faction(100.0, 30.0, "shield", "unknown_faction") > 100.0, "unknown faction falls back to grineer")


func test_critical() -> void:
	check(near(Critical.calculate_crit_chance(0.5, 2.0), 1.0), "crit chance caps at 1.0")
	check(Critical.get_crit_tier(1.5) == Critical.Tier.YELLOW, "1.5x is yellow")
	check(Critical.get_crit_tier(2.5) == Critical.Tier.ORANGE, "2.5x is orange")
	check(Critical.get_crit_tier(3.0) == Critical.Tier.RED, "3.0x is red")
	var miss := Critical.roll_crit(0.1, 2.0, 0.0, 0.0, 0.99)
	check(not miss.is_crit, "roll above chance does not crit")
	var hit := Critical.roll_crit(0.5, 2.0, 0.0, 0.0, 0.01)
	check(hit.is_crit and near(hit.multiplier, 2.0), "roll below chance crits at base multiplier")
	var result := {"is_crit": true, "multiplier": 2.0}
	check(near(Critical.apply_crit_and_precision(10.0, result, 2.0), 30.0), "crit 2x plus stealth 2x is additive (3x)")
	check(near(Critical.apply_crit_and_precision(10.0, {"is_crit": false}, 2.0), 20.0), "no crit still gets precision bonus")


func test_health() -> void:
	var enemy := HealthComponent.new({"maxHp": 100.0, "maxShield": 100.0, "armor": 0.0}, false)
	check(near(enemy.take_damage(30.0), 0.0), "shield absorbs a small hit")
	check(near(enemy.shield, 70.0), "shield drops by absorbed damage")
	enemy.take_damage(150.0)
	check(near(enemy.shield, 0.0), "shield depleted by a large hit")
	check(near(enemy.hp, 100.0), "hp untouched when shield breaks")
	check(near(enemy.shield_gate_timer, 0.1), "enemy gate timer is 0.1 s")

	var toxin_target := HealthComponent.new({"maxHp": 100.0, "maxShield": 0.0, "armor": 0.0}, false)
	toxin_target.take_damage({"total": 10.0, "toxin": 10.0})
	check(near(toxin_target.hp, 90.0), "toxin goes straight to health")

	var player := HealthComponent.new({"maxHp": 100.0, "maxShield": 100.0, "armor": 0.0}, true)
	player.take_damage(100.0)
	check(near(player.shield, 50.0), "player shield DR halves absorption")
	check(near(player.hp, 100.0), "player health untouched while shield holds")

	var gated := HealthComponent.new({"maxHp": 100.0, "maxShield": 100.0, "armor": 0.0}, true)
	gated.take_damage(100.0)
	gated.take_damage(100.0)
	check(near(gated.hp, 100.0), "player is invulnerable during shield gate")
	check(gated.is_invulnerable(), "player reports invulnerable")

	var true_damage := HealthComponent.new({"maxHp": 100.0, "maxShield": 0.0, "armor": 2700.0}, false)
	var applied := true_damage.take_damage({"total": 50.0, "trueDamage": true})
	check(near(applied, 50.0), "true damage ignores armor")

	var regen := HealthComponent.new({"maxHp": 100.0, "maxShield": 100.0, "armor": 0.0}, false)
	regen.shield = 0.0
	regen.magnetic_timer = 2.0
	regen.restore_shield(50.0)
	check(near(regen.shield, 0.0), "magnetic blocks shield restoration")


func test_status_manager() -> void:
	# 300 max hp so six 35-damage ticks (210) fit without hitting the zero clamp
	var health := HealthComponent.new({"maxHp": 300.0, "maxShield": 0.0, "armor": 2700.0}, false)
	var manager := StatusManager.new()
	manager.add_effect(StatusManager.make_slash(100.0))
	# Bleed ticks once per second for 6 ticks at 35 damage each, ignoring armor
	manager.update(1.0, health)
	check(near(health.hp, 265.0), "first bleed tick deals 35 true damage")
	for _i in range(5):
		manager.update(1.0, health)
	check(manager.effects.is_empty(), "bleed expires after 6 ticks")
	check(near(health.hp, 300.0 - 6.0 * 35.0), "six ticks total 210 damage")


func test_status_effects() -> void:
	check(near(StatusEffects.calculate_status_chance(0.1, 0.0, 1), 0.1), "single projectile proc chance equals base")
	check(near(StatusEffects.calculate_status_chance(0.1, 0.0, 2), 0.19), "two projectiles roll independently")
	check(StatusEffects.pick_status_proc({}) == null, "no damage means no proc")
	check(StatusEffects.pick_status_proc({"heat": 100}, 0.5) == "heat", "single weight always procs that status")
	check(StatusEffects.pick_status_proc({"slash": 50, "cold": 50}, 0.75) == "cold", "roll 0.75 lands in second half")

	var effect := StatusEffects.create_status_effect("cold", 100.0)
	check(near(effect.remainingTime, 6.0), "freeze lasts 6 s")
	var manager := StatusManager.new()
	StatusEffects.apply_status_effect(manager, effect)
	StatusEffects.apply_status_effect(manager, StatusEffects.create_status_effect("cold", 100.0))
	check(manager.get_effect("cold").stacks == 2, "stack behaviour adds a stack")
	for _i in range(15):
		StatusEffects.apply_status_effect(manager, StatusEffects.create_status_effect("cold", 100.0))
	check(manager.get_effect("cold").stacks == 10, "stacks cap at maxStacks")

	var bleeds := StatusManager.new()
	StatusEffects.apply_status_effect(bleeds, StatusEffects.create_status_effect("slash", 100.0))
	StatusEffects.apply_status_effect(bleeds, StatusEffects.create_status_effect("slash", 100.0))
	check(bleeds.effects.size() == 2, "independent behaviour keeps separate instances")

	var ignite := StatusEffects.create_status_effect("heat", 100.0)
	ignite.remainingTime = 1.0
	var refresh := StatusManager.new()
	StatusEffects.apply_status_effect(refresh, ignite)
	StatusEffects.apply_status_effect(refresh, StatusEffects.create_status_effect("heat", 100.0))
	check(near(refresh.get_effect("heat").remainingTime, 6.0), "refresh resets duration")
	check(StatusEffects.create_status_effect("nope", 1.0).is_empty(), "unknown status creates nothing")

	# DoT procs get the tick fields StatusManager.update() needs
	var dot := StatusEffects.create_status_effect("toxin", 100.0)
	check(near(dot.interval, 1.0) and near(dot.tickDamage, 50.0) and dot.remaining == 6, "toxin DoT has tick fields")
	var poison_target := HealthComponent.new({"maxHp": 100.0, "maxShield": 0.0, "armor": 2700.0}, false)
	var poison_manager := StatusManager.new()
	StatusEffects.apply_status_effect(poison_manager, dot)
	poison_manager.update(1.0, poison_target)
	# Toxin bypasses shields but not armor: 50 damage at 2700 armor (90% reduction) leaves 5, so hp 95
	check(near(poison_target.hp, 95.0), "toxin tick is reduced by armor, not by shields")


func test_loadout_data() -> void:
	check(Loadout.item("primary", "Braton").get("name", "") == "Braton", "Braton loads from primary data")
	check(Loadout.item("primary", "Grakata").get("name", "") == "Grakata", "Grakata loads from primary data")
	check(Loadout.item("secondary", "Lato").get("name", "") == "Lato", "Lato loads from secondary data")
	check(Loadout.item("melee", "Skana").get("name", "") == "Skana", "Skana loads from melee data")
	check(Loadout.item("warframe", "Excalibur").get("name", "") == "Excalibur", "Excalibur loads from warframe data")
	check(Loadout.item("primary", "Nope").is_empty(), "unknown item returns empty")
	Loadout.equipped["primary"] = "Grakata"
	check(Loadout.equipped_item("primary").get("name", "") == "Grakata", "equipped primary follows the choice")
	Loadout.equipped["primary"] = "Braton"


func test_mod_placement() -> void:
	Mods.installed.clear()
	var redirection := Mods.by_unique("/Lotus/Upgrades/Mods/Utility/RedirectionMod")
	check(redirection.get("name", "") == "Redirection", "Redirection loads from mod data")
	check(Mods.capacity() == 15, "capacity is 15 at mastery rank 0")
	check(Mods.slot_kind("warframe", 0) == Mods.AURA and Mods.slot_kind("warframe", 1) == Mods.EXILUS, "warframe aura and exilus slots")
	check(Mods.slot_kind("primary", 8) == Mods.EXILUS and Mods.slot_kind("primary", 7) == Mods.NORMAL, "weapon exilus is slot 8")
	check(not Mods.install("warframe", 0, redirection), "normal mod is refused in the aura slot")
	check(Mods.install("warframe", 2, redirection), "Redirection installs in a normal slot")
	check(Mods.mod_at("warframe", 2).get("name", "") == "Redirection", "installed mod is read back")
	check(not Mods.install("warframe", 3, redirection), "same mod cannot be installed twice on one item")
	check(Mods.used_capacity("warframe") == Mods.drain(redirection), "capacity counts the installed mod's drain")
	Mods.remove("warframe", 2)
	check(Mods.mod_at("warframe", 2).is_empty(), "remove empties the slot")
	check(Mods.owned_for("warframe").size() >= 1 and Mods.owned_for("primary").is_empty(), "owned mods filter by item type")
	Mods.installed.clear()


func test_mod_effects() -> void:
	var dmg := ModEffects.parse_mod_stat("+15% Damage")
	check(dmg.get("key", "") == "damage" and near(dmg.get("percent", 0.0), 15.0), "damage line parses to damage 15%")
	check(ModEffects.parse_mod_stat("+9% Shields").is_empty(), "frame stat is not a weapon stat")
	check(ModEffects.parse_mod_stat("Not a stat").is_empty(), "text without a percent is ignored")

	var serration := {"compatName": "Primary", "currentRank": 2,
		"levelStats": [{"stats": ["+15% Damage"]}, {"stats": ["+30% Damage"]}, {"stats": ["+45% Damage"]}]}
	check(near(ModEffects.weapon_bonuses([serration], "primary").damage, 30.0), "rank 2 is +30%, not summed")
	check(near(ModEffects.weapon_bonuses([serration], "melee").damage, 0.0), "primary mod does not affect melee")
	serration.currentRank = 0
	check(near(ModEffects.weapon_bonuses([serration], "primary").damage, 0.0), "unranked mod adds nothing to weapons")

	var weapon := {"damage": {"total": 100.0}, "fireRate": 10.0, "magazineSize": 30, "reloadTime": 2.0}
	var bonuses := ModEffects.empty_weapon_bonuses()
	bonuses.damage = 50.0
	bonuses.magazine = 100.0
	var applied := ModEffects.apply_to_weapon(weapon, bonuses)
	check(near(applied.damage.total, 150.0), "damage bonus applies to the base total")
	check(applied.magazineSize == 60, "magazine bonus applies to the base size")
	check(near(weapon.damage.total, 100.0), "apply_to_weapon does not change the original")

	var redirection := Mods.by_unique("/Lotus/Upgrades/Mods/Utility/RedirectionMod")
	var frame := ModEffects.frame_bonuses([redirection])
	check(near(frame.shield, 9.0), "Redirection unranked gives +9% shields")

	Mods.installed.clear()


func test_player_health() -> void:
	# Armor 100 on a player: 100 raw damage less 25% reduction (armor / (armor + 300)) = 75 to health
	var player_hp := HealthComponent.new({"maxHp": 100.0, "maxShield": 0.0, "armor": 100.0}, true)
	player_hp.take_damage(100.0)
	check(near(player_hp.hp, 25.0), "player armor 100 reduces 100 damage to 75")
	# Frame shields absorb first, at half effectiveness
	var shielded := HealthComponent.new({"maxHp": 100.0, "maxShield": 100.0, "armor": 0.0}, true)
	shielded.take_damage(40.0)
	check(near(shielded.shield, 80.0) and near(shielded.hp, 100.0), "player shield absorbs at 50% DR")


func test_shield_recharge() -> void:
	# A partly drained shield waits 1 s after the last hit, then recharges at (15 + 5) = 20 per second
	var p := Player.new()
	p.health = HealthComponent.new({"maxHp": 100.0, "maxShield": 100.0, "armor": 0.0}, true)
	p.health.shield = 50.0
	p.time_since_damage = 0.0
	p.recharge_shield(0.5)
	check(near(p.health.shield, 50.0), "no recharge within the 1 s delay")
	p.recharge_shield(0.6)
	check(near(p.health.shield, 62.0), "partial shield recharges at 20 per second after 1 s")

	# A fully depleted shield waits 4 s before it recharges
	var empty := Player.new()
	empty.health = HealthComponent.new({"maxHp": 100.0, "maxShield": 100.0, "armor": 0.0}, true)
	empty.health.shield = 0.0
	empty.time_since_damage = 0.0
	empty.recharge_shield(3.9)
	check(near(empty.health.shield, 0.0), "depleted shield waits 4 s")
	empty.recharge_shield(0.2)
	check(near(empty.health.shield, 4.0), "depleted shield recharges after 4 s")

	# Magnetic blocks recharge
	var magnetic := Player.new()
	magnetic.health = HealthComponent.new({"maxHp": 100.0, "maxShield": 100.0, "armor": 0.0}, true)
	magnetic.health.shield = 50.0
	magnetic.health.magnetic_timer = 6.0
	magnetic.time_since_damage = 10.0
	magnetic.recharge_shield(1.0)
	check(near(magnetic.health.shield, 50.0), "magnetic blocks shield recharge")
	p.free()
	empty.free()
	magnetic.free()


func test_bleed_out_and_revive() -> void:
	var p := Player.new()
	p.max_hp = 100.0
	p.max_shield = 0.0
	p.max_armor = 0.0
	p.health = HealthComponent.new({"maxHp": 100.0, "maxShield": 0.0, "armor": 0.0}, true)
	check(p.revives_remaining == 4 and p.alive, "player starts with 4 revives and alive")

	# Lethal damage drops to 1 hp and starts the 20 s bleed-out
	p.take_damage(150.0)
	check(p.is_bleeding_out and near(p.health.hp, 1.0), "lethal hit leaves the player bleeding out at 1 hp")
	p.take_damage(50.0)
	check(near(p.health.hp, 1.0), "downed player takes no further damage")

	p._update_downed(1.0)
	check(near(p.bleedout_timer, 19.0), "bleed-out counts down")
	p._complete_self_revive()
	check(not p.is_bleeding_out and near(p.health.hp, 100.0) and p.revives_remaining == 3, "self-revive restores health and spends a revive")

	# Bleed-out timer running out waits for the self-revive
	p.take_damage(150.0)
	p._update_downed(20.0)
	check(p.awaiting_revive and p.is_bleeding_out, "after 20 s the player waits for a self-revive")

	# Out of revives while downed means dead (the downed update ends the run)
	p.revives_remaining = 0
	p._update_downed(0.0)
	check(not p.alive, "bleeding out with no revives left is death")

	# A lethal hit with no revives, while standing, is also death
	var q := Player.new()
	q.health = HealthComponent.new({"maxHp": 100.0, "maxShield": 0.0, "armor": 0.0}, true)
	q.revives_remaining = 0
	q.take_damage(150.0)
	check(not q.alive, "lethal hit with no revives left is death")
	p.free()
	q.free()


func test_survival_waves() -> void:
	check(Game.wave_size(1) == 3, "wave 1 has 3 enemies")
	check(Game.wave_size(2) == 5 and Game.wave_size(3) == 7, "each wave adds 2 enemies")
	check(Game.wave_size(0) == 3, "wave numbers below 1 use the base size")


func test_account_crypto() -> void:
	# FNV-1a 32-bit known values
	check(SaveStorage.checksum("") == "811c9dc5", "checksum of empty text")
	check(SaveStorage.checksum("a") == "e40c292c", "checksum of 'a'")
	# PBKDF2-HMAC-SHA256 published vectors (password, salt, 1 and 2 iterations, 32 bytes)
	var pw := "password".to_utf8_buffer()
	var salt := "salt".to_utf8_buffer()
	check(Marshalls.raw_to_base64(Auth.pbkdf2_sha256(pw, salt, 1)) == Marshalls.raw_to_base64(
		"120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b".hex_decode()), "PBKDF2 vector, 1 iteration")
	check(Marshalls.raw_to_base64(Auth.pbkdf2_sha256(pw, salt, 2)) == Marshalls.raw_to_base64(
		"ae4d0c95af6b46d32d0adff928f06dd02a303f8ef3c251dfd6e2d85a95474c43".hex_decode()), "PBKDF2 vector, 2 iterations")
	# A stored hash checks out with the same password and not with another one
	var stored := Auth.hash_password("flatframe-test", "", 2)
	check(Auth.hash_password("flatframe-test", stored.salt, 2).hash == stored.hash, "same password verifies")
	check(Auth.hash_password("wrong-pass", stored.salt, 2).hash != stored.hash, "wrong password does not verify")


func test_account_sections() -> void:
	# Starting balances come from the browser build's currency definitions
	check(Wallet.starts().get("platinum", -1) == 50 and Wallet.starts().get("credits", -1) == 0, "wallet starts with 50 platinum")
	# Settings defaults are the browser build's exported defaults
	check(Settings.defaults().get("invertY", true) == false, "settings default invertY is false")
	check(Settings.defaults().has("gamepadBindings"), "settings include gamepad bindings")
	# A new frame has 3 configs of 10 empty mod slots, as in player_frames.js
	var frame: Dictionary = PlayerFrames.default_frames().Excalibur
	check(frame.configs.size() == 3 and frame.configs[0].mods.size() == 10, "frame has 3 configs of 10 mod slots")
	check(frame.configs[0].mods[0] == null, "mod slots start empty")


func test_map_generator() -> void:
	# Reference values from the browser's generator (src/missions/generator/tile_generator.js) for these seeds
	var cases := [
		[1, [2016.0, 1920.0], 175, 20, 11, [1680.0, 1200.0], "start,connector,intermediate,objective,exit,spawn,dead end,dead end"],
		[7, [2688.0, 1920.0], 173, 20, 11, [1680.0, 1680.0], "start,intermediate,spawn,intermediate,dead end,objective,dead end,exit"],
		[12345, [4032.0, 960.0], 189, 8, 11, [2352.0, 240.0], "start,connector,intermediate,exit,connector,spawn,intermediate,objective"],
	]
	for c in cases:
		var m := TileGenerator.generate_mission_map(8, c[0])
		var roles: Array = []
		for r in m.rooms:
			roles.append(r.role)
		check(m.bounds.width == c[1][0] and m.bounds.height == c[1][1], "seed %d bounds match the browser" % c[0])
		check(m.walls.size() == c[2], "seed %d wall count matches the browser" % c[0])
		check(m.entities.size() == c[3], "seed %d entity count matches the browser" % c[0])
		check(m.spawnPoints.size() == c[4], "seed %d spawn count matches the browser" % c[0])
		check(m.playerStart.x == c[5][0] and m.playerStart.y == c[5][1], "seed %d player start matches the browser" % c[0])
		check(",".join(roles) == c[6], "seed %d room roles match the browser" % c[0])

func test_earth_weather_rng() -> void:
	# The first values of the browser's seeded generator (seed 7), so the cloud layout is identical
	var rng := EarthMap.Rng.new(7)
	var expected := [0.011704753153, 0.061958257575, 0.976907632779, 0.699028705712, 0.521445268532]
	var ok := true
	for v in expected:
		if absf(rng.next() - v) > 1e-9:
			ok = false
	check(ok, "seeded weather RNG matches the browser values")
	check(EarthMap.make_weather().size() == EarthMap.WEATHER_COUNT + EarthMap.WEATHER_STORMS * EarthMap.WEATHER_STORM_ARMS,
		"weather has the browser's cloud count")


func test_settings_sections() -> void:
	var sections := Settings.sections()
	check(sections.size() == 8, "settings has 8 categories")
	check(sections[0].get("id", "") == "keyboardMouse", "first category is keyboard and mouse")
	var found := false
	for s in sections:
		for item in s.get("items", []):
			if item.get("key", "") == "invertY":
				found = item.get("type", "") == "toggle"
	check(found, "invertY is a toggle row")


func test_enemy_status_ticks() -> void:
	# A toxin proc (damage-over-time) ticks the enemy's health once a second, 50% of the shot's damage
	var e := Enemy.new()
	e.apply_proc({"toxin": 100.0}, 100.0)
	check(e.status.effects.size() == 1, "a toxin proc adds one damage-over-time effect")
	e._process(1.0)
	check(absf(e.hp - (Enemy.MAX_HP - 50.0)) < 0.001, "one toxin tick takes 50 hit points")
	e.free()


func test_hit_zones() -> void:
	var pos := Vector2(100.0, 100.0)
	check(HitZones.hit_zone(pos, 20.0, pos + Vector2(0.0, -12.0)) == "head", "point above centre is head")
	check(HitZones.hit_zone(pos, 20.0, pos + Vector2(0.0, 2.0)) == "body", "point at centre is body")
	check(HitZones.hit_zone(pos, 20.0, pos + Vector2(100.0, 0.0)) == "", "far point misses")
