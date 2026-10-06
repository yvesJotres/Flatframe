import PrimaryWeapon, { PRIMARY_WEAPONS, DEFAULT_PRIMARY } from './primary_weapon.js';
import SecondaryWeapon, { SECONDARY_WEAPONS, DEFAULT_SECONDARY } from './secondary_weapon.js';
import MeleeWeapon, { MELEE_WEAPONS, DEFAULT_MELEE } from './melee_weapon.js';

const CATEGORIES = {
  primary: { data: PRIMARY_WEAPONS, Class: PrimaryWeapon, defaultName: DEFAULT_PRIMARY },
  secondary: { data: SECONDARY_WEAPONS, Class: SecondaryWeapon, defaultName: DEFAULT_SECONDARY },
  melee: { data: MELEE_WEAPONS, Class: MeleeWeapon, defaultName: DEFAULT_MELEE },
};

export const WeaponLibrary = {
  categories() {
    return Object.keys(CATEGORIES);
  },

  list(category) {
    const entry = CATEGORIES[category];
    return entry ? Object.keys(entry.data) : [];
  },

  has(category, name) {
    return Boolean(CATEGORIES[category]?.data[name]);
  },

  defaultName(category) {
    return CATEGORIES[category]?.defaultName;
  },

  get(category, name) {
    const entry = CATEGORIES[category];
    if (!entry) return undefined;
    return entry.data[name ?? entry.defaultName];
  },

  create(category, name) {
    const entry = CATEGORIES[category];
    if (!entry) throw new Error(`Unknown weapon category: ${category}`);
    return new entry.Class(name ?? entry.defaultName);
  },
};

export default WeaponLibrary;
