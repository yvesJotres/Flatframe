// DOM heads-up display.
//
// The markup lives in index.html; this class owns the numbers and the handful of
// state classes (damage pinch, low health, reloading) so game.js stays about the
// game rather than about styling.

const VITAL_BAR_TOTAL_WIDTH = 400; // px

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

function setWidthPx(element, px) {
  if (element) element.style.width = `${Math.round(px)}px`;
}

function toggle(element, className, on) {
  if (element) element.classList.toggle(className, !!on);
}

export default class Hud {
  constructor() {
    const pick = (id) => document.getElementById(id);

    this.el = {
      root: pick('hud'),
      flash: pick('damage-flash'),

      // Vitals (new Warframe-style layout)
      shieldValue: pick('shield-display'),
      healthValue: pick('health-display'),
      shieldTrack: pick('shield-track'),
      healthTrack: pick('health-track'),
      shieldFill: pick('shield-fill'),
      healthFill: pick('health-fill'),
      frameDisplay: pick('frame-display'),
      armor: pick('armor-display'),
      energy: pick('energy-display'),

      // Mission banner (top-left)
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
      angle: pick('angle-display'),

      // Revive
      revivePanel: pick('revive-panel'),
      bleedoutTimer: pick('bleedout-timer'),
      reviveCount: pick('revive-count'),
      reviveInstruction: pick('revive-instruction')
    };

    this.lastVitals = null;
    this.flashTimer = 0;
    this.vitalsInitialized = false;
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
    toggle(this.el.ammoPanel, 'low-ammo', false);
  }

  updateVitals(player, dt = 0) {
    if (player && player.isBleedingOut) {
      // Show revive panel
      toggle(this.el.revivePanel, 'hidden', false);
      
      // Update bleedout timer (MM:SS or DEAD)
      const timerSec = Math.max(0, Math.floor(player.bleedoutTimer || 0));
      if (timerSec > 0) {
        const mm = Math.floor(timerSec / 60).toString().padStart(2, '0');
        const ss = (timerSec % 60).toString().padStart(2, '0');
        setText(this.el.bleedoutTimer, `BLEEDING OUT ${mm}:${ss}`);
      } else {
        setText(this.el.bleedoutTimer, 'DEAD');
      }
      
      // Update revive counter
      setText(this.el.reviveCount, String(player.revivesRemaining));
      
      if (player.awaitingRevive) {
        this.updateObjective('DOWN', 'HOLD X TO SELF-REVIVE · Revives: ' + player.revivesRemaining, '#ff4444');
      } else {
        const timer = player.bleedoutTimer ? player.bleedoutTimer.toFixed(1) : '0.0';
        const hold = player.reviveHoldTime ? ' [Holding X: ' + player.reviveHoldTime.toFixed(1) + ']' : '';
        this.updateObjective('BLEEDOUT', 'BLEEDOUT: ' + timer + 's · Revives: ' + player.revivesRemaining + hold, '#ff4444');
      }
      
      // Hide vitals during bleedout
      toggle(this.el.vitalValuesRow, 'hidden', true);
      toggle(this.el.vitalBarsRow, 'hidden', true);
      toggle(this.el.chips, 'hidden', true);
      if (this.el.frameDisplay) toggle(this.el.frameDisplay, 'hidden', true);
    } else {
      // Hide revive panel when not bleeding out
      toggle(this.el.revivePanel, 'hidden', true);
      
      // Show vitals when alive
      toggle(this.el.vitalValuesRow, 'hidden', false);
      toggle(this.el.vitalBarsRow, 'hidden', false);
      toggle(this.el.chips, 'hidden', false);
      if (this.el.frameDisplay) toggle(this.el.frameDisplay, 'hidden', false);
    }
    
    const healthPercent = player.maxHealth > 0 ? player.health / player.maxHealth : 0;
    const shieldPercent = player.maxShield > 0 ? player.shield / player.maxShield : 0;

    // First frame: set track widths proportionally to max values (total = 400px)
    if (!this.vitalsInitialized && player.maxHealth > 0 && player.maxShield > 0) {
      const totalMax = player.maxHealth + player.maxShield;
      const healthTrackWidth = (player.maxHealth / totalMax) * VITAL_BAR_TOTAL_WIDTH;
      const shieldTrackWidth = (player.maxShield / totalMax) * VITAL_BAR_TOTAL_WIDTH;
      
      setWidthPx(this.el.healthTrack, healthTrackWidth);
      setWidthPx(this.el.shieldTrack, shieldTrackWidth);
      this.vitalsInitialized = true;
    }

    // Deplete fills from right to left (width = current percent * track width)
    const shieldTrackWidth = this.el.shieldTrack ? parseFloat(this.el.shieldTrack.style.width) || 0 : 0;
    const healthTrackWidth = this.el.healthTrack ? parseFloat(this.el.healthTrack.style.width) || 0 : 0;
    
    setWidthPx(this.el.shieldFill, shieldPercent * shieldTrackWidth);
    setWidthPx(this.el.healthFill, healthPercent * healthTrackWidth);

    // Values: just the current number (no "/ max")
    setText(this.el.shieldValue, `${Math.ceil(player.shield)}`);
    setText(this.el.healthValue, `${Math.ceil(player.health)}`);
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
      return;
    }

    setText(this.el.weaponName, `${weapon.name} [${weapon.rank || 0}]`);
    setText(this.el.ammoValue, weapon.ammo);
    setText(this.el.reserveValue, `/ ${weapon.ammoReserve}`);
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
