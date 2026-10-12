/**
 * Login screen: signs in to the admin account on this browser. Shown on start-up until someone is signed in.
 * Plain DOM over the game, so it covers every screen. It can't be closed without signing in.
 */
import { userIdByName, ADMIN_NAME } from '../user/accounts.js';
import { MAX_NAME_LENGTH } from '../user/user_data.js';
import { signIn } from '../user/auth.js';
import { FONT as FONT_FAMILY } from './menus/menu_style.js';

let root = null;
let form = null;
let message = null;

const input = 'width:100%;box-sizing:border-box;background:#0a0a14;border:1px solid rgba(255,255,255,0.15);color:#f0e8e0;border-radius:4px;padding:12px;font:16px ' + FONT_FAMILY + ';';
const button = 'width:100%;background:rgba(255,107,53,0.2);border:1px solid rgba(255,107,53,0.7);color:#ffd78a;border-radius:4px;padding:14px;font:700 16px ' + FONT_FAMILY + ';letter-spacing:1px;cursor:pointer;';
const label = 'color:#9a9ab0;font:600 12px ' + FONT_FAMILY + ';letter-spacing:1px;margin-top:6px;';

function el(tag, attrs = {}, text) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}

function setMessage(text, isError = true) {
  message.textContent = text;
  message.style.color = isError ? '#f0a0a0' : '#9af0b0';
}

const EYE_OPEN = '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>';
const EYE_SHUT = '<path d="M17.94 17.94A10.9 10.9 0 0 1 12 19c-7 0-11-7-11-7a19.8 19.8 0 0 1 5.06-5.94M9.9 4.24A10.9 10.9 0 0 1 12 4c7 0 11 7 11 7a19.8 19.8 0 0 1-3.17 4.19M1 1l22 22"/>';

function passwordField() {
  const wrap = el('div', { style: 'position:relative;' });
  const field = el('input', { id: 'login-pass', type: 'password', autocomplete: 'current-password', style: input + 'padding-right:48px;' });
  const toggle = el('button', {
    type: 'button',
    'aria-label': 'Show password',
    'aria-pressed': 'false',
    style: 'position:absolute;right:0;top:0;height:100%;width:44px;background:none;border:none;color:#9a9ab0;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;',
  });
  toggle.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${EYE_OPEN}</svg>`;
  toggle.addEventListener('click', () => {
    const showing = field.type === 'text';
    field.type = showing ? 'password' : 'text';
    toggle.setAttribute('aria-pressed', String(!showing));
    toggle.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
    toggle.querySelector('svg').innerHTML = showing ? EYE_OPEN : EYE_SHUT;
    field.focus();
  });
  wrap.append(field, toggle);
  return wrap;
}

function renderForm() {
  form.replaceChildren();
  form.appendChild(el('div', { style: label }, 'USERNAME'));
  form.appendChild(el('input', { id: 'login-user', type: 'text', value: ADMIN_NAME, maxlength: String(MAX_NAME_LENGTH), autocomplete: 'username', autocapitalize: 'off', style: input }));
  form.appendChild(el('div', { style: label }, 'PASSWORD'));
  form.appendChild(passwordField());
  form.appendChild(el('div', { style: 'color:#7a7a9a;font:12px ' + FONT_FAMILY + ';margin-top:4px;' }, 'First sign-in sets the password.'));
  const remember = el('label', { style: 'display:flex;align-items:center;gap:8px;margin-top:10px;color:#c8c8dc;font:14px ' + FONT_FAMILY + ';cursor:pointer;' });
  const box = el('input', { id: 'login-remember', type: 'checkbox', style: 'width:16px;height:16px;accent-color:#ff6b35;' });
  box.checked = true;
  remember.append(box, document.createTextNode('Auto login (stay signed in)'));
  form.appendChild(remember);
  form.appendChild(el('button', { type: 'submit', style: button + 'margin-top:12px;' }, 'SIGN IN'));
}

async function onSubmit(e) {
  e.preventDefault();
  const pass = form.querySelector('#login-pass')?.value ?? '';
  const remember = form.querySelector('#login-remember')?.checked ?? true;
  const name = form.querySelector('#login-user')?.value ?? '';
  const id = userIdByName(name);
  if (!id) return setMessage('No user with that name');
  let result;
  try {
    result = await signIn(id, pass, { remember });
  } catch {
    // crypto.subtle (password hashing) only exists on HTTPS pages and localhost
    return setMessage(window.isSecureContext ? 'Sign-in failed, try again' : 'Sign-in needs a secure (HTTPS) connection');
  }
  if (!result.ok) {
    setMessage(result.error);
    const field = form.querySelector('#login-pass');
    if (field) { field.value = ''; field.focus(); }
    return;
  }
  setMessage('Signed in', false);
  setTimeout(closeLoginScreen, 300);
}

function build() {
  root = el('div', {
    id: 'login-screen',
    style: 'position:fixed;inset:0;z-index:110;display:none;align-items:center;justify-content:center;overflow-y:auto;padding:16px;box-sizing:border-box;background:radial-gradient(circle at 30% 20%,#141826,#06060e 60%,#020205);',
  });
  const box = el('div', {
    style: 'width:min(380px,100%);margin:auto;display:flex;flex-direction:column;gap:6px;',
  });
  box.appendChild(el('div', { style: 'color:#f0e8e0;font:800 clamp(26px,9vw,34px) ' + FONT_FAMILY + ';letter-spacing:4px;text-align:center;' }, 'FLATFRAME'));
  box.appendChild(el('div', { style: 'color:#ff6b35;font:600 11px ' + FONT_FAMILY + ';letter-spacing:4px;text-align:center;margin-bottom:18px;' }, 'SIGN IN'));

  form = el('form', { style: 'display:flex;flex-direction:column;gap:6px;' });
  form.addEventListener('submit', onSubmit);
  box.appendChild(form);

  message = el('div', { style: 'font:700 15px ' + FONT_FAMILY + ';min-height:24px;margin-top:10px;text-align:center;' });
  box.appendChild(message);

  root.appendChild(box);
  document.body.appendChild(root);
}

export function openLoginScreen() {
  if (!root) build();
  root.style.display = 'flex';
  renderForm();
  setMessage('');
  setTimeout(() => form.querySelector('input')?.focus(), 0);
}

export function closeLoginScreen() {
  if (root) root.style.display = 'none';
}
