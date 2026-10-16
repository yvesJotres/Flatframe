class_name UserStore
extends RefCounted

# Player profiles on this device. Port of src/user/user_data.js (storage) and src/user/accounts.js.
# The browser build keeps these in localStorage; the Godot build keeps them in user://users.json.
# Stored data is not shared with the browser build.

const STORE_PATH := "user://users.json"
const ADMIN_NAME := "Admin"
const MAX_NAME_LENGTH := 16

# Fields a profile can have, with the value a new profile starts with (user_data.js DEFAULT_FIELDS)
const DEFAULT_FIELDS := {
	"displayName": "Tenno",
	"masteryRank": 0,
	"completedNodes": [],
	"unlockedPlanets": ["Earth"],
	"loadout": {},
	"squad": {"mode": "public", "invited": []},
	"affinity": {},
	"masteryPoints": 0,
}


# { activeId, profiles: { id: fields } }. The first run creates one profile.
static func read() -> Dictionary:
	if FileAccess.file_exists(STORE_PATH):
		var parsed = JSON.parse_string(FileAccess.get_file_as_string(STORE_PATH))
		if parsed is Dictionary and parsed.get("profiles") is Dictionary and not parsed.profiles.is_empty():
			return parsed
	var id := _new_id()
	var store := {"activeId": id, "profiles": {id: DEFAULT_FIELDS.duplicate(true)}}
	write(store)
	return store


static func write(store: Dictionary) -> void:
	var f := FileAccess.open(STORE_PATH, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(store))


static func _new_id() -> String:
	return "local-%d-%d" % [Time.get_unix_time_from_system(), randi()]


static func get_profile(id: String) -> Dictionary:
	return read().profiles.get(id, {})


# Writes the given fields into a profile, keeping the rest (including its password data)
static func save_profile(id: String, fields: Dictionary) -> void:
	var store := read()
	if not store.profiles.has(id):
		return
	var merged: Dictionary = store.profiles[id]
	merged.merge(fields, true)
	store.profiles[id] = merged
	write(store)


# Returns { ok, id } or { ok, error }, as accounts.js createUser
static func create_user(display_name: String) -> Dictionary:
	var name := display_name.strip_edges()
	if name == "":
		return {"ok": false, "error": "Enter a name first"}
	if name.length() > MAX_NAME_LENGTH:
		return {"ok": false, "error": "Names can be up to %d characters" % MAX_NAME_LENGTH}
	var id := _new_id()
	var store := read()
	var fields := DEFAULT_FIELDS.duplicate(true)
	fields.displayName = name
	store.profiles[id] = fields
	write(store)
	return {"ok": true, "id": id}


static func admin_user_id() -> String:
	var store := read()
	for id in store.profiles:
		if store.profiles[id].get("displayName", "") == ADMIN_NAME:
			return id
	return ""


# The admin account is created once and sets its password on first sign-in
static func ensure_admin() -> void:
	if admin_user_id() == "":
		create_user(ADMIN_NAME)


# Case-insensitive lookup by display name, "" when there is no such user
static func user_id_by_name(name: String) -> String:
	var wanted := name.strip_edges().to_lower()
	if wanted == "":
		return ""
	var store := read()
	for id in store.profiles:
		if str(store.profiles[id].get("displayName", "")).to_lower() == wanted:
			return id
	return ""


static func active_id() -> String:
	return read().get("activeId", "")


static func set_active(id: String) -> bool:
	var store := read()
	if not store.profiles.has(id):
		return false
	store.activeId = id
	write(store)
	return true
