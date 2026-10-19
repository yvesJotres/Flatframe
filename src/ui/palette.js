/**
 * The colour palette for every menu and screen. Change a colour here and it changes everywhere it is used.
 * Menus, the squad panel, the login and the profile panel all read from this file.
 */
export const PALETTE = {
  // Accent and highlights
  accent: '#ff6b35',          // orange: selected rows, borders of active items, bars
  accentSoft: 'rgba(255,107,53,0.18)', // orange button fill
  accentGlow: 'rgba(255,107,53,0.12)', // soft orange band behind a selected row
  selected: '#ffd78a',        // yellow: selected text, titles
  danger: '#f0a0a0',          // errors and warnings
  success: '#9af0b0',         // confirmations
  blue: '#4da3ff',            // unlocked, not yet played

  // Text
  text: '#f0e8e0',            // main text
  textDim: '#9a9ab0',         // labels and secondary text
  textFaint: '#7a7a9a',       // hints and footers
  white: '#ffffff',

  // Panels
  panel: 'rgba(24,30,44,0.92)',        // boxes on the icons, currency bar and buttons
  panelDeep: 'rgba(10,10,20,0.97)',    // the squad panel and other full panels
  panelStroke: 'rgba(255,255,255,0.08)', // faint outline of a box

  // Extra text and edges used by the squad, profile and login panels
  textSoft: '#c7cddf',
  textMuted: '#8b93ad',
  accentLine: 'rgba(255,107,53,0.6)',  // orange edge of a button
  accentEdge: 'rgba(255,107,53,0.5)',  // orange outline of a panel
};
