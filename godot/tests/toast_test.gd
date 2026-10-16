extends SceneTree

# Checks the currency toasts: a wallet change becomes a toast, and the change list is emptied once it is read. The
# test does not write to any profile. Run headless from the godot/ folder:
#   godot --headless -s res://tests/toast_test.gd

var passes := 0
var failures := 0
var toast: CurrencyToast
var step := 0


func _initialize() -> void:
	toast = CurrencyToast.new()
	root.add_child(toast)
	Wallet.pending_changes.append({"currency": "endo", "delta": 45})
	Wallet.pending_changes.append({"currency": "platinum", "delta": -20})


func check(condition: bool, label: String) -> void:
	if condition:
		passes += 1
	else:
		failures += 1
		print("FAIL: ", label)


func _process(_delta: float) -> bool:
	step += 1
	if step == 2:
		check(Wallet.pending_changes.is_empty(), "the change list is emptied once read")
		check(toast.toasts.size() == 2, "each change makes a toast")
		check(toast.toasts[0].text == "+45 Endo", "a gain reads as +amount name")
		check(toast.toasts[1].text == "−20 Platinum", "a spend reads as −amount name")
		print("%d passed, %d failed" % [passes, failures])
		quit(1 if failures > 0 else 0)
		return true
	return false
