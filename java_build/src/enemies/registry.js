const base = new URL('.', import.meta.url).href;

export const ENTITY_REGISTRY = {
  corpus: {
    Crewman: new URL('./corpus/crewman.js', base).href,
    MOA: new URL('./corpus/moa.js', base).href,
    ShieldOsprey: new URL('./corpus/shield_osprey.js', base).href,
  },
  grineer: {
    Butcher: new URL('./grineer/butcher.js', base).href,
    Lancer: new URL('./grineer/lancer.js', base).href,
    Trooper: new URL('./grineer/trooper.js', base).href,
  },
  infested: {
    Charger: new URL('./infested/charger.js', base).href,
    Leaper: new URL('./infested/leaper.js', base).href,
    Runner: new URL('./infested/runner.js', base).href,
  }
};
