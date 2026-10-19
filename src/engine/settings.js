/**
 * Player settings: definitions, defaults, persistence (localStorage) and change events.
 * Every setting listed here is wired to the game in applySettings() (game.js), so the
 * Settings screen only shows options that actually do something.
 */

const STORAGE_KEY = 'flatframe.settings.v1';

// Gamepad actions and their default buttons (standard Gamepad API indices, -1 = unbound).
// Stored as one map under 'gamepadBindings': { [action id]: button index }
export const GAMEPAD_ACTIONS = [
  { id: 'fire', label: 'Fire', default: 7 },
  { id: 'parry', label: 'Parry', default: 6 },
  { id: 'heavy', label: 'Heavy Attack', default: -1 },
  { id: 'melee', label: 'Melee', default: 1 },
  { id: 'reload', label: 'Reload', default: 2 },
  { id: 'swap', label: 'Swap (hold for Melee)', default: 3 },
  { id: 'dash', label: 'Jump (crouch + jump = bullet jump)', default: 0 },
  { id: 'crouch', label: 'Crouch (hold)', default: 5 },
  { id: 'revive', label: 'Revive', default: 2 },
  { id: 'abilityModifier', label: 'Ability Menu (hold)', default: 4 },
  { id: 'ability1', label: 'Ability 1 (hold modifier + A)', default: 0 },
  { id: 'ability2', label: 'Ability 2 (hold modifier + X)', default: 2 },
  { id: 'ability3', label: 'Ability 3 (hold modifier + B)', default: 1 },
  { id: 'ability4', label: 'Ability 4 (hold modifier + Y)', default: 3 },
  { id: 'pause', label: 'Pause', default: 9 },
];
export const DEFAULT_PAD_BINDINGS = Object.fromEntries(GAMEPAD_ACTIONS.map(a => [a.id, a.default]));

// type: 'slider' (min..max, step, format) | 'toggle' | 'choice' (options) | 'binding' (gamepad button per action)
// The options categories, in order (from the Warframe options menu). Settings are stored; the game reads
// the ones it uses. A category with no settings yet is empty.
const T = (key, label, def, extra = {}) => ({ key, label, type: 'toggle', default: def, ...extra });
const S = (key, label, def, min, max, step, extra = {}) => ({ key, label, type: 'slider', default: def, min, max, step, ...extra });
const C = (key, label, options, def, extra = {}) => ({ key, label, type: 'choice', options, default: def, ...extra });

export const SETTING_SECTIONS = [
  {
    id: 'keyboardMouse', label: 'KEYBOARD/MOUSE',
    items: [
      T('invertY', 'Invert Y Axis', false),
      T('invertX', 'Invert X Axis', false),
      S('lookSensitivity', 'Look Sensitivity', 20, 0, 100, 1),
      S('aimSensitivity', 'Aim Sensitivity', 20, 0, 100, 1),
      S('aimScopedSensitivity', 'Aim Sensitivity (Scoped)', 20, 0, 100, 1),
      T('mouseThumbBack', 'Use Mouse Thumb Button as Back', true),
      T('autoSwapOnEmpty', 'Auto Swap Weapon On Empty', true),
      T('reloadContext', 'Reload with Context Action Input', true),
      T('meleeWithFire', 'Melee with Fire Weapon Input', false),
      T('meleeAutoTarget', 'Melee Auto Targeting', true),
      T('alignAttacksCamera', 'Align Attacks to Camera', true),
      T('cameraTracksMelee', 'Camera Tracks Melee Target', false),
      T('doubleJumpVoidSling', 'Double Jump executes Void Sling', false),
    ],
  },
  {
    id: 'controller', label: 'CONTROLLER',
    items: [
      ...GAMEPAD_ACTIONS.map(a => ({ key: 'gamepadBindings', action: a.id, label: a.label, type: 'binding', note: 'Enter, then press a button' })),
      T('invertYController', 'Invert Y Axis', false),
      T('invertXController', 'Invert X Axis', false),
      S('lookSensitivityController', 'Look Sensitivity', 20, 0, 100, 1),
      S('aimSensitivityController', 'Aim Sensitivity', 20, 0, 100, 1),
      S('aimScopedSensitivityController', 'Aim Sensitivity (Scoped)', 20, 0, 100, 1),
      T('vibration', 'Enable Vibration', true),
      S('uiCursorSensitivity', 'UI Cursor Sensitivity', 50, 0, 100, 1),
      T('useAbilitiesOnSelection', 'Use Abilities on Selection', false),
      T('crouchToggle', 'Crouch Button is Toggle', false),
      T('holdToSprint', 'Hold to Sprint', true),
      T('holdToAim', 'Hold to Aim Weapon', false),
      T('controllerAimAssist', 'Enable Controller Aim Assist', true),
      S('leftStickDeadzone', 'Left Stick Deadzone', 10, 0, 50, 1),
      S('rightStickDeadzone', 'Right Stick Deadzone', 10, 0, 50, 1),
      S('triggerPressThreshold', 'Trigger Press Threshold', 30, 0, 100, 1),
      S('triggerReleaseThreshold', 'Trigger Release Threshold', 20, 0, 100, 1),
      T('controllerSouthpaw', 'Enable Controller Southpaw', false),
      T('legacyAimDeadzone', 'Legacy Aim Deadzone', false),
      // Touch controls (mobile)
      C('touchControls', 'Touch Controls', ['Auto', 'On', 'Off'], 'Auto', { note: 'Takes effect after reload' }),
      C('touchAutoAim', 'Touch Auto Aim', ['Off', 'On'], 'Off', { note: 'Aims and fires at the nearest enemy. The right stick overrides it' }),
      S('touchOpacity', 'Touch Controls Opacity', 0.8, 0.2, 1, 0.05, { format: 'percent' }),
      S('touchSize', 'Touch Controls Size', 1, 0.7, 1.4, 0.05, { format: 'percent' }),
    ],
  },
  {
    id: 'system', label: 'SYSTEM',
    items: [
      C('region', 'Region', ['Automatic', 'Europe', 'North America', 'Asia'], 'Automatic'),
      C('matchmakingPing', 'Matchmaking Ping Limit', ['Off', '100 ms', '200 ms', '300 ms'], '200 ms'),
      T('upnp', 'Enable UPnP', true),
      T('crossPlatformPlay', 'Cross Platform Play', true),
      T('gore', 'Gore Enabled', true),
      T('legacyPalettes', 'Legacy Color Palettes', false),
    ],
  },
  {
    id: 'social', label: 'SOCIAL',
    items: [
      C('squadInvitesFrom', 'Allow Squad Invites From', ['Everyone', 'Friends', 'Nobody'], 'Everyone'),
      C('friendRequestsFrom', 'Receive Friend Requests From', ['Everyone', 'Friends of Friends', 'Nobody'], 'Everyone'),
      T('friendRequestNotifications', 'Show Friend Request Notifications', true),
      C('giftsFrom', 'Receive Gifts From', ['Everyone', 'Friends', 'Nobody'], 'Everyone'),
      C('clanInvitesFrom', 'Receive Clan Invitations From', ['Everyone', 'Friends', 'Nobody'], 'Everyone'),
      T('creatorMode', 'Creator Mode', false),
      T('surveys', 'Enable Surveys', true),
      T('chatRegion', 'Show Region Chat', true),
      T('chatQuestions', 'Show Questions & Answers Chat', true),
      T('chatRecruiting', 'Show Recruiting Chat', true),
      T('chatTrade', 'Show Trade Chat', true),
      T('chatTimestamps', 'Show Chat Message Timestamps', false),
      T('profanityFilter', 'Enable Profanity Filter', true),
      T('emojisAsText', 'Emojis As Text', false),
      S('chatScale', 'Chat Scale', 100, 50, 150, 5),
      S('chatNotificationVolume', 'Chat Notification Volume', 50, 0, 100, 1),
    ],
  },
  {
    id: 'interface', label: 'INTERFACE',
    items: [
      { key: 'damageNumbers', label: 'Damage Numbers', type: 'choice', options: ['Enhanced', 'Legacy', 'Off'], default: 'Enhanced' },
      { key: 'damageNumberScale', label: 'Damage Number Size', type: 'slider', min: 0.5, max: 2, step: 0.1, default: 1, format: 'percent' },
      { key: 'damageNumberOpacity', label: 'Damage Number Opacity', type: 'slider', min: 0.2, max: 1, step: 0.05, default: 1, format: 'percent' },
      { key: 'compactDamageNumbers', label: 'Compact Numbers (12.3k)', type: 'toggle', default: false },
      T('boldDamageNumbers', 'Bold Damage Numbers', false),
      T('affinityNumbers', 'Show Affinity Numbers', true),
      T('showHud', 'Show HUD', true),
      S('hudScale', 'HUD Scale', 100, 50, 150, 5),
      { key: 'hudOpacity', label: 'HUD Opacity', type: 'slider', min: 0.3, max: 1, step: 0.05, default: 1, format: 'percent' },
      T('showDebugInfo', 'Show Position Read-out', true),
      T('enemyNames', 'Show Enemy Names', true),
      T('enemyHealthBars', 'Show Health over Enemies', true),
      T('subtitles', 'Show Subtitles', true),
      T('itemLabels', 'Item Labels', true),
      T('tennoGuide', 'Show Tenno Guide', true),
      T('hudMotion', 'Enable HUD Motion', true),
      T('uiInScreenshots', 'Show UI In Screenshots', false),
      C('menuScale', 'Menu Scale', ['Small', 'Medium', 'Large'], 'Medium'),
      S('cursorScale', 'Cursor Scale', 100, 50, 150, 5),
      C('mouseCursor', 'Mouse Cursor', ['Default', 'Large', 'Crosshair'], 'Default'),
      C('numericSeparators', 'Numeric Separators', ['1,000', '1.000', '1 000', '1000'], '1,000'),
      T('lockMapRotation', 'Lock Map Rotation', false),
      T('overlayMap', 'Prefer Overlay Map', false),
    ],
  },
  {
    id: 'video', label: 'VIDEO',
    items: [
      C('displayMode', 'Display Mode', ['Fullscreen', 'Borderless', 'Windowed'], 'Borderless'),
      C('verticalSync', 'Vertical Sync', ['Off', 'On'], 'Off'),
      C('maxFramerate', 'Max Framerate', ['Unlimited', '60', '120', '144'], 'Unlimited'),
      C('qualityPreset', 'Quality Preset', ['Low', 'Medium', 'High', 'Ultra'], 'High'),
      C('antiAliasing', 'Anti-Aliasing', ['Off', 'FXAA', 'TAA'], 'TAA'),
      C('upscalingMethod', 'Upscaling Method', ['None', 'Bilinear', 'FSR'], 'None'),
      C('upscalingQuality', 'Upscaling Quality', ['Performance', 'Balanced', 'Quality'], 'Balanced'),
      S('sharpening', 'Sharpening', 0, 0, 100, 1),
      S('brightness', 'Brightness', 50, 0, 100, 1),
      S('contrast', 'Contrast', 50, 0, 100, 1),
      S('fieldOfView', 'Field of View', 90, 60, 110, 1),
      C('volumetricFog', 'Volumetric Fog Quality', ['Disabled', 'Low', 'Medium', 'High'], 'High'),
      T('dynamicLighting', 'Dynamic Lighting', true),
      T('motionBlur', 'Motion Blur', true),
      T('depthOfField', 'Depth of Field', true),
      T('bloom', 'Bloom', true),
      T('filmGrain', 'Film Grain', false),
      T('sunShadows', 'Sun Shadows', true),
      T('enhancedDecals', 'Enhanced Decals', true),
      T('reduceFrameLatency', 'Reduce Frame Latency', true),
      { key: 'showFps', label: 'Show FPS', type: 'toggle', default: false, note: 'Frame rate, frame time, RAM. GPU and VRAM show n/a in a browser' },
    ],
  },
  {
    id: 'audio', label: 'AUDIO',
    items: [
      { key: 'masterVolume', label: 'Master Volume', type: 'slider', min: 0, max: 1, step: 0.05, default: 0.8, format: 'percent' },
      { key: 'musicVolume', label: 'Music', type: 'slider', min: 0, max: 1, step: 0.05, default: 0.7, format: 'percent', preview: 'music' },
      { key: 'sfxVolume', label: 'Sound Effects', type: 'slider', min: 0, max: 1, step: 0.05, default: 0.9, format: 'percent', preview: 'sfx' },
      { key: 'uiVolume', label: 'Interface', type: 'slider', min: 0, max: 1, step: 0.05, default: 0.8, format: 'percent', preview: 'ui' },
      { key: 'ambienceVolume', label: 'Ambience', type: 'slider', min: 0, max: 1, step: 0.05, default: 0.6, format: 'percent' },
      S('narrativeVolume', 'Narrative Dialog Volume', 80, 0, 100, 1),
      S('enemyVolume', 'Enemy Volume', 80, 0, 100, 1),
      S('companionVolume', 'Companion Volume', 80, 0, 100, 1),
      S('ordisVolume', 'Ordis Dialog Volume', 80, 0, 100, 1),
      S('noraVolume', 'Nora Night Volume', 80, 0, 100, 1),
      S('personalWeaponsVolume', 'Personal Weapons Volume', 80, 0, 100, 1),
      S('personalAbilitiesVolume', 'Personal Abilities Volume', 80, 0, 100, 1),
      S('combatVolume', 'Enemy & Ally Combat Volume', 80, 0, 100, 1),
      S('mandachordVolume', 'Personal Mandachord Volume', 70, 0, 100, 1),
      T('ordisTransmissions', 'Enable Ordis Orbiter Transmissions', true),
      T('hintTransmissions', 'Hint Transmissions', true),
      T('operatorVoice', 'Enable Operator Voice', true),
      { key: 'muteAll', label: 'Mute All', type: 'toggle', default: false },
      { key: 'muteInBackground', label: 'Mute When In Background', type: 'toggle', default: true },
    ],
  },
  {
    id: 'accessibility', label: 'ACCESSIBILITY',
    items: [
      C('colorBlind', 'Color Blind Compensation', ['Off', 'Protanopia', 'Deuteranopia', 'Tritanopia'], 'Off'),
      S('colorBlindStrength', 'Color Blind Filter Strength', 50, 0, 100, 1),
      S('visualEffectsIntensity', 'Visual Effects Intensity', 100, 0, 100, 1),
      T('previewVisualEffects', 'Preview Visual Effects Intensity', false),
      T('reduceTeammateEffects', 'Reduce Teammate Visual Effects', false),
      T('screenShake', 'Enable Screen Shake', true),
      C('recoilType', 'Recoil Type', ['Default', 'Reduced'], 'Default'),
      C('cloakedAppearance', 'Cloaked Appearance', ['Standard', 'Semi-Cloak', 'Glow-Cloak'], 'Standard'),
      T('enemyHighlights', 'Enemy Highlights', true),
      C('enemyHighlightColor', 'Enemy Highlight Color', ['Red', 'Blue', 'Yellow', 'White'], 'Red'),
      S('enemyHighlightIntensity', 'Enemy Highlight Intensity', 70, 0, 100, 1),
      T('allyHighlights', 'Ally Highlights', true),
      T('selfHighlight', 'Self Highlight', true),
      C('allyHighlightColor', 'Ally Highlight Color', ['Blue', 'Green', 'Yellow', 'White'], 'Blue'),
      S('allyHighlightIntensity', 'Ally Highlight Intensity', 70, 0, 100, 1),
    ],
  },
];

const ITEMS = SETTING_SECTIONS.flatMap(s => s.items);
export const DEFAULT_SETTINGS = {
  ...Object.fromEntries(ITEMS.filter(i => i.type !== 'binding').map(i => [i.key, i.default])),
  gamepadBindings: { ...DEFAULT_PAD_BINDINGS },
};

function cleanBindings(saved) {
  return Object.fromEntries(GAMEPAD_ACTIONS.map(a => {
    const b = saved?.[a.id];
    return [a.id, Number.isInteger(b) && b >= -1 && b <= 16 ? b : a.default];
  }));
}

function load() {
  try {
    const saved = JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY) ?? '{}');
    // Keep only known keys with the right type, so old or broken saves can't break the game
    const clean = {};
    for (const item of ITEMS) {
      const v = saved[item.key];
      if (item.type === 'slider' && typeof v === 'number') clean[item.key] = Math.min(item.max, Math.max(item.min, v));
      else if (item.type === 'toggle' && typeof v === 'boolean') clean[item.key] = v;
      else if (item.type === 'choice' && item.options.includes(v)) clean[item.key] = v;
    }
    clean.gamepadBindings = cleanBindings(saved.gamepadBindings);
    return { ...DEFAULT_SETTINGS, ...clean };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

class SettingsStore {
  constructor() {
    this.values = load();
    this.listeners = new Set();
  }

  get(key) {
    return this.values[key];
  }

  set(key, value) {
    if (this.values[key] === value) return;
    this.values[key] = value;
    this.save();
    for (const fn of this.listeners) fn(this.values, key);
  }

  reset(sectionId) {
    const section = SETTING_SECTIONS.find(s => s.id === sectionId);
    for (const item of section?.items ?? ITEMS) {
      if (item.type !== 'binding') this.values[item.key] = item.default;
    }
    if (!section || section.id === 'controller') this.values.gamepadBindings = { ...DEFAULT_PAD_BINDINGS };
    this.save();
    for (const fn of this.listeners) fn(this.values, null);
  }

  save() {
    try { globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(this.values)); } catch { /* private mode etc. */ }
  }

  /** Calls fn(values) now and on every change. */
  subscribe(fn) {
    this.listeners.add(fn);
    fn(this.values, null);
    return () => this.listeners.delete(fn);
  }
}

export const settings = new SettingsStore();
