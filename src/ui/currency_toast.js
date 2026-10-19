/**
 * Small pop-up that says what was just gained or spent, such as "+45 Credits".
 * It listens to the wallet, so loot, mission rewards and purchases show up at once, without a reload.
 * It is plain DOM (like the close button), so it shows on every screen, including during missions.
 */
import { wallet as playerWallet } from '../economy/wallet.js';
import { CURRENCY_DEFS, formatAmount } from '../economy/currencies.js';
import { PALETTE as C } from './palette.js';

const SHOW_MS = 1800;

export function startCurrencyToasts(wallet = playerWallet) {
  const box = document.createElement('div');
  box.id = 'currency-toasts';
  box.setAttribute('aria-live', 'polite');
  Object.assign(box.style, {
    position: 'fixed', left: '50%', top: '96px', transform: 'translateX(-50%)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
    zIndex: '70', pointerEvents: 'none', font: '600 16px "Segoe UI", Roboto, system-ui, sans-serif',
  });
  document.body.appendChild(box);

  wallet.onChange((_balances, changes) => {
    for (const { currency, delta } of changes) {
      const el = document.createElement('div');
      const sign = delta > 0 ? '+' : '−';
      el.textContent = `${sign}${formatAmount(currency, Math.abs(delta))} ${CURRENCY_DEFS[currency]?.name ?? currency}`;
      Object.assign(el.style, {
        background: 'rgba(10,10,20,0.85)', border: '1px solid rgba(255,107,53,0.5)', borderRadius: '4px',
        padding: '6px 14px', color: delta > 0 ? C.selected : C.danger, transition: 'opacity 0.4s',
      });
      box.appendChild(el);
      setTimeout(() => { el.style.opacity = '0'; }, SHOW_MS);
      setTimeout(() => el.remove(), SHOW_MS + 450);
    }
  });
  return box;
}
