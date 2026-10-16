class_name MissionContainer
extends RefCounted

# A breakable storage container (port of Container in src/pickups/lootable.js). It is solid, takes damage from shots
# and melee, and drops loot when it breaks. Region resources are not ported yet (they need the region tables).

const HP := {"common": 30.0, "uncommon": 40.0, "rare": 60.0, "reinforced": 150.0}   # placeholders from the browser
const RESOURCE_ROLLS := {"common": 1, "uncommon": 2, "rare": 3, "reinforced": 4}
const ITEM_ROLLS := {"common": [0, 3], "uncommon": [1, 3], "rare": [3, 3], "reinforced": [4, 4]}
const CREDIT_RANGE := {"common": [20, 60], "uncommon": [40, 100], "rare": [150, 400], "reinforced": [400, 1000]}
const ITEM_WEIGHTS := [["credits", 0.25], ["ammo", 0.2], ["secondary_ammo", 0.2], ["energy", 0.15], ["health", 0.2]]
const ENDO_ORB := 80

var rect: Rect2
var kind: String
var max_hp: float
var hp: float
var flash := 0.0


func _init(entity: Dictionary) -> void:
	rect = Rect2(entity.x, entity.y, entity.w, entity.h)
	kind = str(entity.get("kind", "common"))
	max_hp = float(HP.get(kind, HP.common))
	hp = max_hp


func centre() -> Vector2:
	return rect.get_center()


func broken() -> bool:
	return hp <= 0.0


func take_damage(amount: float) -> void:
	hp -= amount
	flash = 0.1


# The loot this container gives when it breaks: [{type, amount, pos}]. Items fall around the container's centre.
func roll_drops() -> Array:
	var drops: Array = []
	var c := centre()
	var lo: int = ITEM_ROLLS.get(kind, ITEM_ROLLS.common)[0]
	var hi: int = ITEM_ROLLS.get(kind, ITEM_ROLLS.common)[1]
	var count := randi_range(lo, hi)
	var credits: Array = CREDIT_RANGE.get(kind, CREDIT_RANGE.common)
	for i in range(count):
		var type := _pick_item()
		var amount := randi_range(int(credits[0]), int(credits[1])) if type == "credits" else 1
		drops.append({"type": type, "amount": amount, "pos": c + _spot()})
	if kind == "rare" or kind == "reinforced":
		drops.append({"type": "endo", "amount": ENDO_ORB, "pos": c + _spot()})
	return drops


func _spot() -> Vector2:
	return Vector2((randf() - 0.5) * 40.0, (randf() - 0.5) * 40.0)


func _pick_item() -> String:
	var total := 0.0
	for entry in ITEM_WEIGHTS:
		total += float(entry[1])
	var roll := randf() * total
	for entry in ITEM_WEIGHTS:
		roll -= float(entry[1])
		if roll <= 0.0:
			return str(entry[0])
	return str(ITEM_WEIGHTS[0][0])
