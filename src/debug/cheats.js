/**
 * Testing cheats for the browser console. Kept in release builds on purpose.
 *   imrich          +9,999 Platinum
 *   imrichcredits   +1,000,000 Credits
 *   imrichendo      +9,999 Endo
 *   gimmepotato     one free Orokin Catalyst and one Orokin Reactor
 *   godmode         toggles invulnerability
 *   winmission      ends the current mission as a win
 *   killall         kills every enemy in the current mission
 *   resetdata       clears the saved wallet and profile, then reloads the page
 */
import { wallet as playerWallet } from '../economy/wallet.js';
import { itemUpgrades } from '../economy/item_upgrades.js';

// Read by Player.takeDamage: while on, the player takes no damage in any mode
export const godMode = { on: false };

function command(name, run) {
  Object.defineProperty(window, name, { configurable: true, get: run });
}

export function installDebugCheats(hooks = {}, wallet = playerWallet) {
  command('imrich', () => {
    wallet.add('platinum', 9999);
    return `+9,999 Platinum (now ${wallet.get('platinum').toLocaleString('en-US')})`;
  });
  command('imrichcredits', () => {
    wallet.add('credits', 1000000);
    return `+1,000,000 Credits (now ${wallet.get('credits').toLocaleString('en-US')})`;
  });
  command('imrichendo', () => {
    wallet.add('endo', 9999);
    return `+9,999 Endo (now ${wallet.get('endo').toLocaleString('en-US')})`;
  });
  command('gimmepotato', () => {
    itemUpgrades.owned.catalyst++;
    itemUpgrades.owned.reactor++;
    return 'Added 1 Orokin Catalyst and 1 Orokin Reactor';
  });
  command('godmode', () => {
    godMode.on = !godMode.on;
    return `God mode ${godMode.on ? 'ON' : 'OFF'}`;
  });
  command('winmission', () => hooks.winMission?.() ?? 'Not available');
  command('killall', () => hooks.killAll?.() ?? 'Not available');
  command('resetdata', () => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('flatframe.wallet') || key.startsWith('flatframe.user')) localStorage.removeItem(key);
    }
    location.reload();
    return 'Reloading';
  });
}
