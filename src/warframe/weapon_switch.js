export class WeaponSwitchHandler {
  constructor(player) {
    this.player = player;
    this.fKeyPressTime = 0;
    this.fKeyHeld = false;
    this.hasHeld = false;
    this.triggeredHold = false;
  }

  handleInput(input, dt, audioManager) {
    const fDown = input.isKeyDown('f');
    const fPressed = input.isKeyPressed('f');

    if (fPressed && !this.fKeyHeld) {
      this.fKeyPressTime = performance.now();
      this.fKeyHeld = true;
      this.hasHeld = false;
      this.triggeredHold = false;
    }

    if (fDown) {
      if (!this.triggeredHold && this.fKeyHeld && performance.now() - this.fKeyPressTime > 200) {
        if (this.player.currentWeapon !== this.player.meleeWeapon) {
          this.player.currentWeapon = this.player.meleeWeapon;
          audioManager.play(Math.random() < 0.5 ? 'melee_equip1' : 'melee_equip2', 0.6);
        } else {
          this.player.currentWeapon = this.player.lastRangedWeapon;
          audioManager.play(Math.random() < 0.5 ? 'ranged_equip1' : 'ranged_equip2', 0.6);
        }
        this.triggeredHold = true;
        this.hasHeld = true;
      }
    } else {
      if (this.fKeyHeld && !this.hasHeld && performance.now() - this.fKeyPressTime <= 200) {
        if (this.player.currentWeapon === this.player.meleeWeapon) {
          this.player.currentWeapon = this.player.lastRangedWeapon;
        } else {
          this.player.currentWeapon = (this.player.lastRangedWeapon === this.player.primaryWeapon) ? this.player.secondaryWeapon : this.player.primaryWeapon;
          this.player.lastRangedWeapon = this.player.currentWeapon;
        }
        audioManager.play(Math.random() < 0.5 ? 'ranged_equip1' : 'ranged_equip2', 0.6);
      }
      this.fKeyHeld = false;
      this.hasHeld = false;
      this.triggeredHold = false;
    }
  }
}
