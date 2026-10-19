// Base information for every Warframe: stats at rank 0 and rank 30, polarities, abilities.
// This is the same for every player. A player's own copies, ranks and mods live in player_frames.js.
export const MAX_FRAME_RANK = 30;
export const STARTING_ENERGY = 50; // wiki: missions start with 50 energy

export const FRAME_LIBRARY = {
  Excalibur: {
    name: 'Excalibur',
    polarities: ['vazarin', 'madurai'],
    sprintSpeed: 1,
    // Wiki: health, shields and energy grow linearly from rank 0 to rank 30; armor stays the same
    stats: {
      rank0: { health: 270, shield: 270, armor: 240, energy: 100 },
      rank30: { health: 370, shield: 370, armor: 240, energy: 150 },
    },
    abilities: ['Slash Dash', 'Radial Blind', 'Radial Javelin', 'Exalted Blade'],
  },
};

export function baseFrameStats(name, rank) {
  const frame = FRAME_LIBRARY[name];
  if (!frame) return null;
  const { rank0, rank30 } = frame.stats;
  const t = Math.min(MAX_FRAME_RANK, Math.max(0, rank)) / MAX_FRAME_RANK;
  const at = (key) => Math.round(rank0[key] + (rank30[key] - rank0[key]) * t);
  return { health: at('health'), shield: at('shield'), armor: rank0.armor, energy: at('energy') };
}
