class_name Auth
extends RefCounted

# Sign-in for the profiles on this device. Port of src/user/auth.js.
# Passwords are salted and hashed with PBKDF2-HMAC-SHA256 (100,000 iterations). Accounts live on this device
# only, so this stops casual switching but is not a server-side login.

const SESSION_PATH := "user://session.json"
const ITERATIONS := 100000
const MIN_PASSWORD_LENGTH := 4

# The session when "Auto login" is off: it lasts until the game closes (sessionStorage in the browser build)
static var _tab_session_id := ""


# PBKDF2 with HMAC-SHA256. Keys of up to 32 bytes, one output block (the only size the game uses).
static func pbkdf2_sha256(password: PackedByteArray, salt: PackedByteArray, iterations: int) -> PackedByteArray:
	var crypto := Crypto.new()
	var block := salt + PackedByteArray([0, 0, 0, 1])
	var u := crypto.hmac_digest(HashingContext.HASH_SHA256, password, block)
	var t := u.duplicate()
	for _i in range(1, iterations):
		u = crypto.hmac_digest(HashingContext.HASH_SHA256, password, u)
		for j in range(t.size()):
			t[j] = t[j] ^ u[j]
	return t


# { salt, hash, iterations } as base64 text, the same shape the browser build stores under profile.auth
static func hash_password(password: String, salt_b64: String = "", iterations: int = ITERATIONS) -> Dictionary:
	var salt: PackedByteArray
	if salt_b64 == "":
		salt = Crypto.new().generate_random_bytes(16)
	else:
		salt = Marshalls.base64_to_raw(salt_b64)
	var derived := pbkdf2_sha256(password.to_utf8_buffer(), salt, iterations)
	return {
		"salt": Marshalls.raw_to_base64(salt),
		"hash": Marshalls.raw_to_base64(derived),
		"iterations": iterations,
	}


# Returns { ok: true, id } or { ok: false, error }. An account with no password sets it on its first sign-in.
static func sign_in(id: String, password: String, remember: bool = true) -> Dictionary:
	var profile := UserStore.get_profile(id)
	if profile.is_empty():
		return {"ok": false, "error": "No such user"}
	var auth: Dictionary = profile.get("auth", {})
	if auth.is_empty():
		if password.length() < MIN_PASSWORD_LENGTH:
			return {"ok": false, "error": "Set a password first: password must be at least %d characters" % MIN_PASSWORD_LENGTH}
		UserStore.save_profile(id, {"auth": hash_password(password)})
	else:
		var again := hash_password(password, auth.salt, int(auth.get("iterations", ITERATIONS)))
		if again.hash != auth.hash:
			return {"ok": false, "error": "Wrong password"}
	sign_out()
	if remember:
		_write_session(id)
	else:
		_tab_session_id = id
	UserStore.set_active(id)
	return {"ok": true, "id": id}


static func sign_out() -> void:
	_tab_session_id = ""
	if FileAccess.file_exists(SESSION_PATH):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(SESSION_PATH))


# The signed-in profile's id, or "" when nobody is signed in
static func signed_in_id() -> String:
	if _tab_session_id != "" and not UserStore.get_profile(_tab_session_id).is_empty():
		return _tab_session_id
	if FileAccess.file_exists(SESSION_PATH):
		var parsed = JSON.parse_string(FileAccess.get_file_as_string(SESSION_PATH))
		if parsed is Dictionary and not UserStore.get_profile(str(parsed.get("id", ""))).is_empty():
			return parsed.id
	return ""


static func is_signed_in() -> bool:
	return signed_in_id() != ""


static func _write_session(id: String) -> void:
	var f := FileAccess.open(SESSION_PATH, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify({"id": id}))
