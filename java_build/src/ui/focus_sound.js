// One place for the hover sound: whenever the focused item changes on any menu, the ui_hover sound plays.
// Screens do not play it themselves. Each screen reports its focus with trackFocus(key) every frame, where
// key is any value that changes when the focus moves (an index, a name, or a combined string).

import { audioManager } from '../engine/audio.js';

let last = undefined;

// Call once per frame with the current focus. The first call after resetFocusSound() plays nothing.
export function trackFocus(key) {
  if (key === null || key === undefined) return;
  if (last !== undefined && key !== last) audioManager.play('ui_hover');
  last = key;
}

// Call when a screen opens, so opening it does not play a hover sound
export function resetFocusSound() {
  last = undefined;
}

// Every clickable element on the page (buttons, links, dropdown rows, squad tiles...) plays the same hover sound
// when the pointer moves onto it. An element is clickable when it shows the pointer cursor, so no panel or button
// needs its own sound. Canvas menus are covered by trackFocus above.
let lastHoverTarget = null;

function clickableAt(el) {
  for (let n = el; n && n !== document.body && n.nodeType === 1; n = n.parentElement) {
    if (getComputedStyle(n).cursor === 'pointer') return n;
  }
  return null;
}

if (typeof document !== 'undefined') {
  document.addEventListener('pointerover', (e) => {
    const target = clickableAt(e.target);
    if (target && target !== lastHoverTarget) audioManager.play('ui_hover');
    lastHoverTarget = target;
  }, true);
}
