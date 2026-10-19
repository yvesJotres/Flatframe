// The statistics of the current mission, shown on the results screen: enemies killed, melee kills, damage dealt and
// received, loot collected by type, and the affinity (XP) earned. Reset when a mission starts.
const state = newState();

function newState() {
  return { kills: 0, meleeKills: 0, damageDealt: 0, damageReceived: 0, affinity: 0, loot: {} };
}

export function resetMissionStats() {
  Object.assign(state, newState());
}

export function missionStats() {
  return { ...state, loot: { ...state.loot } };
}

export function recordDamageDealt(amount) {
  if (amount > 0) state.damageDealt += amount;
}

export function recordDamageReceived(amount) {
  if (amount > 0) state.damageReceived += amount;
}

export function recordKill({ melee = false } = {}) {
  state.kills += 1;
  if (melee) state.meleeKills += 1;
}

export function recordLoot(type, amount = 1) {
  state.loot[type] = (state.loot[type] ?? 0) + amount;
}

export function recordAffinity(amount) {
  if (amount > 0) state.affinity += amount;
}
