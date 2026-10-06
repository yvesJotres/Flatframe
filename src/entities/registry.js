const base = new URL('.', import.meta.url).href;

export const ENTITY_REGISTRY = {
  corpus: {
    Crewman: new URL('./factions/corpus/crewman.js', base).href,
    MOA: new URL('./factions/corpus/moa.js', base).href,
    ShieldOsprey: new URL('./factions/corpus/shield_osprey.js', base).href,
  },
  grineer: {
    Butcher: new URL('./factions/grineer/butcher.js', base).href,
    Lancer: new URL('./factions/grineer/lancer.js', base).href,
    Trooper: new URL('./factions/grineer/trooper.js', base).href,
  },
  infested: {
    Charger: new URL('./factions/infested/charger.js', base).href,
    Leaper: new URL('./factions/infested/leaper.js', base).href,
    Runner: new URL('./factions/infested/runner.js', base).href,
  }
};
