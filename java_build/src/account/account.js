// The account: every save goes through here. Sections (frames, mods, wallet, profiles, settings) register how they
// are saved and loaded; the account writes them all into one crash-safe save, and reads them back on start-up.
export { registerSaveSection as registerAccountSection, writeSave as saveAccount, applySave as loadAccount, installAutoSave } from './storage.js';
