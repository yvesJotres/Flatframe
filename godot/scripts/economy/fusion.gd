class_name Fusion
extends RefCounted

# Mod fusion: spends Endo and Credits to raise an owned mod one rank. Port of src/economy/fusion.js, with the default
# cost tables from src/mods/mod.js (used when a mod has no costs of its own).

const ENDO_PER_RANK := [0, 500, 1500, 3500, 7000, 12500, 20000, 30000, 42500, 57500, 75000]
const CREDITS_PER_RANK := [0, 1000, 3000, 6000, 10000, 15000, 21000, 28000, 36000, 45000, 55000]
const MAX_RANK := 10


# The Endo and Credits the next rank costs. Zero at the top rank.
static func cost_to_next_rank(current_rank: int) -> Dictionary:
	if current_rank >= MAX_RANK:
		return {"endo": 0, "credits": 0}
	return {"endo": ENDO_PER_RANK[current_rank + 1], "credits": CREDITS_PER_RANK[current_rank + 1]}


# Raises an owned mod one rank when the player can pay both costs (returns true), or changes nothing (false)
static func fuse(unique: String, profile_id: String) -> bool:
	var rank := int(Mods.owned_ranks.get(unique, -1))
	if rank < 0 or rank >= MAX_RANK:
		return false
	var cost := cost_to_next_rank(rank)
	if not Wallet.spend(profile_id, {"endo": cost.endo, "credits": cost.credits}):
		return false
	Mods.owned_ranks[unique] = rank + 1
	return true
