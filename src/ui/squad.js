/**
 * Squad: the players you play with, the matchmaking mode, and inviting members. One file, one panel.
 *
 * The panel comes in two sizes:
 *   'big'    the main menu version: large, centred, room for every member
 *   'small'  the in-game version, opened from the squad icons on the navigation and Arsenal screens
 *
 * Data: you are always the first member (your profile name). Invited members and the mode are saved in this browser.
 * Limit: there is no server, so invited members are local entries only.
 */
import { user } from '../user/user_data.js';
import { FONT as FONT_FAMILY } from './menus/menu_style.js';

export const MAX_SQUAD = 4;
const MAX_NAME = 16;

// Who can join matchmaking. The glyphs are text symbols until real icon art exists.
export const MATCHMAKING_MODES = [
  { id: 'public', label: 'PUBLIC', glyph: '🌐' },
  { id: 'friends', label: 'FRIENDS ONLY', glyph: '☺' },
  { id: 'clan', label: 'CLAN ONLY', glyph: '⛨' },
  { id: 'invite', label: 'INVITE ONLY', glyph: '✉' },
  { id: 'solo', label: 'SOLO', glyph: '👤' },
];

// ---------------------------------------------------------------- data

// Saved on the active user's profile (src/user/user_data.js), already cleaned there
function readState() {
  const s = user.get('squad');
  return { mode: s.mode, invited: s.invited };
}

function writeState(state) {
  user.set('squad', { mode: state.mode, invited: state.invited });
}

export function getMode() {
  return MATCHMAKING_MODES.find((m) => m.id === readState().mode) ?? MATCHMAKING_MODES[0];
}

export function setMode(id) {
  if (!MATCHMAKING_MODES.some((m) => m.id === id)) return false;
  writeState({ ...readState(), mode: id });
  return true;
}

// You first, then the members you invited
export function getMembers() {
  return [{ id: user.id, name: user.get('displayName'), you: true }, ...readState().invited];
}

// Returns { ok: true, member } or { ok: false, error }
export function inviteMember(name) {
  const clean = String(name ?? '').trim();
  if (!clean) return { ok: false, error: 'Enter a name first' };
  if (clean.length > MAX_NAME) return { ok: false, error: `Names can be up to ${MAX_NAME} characters` };
  const members = getMembers();
  if (members.length >= MAX_SQUAD) return { ok: false, error: `A squad holds up to ${MAX_SQUAD} players` };
  if (members.some((m) => m.name.toLowerCase() === clean.toLowerCase())) return { ok: false, error: `${clean} is already in your squad` };
  const member = { id: globalThis.crypto?.randomUUID?.() ?? `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, name: clean };
  const state = readState();
  writeState({ ...state, invited: [...state.invited, member] });
  return { ok: true, member };
}

export function removeMember(id) {
  const state = readState();
  const invited = state.invited.filter((m) => m.id !== id);
  if (invited.length === state.invited.length) return false;
  writeState({ ...state, invited });
  return true;
}

// ---------------------------------------------------------------- panel

// Sizes for each version of the panel
const SIZES = {
  big: { width: 760, title: 22, name: 18, label: 13, tile: 76, tileFont: 30, button: 15, pad: 26, gap: 12, glyph: 22 },
  small: { width: 360, title: 15, name: 14, label: 11, tile: 44, tileFont: 18, button: 12, pad: 16, gap: 8, glyph: 15 },
};

let root = null;
let body = null;
let message = null;
let current = null; // { size, anchor } of the open panel

const css = (o) => Object.entries(o).map(([k, v]) => `${k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}:${v}`).join(';');
function el(tag, style = {}, text) {
  const node = document.createElement(tag);
  node.setAttribute('style', css(style));
  if (text !== undefined) node.textContent = text;
  return node;
}

function setMessage(text, isError = true) {
  message.textContent = text;
  message.style.color = isError ? '#f0a0a0' : '#9af0b0';
}

function sectionLabel(s, text) {
  return el('div', { color: '#9a9ab0', font: `600 ${s.label}px ${FONT_FAMILY}`, letterSpacing: '1px' }, text);
}

// One squad member: a profile tile (initial letter) with the username beside it
function memberCard(s, m) {
  const card = el('div', { display: 'flex', alignItems: 'center', gap: `${s.gap}px`, padding: `${s.gap}px`,
    background: 'rgba(18,18,30,0.9)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', minWidth: '0' });
  const tile = el('div', {
    width: `${s.tile}px`, height: `${s.tile}px`, flexShrink: '0', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: m.you ? 'linear-gradient(135deg,#2a3550,#5a2f3a)' : 'linear-gradient(135deg,#2a2a3a,#3a2a34)',
    border: `1px solid ${m.you ? 'rgba(255,215,138,0.6)' : 'rgba(255,255,255,0.2)'}`, borderRadius: '4px',
    color: '#f0e8e0', font: `700 ${s.tileFont}px ${FONT_FAMILY}`,
  }, m.name.charAt(0).toUpperCase());
  const text = el('div', { minWidth: '0', flex: '1' });
  text.appendChild(el('div', { color: '#f0e8e0', font: `700 ${s.name}px ${FONT_FAMILY}`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, m.name));
  text.appendChild(el('div', { color: m.you ? '#ff6b35' : '#9a9ab0', font: `600 ${s.label}px ${FONT_FAMILY}` }, m.you ? 'YOU' : 'INVITED'));
  card.append(tile, text);
  if (!m.you) {
    const remove = el('button', { type: 'button', background: 'rgba(255,107,53,0.18)', border: '1px solid rgba(255,107,53,0.6)', color: '#ffd78a',
      borderRadius: '4px', padding: `${s.gap / 2}px ${s.gap}px`, font: `600 ${s.button}px ${FONT_FAMILY}`, cursor: 'pointer' }, 'REMOVE');
    remove.addEventListener('click', () => {
      if (removeMember(m.id)) setMessage(`${m.name} left the squad`, false);
      render();
    });
    card.appendChild(remove);
  }
  return card;
}

function render() {
  const s = SIZES[current.size];
  body.replaceChildren();

  body.appendChild(el('div', { color: '#ffd78a', font: `700 ${s.title}px ${FONT_FAMILY}`, letterSpacing: '2px' },
    `SQUAD  ${getMembers().length}/${MAX_SQUAD}`));

  // Members
  const members = el('div', { display: 'grid', gridTemplateColumns: current.size === 'big' ? '1fr 1fr' : '1fr', gap: `${s.gap}px` });
  for (const m of getMembers()) members.appendChild(memberCard(s, m));
  body.appendChild(members);

  // Add a squad member
  body.appendChild(sectionLabel(s, 'ADD SQUAD MEMBER'));
  const form = el('form', { display: 'flex', gap: `${s.gap}px` });
  const input = el('input', { type: 'text', maxlength: String(MAX_NAME), placeholder: 'Player name', autocomplete: 'off',
    flex: '1', minWidth: '0', background: '#0a0a14', border: '1px solid rgba(255,255,255,0.15)', color: '#f0e8e0', borderRadius: '4px',
    padding: `${s.gap / 2}px ${s.gap}px`, font: `${s.button + 1}px ${FONT_FAMILY}` });
  const add = el('button', { type: 'submit', background: 'rgba(255,107,53,0.18)', border: '1px solid rgba(255,107,53,0.6)', color: '#ffd78a',
    borderRadius: '4px', padding: `${s.gap / 2}px ${s.gap}px`, font: `700 ${s.button}px ${FONT_FAMILY}`, cursor: 'pointer' }, 'ADD');
  form.append(input, add);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    // Solo means no squad, so members can't be added until the matchmaking mode is changed
    if (getMode().id === 'solo') return setMessage('You are in SOLO mode. Change the matchmaking mode to add members.');
    const result = inviteMember(input.value);
    if (!result.ok) return setMessage(result.error);
    setMessage(`${result.member.name} was added`, false);
    render();
  });
  body.appendChild(form);

  body.appendChild(message);
  body.appendChild(el('button', { type: 'button', alignSelf: 'flex-end', background: 'rgba(255,107,53,0.18)', border: '1px solid rgba(255,107,53,0.6)',
    color: '#ffd78a', borderRadius: '4px', padding: `${s.gap / 2}px ${s.gap}px`, font: `600 ${s.button}px ${FONT_FAMILY}`, cursor: 'pointer' }, 'CLOSE'))
    .addEventListener('click', closeSquad);
}

function build() {
  root = el('div', { position: 'fixed', inset: '0', zIndex: '80', display: 'none' });
  root.addEventListener('click', backdropClose);
  body = el('div', { position: 'absolute', background: 'rgba(10,10,20,0.97)', border: '1px solid rgba(255,107,53,0.5)', borderRadius: '6px',
    display: 'flex', flexDirection: 'column', boxSizing: 'border-box', maxHeight: '90vh', overflowY: 'auto' });
  message = el('div', { font: `13px ${FONT_FAMILY}`, minHeight: '18px' });
  root.appendChild(body);
  document.body.appendChild(root);
}

// Opens the squad panel.
//   size: 'big' (main menu) or 'small' (in-game)
//   anchor: for 'small', the icon's box in canvas pixels; the panel opens under it. Defaults to the top-left corner.
export function openSquad({ size = 'small', anchor = null, canvas = document.getElementById('gameCanvas') } = {}) {
  if (!root) build();
  current = { size, anchor };
  // A normal open is a modal: a dark backdrop that closes on click.
  root.style.background = 'rgba(0,0,0,0.6)';
  root.style.pointerEvents = 'auto';
  root.addEventListener('click', backdropClose);
  body.style.pointerEvents = 'auto';
  const s = SIZES[size];
  body.style.padding = `${s.pad}px`;
  body.style.gap = `${s.gap}px`;
  body.style.width = `min(${s.width}px, 92vw)`;
  if (size === 'big') {
    Object.assign(body.style, { left: '50%', top: '50%', transform: 'translate(-50%,-50%)' });
  } else {
    // Small: under the anchor (or the top-left corner), converted from canvas pixels to screen pixels
    const rect = canvas.getBoundingClientRect();
    const sx = rect.width / canvas.width, sy = rect.height / canvas.height;
    const a = anchor ?? { x: 96, y: 46, w: 42, h: 42 };
    Object.assign(body.style, {
      left: `${rect.left + a.x * sx}px`, top: `${rect.top + (a.y + a.h + 8) * sy}px`, transform: 'none',
    });
  }
  setMessage('');
  render();
  root.style.display = 'block';
}

export function closeSquad() {
  if (root) root.style.display = 'none';
}

// True while the squad panel is open (the game loop closes it on Escape before the screen sees the key)
export function isSquadOpen() {
  return !!root && root.style.display === 'block';
}

// The squad-mode icon's box in canvas pixels (the same place on the navigation, Arsenal and main menus)
export const SQUAD_MODE_BOX = { x: 144, y: 46, w: 42, h: 42 };

// ---------------------------------------------------------------- matchmaking dropdown on hover

// Shown under the matchmaking icon while the pointer is over the icon or the list. It is separate from the squad panel.
let modeDrop = null;
let modeDropOn = false;
let modeDropCanvas = null;
let modeDropBox = SQUAD_MODE_BOX; // the matchmaking icon's box on the current screen

function buildModeDrop() {
  // Above the squad panel (zIndex 80) so the list is never hidden under it
  modeDrop = el('div', { position: 'fixed', zIndex: '81', display: 'none', flexDirection: 'column', width: '255px',
    boxSizing: 'border-box', background: 'rgba(10,10,20,0.94)', border: '1px solid rgba(255,255,255,0.12)' });
  document.body.appendChild(modeDrop);
  document.addEventListener('mousemove', onModeDropMove);
}

// The matchmaking icon's box on screen, from canvas pixels
function modeBoxScreenRect() {
  const rect = modeDropCanvas.getBoundingClientRect();
  const sx = rect.width / modeDropCanvas.width, sy = rect.height / modeDropCanvas.height;
  const b = modeDropBox;
  return { left: rect.left + b.x * sx, top: rect.top + b.y * sy, right: rect.left + (b.x + b.w) * sx, bottom: rect.top + (b.y + b.h) * sy };
}

function renderModeDrop() {
  modeDrop.replaceChildren();
  const active = getMode();
  for (const mode of MATCHMAKING_MODES) {
    const on = mode.id === active.id;
    const row = el('div', { display: 'flex', alignItems: 'center', gap: '12px', width: '255px', height: '42px', boxSizing: 'border-box',
      padding: '0 12px', color: on ? '#ffd78a' : '#f0e8e0', font: `700 14px ${FONT_FAMILY}`, cursor: 'pointer', whiteSpace: 'nowrap' });
    row.appendChild(el('span', { width: '22px', textAlign: 'center', font: '18px "Segoe UI Symbol",Arial,sans-serif' }, mode.glyph));
    row.appendChild(el('span', {}, mode.label));
    // The row under the pointer gets the main menu's selected look: yellow text on an orange glow band
    const glow = 'linear-gradient(90deg,rgba(255,107,53,0) 0%,rgba(255,107,53,0.14) 50%,rgba(255,107,53,0) 100%)';
    const base = { background: 'transparent', color: on ? '#ffd78a' : '#f0e8e0' };
    row.addEventListener('mouseenter', () => Object.assign(row.style, { background: glow, color: '#ffd78a' }));
    row.addEventListener('mouseleave', () => Object.assign(row.style, base));
    row.addEventListener('click', () => { setMode(mode.id); renderModeDrop(); });
    modeDrop.appendChild(row);
  }
}

function inRect(r, x, y) {
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

// Shows the list while the pointer is over the matchmaking icon or over the list itself
function onModeDropMove(e) {
  if (!modeDropOn || !modeDropCanvas) return;
  const box = modeBoxScreenRect();
  const over = inRect(box, e.clientX, e.clientY) || (modeDrop.style.display !== 'none' && inRect(modeDrop.getBoundingClientRect(), e.clientX, e.clientY));
  if (over && modeDrop.style.display === 'none') {
    modeDrop.style.left = `${box.left}px`;
    modeDrop.style.top = `${box.bottom}px`;
    renderModeDrop();
    modeDrop.style.display = 'flex';
  } else if (!over) {
    modeDrop.style.display = 'none';
  }
}

// Called every frame: enabled on the screens that show the matchmaking icon
export function syncModeDrop(enabled, box = SQUAD_MODE_BOX, canvas = document.getElementById('gameCanvas')) {
  if (!modeDrop) buildModeDrop();
  modeDropOn = enabled;
  modeDropCanvas = canvas;
  modeDropBox = box;
  if (!enabled) modeDrop.style.display = 'none';
}

function backdropClose(e) {
  if (e.target === root) closeSquad();
}
