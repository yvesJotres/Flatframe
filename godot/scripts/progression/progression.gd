class_name Progression
extends RefCounted

# Affinity, item ranks and Mastery Rank. Port of src/progression/progression.js. Affinity is stored per item in the
# active profile (see UserStore). Rules (wiki):
#   - Abilities earn Affinity equal to their base energy cost, all to the Warframe.
#   - Weapon kills split Affinity 50/50 between the Warframe and the weapon.
#   - Mastery Rank total XP = 2,500 × rank², capped at MR 30. Each new item level adds mastery points:
#     200 for Warframes, 100 for weapons.

const ITEM_MAX_RANK := 30
const MASTERY_MAX_RANK := 30
const WEAPON_KILL_WARFRAME_SHARE := 0.5
const MASTERY_POINTS_PER_LEVEL := {"frame": 200, "weapon": 100}

# Base Affinity per enemy, from each enemy's wiki infobox. Enemies not listed give no Affinity.
const ENEMY_BASE_AFFINITY := {
	"Crewman": 50, "Lancer": 50, "Butcher": 50, "Trooper": 100, "Shield Osprey": 50,
	"Charger": 50, "Leaper": 35, "Runner": 35, "MOA": 50,
}


static func mastery_xp_for_rank(rank: int) -> int:
	return 2500 * rank * rank


# Highest mastery rank (capped at MR 30) whose total XP is reached
static func mastery_rank_from_xp(xp: int) -> int:
	var rank := 0
	while rank < MASTERY_MAX_RANK and xp >= mastery_xp_for_rank(rank + 1):
		rank += 1
	return rank


# Total Affinity needed to reach an item rank
static func affinity_for_item_rank(rank: int, kind: String) -> float:
	var base := 1000.0 * rank * rank
	return base / 2.0 if kind == "weapon" else base


# Highest item rank (capped at 30) reached with this much Affinity
static func item_rank_from_affinity(xp: float, kind: String) -> int:
	var rank := 0
	while rank < ITEM_MAX_RANK and xp >= affinity_for_item_rank(rank + 1, kind):
		rank += 1
	return rank


static func affinity_of(item_name: String) -> float:
	return float(_profile().get("affinity", {}).get(item_name, 0.0))


static func item_rank_of(item_name: String, kind: String) -> int:
	return item_rank_from_affinity(affinity_of(item_name), kind)


# Rank and progress toward the next rank (0..1) for an item's bar
static func item_progress_of(item_name: String, kind: String) -> Dictionary:
	var xp := affinity_of(item_name)
	var rank := item_rank_from_affinity(xp, kind)
	if rank >= ITEM_MAX_RANK:
		return {"rank": rank, "xp": 1.0}
	var from := affinity_for_item_rank(rank, kind)
	var to := affinity_for_item_rank(rank + 1, kind)
	return {"rank": rank, "xp": (xp - from) / (to - from)}


# Adds Affinity to one item and returns its new total. Each item level gained adds mastery points, and Mastery Rank
# follows the total. kind is "frame" or "weapon".
static func add_affinity(item_name: String, amount: float, kind: String) -> float:
	if item_name == "" or amount <= 0.0:
		return 0.0
	var profile := _profile()
	var affinity: Dictionary = profile.get("affinity", {}).duplicate()
	var before := item_rank_from_affinity(float(affinity.get(item_name, 0.0)), kind)
	affinity[item_name] = float(affinity.get(item_name, 0.0)) + amount
	var after := item_rank_from_affinity(float(affinity[item_name]), kind)
	var gained := maxi(0, after - before)
	var points: int = int(profile.get("masteryPoints", 0)) + gained * int(MASTERY_POINTS_PER_LEVEL[kind])
	UserStore.save_profile(UserStore.active_id(), {
		"affinity": affinity,
		"masteryPoints": points,
		"masteryRank": mastery_rank_from_xp(points),
	})
	return float(affinity[item_name])


# Affinity for one kill: base × (1 + 0.1425 × √level) (Spanish Warframe Fandom, Affinity page)
static func kill_affinity(enemy_name: String, level: int) -> float:
	var base := float(ENEMY_BASE_AFFINITY.get(enemy_name, 0))
	return base * (1.0 + 0.1425 * sqrt(maxf(1.0, float(level))))


# A kill made with a weapon: half to the Warframe, half to the weapon
static func award_weapon_kill(frame_name: String, weapon_name: String, amount: float) -> void:
	add_affinity(frame_name, amount * WEAPON_KILL_WARFRAME_SHARE, "frame")
	add_affinity(weapon_name, amount * (1.0 - WEAPON_KILL_WARFRAME_SHARE), "weapon")


# Awards Affinity for a weapon kill. Returns the amount awarded (0 for an enemy with no base Affinity).
static func award_kill(enemy_name: String, level: int, frame_name: String, weapon_name: String) -> float:
	var amount := kill_affinity(enemy_name, level)
	if amount <= 0.0:
		return 0.0
	award_weapon_kill(frame_name, weapon_name, amount)
	return amount


static func _profile() -> Dictionary:
	return UserStore.get_profile(UserStore.active_id())
