import { itemRankOf } from '../progression/progression.js';
import { COMBO_RESET_MS } from '../engine/constants.js';
import { RADIAL_BLIND, RADIAL_JAVELIN, EXALTED_BLADE, SLASH_DASH } from '../warframe/abilities/excalibur_abilities.js';
// DOM heads-up display.
//
// The markup lives in index.html; this class owns the numbers and the handful of
// state classes (damage pinch, low health, reloading) so game.js stays about the
// game rather than about styling.

const VITAL_BAR_TOTAL_WIDTH = 200; // px

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

const COMBO_TIER_HITS = 20; // matches MeleeWeapon.getComboMultiplier()

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
      energyFill: pick('energy-fill'),
      abilityIcons: [
        { icon: pick('ability-slash-dash'), cost: SLASH_DASH.energyCost },
        { icon: pick('ability-radial-blind'), cost: RADIAL_BLIND.energyCost },
        { icon: pick('ability-radial-javelin'), cost: RADIAL_JAVELIN.energyCost },
        { icon: pick('ability-exalted-blade'), cost: EXALTED_BLADE.energyCost },
      ],

      // Mission banner (top-left)
      missionName: pick('mission-display'),
      objective: pick('objective-display'),
      objectiveBar: pick('objective-bar'),
      objectiveFill: pick('objective-fill'),
      detail: pick('wave-display'),

      // Weapon
      ammoPanel: pick('ammo-panel'),
      weaponName: pick('weapon-display'),
      ammoCounts: document.querySelector('#ammo-panel .ammo-counts'),
      meleePanel: pick('melee-panel'),
      comboMult: pick('combo-mult'),
      comboHits: pick('combo-hits'),
      comboTierFill: pick('combo-tier-fill'),
      comboDecayFill: pick('combo-decay-fill'),
      heavyState: pick('heavy-state'),
      parryState: pick('parry-state'),
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
    // The revive panel and damage flash live outside #hud, so leaving a mission
    // (abort, restart, death) must clear them explicitly or they stay on screen.
    if (!visible) {
      toggle(this.el.revivePanel, 'hidden', true);
      toggle(this.el.flash, 'hit', false);
      this.flashTimer = 0;
    }
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
        // Show revive panel (middle screen), but never while the HUD itself is hidden (paused, menus)
        toggle(this.el.revivePanel, 'hidden', this.el.root?.classList.contains('hidden'));

        // Update middle screen revive counter
                setText(this.el.reviveCount, String(player.revivesRemaining));
                toggle(this.el.bleedoutTimer, 'hidden', true); // Hide old bleedout timer

        // REPLACE health/shield values with bleedout text (same font/size/color as health)
        const timer = Math.max(0, Math.floor(player.bleedoutTimer || 0));
        if (timer <= 0) {
          setText(this.el.healthValue, 'DEAD');
        } else {
          const mm = Math.floor(timer / 60).toString().padStart(2, '0');
          const ss = (timer % 60).toString().padStart(2, '0');
          setText(this.el.healthValue, `BLEEDING OUT ${mm}:${ss}`);
        }
        // Hide shield value during bleedout
        setText(this.el.shieldValue, '');
      
        // Empty vital bars
        setWidthPx(this.el.shieldFill, 0);
        setWidthPx(this.el.healthFill, 0);
      
        if (player.awaitingRevive) {
          this.updateObjective('DOWN', 'HOLD X TO SELF-REVIVE · Revives: ' + player.revivesRemaining, '#ff4444');
        } else {
        const timer = player.bleedoutTimer ? player.bleedoutTimer.toFixed(1) : '0.0';
        const hold = player.reviveHoldTime ? ' [Holding X: ' + player.reviveHoldTime.toFixed(1) + ']' : '';
        this.updateObjective('BLEEDOUT', 'BLEEDOUT: ' + timer + 's · Revives: ' + player.revivesRemaining + hold, '#ff4444');
        }
      } else {
        // Hide revive panel when not bleeding out
        toggle(this.el.revivePanel, 'hidden', true);

        // Normal vital display
                const healthPercent = player.maxHealth > 0 ? player.health / player.maxHealth : 0;
                const shieldPercent = player.maxShield > 0 ? player.shield / player.maxShield : 0;
        
                // Check for shield gate invulnerability
                const isInvulnerable = player.healthComponent && player.healthComponent.isInvulnerable;

                // First frame: set track widths proportionally to max values (total = 400px)
                if (!this.vitalsInitialized && player.maxHealth > 0 && player.maxShield > 0) {
                  const totalMax = player.maxHealth + player.maxShield;
                  const healthTrackWidth = (player.maxHealth / totalMax) * VITAL_BAR_TOTAL_WIDTH;
                  const shieldTrackWidth = (player.maxShield / totalMax) * VITAL_BAR_TOTAL_WIDTH;

                  setWidthPx(this.el.healthTrack, healthTrackWidth);
                  setWidthPx(this.el.shieldTrack, shieldTrackWidth);
                  this.vitalsInitialized = true;
                }

                // Apply invulnerable state styling
                toggle(this.el.shieldTrack, 'invulnerable', isInvulnerable);
                toggle(this.el.healthTrack, 'invulnerable', isInvulnerable);
                toggle(this.el.shieldValue, 'invulnerable', isInvulnerable);
                toggle(this.el.healthValue, 'invulnerable', isInvulnerable);

                // Apply armored state styling (enemies only — player bar stays red)
                const hasArmor = player.healthComponent && player.healthComponent.hasArmor && !player.healthComponent.isPlayer;
                toggle(this.el.healthTrack, 'armored', hasArmor);

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
        this.el.energyFill.style.width = percentOf(player.energy / player.maxEnergy);
        // Dim each ability icon while there isn't enough energy to cast it
        for (const { icon, cost } of this.el.abilityIcons) {
          icon.classList.toggle('unavailable', player.energy < cost);
        }
      }

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
    // The Warframe's rank comes from its affinity, the same as the Arsenal shows
    setText(this.el.frameDisplay, `${player.frameName.toUpperCase()} [${itemRankOf(player.frameName, 'frame')}]`);

    const isMelee = weapon.category === 'melee';
    toggle(this.el.meleePanel, 'hidden', !isMelee);
    toggle(this.el.ammoCounts, 'hidden', isMelee);

    // Melee: combo multiplier, hit count, progress to next tier, combo decay, heavy/parry state
    if (isMelee) {
      const hits = weapon.comboCount ?? 0;
      const mult = weapon.getComboMultiplier ? weapon.getComboMultiplier() : 1;
      setText(this.el.weaponName, `${weapon.name} [${itemRankOf(weapon.name, 'weapon')}]`);
      setText(this.el.comboMult, `${mult.toFixed(2).replace(/0$/, '')}x`);
      setText(this.el.comboHits, `${hits} ${hits === 1 ? 'HIT' : 'HITS'}`);
      setWidth(this.el.comboTierFill, (hits % COMBO_TIER_HITS) / COMBO_TIER_HITS);
      setWidth(this.el.comboDecayFill, hits > 0 ? Math.max(0, weapon.comboTimer) / COMBO_RESET_MS : 0);
      toggle(this.el.comboMult, 'boosted', mult > 1);
      // Heavy attack spends the combo, so it is only worth it with hits banked
      toggle(this.el.heavyState, 'ready', hits > 0);
      toggle(this.el.parryState, 'active', !!weapon.isParrying);
      toggle(this.el.parryState, 'perfect', !!weapon.checkPerfectParry?.());
      return;
    }

    setText(this.el.weaponName, `${weapon.name} [${itemRankOf(weapon.name, 'weapon')}]`);
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
