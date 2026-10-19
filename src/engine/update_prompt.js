// Shows a "new update" prompt when the dev server's version.json changes, and pauses the game while it is open.
// It only opens when canShow() is true (menus and between missions), so it never interrupts a fight; until then it waits.
// YES: A on a gamepad, Enter on a keyboard, or tap. NO: B, Escape, or tap.
const POLL_MS = 15000;

let shownVersion = null;
let overlay = null;
let stopInput = null;
let pendingVersion = null;
let canShowPrompt = () => false;

function close(version) {
  shownVersion = version;
  stopInput?.();
  stopInput = null;
  overlay?.remove();
  overlay = null;
  window.gamePaused = false;
  pendingVersion = null;
}

function listenForInput(yes, no) {
  const onKey = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); yes.click(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); no.click(); }
  };
  window.addEventListener('keydown', onKey, true); // capture: runs before the game's own key handling

  let frame = null;
  let aDown = false;
  let bDown = false;
  const poll = () => {
    const pad = Array.from(navigator.getGamepads?.() ?? []).find((p) => p && p.connected);
    const a = !!pad?.buttons[0]?.pressed;
    const b = !!pad?.buttons[1]?.pressed;
    if (a && !aDown) yes.click();
    if (b && !bDown) no.click();
    aDown = a;
    bDown = b;
    frame = requestAnimationFrame(poll);
  };
  frame = requestAnimationFrame(poll);

  return () => {
    window.removeEventListener('keydown', onKey, true);
    cancelAnimationFrame(frame);
  };
}

function show(version) {
  if (overlay) return;
  window.gamePaused = true;
  overlay = document.createElement('div');
  overlay.setAttribute('role', 'dialog');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:500;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.7);font-family:system-ui,sans-serif;';
  const box = document.createElement('div');
  box.style.cssText = 'background:#0d0f18;border:1px solid rgba(255,107,53,0.6);border-radius:8px;padding:24px;width:min(340px,86vw);text-align:center;color:#f0e8e0;';
  box.innerHTML = '<div style="font-size:18px;font-weight:700;letter-spacing:1px;margin-bottom:8px;">New update available</div>'
    + '<div style="color:#9a9ab0;font-size:14px;margin-bottom:20px;">Would you like to restart?</div>';
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:12px;justify-content:center;';
  const button = (label, hint, primary) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = `${label}<div style="font-size:11px;font-weight:400;opacity:0.7;margin-top:2px;">${hint}</div>`;
    b.style.cssText = `min-width:110px;padding:10px;border-radius:6px;font:700 15px system-ui,sans-serif;cursor:pointer;border:1px solid rgba(255,107,53,0.7);background:${primary ? 'rgba(255,107,53,0.25)' : 'transparent'};color:#ffd78a;`;
    return b;
  };
  const yes = button('YES', 'A / Enter', true);
  const no = button('NO', 'B / Esc', false);
  yes.addEventListener('click', () => location.reload());
  no.addEventListener('click', () => close(version));
  row.append(yes, no);
  box.append(row);
  overlay.append(box);
  document.body.append(overlay);
  yes.focus();
  stopInput = listenForInput(yes, no);
}

async function check() {
  try {
    const res = await fetch('version.json', { cache: 'no-store' });
    if (!res.ok) return;
    const { v } = await res.json();
    if (shownVersion === null) { shownVersion = v; return; }
    if (v !== shownVersion) pendingVersion = v;
  } catch {
    // no version file (e.g. a production build): nothing to check
  }
  if (pendingVersion !== null && !overlay && canShowPrompt()) show(pendingVersion);
}

// canShow: true only on menus and between missions; the prompt waits for a moment like that
export function startUpdateWatch(canShow = () => false) {
  canShowPrompt = canShow;
  check();
  setInterval(check, POLL_MS);
}
