class_name SaveStorage
extends RefCounted

# Crash-safe save on this device. Port of src/account/storage.js.
# Two slots are written alternately: a new save never overwrites the last good one, and a save only counts as
# done after it reads back with a matching checksum.

const SLOT_PATHS := ["user://save_a.json", "user://save_b.json"]
const VERSION := 1

static var _last_seq := 0


# FNV-1a over the UTF-8 bytes: enough to catch a torn or corrupted write
static func checksum(text: String) -> String:
	var hash_value := 0x811c9dc5
	for b in text.to_utf8_buffer():
		hash_value = ((hash_value ^ b) * 0x01000193) & 0xffffffff
	return "%08x" % hash_value


# { seq, payload } for a slot that reads back intact, or {}
static func _read_slot(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		return {}
	var slot = JSON.parse_string(FileAccess.get_file_as_string(path))
	if not (slot is Dictionary) or int(slot.get("version", 0)) != VERSION or not (slot.get("payload") is String):
		return {}
	if checksum(slot.payload) != str(slot.get("checksum", "")):
		return {}   # torn or corrupted
	return {"seq": int(slot.get("seq", 0)), "payload": slot.payload}


# The newest intact slot, or {}
static func load_newest() -> Dictionary:
	var best := {}
	for path in SLOT_PATHS:
		var s := _read_slot(path)
		if not s.is_empty() and (best.is_empty() or s.seq > best.seq):
			best = s
	return best


# Writes the sections. Returns true only when the slot reads back intact.
static func write(sections: Dictionary) -> bool:
	var payload := JSON.stringify(sections)
	var seq := maxi(_last_seq, int(load_newest().get("seq", 0))) + 1
	var path: String = SLOT_PATHS[seq % 2]
	var content := JSON.stringify({"version": VERSION, "seq": seq, "checksum": checksum(payload), "payload": payload})
	var f := FileAccess.open(path, FileAccess.WRITE)
	if f == null:
		return false   # the previous slot still holds the last good save
	f.store_string(content)
	f.close()
	var check := _read_slot(path)
	if check.is_empty() or check.seq != seq:
		return false
	_last_seq = seq
	return true


# The sections from the newest save, or {} on a first run
static func read() -> Dictionary:
	var newest := load_newest()
	if newest.is_empty():
		return {}
	_last_seq = newest.seq
	var parsed = JSON.parse_string(newest.payload)
	return parsed if parsed is Dictionary else {}
