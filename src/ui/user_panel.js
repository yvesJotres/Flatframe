/**
 * User panel: shows who is signed in and signs them out. Opened from the profile icon in the Arsenal.
 * Accounts are switched by signing out and signing in again, so every switch needs the password.
 */
import { listUsers } from '../user/accounts.js';
import { signOut } from '../user/auth.js';
import { openLoginScreen } from './login_screen.js';
import { FONT as FONT_FAMILY } from './menus/menu_style.js';

let root = null;
let body = null;

const button = 'background:rgba(255,107,53,0.18);border:1px solid rgba(255,107,53,0.6);color:#ffd78a;border-radius:4px;padding:8px 14px;font:600 14px ' + FONT_FAMILY + ';cursor:pointer;';

function el(tag, attrs = {}, text) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}

function render() {
  body.replaceChildren();
  const current = listUsers().find((u) => u.active);
  body.appendChild(el('div', { style: 'color:#9a9ab0;font:600 12px ' + FONT_FAMILY + ';letter-spacing:1px;' }, 'SIGNED IN AS'));
  body.appendChild(el('div', { style: 'color:#f0e8e0;font:700 20px ' + FONT_FAMILY + ';' }, current?.displayName ?? '—'));
  const out = el('button', { type: 'button', style: button + 'align-self:flex-start;margin-top:10px;' }, 'SIGN OUT');
  out.addEventListener('click', () => {
    signOut();
    closeUserPanel();
    openLoginScreen();
  });
  body.appendChild(out);
}

function build() {
  root = el('div', {
    id: 'user-panel',
    style: 'position:fixed;inset:0;z-index:80;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);',
  });
  const box = el('div', {
    style: 'width:min(360px,90vw);background:rgba(10,10,20,0.97);border:1px solid rgba(255,107,53,0.5);border-radius:6px;padding:20px;display:flex;flex-direction:column;gap:10px;',
  });
  box.appendChild(el('div', { style: 'color:#ffd78a;font:700 16px ' + FONT_FAMILY + ';letter-spacing:2px;' }, 'PROFILE'));
  body = el('div', { style: 'display:flex;flex-direction:column;gap:4px;' });
  box.appendChild(body);
  const close = el('button', { type: 'button', style: button + 'align-self:flex-end;' }, 'CLOSE');
  close.addEventListener('click', closeUserPanel);
  box.appendChild(close);
  root.appendChild(box);
  root.addEventListener('click', (e) => { if (e.target === root) closeUserPanel(); });
  document.body.appendChild(root);
}

export function openUserPanel() {
  if (!root) build();
  render();
  root.style.display = 'flex';
}

export function closeUserPanel() {
  if (root) root.style.display = 'none';
}
