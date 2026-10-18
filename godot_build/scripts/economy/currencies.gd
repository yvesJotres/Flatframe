class_name Currencies
extends RefCounted
## Port of java_build/src/economy/currencies.js. Currency definitions, taken
## from the Warframe wiki pages for Credits, Platinum, Endo and Currencies.
##
## kind:       "evergreen" currencies, or a "resource" that is spent like a currency
## start:      what a new player begins with
## tradeable:  only set where the wiki states it
## displayCap: the UI shows at most this amount (the balance itself is not capped)

const DEFS := {
	# Evergreen currencies
	"credits": {"name": "Credits", "kind": "evergreen", "start": 0, "displayCap": 999999999,
		"uses": "Blueprints, equipment, Foundry crafting, mod fusion and transmutation"},
	"ducats": {"name": "Orokin Ducats", "kind": "evergreen", "start": 0, "uses": "Baro Ki'Teer, the Void Trader"},
	"platinum": {"name": "Platinum", "kind": "evergreen", "start": 50, "tradeable": true,
		"uses": "Inventory slots, Market purchases, renaming, rushing Foundry crafting"},
	"standing": {"name": "Standing", "kind": "evergreen", "start": 0, "uses": "Syndicate rewards"},
	"nightwaveCred": {"name": "Nightwave Cred", "kind": "evergreen", "start": 0, "uses": "Nightwave rewards"},
	"aya": {"name": "Aya", "kind": "evergreen", "start": 0, "uses": "Varzia"},
	"regalAya": {"name": "Regal Aya", "kind": "evergreen", "start": 0, "tradeable": false, "uses": "Varzia and Prime Resurgence"},

	# Resources that act as currency
	"endo": {"name": "Endo", "kind": "resource", "start": 0, "tradeable": false, "uses": "Fusing mods to raise their rank"},
	"focus": {"name": "Focus Points", "kind": "resource", "start": 0, "uses": "Unlocking Ways"},
	"kuva": {"name": "Kuva", "kind": "resource", "start": 0, "uses": "Rerolling Riven Mods"},
	"voidTraces": {"name": "Void Traces", "kind": "resource", "start": 0, "uses": "Upgrading Void Relics"},

	# Earth region resources (dropped by enemies)
	"ferrite": {"name": "Ferrite", "kind": "resource", "start": 0, "uses": "Earth region resource"},
	"rubedo": {"name": "Rubedo", "kind": "resource", "start": 0, "uses": "Earth region resource"},
	"neurodes": {"name": "Neurodes", "kind": "resource", "start": 0, "uses": "Earth region resource"},
	"detonite_ampule": {"name": "Detonite Ampule", "kind": "resource", "start": 0, "uses": "Earth region resource"},
}

# Currencies shown in the top bar, in order
const DISPLAY_CURRENCIES := ["credits", "platinum", "endo"]

# Endo dropped by a slain enemy comes in orbs of these sizes
const ENDO_ORB_VALUES := [15, 50, 80]


# Whether the wiki says the currency can be traded. Unknown or untradeable currencies return false.
static func is_tradeable(currency: String) -> bool:
	return DEFS.get(currency, {}).get("tradeable", false) == true


# "250,000", capped at the currency's display limit (999,999,999 for Credits)
static func format_amount(currency: String, value: int) -> String:
	var cap: int = DEFS.get(currency, {}).get("displayCap", value)
	return _with_commas(mini(value, cap))


static func _with_commas(value: int) -> String:
	var digits := str(absi(value))
	var out := ""
	for i in digits.length():
		if i > 0 and (digits.length() - i) % 3 == 0:
			out += ","
		out += digits[i]
	return ("-" if value < 0 else "") + out
