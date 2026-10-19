import PrimaryWeapon from '../weapons/primary_weapon.js';
import SecondaryWeapon from '../weapons/secondary_weapon.js';
import MeleeWeapon from '../weapons/melee_weapon.js';
import { reduceDamage } from '../combat/damage.js';
import { damageNumbersManager, getDamageNumberType } from '../combat/damage_numbers.js';
import { approach } from '../engine/movement.js';
import { audioManager } from '../engine/audio.js';
import HealthComponent from '../combat/health.js';
import StatusManager from '../combat/status_manager.js';
import { WeaponSwitchHandler } from './weapon_switch.js';
import { baseFrameStats, STARTING_ENERGY } from './library.js';
import { DEFAULT_WARFRAME } from './warframes.js';
import { itemRankOf } from '../progression/progression.js';
import { frameModBonuses } from '../mods/mod_effects.js';
import { RADIAL_BLIND, RADIAL_JAVELIN, EXALTED_BLADE, ExaltedBlade, castRadialBlind, castRadialJavelin, SlashDash, SLASH_DASH, JavelinVolley, DashTrail } from './abilities/excalibur_abilities.js';
import { drawEnergyBlade } from '../engine/energy_visuals.js';
import { godMode } from '../debug/cheats.js';
import { hitZone } from '../combat/hitzones.js';
import { canAutoAttack } from '../combat/stealth.js';
import { drawVisualEffect, EFFECT_NAMES } from '../engine/visual_effects.js';
import { ART, drawArt, WEAPON_LAYER, FIGURE_RADIUS_UNITS } from '../assets/art/art.js';
import { recordDamageReceived } from '../missions/mission_stats.js';
import { JUMP, JumpState } from './jump.js';
import { UNITS_PER_METER } from '../engine/constants.js';
import { gameNow } from '../engine/game_clock.js';

// Idle, the melee blade stands upright tilted this far to the right (radians, clockwise on screen)
const BLADE_REST_TILT = 15 * Math.PI / 180;

export default class Player {
  // loadout: { primary, secondary, melee } weapon names from the Arsenal (defaults when omitted)
  constructor(x, y, loadout = {}) {
      this.x = x;
      this.y = y;
      this.velocity = { x: 0, y: 0 };
      this.radius = 16;

      // Movement tuning (px/s and px/s²)
      this.moveSpeed = 400;
      this.acceleration = 3600;
      this.deceleration = 4800;

      // Parkour: hop, double jump, and bullet jump (see jump.js)
      this.jump = new JumpState();
      this.crouching = false;
      this.isBulletJumping = false;
      this.bulletJumpDirection = { x: 0, y: 0 };
      this.bulletJumpVisualTimer = 0;

      this.angle = 0;

      // Test control (the Simulacrum's INVULNERABLE): takes no damage at all
      this.invulnerable = false;

      // Excalibur stats at the frame's rank (wiki); the Arsenal passes the rank in the loadout
      // Frame rank comes from its affinity (the Arsenal passes it in the loadout too)
      // The equipped Warframe: its name and rank come from the loadout, never from a fixed name
      this.frameName = loadout.warframe ?? DEFAULT_WARFRAME;
      const stats = baseFrameStats(this.frameName, loadout.frameRank ?? itemRankOf(this.frameName, 'frame'));
      // Warframe mods add a percentage to the frame's base health, shield and armor
      const mods = frameModBonuses(loadout.mods ?? []);
      this.healthComponent = new HealthComponent({
              maxHp: Math.round(stats.health * (1 + mods.health / 100)),
              maxShield: Math.round(stats.shield * (1 + mods.shield / 100)),
              armor: Math.round(stats.armor * (1 + mods.armor / 100)),
            }, true);
            this.status = new StatusManager();
            this.maxEnergy = stats.energy;
            this.energy = Math.min(STARTING_ENERGY, this.maxEnergy);

            // Shield recharge (wiki formula with mod bonus support)
            this.shieldRechargeBonus = 0; // From mods like Fast Deflection, Vigilante Vigor, etc.
            this.timeSinceDamage = Infinity;
            this.alive = true;
      this.isPlayer = true;  // For AI target identification

      // Stealth/Noise system (per Warframe wiki)
      // Killing an enemy produces sound audible ~5m (75 units)
      // Firing unsilenced weapon produces sound audible ~20m (300 units)
      this.lastNoisePosition = null;
      this.lastNoiseTime = 0;
      this.noiseRadius = 75; // 5m kill noise radius
      this.weaponNoiseRadius = 300; // 20m unsilenced weapon noise radius
      this.isInvisible = false; // Will be set by Warframe abilities
      this.isSilenced = false; // Will be set by weapon mods

      this.primaryWeapon = new PrimaryWeapon(loadout.primary || undefined);
      this.isBleedingOut = false;
      this.awaitingRevive = false;
      this.bleedoutTimer = 0;
      this.revivesRemaining = 4;
      this.reviveHoldTime = 0;
      this.downedX = 0;
      this.downedY = 0;
      this.awaitingPulse = 0;
      this.secondaryWeapon = new SecondaryWeapon(loadout.secondary || undefined);
      this.meleeWeapon = new MeleeWeapon(loadout.melee || undefined);
      this.equippedMods = loadout.mods ?? [];
      this.primaryWeapon.applyMods(this.equippedMods, 'primary');
      this.secondaryWeapon.applyMods(this.equippedMods, 'secondary');
      this.meleeWeapon.applyMods(this.equippedMods, 'melee');
      this.currentWeapon = this.primaryWeapon;
      this.lastRangedWeapon = this.primaryWeapon;
      this.lastShotTime = 0;
      this.lastMeleeTime = 0;
      this.meleeSwingTimer = 0;
      this.meleeSwingType = 'normal'; // 'normal' | 'heavy'
      this.meleeSwingDuration = 0.15; // seconds the current swing lasts (its timer starts here)
      this.meleeSwingHits = [];
      this.lungeTarget = null;
      this.lungeTimer = 0;
          this.weaponSwitchHandler = new WeaponSwitchHandler(this);
      this.slashDash = new SlashDash();
      this.exaltedBlade = new ExaltedBlade();
      this.javelinFx = new JavelinVolley(); // Radial Javelin visual (excalibur_abilities.js)
      this.dashTrail = new DashTrail(); // blue trail of a Slash Dash with the Exalted Blade (excalibur_abilities.js)
    }

  // Backward compatibility getters/setters
  get maxHealth() { return this.healthComponent.maxHp; }
  set maxHealth(val) { this.healthComponent.maxHp = val; }
  get health() { return this.healthComponent.hp; }
  set health(val) { this.healthComponent.hp = val; }
  get maxShield() { return this.healthComponent.maxShield; }
  set maxShield(val) { this.healthComponent.maxShield = val; }
  get shield() { return this.healthComponent.shield; }
  set shield(val) { this.healthComponent.shield = val; }
  get armor() { return this.healthComponent.currentArmor; }
  set armor(val) { this.healthComponent.currentArmor = val; }

  update(dt, input, projectiles = [], enemies = [], camera = { x: 0, y: 0 }) {
    if (this.finisherTimer > 0) this.finisherTimer = Math.max(0, this.finisherTimer - dt);
    this.healthComponent.update(dt);

    // Convert screen mouse to world coordinates
    const mouseWorld = input.getWorldMousePos ? input.getWorldMousePos(camera)
      : { x: input.mouse.x + camera.x, y: input.mouse.y + camera.y, down: input.mouse.down, rightDown: input.mouse.rightDown, middleDown: input.mouse.middleDown };

    if (!this.alive) return;
    if (this.isBleedingOut) {
      if (!this.awaitingRevive) {
        this.bleedoutTimer -= dt;
      }

      // Hold X for 2s to self-revive — available during the countdown and
      // after it expires ("can't be revived by others" state).
      if (input.isKeyDown('x')) {
        this.reviveHoldTime += dt;
        if (this.reviveHoldTime >= 2.0 && this.revivesRemaining > 0) {
          audioManager.play('revive', 0.8);
          this.revivesRemaining--;
          this.isBleedingOut = false;
          this.awaitingRevive = false;
          this.health = this.maxHealth;
          this.shield = this.maxShield;
          this.reviveHoldTime = 0;
          this.timeSinceDamage = 0;
          return;
        }
      } else {
        this.reviveHoldTime = 0;
      }

      // No revives left while downed = dead.
      if (this.revivesRemaining <= 0) {
        this.alive = false;
        this.isBleedingOut = false;
        return;
      }

      // Countdown over: body is gone, only the X marker remains. Nothing
      // but the self-revive input works from here.
      if (this.bleedoutTimer <= 0) {
        if (!this.awaitingRevive) {
          this.awaitingRevive = true;
          this.downedX = this.x;
          this.downedY = this.y;
          this.velocity.x = 0;
          this.velocity.y = 0;
        }
        this.awaitingPulse += dt;
        return;
      }

      // Downed but body intact: aim and fire the secondary only —
      // no primary, no melee, no weapon swapping.
      if (this.currentWeapon !== this.secondaryWeapon) {
        this.currentWeapon = this.secondaryWeapon;
      }
      this.angle = Math.atan2(mouseWorld.y - this.y, mouseWorld.x - this.x);
      const firing = mouseWorld.down;
      this.secondaryWeapon.update(dt, firing);
      this.primaryWeapon.update(dt, false); // keep reload timers honest
      if (firing) this.secondaryWeapon.fire(this, mouseWorld, dt, projectiles);
      if (input.isKeyPressed('r')) this.secondaryWeapon.startReload();
      if (this.meleeSwingTimer > 0) this.meleeSwingTimer -= dt;
      return;
    }
    // 1. Movement (WASD)
    let dirX = 0;
    let dirY = 0;
    if (input.isKeyDown('w')) dirY -= 1;
    if (input.isKeyDown('s')) dirY += 1;
    if (input.isKeyDown('a')) dirX -= 1;
    if (input.isKeyDown('d')) dirX += 1;
    // Gamepad left stick (set by engine/gamepad.js), added to the keys
    dirX += input.gamepadMove?.x ?? 0;
    dirY += input.gamepadMove?.y ?? 0;

    const moving = dirX !== 0 || dirY !== 0;
    if (moving) {
      const len = Math.hypot(dirX, dirY);
      dirX /= len;
      dirY /= len;
    }

    // Ability 1 (Slash Dash): pressing 1 charges toward the aim direction.
    // While it runs, it moves the player instead of WASD.
    const aimAngle = Math.atan2(mouseWorld.y - this.y, mouseWorld.x - this.x);
    // Touch buttons send touch-ability-N (see touch_controls.js); keyboard keys are unchanged
    const dashKey = input.isKeyPressed(SLASH_DASH.key);
    if (input.isKeyPressed('touch-ability-1') || dashKey) this.slashDash.activate(this, aimAngle);
    // Abilities 2-4: Radial Blind, Radial Javelin, Exalted Blade (toggle)
    const blindKey = input.isKeyPressed(RADIAL_BLIND.key);
    const javelinKey = input.isKeyPressed(RADIAL_JAVELIN.key);
    const exaltedKey = input.isKeyPressed(EXALTED_BLADE.key);
    if (input.isKeyPressed('touch-ability-2') || blindKey) castRadialBlind(this, enemies);
    if (input.isKeyPressed('touch-ability-3') || javelinKey) castRadialJavelin(this, enemies);
    if (input.isKeyPressed('touch-ability-4') || exaltedKey) this.exaltedBlade.toggle(this);
    this.exaltedBlade.update(dt, this);
    this.javelinFx.update(dt);
    this.dashTrail.update(dt);
    if (this.slashDash.active && this.exaltedBlade.active) this.dashTrail.record(this.x, this.y);
    this.exaltedBlade.updateWaves(dt, enemies);

    // Crouch (held Ctrl or the crouch button): smaller hitbox, read by enemy sight in enemy.js
    this.crouching = input.isKeyDown('control');
    this.radius = this.crouching ? JUMP.crouchRadius : JUMP.standRadius;
    this.sightFactor = this.crouching ? JUMP.crouchSightFactor : 1;

    // Jump (Shift): hop, double jump, or bullet jump when crouched (jump.js)
    if (input.isKeyPressed('shift')) {
      const aimX = Math.cos(this.angle);
      const aimY = Math.sin(this.angle);
      const kind = this.jump.press(dirX, dirY, aimX, aimY, this.crouching);
      if (kind) {
        audioManager.play('melee_swing1', 0.4);
        if (kind === 'bullet') {
          this.bulletJumpVisualTimer = 0.15;
          this.bulletOrigin = { x: this.x, y: this.y }; // the blast happens where the jump began (wiki)
        }
      }
    }
    const landing = this.jump.update(dt);
    if (landing?.landed === 'bullet') this.blastOnLanding(enemies);
    this.isBulletJumping = this.jump.bulletActive;
    if (this.jump.bulletActive) {
      this.bulletJumpDirection.x = Math.cos(this.angle);
      this.bulletJumpDirection.y = Math.sin(this.angle);
    }
    if (this.bulletJumpVisualTimer > 0) this.bulletJumpVisualTimer -= dt;

    if (this.slashDash.active) {
      this.slashDash.update(dt, this, enemies);
    } else if (this.jump.airborne) {
      // The jump carries the player; WASD does not steer it
      this.velocity.x = this.jump.vx;
      this.velocity.y = this.jump.vy;
      this.x += this.velocity.x * dt;
      this.y += this.velocity.y * dt;
    } else {
      const rate = (moving ? this.acceleration : this.deceleration) * dt;
      this.velocity.x = approach(this.velocity.x, dirX * this.moveSpeed, rate);
      this.velocity.y = approach(this.velocity.y, dirY * this.moveSpeed, rate);

      this.x += this.velocity.x * dt;
      this.y += this.velocity.y * dt;
    }

    // 2. Shields recharge
    // Wiki rules: partial shields recharge after 1s without damage;
    // fully depleted shields recharge 4s after the last hit (Shield Gating).
    // Delay reduction: cap 80%
    const delayReduction = Math.min(0.8, this.shieldRechargeDelayReduction ?? 0);
    this.timeSinceDamage += dt;
    const regenDelay = (this.shield <= 0 ? 4 : 1) * (1 - delayReduction);
    
    // Check if magnetic status prevents regen
    if (this.timeSinceDamage >= regenDelay && this.shield < this.maxShield && this.healthComponent.canRegenerateShield()) {
      // Wiki: (15 + 0.05 * MaxShields) * (1 + Bonus) units/s
      const bonus = this.shieldRechargeBonus ?? 0;
      const regenAmount = (15 + 0.05 * this.maxShield) * (1 + bonus) * dt;
      // Recharge during the gate invulnerability window immediately ends it
      if (this.healthComponent.shieldGateTimer > 0) {
        this.healthComponent.shieldGateTimer = 0;
        this.healthComponent.shieldGateInvulnerable = false;
      }
      this.shield = Math.min(this.maxShield, this.shield + regenAmount);
      // Track max shield replenished since last gate
      if (this.shield > this.healthComponent.maxShieldSinceLastGate) {
        this.healthComponent.maxShieldSinceLastGate = this.shield;
      }
    }

    // 3. Aim toward mouse
    this.angle = Math.atan2(mouseWorld.y - this.y, mouseWorld.x - this.x);
    this.handleWeapons(dt, input, projectiles, enemies, mouseWorld);

  }

  handleWeapons(dt, input, projectiles, enemies, mouseWorld) {
    if (this.lungeTarget) {
      if (this.lungeTarget.hp <= 0 || Math.hypot(this.lungeTarget.x - this.x, this.lungeTarget.y - this.y) < 10) {
        this.lungeTarget = null;
        this.lungeTimer = 0;
      } else {
        const angle = Math.atan2(this.lungeTarget.y - this.y, this.lungeTarget.x - this.x);
        this.velocity.x = Math.cos(angle) * 1200;
        this.velocity.y = Math.sin(angle) * 1200;
        this.lungeTimer -= dt;
        if (this.lungeTimer <= 0) {
            this.meleeWeapon.melee(this, this.meleeTargets(enemies));
            this.lungeTarget = null;
        }
        return;
      }
    }
    const firing = mouseWorld.down;
    const heavyClick = mouseWorld.middleDown;
    this.primaryWeapon.update(dt, firing && this.currentWeapon === this.primaryWeapon);
    this.secondaryWeapon.update(dt, firing && this.currentWeapon === this.secondaryWeapon);

    const isMeleeEquipped = this.currentWeapon === this.meleeWeapon;

    // Parry state management (right-click hold while melee equipped)
    if (isMeleeEquipped && mouseWorld.rightDown) {
      if (!this.meleeWeapon.isParrying) {
        this.meleeWeapon.startParry();
      }
    } else if (this.meleeWeapon.isParrying) {
      if (this.meleeWeapon.checkPerfectParry()) {
        // Perfect parry window still active - grant free heavy attack opportunity
        this.meleeWeapon.perfectParryReady = true;
      }
      this.meleeWeapon.stopParry();
    }

    // Auto-swing: if not parrying, no lunge active, and any enemy is in reach (no aim needed).
    // Works with any weapon equipped; the melee weapon is used (same as quick melee E).
    // Turn to the nearest enemy first so the swing's arc covers it.
    if (!this.meleeWeapon.isParrying && !this.lungeTarget) {
      // Auto attacks only reach enemies that have spotted the player and are not blinded (combat/stealth.js)
      const autoTargets = enemies.filter(canAutoAttack);
      const targetInfo = this.meleeWeapon.findBestTarget(this, autoTargets, Math.PI);
      if (targetInfo.target) {
        this.angle = targetInfo.angle;
        const hits = this.meleeWeapon.melee(this, this.meleeTargets(autoTargets));
        if (hits) {
          this.meleeSwingTimer = this.meleeSwingDuration = 0.15;
          this.meleeSwingHits = hits.map(e => ({ angle: Math.atan2(e.y - this.y, e.x - this.x), distance: Math.hypot(e.x - this.x, e.y - this.y) }));
        }
      }
    }

    // Lunge trigger: manual swing (click/E) with no target in reach, but one just outside
    // Read E once per frame: isKeyPressed consumes the press, and quick melee below needs it too
    this.quickMeleePressed = input.isKeyPressed('e');
    const meleeInput = this.quickMeleePressed || (firing && isMeleeEquipped);
    if (meleeInput && isMeleeEquipped && !this.meleeWeapon.isParrying && !this.lungeTarget) {
      const halfArc = this.meleeWeapon.arc / 2;
      const targetInfo = this.meleeWeapon.findBestTarget(this, enemies, halfArc);
      if (!targetInfo.target) {
        const reach = this.meleeWeapon.range * UNITS_PER_METER;
        let best = { target: null, distance: Infinity };
        for (const enemy of enemies) {
          if (!enemy || enemy.hp <= 0) continue;
          const dx = enemy.x - this.x;
          const dy = enemy.y - this.y;
          const dist = Math.hypot(dx, dy);
          if (dist > reach + (enemy.radius || 0) + 60) continue;
          if (dist < best.distance) {
            best = { target: enemy, distance: dist };
          }
        }
        if (best.target) {
          this.lungeTarget = best.target;
          this.lungeTimer = 0.2;
          return;
        }
      }
    }

    // 4. Normal melee swing (left click) or shooting
        if (firing) {
          if (isMeleeEquipped) {
            const hits = this.meleeWeapon.melee(this, this.meleeTargets(enemies));
            if (hits !== null) { // null = still on cooldown; [] = a whiff that still swings
              this.exaltedBlade.fireWave(this); // the summoned blade's energy wave
              this.meleeSwingTimer = this.meleeSwingDuration = 0.15;
              this.meleeSwingHits = hits.map(e => ({ angle: Math.atan2(e.y - this.y, e.x - this.x), distance: Math.hypot(e.x - this.x, e.y - this.y) }));
              this.meleeSwingType = 'normal';
            }
          } else {
            // Fire ranged weapon. A real shot (the ammo went down) makes noise unless silenced; enemies in the same room hear it
            const weapon = this.currentWeapon;
            const ammoBefore = weapon.ammo;
            weapon.fire(this, mouseWorld, dt, projectiles);
            if (weapon.ammo < ammoBefore && !this.isSilenced) {
              this.lastNoisePosition = { x: this.x, y: this.y };
              this.lastNoiseTime = 0; // Reset noise timer
              this.noiseSerial = (this.noiseSerial ?? 0) + 1; // one number per shot
            }
          }
        }

    // Heavy attack (middle click while melee equipped)
    // Lockout: check meleeSwingTimer to prevent light-attack-like spam
    // Use weapon's windUp (default 0.8s) for the lockout duration
    if (heavyClick && isMeleeEquipped && this.meleeSwingTimer <= 0) {
      const hits = this.meleeWeapon.heavyAttack(this, this.meleeTargets(enemies));
      if (hits) {
        const windUp = this.meleeWeapon.heavyAttackData?.windUp ?? 0.8;
        this.meleeSwingTimer = this.meleeSwingDuration = windUp;
        this.meleeSwingHits = hits.map(e => ({ angle: Math.atan2(e.y - this.y, e.x - this.x), distance: Math.hypot(e.x - this.x, e.y - this.y) }));
        this.meleeSwingType = 'heavy';
      }
    }

    if (input.isKeyPressed('r')) this.currentWeapon.startReload();

    // 5. Quick Melee (E) - works regardless of current weapon
    this.meleeWeapon.update(dt);
    if (this.quickMeleePressed) {
      // Quick melee (B) turns to the nearest enemy in reach first, so the swing lands whatever the aim is
      const nearest = this.meleeWeapon.findBestTarget(this, enemies, Math.PI);
      if (nearest.target) this.angle = nearest.angle;
      const hits = this.meleeWeapon.melee(this, this.meleeTargets(enemies));
      if (hits) this.exaltedBlade.fireWave(this); // the summoned blade's energy wave
      if (hits) {
        this.meleeSwingTimer = this.meleeSwingDuration = 0.15;
        this.meleeSwingHits = hits.map(e => ({ angle: Math.atan2(e.y - this.y, e.x - this.x), distance: Math.hypot(e.x - this.x, e.y - this.y) }));
        this.meleeSwingType = 'normal';
      }
    }

    if (this.meleeSwingTimer > 0) {
      this.meleeSwingTimer -= dt;
    }

    // 6. Weapon switching (F: tap swaps primary/secondary, hold switches to melee). Keys 1-4 are abilities.
    this.weaponSwitchHandler.handleInput(input, dt, audioManager);
  }

  // What a melee swing can hit: enemies, and the breakable containers around (set by the game each frame)
  meleeTargets(enemies) {
    return this.breakables?.length ? enemies.concat(this.breakables) : enemies;
  }

  // Which part of the Warframe a point is in: 'head', 'body', or null (same shapes as enemies, see hitzones.js)
  hitZone(px, py) {
    return hitZone(this, px, py);
  }

  // A bullet jump's blast (wiki): 100 Blast damage within 3 m of where the jump began, falling off toward the edge,
  // with a guaranteed Blast proc. No critical hit or stealth multiplier applies.
  blastOnLanding(enemies) {
    const origin = this.bulletOrigin ?? { x: this.x, y: this.y };
    for (const e of enemies) {
      if (e.isDowned?.() || e.health?.isDead) continue;
      const dist = Math.hypot(e.x - origin.x, e.y - origin.y);
      const reach = JUMP.blastRadius + (e.radius ?? 0);
      if (dist > reach) continue;
      const falloff = 1 - (1 - JUMP.blastMinFraction) * (dist / reach);
      const damage = JUMP.blastDamage * falloff;
      // The guaranteed Blast proc is not applied yet: the Blast status (status_effects.js) has no enemy-side
      // implementation in StatusManager, so adding it there crashed the landing.
      e.takeDamage({ total: damage, slash: 0, status: null }, origin.x, origin.y);
    }
  }

  takeDamage(damage) {
    if (godMode.on || this.invulnerable) return 0; // debug god mode (console: godmode) or the Simulacrum's INVULNERABLE
    if (this.finisherTimer > 0) return 0; // invulnerable while a finisher animation plays (combat/stealth.js)
    if (this.isBleedingOut) return 0; // downed players are ignored by enemies

    let mitigation = 0;
    // Parry damage reduction (90% reduction while parrying)
    if (this.currentWeapon === this.meleeWeapon && this.meleeWeapon.isParrying) {
      mitigation = this.meleeWeapon.parryDamageReduction; // 90% reduction
      // Perfect parry: stagger attacker, grant free heavy
      if (this.meleeWeapon.checkPerfectParry()) {
        this.meleeWeapon.perfectParryReady = true;
        audioManager.play('ui_parry', 0.6);
      }
    }

    const oldShield = this.healthComponent.shield;
    const hpBefore = this.healthComponent.hp;
    const toHealth = this.healthComponent.takeDamage(damage, mitigation);
    recordDamageReceived((hpBefore - this.healthComponent.hp) + (oldShield - this.healthComponent.shield));
    const newShield = this.healthComponent.shield;
    
    // Only reset delay if shield was actually damaged
    if (newShield < oldShield) {
      this.timeSinceDamage = 0;
    }

    if (this.healthComponent.isDead) {
      if (!this.isBleedingOut && this.revivesRemaining > 0) {
        this.isBleedingOut = true;
        this.awaitingRevive = false;
        this.bleedoutTimer = 20;
        this.healthComponent.hp = 1;
        this.currentWeapon = this.secondaryWeapon;
        this.velocity.x = 0;
        this.velocity.y = 0;
        return toHealth;
      } else {
        this.alive = false;
        this.isBleedingOut = false;
      }
    }
    return toHealth;
  }

  // Direction of the melee blade relative to the aim. Idle it stands upright on screen, 15 degrees to the right; during
  // a swing it blends from that pose into the sweep through the swing arc
  meleeBladeAngle() {
    const rest = -Math.PI / 2 + BLADE_REST_TILT - this.angle;
    if (this.meleeSwingTimer <= 0) return rest;
    const progress = this.swingProgress();
    const w = Math.sin(progress * Math.PI); // 0 at the start and end of the swing, 1 in the middle
    return rest + (this.swingOffset() - rest) * w;
  }

  // 0 at the start of the current swing, 1 when it ends (clamped, so a long wind-up cannot push it out of range)
  swingProgress() {
    return Math.min(1, Math.max(0, 1 - this.meleeSwingTimer / this.meleeSwingDuration));
  }

  // How far the melee blade is turned from the aim while it swings: it starts on one side of the arc and sweeps to the
  // other as the swing plays out, so the blade moves through the same arc the swing draws
  swingOffset() {
    if (this.meleeSwingTimer <= 0) return 0;
    const heavy = this.meleeSwingType === 'heavy';
    const weapon = this.meleeWeapon;
    const halfArc = (heavy ? (weapon.heavyAttackData?.arc ?? 140) : (weapon.attack.arc ?? 120)) * Math.PI / 180 / 2;
    const progress = this.swingProgress();
    return -halfArc + 2 * halfArc * progress;
  }

  draw(ctx) {
    if (this.awaitingRevive) {
      // Body is gone — leave a pulsing X at the downed position.
      const pulse = 0.55 + 0.45 * Math.sin(this.awaitingPulse * 4);
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.strokeStyle = `rgba(255, 80, 80, ${pulse})`;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-10, -10);
      ctx.lineTo(10, 10);
      ctx.moveTo(10, -10);
      ctx.lineTo(-10, 10);
      ctx.stroke();
      ctx.fillStyle = `rgba(255, 255, 255, ${pulse})`;
      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('HOLD X TO SELF-REVIVE', 0, 30);
      ctx.restore();
      return;
    }
    this.javelinFx.draw(ctx); // world space, under the figure
    this.dashTrail.draw(ctx);
    this.exaltedBlade.drawWaves(ctx);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    // The Warframe: a head and body (see visual_effects.js HUMANOID). Drawn upright; the aim shows as the facing pip.
    ctx.rotate(-this.angle);
    const slot = this.currentWeapon === this.meleeWeapon ? 'melee' : this.currentWeapon === this.secondaryWeapon ? 'secondary' : 'primary';
    drawVisualEffect(EFFECT_NAMES.HUMANOID, ctx, { x: 0, y: 0, radius: this.radius, color: '#4ade80', squash: this.crouching ? JUMP.crouchSquash : 1 });
    // The equipped weapon points where the Warframe aims: it is drawn in the aim direction, not on the upright figure
    ctx.rotate(this.angle);
    const k = this.radius / FIGURE_RADIUS_UNITS;
    const hx = WEAPON_LAYER.x * k, hy = WEAPON_LAYER.y * k + WEAPON_LAYER.h * k / 2; // the hand
    const bladeAngle = this.meleeBladeAngle();
    if (this.exaltedBlade.active) {
      // The summoned Exalted Blade is an energy blade held at the hand
      ctx.save();
      ctx.translate(hx, hy);
      ctx.rotate(bladeAngle);
      drawEnergyBlade(ctx, 0, 0, 34 * k);
      ctx.restore();
    } else if (this.currentWeapon === this.meleeWeapon) {
      // Skana, held at the hand. The art's blade is drawn 45 degrees off upright (melee_sword.svg), so it is turned
      // by the difference, and its crossguard, 9 units from the centre of the art, sits at the hand
      const S = 60 * k;
      const cx = hx + Math.cos(bladeAngle) * 9 * k, cy = hy + Math.sin(bladeAngle) * 9 * k;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(bladeAngle + Math.PI / 4);
      drawArt(ctx, ART.melee, -S / 2, -S / 2, S, S);
      ctx.restore();
    } else {
      drawArt(ctx, ART[slot], WEAPON_LAYER.x * k, WEAPON_LAYER.y * k, WEAPON_LAYER.w * k, WEAPON_LAYER.h * k);
    }

    // Persistent melee attack arc shadow (telegraph) when melee is equipped
    if (this.currentWeapon === this.meleeWeapon && this.meleeSwingTimer === 0) {
      const weapon = this.meleeWeapon;
      const reach = weapon.range * UNITS_PER_METER;
      const halfArc = (weapon.attack.arc ?? 120) * Math.PI / 180 / 2;

      ctx.strokeStyle = "rgba(255, 200, 100, 0.12)";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, reach, -halfArc, halfArc);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Melee swing arc
    if (this.meleeSwingTimer > 0) {
      const weapon = this.meleeWeapon;
      const reach = weapon.range * UNITS_PER_METER;
      const halfArc = (this.meleeSwingType === 'heavy' ? (weapon.heavyAttackData?.arc ?? 140) : (weapon.attack.arc ?? 120)) * Math.PI / 180 / 2;
      const progress = this.swingProgress();
      
      ctx.strokeStyle = this.meleeSwingType === 'heavy' 
        ? `rgba(255, 100, 50, ${0.9 * (1 - progress)})` // orange-red for heavy
        : `rgba(255, 200, 100, ${0.8 * (1 - progress)})`;
      ctx.lineWidth = this.meleeSwingType === 'heavy' ? 6 : 4;
      ctx.lineCap = 'round';
      
      ctx.beginPath();
      ctx.arc(0, 0, reach * 0.3 + reach * 0.7 * progress, -halfArc, halfArc);
      ctx.stroke();
      
      // Hit sparks
      ctx.fillStyle = `rgba(255, 220, 150, ${1 - progress})`;
      for (const hit of this.meleeSwingHits) {
        const localAngle = hit.angle - this.angle;
        const dist = Math.min(hit.distance, reach) * (0.5 + progress * 0.5);
        ctx.beginPath();
        ctx.arc(Math.cos(localAngle) * dist, Math.sin(localAngle) * dist, 3 + progress * 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Parry visualization (blue-white shield arc in front)
    if (this.currentWeapon === this.meleeWeapon && this.meleeWeapon.isParrying) {
      const parryProgress = (gameNow() - this.meleeWeapon.parryStartTime) / (this.meleeWeapon.parryWindow * 1000);
      const parryArc = Math.PI / 2; // 90° front arc
      const parryRadius = 35 + Math.sin(performance.now() * 0.01) * 3; // pulsing
      
      ctx.strokeStyle = parryProgress < 1 
        ? `rgba(100, 200, 255, ${0.8 * (1 - parryProgress)})` // blue while in window
        : `rgba(255, 100, 100, 0.5)`; // red flash when window expires
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, parryRadius, -parryArc / 2, parryArc / 2);
      ctx.stroke();
      
      // Perfect parry indicator (white flash at center)
      if (parryProgress < 0.5) {
        ctx.fillStyle = `rgba(255, 255, 255, ${0.6 * (1 - parryProgress * 2)})`;
        ctx.beginPath();
        ctx.arc(0, 0, 15 * (1 - parryProgress * 2), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Bullet Jump visual effect (directional energy trail)
    if (this.bulletJumpVisualTimer > 0) {
      const progress = 1 - this.bulletJumpVisualTimer / 0.15;
      const trailLength = 40 * progress;
      const alpha = 0.8 * (1 - progress);

      ctx.save();
      // Rotate to bullet jump direction
      const bjAngle = Math.atan2(this.bulletJumpDirection.y, this.bulletJumpDirection.x);
      ctx.rotate(bjAngle - this.angle);

      // Energy trail
      ctx.strokeStyle = `rgba(100, 200, 255, ${alpha})`;
      ctx.lineWidth = 8 * (1 - progress);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-trailLength, 0);
      ctx.lineTo(0, 0);
      ctx.stroke();

      // Glow at origin
      ctx.fillStyle = `rgba(100, 200, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(0, 0, 12 * (1 - progress), 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    ctx.restore();
  }
}

