extends SceneTree

# Checks that Exterminate ends in a win and in a loss, by driving the mission state directly.
# Run headless from the godot/ folder:
#   godot --headless -s res://tests/mission_flow_test.gd

var passes := 0
var failures := 0
var game: Game
var step := 0


func _initialize() -> void:
	Game.pending_mission = "exterminate"
	game = load("res://scenes/main.tscn").instantiate()
	root.add_child(game)


func check(condition: bool, label: String) -> void:
	if condition:
		passes += 1
	else:
		failures += 1
		print("FAIL: ", label)


func _process(_delta: float) -> bool:
	step += 1
	# Let the scene start, then run each scenario in turn
	if step == 3:
		check(game.state == "running", "mission starts running")
		check(game.kills == 0 and Game.KILL_QUOTA == 33, "mission starts at 0 of 33 kills")
		game.kills = Game.KILL_QUOTA
		# Melee: an enemy in front, inside the arc and reach, takes a hit; one behind does not
		game.player.aim_dir = Vector2.RIGHT
		game.player.melee_cooldown = 0.0
		var front: Enemy = Enemy.new()
		front.position = game.player.position + Vector2(30.0, 0.0)
		game.add_child(front)
		var behind: Enemy = Enemy.new()
		behind.position = game.player.position + Vector2(-30.0, 0.0)
		game.add_child(behind)
		var hits: int = game.player.melee_swing()
		check(hits == 1, "a melee swing hits the enemy in front and not the one behind")
		check(front.hp < Enemy.MAX_HP and behind.hp == Enemy.MAX_HP, "the front enemy takes melee damage")
		front.queue_free()
		behind.queue_free()
		# Pathing: an enemy gets a route across the generated map to a reachable spot
		var walker: Enemy = Enemy.new()
		walker.nav = game.nav
		walker.position = game.player.position
		var goal: Vector2 = game.player.position + Vector2(200.0, 0.0)
		var route: Array = walker._route_to(goal)
		check(game.nav.is_in_boundsv(Vector2i(floori(goal.x / 96.0), floori(goal.y / 96.0))), "the route goal is on the map")
		check(route.size() > 0 or game.is_blocked(goal, 1.0), "a reachable spot has a route")
		walker.free()
		# Grenade: a blast damages an enemy close to it
		var near_enemy: Enemy = Enemy.new()
		near_enemy.position = game.player.position + Vector2(40.0, 0.0)
		game.add_child(near_enemy)
		var nade: Grenade = Grenade.new()
		nade.position = game.player.position
		game.add_child(nade)
		nade._explode()
		check(near_enemy.hp < Enemy.MAX_HP, "a grenade blast damages an enemy close to it")
		near_enemy.queue_free()
		# Crewman: corpus health from the scaling table, and an enemy grenade hurts the Warframe
		var crew := CrewmanEnemy.new()
		game.add_child(crew)
		check(crew.max_hp == 90.0 and crew.hp == 90.0, "a crewman has 90 health at level 1")
		crew.queue_free()
		# Knockdown: a heavy hit drops an enemy, a downed enemy takes a ground finisher, and it gets up after 8 s
		var downed: Enemy = Enemy.new()
		downed.position = game.player.position + Vector2(30.0, 0.0)
		game.add_child(downed)
		downed.knock_down()
		check(downed.is_downed(), "a knocked-down enemy is downed")
		game.player.aim_dir = Vector2.RIGHT
		game.player.melee_cooldown = 0.0
		game.player.melee_swing()
		check(downed.dead or downed.hp < Enemy.MAX_HP, "a ground finisher deals its true damage to a downed enemy")
		downed.queue_free()
		var scaled := CrewmanEnemy.new()
		scaled.level = 5
		game.add_child(scaled)
		check(scaled.max_hp == Scaling.scale_stat_by_faction(90.0, 5, "hp", "corpus") and scaled.max_hp > 90.0, "a level 5 crewman has scaled health")
		scaled.queue_free()
		# Every faction unit takes its browser health and armour, scaled at level 1
		for unit_name in EnemyUnits.UNITS:
			var unit: UnitEnemy = EnemyUnits.create(unit_name)
			game.add_child(unit)
			var data: Dictionary = EnemyUnits.UNITS[unit_name]
			var want_hp := Scaling.scale_stat_by_faction(data.hp, 1, "hp", data.faction)
			var want_armor := Scaling.scale_stat_by_faction(data.armor, 1, "armor", data.faction)
			check(unit.max_hp == want_hp and unit.armor == want_armor, "%s has its browser health and armour" % unit_name)
			unit.queue_free()
		var before: float = game.player.health.hp + game.player.health.shield
		var enemy_nade: Grenade = Grenade.new()
		enemy_nade.position = game.player.position
		enemy_nade.from_enemy = true
		game.add_child(enemy_nade)
		enemy_nade._explode()
		check(game.player.health.hp + game.player.health.shield < before, "an enemy grenade damages the Warframe")
	elif step == 5:
		check(game.state == "won", "reaching the kill quota wins the mission")
		print("win scenario: state=", game.state)
		game.queue_free()
		game = load("res://scenes/main.tscn").instantiate()
		root.add_child(game)
	elif step == 8:
		check(game.state == "running", "second mission starts running")
		game.player.revives_remaining = 0
		# An empty shield with no gate running lets the hit reach health (a broken shield gates the first hit)
		game.player.health.shield = 0.0
		game.player.health.shield_gate_timer = 0.0
		game.player.health.shield_gate_invulnerable = false
		game.player.take_damage(100000.0)
	elif step == 10:
		check(game.state == "lost", "dying with no revives loses the mission")
		print("loss scenario: state=", game.state)
		print("%d passed, %d failed" % [passes, failures])
		quit(1 if failures > 0 else 0)
		return true
	return false
