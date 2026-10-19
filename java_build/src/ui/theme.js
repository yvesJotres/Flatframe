import { PALETTE as C } from './palette.js';
// The menu theme: every colour, outline and background the menus use is defined here.
// Screens and panels call drawPanel / drawMenuBackground / THEME instead of writing their own values.
// Change the look here and every menu follows.

export const THEME = {
  // Panels: the dark boxes behind tabs, rows, cards and the top bar icons
  panel: {
    fill: C.panel,
    stroke: C.panelStroke,
    strokeWidth: 1,
    radius: 4,
  },
  // The highlighted item (selected row or tab, hovered icon): gold outline
  highlight: {
    stroke: C.selected,
    strokeWidth: 1.5,
  },
  // Orange accent: corner brackets, reset buttons, active bars, and its tints
  accent: C.accent,
  accentSoft: 'rgba(255,107,53,0.5)',   // outline on buttons
  accentFaint: C.accentGlow, // hover fill
  accentFill: C.accentSoft,  // pressed / active fill
  accentGlow: 'rgba(255,107,53,0.3)',   // corner brackets and glows
  // Text and small chrome colours
  text: {
    title: C.text,
    selected: C.selected,
    label: '#c8b8a8',
    hint: '#9090b0',
    footer: C.textFaint,
    dim: C.textDim,
    white: C.white,
    danger: '#ff5b5b',
    error: C.danger,
    ok: C.success,
  },
  // Dark veils and dropdown panels
  veil: 'rgba(6,6,14,0.78)',
  dropdown: {
    fill: 'rgba(10,10,20,0.94)',
    stroke: 'rgba(255,255,255,0.12)',
    glow: 'rgba(255,255,255,0.06)',
  },
  // Frame glyph (the in-game colour of the Warframe)
  frameGreen: '#4ade80',
  // Subtle white fills: track, pips, faint hover
  subtle: {
    faint: 'rgba(255,255,255,0.03)',
    soft: 'rgba(255,255,255,0.05)',
    mid: 'rgba(255,255,255,0.10)',
    track: 'rgba(255,255,255,0.12)',
    pip: 'rgba(255,255,255,0.18)',
  },
  // Accent tint for toggled-on and pressed options
  accentPressed: 'rgba(255,107,53,0.2)',
  // Avatar frame gradient (profile icon)
  avatar: { from: '#2a3550', to: '#5a2f3a' },
  // Warning red for unaffordable options, and a muted label
  text2: { warn: '#e0706a', muted: '#8080a0' },
  inkDark: '#050508',
  // Faint tints behind the main menu (orange, blue, green)
  menuTints: ['rgba(255,107,53,0.04)', 'rgba(58,143,206,0.03)', 'rgba(122,184,0,0.03)'],
  // Profile: warm grey labels, dim borders, the frame's dark fill, and the stat categories
  profile: {
    warmGrey: '#9a8a7a',
    border: '#333355',
    frameFill: '#1a1a2e',
    defense: '#3a8fce',
    utility: '#7ab800',
    gold: '#ffd700',
    pink: '#ff2a8a',
    silver: '#e8e8f0',
    cardFill: 'rgba(10,10,20,0.6)',
    palette: [C.accent, '#3a8fce', '#7ab800', '#ffd700', '#ff2a8a', '#e8e8f0', '#000000', C.white],
  },
  // Squad panel: input and card fills, and the edges around them
  squad: {
    cardFill: 'rgba(18,18,30,0.9)',
    inputFill: '#0a0a14',
    modalFill: C.panelDeep,
    scrim: 'rgba(0,0,0,0.6)',
    edge: 'rgba(255,255,255,0.2)',
    edgeSoft: 'rgba(255,255,255,0.15)',
    youEdge: 'rgba(255,215,138,0.6)',
  },
  // Dark veil over the pause menu
  veilDeep: 'rgba(2,2,5,0.94)',
  // Gold and status colours used on mission cards and the map
  gold: '#ffd700',
  complete: '#7ad07a',
  info: '#4da3ff',
  highlightSoft: 'rgba(255,215,138,0.5)',
  accentStrong: 'rgba(255,107,53,0.6)',
  panelFillAlt: 'rgba(16,16,28,0.9)',
  cardFill: 'rgba(14,16,24,0.94)',
  cardBorder: 'rgba(255,255,255,0.14)',
  cardBanner: ['#1b2028', '#0c0e14'],
  // Text on the map and cards
  text3: { cream: '#f5f0ea', bright: '#e8eefc', grey: '#8a8aaa', grey2: '#8a90a0', dark: '#9a8a7a' },
  // Lines and separators on the map
  line: { faint: 'rgba(255,255,255,0.06)', strong: 'rgba(255,255,255,0.25)' },
  // Space background behind the navigation map
  space: { center: '#0a0a14', mid: '#06060a', edge: '#030305' },
  // Avatar frame gradient (profile icon)
  // Damage type colours (Impact, Puncture, Slash and the elements), used by the Arsenal stats
  damage: {
    impact: '#8fb3c9', puncture: '#e0c870', slash: '#d0584a',
    heat: '#ff7a2e', cold: '#7fd3ff', electricity: '#b48cff', toxin: '#7ad14a',
    fallback: '#aaaaaa',
  },
  // Background gradient stops (top-left to edge)
  background: {
    center: '#0d0d1a',
    mid: '#06060e',
    edge: '#020205',
  },
  // Layout
  topBarHeight: 54,       // squad icons and currency bar
  topBarGap: 18,          // space between the top bar and the content
  backButton: { w: 130, h: 40 },
  tabHeight: 36,
  tabWidth: 160,
};

// Fills and outlines a panel box. selected draws the highlight outline instead of the normal one.
// faintFill: a selected panel also gets the faint accent fill the Arsenal's active panels use
export function drawPanel(ctx, x, y, w, h, { radius = THEME.panel.radius, selected = false, faintFill = false, roundRect } = {}) {
  const path = roundRect ?? defaultRoundRect;
  path(ctx, x, y, w, h, radius);
  ctx.fillStyle = selected && faintFill ? THEME.accentFaint : THEME.panel.fill;
  ctx.fill();
  ctx.strokeStyle = selected ? THEME.highlight.stroke : THEME.panel.stroke;
  ctx.lineWidth = selected ? THEME.highlight.strokeWidth : THEME.panel.strokeWidth;
  ctx.stroke();
}

// The shared background for every menu screen
export function drawMenuBackground(ctx, w, h) {
  const bg = ctx.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.8);
  bg.addColorStop(0, THEME.background.center);
  bg.addColorStop(0.4, THEME.background.mid);
  bg.addColorStop(1, THEME.background.edge);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
}

function defaultRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
