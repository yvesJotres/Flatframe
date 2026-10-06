const base = new URL('.', import.meta.url).href;

export const ENTITY_REGISTRY = {
  corpus: {
    Crewman: new URL('./ai/enemies/factions/corpus/crewman.js', base).href,
    MOA: new URL('./ai/enemies/factions/corpus/moa.js', base).href,
    ShieldOsprey: new URL('./ai/enemies/factions/corpus/shield_osprey.js', base).href,
  },
  grineer: {
    Butcher: new URL('./ai/enemies/factions/grineer/butcher.js', base).href,
    Lancer: new URL('./ai/enemies/factions/grineer/lancer.js', base).href,
    Trooper: new URL('./ai/enemies/factions/grineer/trooper.js', base).href,
  },
  infested: {
    Charger: new URL('./ai/enemies/factions/infested/charger.js', base).href,
    Leaper: new URL('./ai/enemies/factions/infested/leaper.js', base).href,
    Runner: new URL('./ai/enemies/factions/infested/runner.js', base).href,
  }
};
