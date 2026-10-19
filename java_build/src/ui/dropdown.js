import { THEME } from './theme.js';
// A reusable list dropdown with the matchmaking dropdown's look: 255px wide, 42px rows, a gold glow under the pointer,
// yellow text for the current choice. It opens under a box on the game canvas (canvas pixels) and closes on a pick or an outside click.
import { FONT } from './menus/menu_style.js';

const WIDTH = 255;
const ROW_HEIGHT = 42;
const GLOW = 'linear-gradient(90deg,rgba(255,107,53,0) 0%,rgba(255,107,53,0.14) 50%,rgba(255,107,53,0) 100%)';

function el(tag, style = {}, text) {
  const node = document.createElement(tag);
  Object.assign(node.style, style);
  if (text !== undefined) node.textContent = text;
  return node;
}

export class Dropdown {
  constructor() {
    this.panel = null;
    this.onOutside = (e) => { if (this.panel && !this.panel.contains(e.target)) this.close(); };
  }

  /**
   * @param {{ canvas: HTMLCanvasElement, box: {x,y,w,h}, options: {id,label}[], value: string, onPick: (id: string) => void }} opts
   */
  open({ canvas, box, options, value, onPick }) {
    this.close();
    const rect = canvas.getBoundingClientRect();
    const sx = rect.width / canvas.width, sy = rect.height / canvas.height;
    this.panel = el('div', {
      position: 'fixed', zIndex: '81', display: 'flex', flexDirection: 'column', width: `${WIDTH}px`,
      boxSizing: 'border-box', background: THEME.dropdown.fill, border: '1px solid rgba(255,255,255,0.12)',
      left: `${rect.left + box.x * sx}px`, top: `${rect.top + (box.y + box.h) * sy}px`,
    });
    for (const option of options) {
      const on = option.id === value;
      const base = { background: 'transparent', color: on ? THEME.text.selected : THEME.text.title };
      const row = el('div', {
        display: 'flex', alignItems: 'center', height: `${ROW_HEIGHT}px`, boxSizing: 'border-box', padding: '0 12px',
        font: `700 14px ${FONT}`, cursor: 'pointer', whiteSpace: 'nowrap', ...base,
      }, option.label);
      row.addEventListener('mouseenter', () => Object.assign(row.style, { background: GLOW, color: THEME.text.selected }));
      row.addEventListener('mouseleave', () => Object.assign(row.style, base));
      row.addEventListener('click', () => { this.close(); onPick(option.id); });
      this.panel.appendChild(row);
    }
    document.body.appendChild(this.panel);
    // Set on the next tick so the click that opened the list does not also close it
    setTimeout(() => document.addEventListener('pointerdown', this.onOutside), 0);
  }

  close() {
    document.removeEventListener('pointerdown', this.onOutside);
    this.panel?.remove();
    this.panel = null;
  }

  isOpen() {
    return !!this.panel;
  }
}
