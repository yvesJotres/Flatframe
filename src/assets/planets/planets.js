// Art for the planets on the navigation map, other than Earth (see earth.js for Earth).
// Data only: the drawing is in src/engine/visual_effects.js.

// Body gradient: light at the top left, dark at the edge (colours from the centre out)
export const PLANET_BODY_COLORS = ['#4a3a2a', '#3a2a1a', '#1a1008'];

// Darker land patches on the body, as [x, y, half width, half height, rotation, alpha] relative to the radius
export const PLANET_LAND_PATCHES = [
  [-0.2, -0.1, 0.35, 0.25, 0.5, 0.6],
  [0.15, 0.1, 0.3, 0.2, -0.3, 0.6],
  [-0.1, 0.35, 0.25, 0.15, 0.8, 0.6],
];
export const PLANET_LAND_RGB = [100, 80, 50];

// Halo around each planet: colours from the inside out, for Earth and for the other planets
export const ATMOSPHERE_COLORS = {
  earth: ['rgba(110,175,255,0.30)', 'rgba(110,175,255,0.10)'],
  other: ['rgba(232,93,42,0.15)', 'rgba(232,93,42,0.05)'],
};
