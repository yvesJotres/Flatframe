class_name Wallet
extends RefCounted

# Player currencies, kept per profile. Port of src/economy/wallet.js (storage and spending).
# Balances are whole numbers. The browser build keeps them in localStorage under the profile ID; here they are
# in user://wallets.json under the same ID. Starting balances come from godot/data/currency_starts.json.

const STORE_PATH := "user://wallets.json"
const STARTS_PATH := "res://data/currency_starts.json"


static func starts() -> Dictionary:
	var parsed = JSON.parse_string(FileAccess.get_file_as_string(STARTS_PATH))
	return parsed if parsed is Dictionary else {}


static func _store() -> Dictionary:
	if not FileAccess.file_exists(STORE_PATH):
		return {}
	var parsed = JSON.parse_string(FileAccess.get_file_as_string(STORE_PATH))
	return parsed if parsed is Dictionary else {}


static func _write(store: Dictionary) -> void:
	var f := FileAccess.open(STORE_PATH, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(store))


# One profile's balances. Missing or broken values fall back to the starting balance.
static func balances(profile_id: String) -> Dictionary:
	var out := starts()
	var saved: Dictionary = _store().get(profile_id, {})
	for currency in out:
		var v = saved.get(currency, null)
		if (v is int or v is float) and v >= 0 and is_equal_approx(v, roundf(v)):
			out[currency] = int(v)
	return out


static func set_balances(profile_id: String, balances_value: Dictionary) -> void:
	var store := _store()
	store[profile_id] = balances_value.duplicate()
	_write(store)


static func amount(profile_id: String, currency: String) -> int:
	return int(balances(profile_id).get(currency, 0))


static func add(profile_id: String, currency: String, value: int) -> bool:
	var bal := balances(profile_id)
	if value <= 0 or not bal.has(currency):
		return false
	bal[currency] = int(bal[currency]) + value
	set_balances(profile_id, bal)
	return true


# Takes every cost or nothing. Returns false when the profile can't afford it.
static func spend(profile_id: String, costs: Dictionary) -> bool:
	var bal := balances(profile_id)
	for currency in costs:
		if not bal.has(currency) or int(bal[currency]) < int(costs[currency]):
			return false
	for currency in costs:
		bal[currency] = int(bal[currency]) - int(costs[currency])
	set_balances(profile_id, bal)
	return true
