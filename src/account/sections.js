// What the account saves. Each section gives its data to the save file and takes it back on start-up.
import { PLAYER_FRAMES } from '../warframe/player_frames.js';
import { MOD_INVENTORY } from '../mods/owned_mods.js';
import { wallet } from '../economy/wallet.js';
import { settings } from '../engine/settings.js';
import { readStore, writeStore, user } from '../user/user_data.js';
import { registerAccountSection, loadAccount, installAutoSave } from './account.js';

registerAccountSection('frames', {
  collect: () => structuredClone(PLAYER_FRAMES),
  apply: (data) => {
    for (const [name, frame] of Object.entries(data)) {
      if (!PLAYER_FRAMES[name] || !Array.isArray(frame.configs)) continue;
      Object.assign(PLAYER_FRAMES[name], {
        copies: frame.copies ?? 1,
        formas: frame.formas ?? 0,
        configs: frame.configs,
      });
    }
  },
});

registerAccountSection('mods', {
  collect: () => structuredClone(MOD_INVENTORY),
  apply: (data) => {
    for (const key of Object.keys(MOD_INVENTORY)) delete MOD_INVENTORY[key];
    for (const [uniqueName, entry] of Object.entries(data)) {
      // Older saves stored { count, rank }; each copy now has its own rank in a list
      const ranks = Array.isArray(entry.ranks) ? entry.ranks : Array(entry.count ?? 0).fill(entry.rank ?? 0);
      MOD_INVENTORY[uniqueName] = { ranks };
    }
  },
});

registerAccountSection('wallet', {
  collect: () => ({ profileId: wallet.profileId, balances: { ...wallet.balances } }),
  apply: (data) => {
    if (data.profileId !== wallet.profileId) return; // balances belong to one profile
    wallet.balances = { ...wallet.balances, ...data.balances };
    wallet.save();
  },
});

registerAccountSection('profiles', {
  collect: () => structuredClone(readStore()),
  apply: (data) => {
    if (!data?.profiles) return;
    writeStore(data);
    user.reloadFrom(data.activeId);
  },
});

registerAccountSection('settings', {
  collect: () => ({ ...settings.values }),
  apply: (data) => {
    Object.assign(settings.values, data);
    settings.save();
  },
});

export function startAccount() {
  loadAccount();
  installAutoSave();
}
