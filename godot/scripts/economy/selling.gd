class_name Selling
extends RefCounted

# Selling rules, from the Warframe wiki's Credits page (port of src/economy/selling.js). Rules only: there is no
# sale price yet.

const SELLABLE_KINDS := ["mod", "weapon", "warframe", "sentinel", "bossSigil", "titanExtractor", "blueprint"]
const UNSELLABLE_KINDS := ["resource", "appearance", "voidKey", "lens"]
# Investments an item loses when sold. Mastery earned from Affinity is kept.
const INVESTMENTS_LOST_ON_SALE := ["reactorOrCatalyst", "formaPolarities", "exilusAdapter", "focusLens"]


static func can_sell(kind: String) -> bool:
	return SELLABLE_KINDS.has(kind)
