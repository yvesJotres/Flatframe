// Earth's map art: rough [longitude, latitude] outlines in degrees, drawn on the globe by visual_effects.js.
// Data only. The look (colours, spin, shading) is in the visual effects file.

// Continents: real coastlines are in earth_land.js (EARTH_LAND_RINGS)

// Ice caps, north and south

// Colours of the globe
export const EARTH_COLORS = {
  oceanLight: '#3d8fe0',
  oceanMid: '#1b5fb4',
  oceanDeep: '#07245a',
  land: '#4c9a52',
  desert: '#c4a964',
  ice: '#e8f2ff',
  rim: 'rgba(120,180,255,0.35)',
  outline: 'rgba(140,190,255,0.5)',
};

// Tilt of the globe's axis (radians) and the spin speeds (degrees per second)
export const EARTH_SPIN = { tilt: -0.32, land: 5, clouds: 4 };
