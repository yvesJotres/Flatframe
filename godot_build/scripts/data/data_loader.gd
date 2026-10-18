extends Node
## Port of java_build/src/data/data_loader.js. Registered as the autoload
## `DataLoader`, so any script can call DataLoader.get_item(...).
## Loads index.json first, then reads each category's chunk file on demand
## and caches it. Data lives under res://data, the equivalent of /src/data.
## Where the JS throws, this port logs with push_error and returns null or an
## empty array, because GDScript has no exceptions.

const BASE_PATH := "res://data"

var index = null
var chunk_cache := {}


func _read_json(path: String):
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return null
	return JSON.parse_string(file.get_as_text())


func load_index():
	if index != null:
		return index
	index = _read_json("%s/index.json" % BASE_PATH)
	if index == null:
		push_error("[dataLoader] Failed to load index")
	return index


func load_chunk(type: String, chunk_name: String):
	var key := "%s/%s" % [type, chunk_name]
	if chunk_cache.has(key):
		return chunk_cache[key]
	var chunk = _read_json("%s/%s/chunks/%s.json" % [BASE_PATH, type, chunk_name])
	if chunk == null:
		push_error("[dataLoader] Failed to load chunk %s" % key)
		return null
	chunk_cache[key] = chunk
	return chunk


# Get all items of a type (loads all chunks - use sparingly)
func get_all(type: String) -> Array:
	var idx = load_index()
	if idx == null:
		return []
	if not idx.has(type):
		push_error("[dataLoader] Unknown data type: %s" % type)
		return []
	var chunk_names := {}
	for item in idx[type]:
		chunk_names[item["chunk"]] = true
	var all := []
	for chunk_name in chunk_names.keys():
		var data = load_chunk(type, chunk_name)
		if data != null:
			all.append_array(data)
	return all


# Get items by category chunk (what UI uses)
func get_by_chunk(type: String, chunk_name: String):
	return load_chunk(type, chunk_name)


# Search/filter using index only (no chunk loads)
func search(type: String, filter: Dictionary) -> Array:
	var idx = load_index()
	if idx == null:
		return []
	if not idx.has(type):
		push_error("[dataLoader] Unknown data type: %s" % type)
		return []
	var result := []
	for item in idx[type]:
		if _text_filter_fails(filter, item):
			continue
		if _field_filter_fails(filter, item):
			continue
		if filter.has("masteryReq") and item.get("masteryReq") != null and item["masteryReq"] > filter["masteryReq"]:
			continue
		var wanted_tags: Array = filter.get("tags", [])
		if wanted_tags.size() > 0 and not _shares_any(wanted_tags, item.get("tags", [])):
			continue
		result.append(item)
	return result


func _text_filter_fails(filter: Dictionary, item: Dictionary) -> bool:
	var wanted: String = filter.get("name", "")
	return wanted != "" and not String(item.get("name", "")).to_lower().contains(wanted.to_lower())


func _field_filter_fails(filter: Dictionary, item: Dictionary) -> bool:
	for key in ["type", "chunk", "category", "rarity", "compatName"]:
		var wanted = filter.get(key)
		if wanted != null and wanted != "" and item.get(key) != wanted:
			return true
	return false


func _shares_any(wanted: Array, have: Array) -> bool:
	for tag in wanted:
		if have.has(tag):
			return true
	return false


# Get single item by name (loads its chunk)
func get_item(type: String, item_name: String):
	var idx = load_index()
	if idx == null:
		return null
	var entry = null
	for candidate in idx[type]:
		if candidate["name"] == item_name:
			entry = candidate
			break
	if entry == null:
		return null
	var chunk = load_chunk(type, entry["chunk"])
	if chunk == null:
		return null
	for item in chunk:
		if item["name"] == item_name:
			return item
	return null


# Get available chunks for a type (for UI tabs)
func get_chunks(type: String) -> Array:
	if index == null:
		return []
	var chunk_names := {}
	for item in index[type]:
		chunk_names[item["chunk"]] = true
	var names := chunk_names.keys()
	names.sort()
	return names
