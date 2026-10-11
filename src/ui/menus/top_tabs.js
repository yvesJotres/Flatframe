// Universal top tabs configuration - single source of truth for all screens
//
export const TOP_TABS = [
  { id: 'arsenal', label: 'ARSENAL', icon: '⚔' },
  { id: 'navigation', label: 'NAVIGATION', icon: '◆' },
  { id: 'profile', label: 'PROFILE', icon: '◈' },
  { id: 'settings', label: 'SETTINGS', icon: '⚙' }
];

export const TAB_STYLE = {
  tabWidth: 130,
  y: 16,
  height: 52,
  radius: 8,
  iconXOffset: 28,
  iconY: 42,
  labelY: 56,
  active: {
    fill: 'rgba(255,107,53,0.18)',
    stroke: '#ff6b35',
    iconColor: '#ff6b35',
    labelColor: '#ffd78a',
    labelFont: 'bold 12px "Segoe UI", Roboto, system-ui, sans-serif'
  },
  inactive: {
    fill: 'rgba(18,18,30,0.95)',
    stroke: '#2a2a4a',
    iconColor: '#6a6a8a',
    labelColor: '#9a8a7a',
    labelFont: '12px "Segoe UI", Roboto, system-ui, sans-serif'
  }
};

export function drawTopTabs(ctx, width, activeTabId, extraTabs = []) {
  const allTabs = [...TOP_TABS, ...extraTabs];
  const startX = (width - allTabs.length * TAB_STYLE.tabWidth) / 2;
  
  allTabs.forEach((tab, i) => {
    const x = startX + i * TAB_STYLE.tabWidth;
    const active = tab.id === activeTabId;
    const style = active ? TAB_STYLE.active : TAB_STYLE.inactive;
    
    ctx.fillStyle = style.fill;
    ctx.strokeStyle = style.stroke;
    ctx.lineWidth = active ? 2 : 1;
    roundRect(ctx, x, TAB_STYLE.y, TAB_STYLE.tabWidth - 8, TAB_STYLE.height, TAB_STYLE.radius);
    ctx.fill();
    ctx.stroke();
    
    ctx.font = '22px Arial';
    ctx.fillStyle = style.iconColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tab.icon, x + TAB_STYLE.iconXOffset, TAB_STYLE.iconY);
    
    ctx.font = style.labelFont;
    ctx.fillStyle = style.labelColor;
    ctx.fillText(tab.label, x + TAB_STYLE.tabWidth / 2 - 4, TAB_STYLE.labelY);
  });
}

export function getTabHitRects(width, extraTabs = []) {
  const allTabs = [...TOP_TABS, ...extraTabs];
  const startX = (width - allTabs.length * TAB_STYLE.tabWidth) / 2;
  return allTabs.map((tab, i) => ({
    id: tab.id,
    x: startX + i * TAB_STYLE.tabWidth,
    y: TAB_STYLE.y,
    width: TAB_STYLE.tabWidth - 8,
    height: TAB_STYLE.height
  }));
}

function roundRect(ctx, x, y, w, h, r) {
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