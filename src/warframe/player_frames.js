// The player's own Warframes: how many copies, the rank of the copy, formas, and the mods equipped in each config.
// Base information for each Warframe is in library.js.
export const PLAYER_FRAMES = {
  Excalibur: {
    copies: 1,
    formas: 0,
    configs: [{ mods: Array(10).fill(null) }, { mods: Array(10).fill(null) }, { mods: Array(10).fill(null) }],
  },
};
