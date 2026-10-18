class_name Wallet
extends RefCounted
## Port of the balances half of java_build/src/economy/wallet.js. Kept in
## memory for now: the browser saved them in localStorage per profile, which
## comes back with the accounts port. A new wallet starts with each currency's
## start amount (50 Platinum, nothing else).

static var balances := {}


static func _ensure() -> void:
	if not balances.is_empty():
		return
	for currency in Currencies.DEFS:
		balances[currency] = Currencies.DEFS[currency]["start"]


static func get_balance(currency: String) -> int:
	_ensure()
	assert(Currencies.DEFS.has(currency), "Unknown currency: %s" % currency)
	return balances[currency]


# Display text for a balance, such as "250,000"
static func format(currency: String) -> String:
	return Currencies.format_amount(currency, get_balance(currency))


# costs: {"credits": 500, "platinum": 2}
static func can_afford(costs: Dictionary) -> bool:
	for currency in costs:
		if get_balance(currency) < costs[currency]:
			return false
	return true


static func add(currency: String, amount: int) -> void:
	assert(amount > 0, "Amount must be a positive whole number: %d" % amount)
	balances[currency] = get_balance(currency) + amount


# Takes every cost or nothing. Returns false when the player can't afford it.
static func spend(costs: Dictionary) -> bool:
	if not can_afford(costs):
		return false
	for currency in costs:
		balances[currency] = get_balance(currency) - int(costs[currency])
	return true
