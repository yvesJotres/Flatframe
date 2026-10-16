class_name Account
extends RefCounted

# The account: what is saved and how it is loaded. Port of src/account/sections.js and account.js.
# Sections: loadout, mods (owned and installed), profiles (all profiles with their password data), frames,
# wallet (the active profile's balances), and settings.

const AUTOSAVE_SECONDS := 30.0


static func collect() -> Dictionary:
	var active := UserStore.active_id()
	return {
		"loadout": Loadout.equipped.duplicate(true),
		"mods": {
			"owned": Mods.owned_ranks.duplicate(true),
			"installed": Mods.installed.duplicate(true),
		},
		"profiles": UserStore.read(),
		"frames": PlayerFrames.get_frames().duplicate(true),
		"wallet": {"profileId": active, "balances": Wallet.balances(active)},
		"settings": Settings.collect(),
	}


static func apply(data: Dictionary) -> void:
	if data.get("loadout") is Dictionary:
		Loadout.equipped = data.loadout
	var mods = data.get("mods")
	if mods is Dictionary:
		if mods.get("owned") is Dictionary:
			Mods.owned_ranks = mods.owned
		if mods.get("installed") is Dictionary:
			Mods.installed = mods.installed
	var profiles = data.get("profiles")
	if profiles is Dictionary and profiles.get("profiles") is Dictionary:
		UserStore.write(profiles)
	if data.get("frames") is Dictionary:
		PlayerFrames.apply(data.frames)
	# Balances belong to one profile: only apply them when that profile is the active one
	var wallet_data = data.get("wallet")
	if wallet_data is Dictionary and wallet_data.get("profileId") == UserStore.active_id():
		Wallet.set_balances(UserStore.active_id(), wallet_data.get("balances", {}))
	if data.get("settings") is Dictionary:
		Settings.apply(data.settings)


# Start-up: load the newest save, then make sure the admin profile exists
static func start() -> void:
	apply(SaveStorage.read())
	UserStore.ensure_admin()


static func save() -> bool:
	return SaveStorage.write(collect())
