class_name SquadData
extends RefCounted
## Port of the data half of java_build/src/ui/squad.js: the members, the
## matchmaking mode, and the limits. Kept in memory for now. The browser saved
## this on the user's profile, which is ported later with the accounts.

const MAX_SQUAD := 4
const MAX_NAME := 16

# Who can join matchmaking. The glyphs are text symbols until real icon art exists.
const MATCHMAKING_MODES := [
	{"id": "public", "label": "PUBLIC", "glyph": "🌐"},
	{"id": "friends", "label": "FRIENDS ONLY", "glyph": "☺"},
	{"id": "clan", "label": "CLAN ONLY", "glyph": "⛨"},
	{"id": "invite", "label": "INVITE ONLY", "glyph": "✉"},
	{"id": "solo", "label": "SOLO", "glyph": "👤"},
]

# Placeholder until the user profile is ported
static var player_name := "Tenno"
static var mode_id := "public"
static var invited: Array = []


static func get_mode() -> Dictionary:
	for m in MATCHMAKING_MODES:
		if m["id"] == mode_id:
			return m
	return MATCHMAKING_MODES[0]


static func set_mode(new_id: String) -> bool:
	for m in MATCHMAKING_MODES:
		if m["id"] == new_id:
			mode_id = new_id
			return true
	return false


# You first, then the members you invited
static func get_members() -> Array:
	var members := [{"id": "you", "name": player_name, "you": true}]
	members.append_array(invited)
	return members


# Returns {ok: true, member} or {ok: false, error}
static func invite(member_name: String) -> Dictionary:
	var clean := member_name.strip_edges()
	if clean == "":
		return {"ok": false, "error": "Enter a name first"}
	if clean.length() > MAX_NAME:
		return {"ok": false, "error": "Names can be up to %d characters" % MAX_NAME}
	var members := get_members()
	if members.size() >= MAX_SQUAD:
		return {"ok": false, "error": "A squad holds up to %d players" % MAX_SQUAD}
	for m in members:
		if String(m["name"]).to_lower() == clean.to_lower():
			return {"ok": false, "error": "%s is already in your squad" % clean}
	var member := {"id": "m%d" % Time.get_ticks_usec(), "name": clean, "you": false}
	invited.append(member)
	return {"ok": true, "member": member}


static func remove_member(member_id: String) -> bool:
	for i in invited.size():
		if invited[i]["id"] == member_id:
			invited.remove_at(i)
			return true
	return false
