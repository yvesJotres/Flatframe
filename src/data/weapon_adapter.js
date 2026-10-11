// Convert Warframe Public Export weapon → Weapon constructor stats
export function adaptAttack(wfAttack) {
  const heavy = wfAttack.heavy_attack;
  const normalDamage = wfAttack.damage ?? {};
  const heavyDamage = heavy?.damage_multiplier ? Object.fromEntries(
    Object.entries(normalDamage).map(([k, v]) => [k, v * heavy.damage_multiplier])
  ) : {};
  // Warframe JSON uses 'blocking_angle' for normal attack arc, 'arc' for heavy
  const arc = wfAttack.blocking_angle ?? wfAttack.arc;
  return {
    fireRate: wfAttack.fire_rate ?? wfAttack.speed ?? 1,
    damage: normalDamage,
    critChance: (wfAttack.critical_chance ?? wfAttack.crit_chance ?? 0) / 100,
    critMultiplier: wfAttack.critical_multiplier ?? wfAttack.crit_mult ?? 1,
    statusChance: (wfAttack.status_chance ?? 0) / 100,
    shotType: (wfAttack.shot_type ?? 'hit-scan').toLowerCase().replace('hitscan', 'hit-scan'),
    range: wfAttack.range ?? 300,
    multishot: wfAttack.multishot ?? 1,
    ammoCost: wfAttack.ammo_cost ?? 1,
    punchThrough: wfAttack.punch_through ?? 0,
    // melee
    arc: arc,
    heavyAttackData: heavy ? {
      damage_multiplier: heavy.damage_multiplier,
      wind_up: heavy.wind_up,
      critChance: (heavy.crit_chance ?? 0) / 100,
      critMultiplier: heavy.crit_mult ?? 1,
      statusChance: (heavy.status_chance ?? 0) / 100,
      damage: heavyDamage,
    } : null,
    meleeCooldown: wfAttack.melee_cooldown,
  };
}

export function adaptWeapon(wfWeapon) {
  const primaryAttack = wfWeapon.attacks?.find(a => a.name === 'Normal') ?? wfWeapon.attacks?.[0] ?? {};
  return {
    name: wfWeapon.name,
    uniqueName: wfWeapon.uniqueName,
    magazine: wfWeapon.magazine_size ?? wfWeapon.magazineSize ?? 30,
    reload: wfWeapon.reload_time ?? wfWeapon.reloadTime ?? 1,
    ammoPickup: wfWeapon.ammoPickup,
    ammoMax: wfWeapon.ammoMax ?? wfWeapon.magazine_size ?? wfWeapon.magazineSize ?? 30,
    sound: wfWeapon.sound,
    reloadSound: wfWeapon.reload_sound ?? wfWeapon.reloadSound,
    attack: adaptAttack(primaryAttack),
    attacks: wfWeapon.attacks,
    range: primaryAttack.range ?? 2.5,
    class: wfWeapon.type,
    stats: wfWeapon,
    // mod capacity
    polarity: wfWeapon.polarities?.[0]?.polarity ?? 'madurai',
    masteryReq: wfWeapon.masteryReq ?? 0,
    // melee cooldown (default 0.45s from constants)
    meleeCooldown: (primaryAttack.melee_cooldown ?? 0.45),
  };
}