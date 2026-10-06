// DOM heads-up display.
//
// The markup lives in index.html; this class owns the numbers and the handful of
// state classes (damage pinch, low health, reloading) so game.js stays about the
// game rather than about styling.

function percentOf(value) {
  const clamped = Math.max(0, Math.min(1, value));
  return `${(clamped * 100).toFixed(2)}%`;
}

function setText(element, text) {
  if (element && element.textContent !== text) element.textContent = text;
}

function setWidth(element, value) {
  if (element) element.style.width = percentOf(value);
}

function toggle(element, className, on) {
  if (element) element.classList.toggle(className, !!on);
}

export default class Hud {
  constructor() {
    const pick = (id) => document.getElementById(id);

    this.el = {
      root: pick('hud'),
      vitals: pick('vitals'),
      flash: pick('damage-flash'),

      // Vitals
      healthBar: pick('health-bar'),
      healthFill: pick('health-fill'),
      healthValue: pick('health-display'),
      shieldBar: pick('shield-bar'),
      shieldFill: pick('shield-fill'),
      shieldValue: pick('shield-display'),
      armor: pick('armor-display'),
      energy: pick('energy-display'),

      // Mission banner
      missionName: pick('mission-display'),
      objective: pick('objective-display'),
      objectiveBar: pick('objective-bar'),
      objectiveFill: pick('objective-fill'),
      detail: pick('wave-display'),

      // Weapon
      ammoPanel: pick('ammo-panel'),
      weaponName: pick('weapon-display'),
      weaponStats: pick('weapon-stats'),
      ammoValue: pick('ammo-display'),
      reserveValue: pick('reserve-display'),
      magBar: pick('mag-bar'),
      magFill: pick('mag-fill'),
      reload: pick('reload-display'),

      // Dev read-out
      position: pick('pos-display'),
      angle: pick('angle-display')
    };

    this.lastVitals = null;
    this.flashTimer = 0;
  }

  setVisible(visible) {
    toggle(this.el.root, 'hidden', !visible);
  }

  // Called when a mission starts, so the banner matches the deployment.
  setMission(mission) {
    setText(this.el.missionName, mission.name.toUpperCase());
    if (this.el.root && mission.accent) {
      this.el.root.style.setProperty('--accent', mission.accent);
    }
    // The Defence bar tracks the objective's health, so it gets its own tint.
    toggle(this.el.objectiveBar, 'objective', mission.id === 'defense');
  }

  // Clears the "previous frame" memory so a fresh run never opens with a
  // damage pinch or a stale critical pulse.
  reset() {
    this.lastVitals = null;
    this.flashTimer = 0;
    toggle(this.el.flash, 'hit', false);
    toggle(this.el.vitals, 'critical', false);
    toggle(this.el.ammoPanel, 'low-ammo', false);
    toggle(this.el.shieldBar, 'recharging', false);
  }

  updateVitals(player, dt = 0) {
    if (player && player.isBleedingOut) {
      if (player.awaitingRevive) {
        this.updateObjective('DOWN', 'HOLD X TO SELF-REVIVE · Revives: ' + player.revivesRemaining, '#ff4444');
      } else {
        const timer = player.bleedoutTimer ? player.bleedoutTimer.toFixed(1) : '0.0';
        const hold = player.reviveHoldTime ? ' [Holding X: ' + player.reviveHoldTime.toFixed(1) + ']' : '';
        this.updateObjective('BLEEDOUT', 'BLEEDOUT: ' + timer + 's · Revives: ' + player.revivesRemaining + hold, '#ff4444');
      }
    }
    
    const healthPercent = player.maxHealth > 0 ? player.health / player.maxHealth : 0;
    const shieldPercent = player.maxShield > 0 ? player.shield / player.maxShield : 0;

    setWidth(this.el.healthFill, healthPercent);
    setWidth(this.el.shieldFill, shieldPercent);
    setText(this.el.healthValue, `${Math.ceil(player.health)} / ${player.maxHealth}`);
    setText(this.el.shieldValue, `${Math.ceil(player.shield)} / ${player.maxShield}`);
    setText(this.el.armor, `ARMOR ${player.armor}`);
    setText(this.el.energy, `ENERGY ${Math.ceil(player.energy)}`);

    // Damage pinch — a red vignette for a moment whenever health OR shield drops.
    const total = player.health + player.shield;
    if (this.lastVitals !== null && total < this.lastVitals - 0.01) {
      this.flashTimer = 0.22;
    }
    this.lastVitals = total;

    this.flashTimer = Math.max(0, this.flashTimer - dt);
    toggle(this.el.flash, 'hit', this.flashTimer > 0);
    toggle(this.el.vitals, 'critical', player.alive && healthPercent <= 0.25);
    toggle(
      this.el.shieldBar,
      'recharging',
      player.alive && player.shield < player.maxShield && player.timeSinceDamage >= player.shieldRegenDelay
    );
  }

  updateWeapon(player) {
    const weapon = player.currentWeapon;

    // Handle melee weapons differently (no ammo, show combo)
    if (weapon.category === 'melee') {
      const comboMult = weapon.getComboMultiplier ? weapon.getComboMultiplier() : 1;
      setText(this.el.weaponName, weapon.name);
      setText(
        this.el.weaponStats,
        `${weapon.totalDamage.toFixed(1)} dmg · ${weapon.meleeCooldown.toFixed(2)}s swing · Combo: ${weapon.comboCount} (${comboMult.toFixed(2)}x)`
      );
      setText(this.el.ammoValue, '');
      setText(this.el.reserveValue, '');
      toggle(this.el.ammoPanel, 'low-ammo', false);
      toggle(this.el.magBar, 'reloading', false);
      setWidth(this.el.magFill, 0);
      setText(this.el.reload, '');
      return;
    }

    setText(this.el.weaponName, weapon.name);
    setText(
      this.el.weaponStats,
      `${weapon.totalDamage.toFixed(1)} dmg · ${weapon.fireRate} r/s · ${weapon.magazine} mag`
    );

    setText(this.el.ammoValue, weapon.ammo);
    setText(this.el.reserveValue, `/ ${weapon.ammoReserve}`);
    toggle(
      this.el.ammoPanel,
      'low-ammo',
      !weapon.reloading && weapon.ammo <= Math.max(1, weapon.magazine * 0.25)
    );

    if (weapon.reloading) {
      const progress = weapon.reloadSpeed > 0
        ? 1 - weapon.reloadRemaining / weapon.reloadSpeed
        : 1;
      setWidth(this.el.magFill, progress);
      toggle(this.el.magBar, 'reloading', true);
      setText(this.el.reload, `RELOADING ${Math.max(0, weapon.reloadRemaining).toFixed(1)}s`);
      return;
    }

    setWidth(this.el.magFill, weapon.magazine > 0 ? weapon.ammo / weapon.magazine : 0);
    toggle(this.el.magBar, 'reloading', false);
    setText(this.el.reload, weapon.ammo === 0 ? 'PRESS R TO RELOAD' : '');
  }

  // `progress` of null hides the fill and dims the bar (used by Survival, which
  // has no finish line to progress towards).
  updateObjective(primary, detail, progress = null) {
    setText(this.el.objective, primary);
    setText(this.el.detail, detail);
    setWidth(this.el.objectiveFill, progress ?? 0);
    toggle(this.el.objectiveBar, 'empty', progress === null);
  }

  updateDev(player) {
    setText(this.el.position, `POS ${player.x.toFixed(0)}, ${player.y.toFixed(0)}`);
    setText(this.el.angle, `ANGLE ${(player.angle * 180 / Math.PI).toFixed(0)}°`);
  }
}
