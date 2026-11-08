// Shadepi Deskpet · Hauptprozess
// Ein randloses, transparentes Overlay liegt über dem ganzen Bildschirm.
// Mausklicks gehen durch, außer der Zeiger steht über einer Figur, einem
// Gegenstand oder dem Menü (der Renderer meldet das per IPC).
const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage, globalShortcut, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { WindowScanner, toOverlaySpace } = require('./windows');

const DEFAULTS = {
  mode: 'wechselnd',        // shadepi | raven | beide | wechselnd
  size: 0.72,               // Darstellungsfaktor der 128x160-Atlanten
  volume: 0.55,
  activity: 'normal',       // ruhig | normal | chaos
  cinematic: true,
  screenDamage: true,
  music: false,
  bubbles: true,
  hideFullscreen: true,
  climbWindows: true,
  display: 0,
  dock: true,
  paused: false,
};

let overlay = null;
let tray = null;
let scanner = null;
let settings = { ...DEFAULTS };
let ignoring = true;
let lastWindows = null;
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');

function loadSettings() {
  try { settings = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(settingsFile(), 'utf8')) }; } catch (_) { settings = { ...DEFAULTS }; }
}
function saveSettings() {
  try { fs.mkdirSync(path.dirname(settingsFile()), { recursive: true }); fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 1)); } catch (_) {}
}

function targetDisplay() {
  const all = screen.getAllDisplays();
  return all[settings.display] || screen.getPrimaryDisplay();
}

function layoutPayload() {
  const d = targetDisplay();
  return {
    width: d.bounds.width,
    height: d.bounds.height,
    workArea: { x: d.workArea.x - d.bounds.x, y: d.workArea.y - d.bounds.y, w: d.workArea.width, h: d.workArea.height },
    scale: d.scaleFactor,
    displays: screen.getAllDisplays().length,
  };
}

function placeOverlay() {
  if (!overlay) return;
  const d = targetDisplay();
  overlay.setBounds(d.bounds);
  overlay.webContents.send('layout', layoutPayload());
}

function createOverlay() {
  const d = targetDisplay();
  overlay = new BrowserWindow({
    ...d.bounds,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    focusable: false,
    alwaysOnTop: true,
    backgroundColor: '#00000000',
    title: 'Shadepi Deskpet',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  overlay.setAlwaysOnTop(true, 'screen-saver');
  overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlay.setIgnoreMouseEvents(true, { forward: true });
  overlay.loadFile(path.join(__dirname, '..', 'app', 'index.html'));
  overlay.webContents.on('did-finish-load', () => {
    overlay.webContents.send('layout', layoutPayload());
    overlay.webContents.send('settings', settings);
    if (lastWindows) sendWindows(lastWindows);
  });
  // Manche Programme drängeln sich nach vorn; regelmäßig wieder nach oben holen.
  setInterval(() => { if (overlay && !overlay.isDestroyed()) { overlay.setAlwaysOnTop(true, 'screen-saver'); overlay.moveTop(); } }, 4000);
}

function sendWindows(raw) {
  if (!overlay || overlay.isDestroyed()) return;
  const data = toOverlaySpace(raw, targetDisplay());
  overlay.webContents.send('windows', data);
}

function send(channel, payload) {
  if (overlay && !overlay.isDestroyed()) overlay.webContents.send(channel, payload);
}

function cursorInOverlay() {
  const p = screen.getCursorScreenPoint();
  const b = targetDisplay().bounds;
  return { x: p.x - b.x, y: p.y - b.y };
}

function setSetting(key, value) {
  settings[key] = value;
  saveSettings();
  send('settings', settings);
  if (key === 'display') placeOverlay();
  buildTray();
}

const EVENTS = [
  ['drohnen', 'Drohnenpatrouille'], ['schwarm', 'Drohnenschwarm'], ['viren', 'Virusausbruch'],
  ['gang', 'Cyberpunk-Gang'], ['bots', 'Kampfbots'], ['ice', 'Boss: ICE-Wächter'], ['jackal', 'Boss: Chrome Jackal'],
  ['training', 'Shadepi trainiert'], ['luke', 'Raven repariert Kabel'], ['besuch', 'Partner kommt vorbei'], ['sparring', 'Sparring'],
];

function buildTray() {
  if (!tray) return;
  const radio = (label, key, value) => ({ label, type: 'radio', checked: settings[key] === value, click: () => setSetting(key, value) });
  const check = (label, key) => ({ label, type: 'checkbox', checked: !!settings[key], click: (i) => setSetting(key, i.checked) });
  const displays = screen.getAllDisplays();
  const menu = Menu.buildFromTemplate([
    { label: 'Shadepi Deskpet', enabled: false },
    { label: 'Menü öffnen  (Strg+Alt+P)', click: () => send('open-menu', cursorInOverlay()) },
    { type: 'separator' },
    { label: 'Maskottchen', submenu: [radio('Shadepi', 'mode', 'shadepi'), radio('Raven', 'mode', 'raven'), radio('Beide', 'mode', 'beide'), radio('Abwechselnd (Besuche)', 'mode', 'wechselnd')] },
    { label: 'Ereignis starten', submenu: EVENTS.map(([id, label]) => ({ label, click: () => send('event', id) })) },
    { label: 'Aktivität', submenu: [radio('Ruhig', 'activity', 'ruhig'), radio('Normal', 'activity', 'normal'), radio('Chaos', 'activity', 'chaos')] },
    { label: 'Einstellungen', submenu: [
      check('Kino-Effekte', 'cinematic'), check('Bildschirmschäden (Löcher, Luke)', 'screenDamage'), check('Fenster beklettern', 'climbWindows'),
      check('Sprechblasen', 'bubbles'), check('Kampfmusik', 'music'), check('Bei Vollbild ausblenden', 'hideFullscreen'), check('Seitenleiste anzeigen', 'dock'),
      { label: 'Bildschirm', submenu: displays.map((d, i) => radio(`Bildschirm ${i + 1} (${d.bounds.width}×${d.bounds.height})`, 'display', i)) },
    ] },
    { type: 'separator' },
    check('Ruhemodus', 'paused'),
    { label: 'Mit Windows starten', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin, click: (i) => { app.setLoginItemSettings({ openAtLogin: i.checked }); buildTray(); } },
    { label: 'Ausblenden / Einblenden  (Strg+Alt+H)', click: toggleVisible },
    { label: 'Projektseite', click: () => shell.openExternal('https://github.com/Inrouder/Shadepideskpet') },
    { type: 'separator' },
    { label: 'Beenden', click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
}

function toggleVisible() {
  if (!overlay) return;
  if (overlay.isVisible()) overlay.hide(); else overlay.showInactive();
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => send('open-menu', cursorInOverlay()));
  app.whenReady().then(() => {
    loadSettings();
    createOverlay();
    const icon = nativeImage.createFromPath(path.join(__dirname, '..', 'app', 'assets', 'ui', process.platform === 'win32' ? 'tray16.png' : 'tray.png'));
    tray = new Tray(icon);
    tray.setToolTip('Shadepi Deskpet');
    tray.on('click', () => send('open-menu', cursorInOverlay()));
    buildTray();

    globalShortcut.register('CommandOrControl+Alt+P', () => send('open-menu', cursorInOverlay()));
    globalShortcut.register('CommandOrControl+Alt+H', toggleVisible);

    scanner = new WindowScanner((raw) => { lastWindows = raw; sendWindows(raw); });
    const scanning = scanner.start();
    setTimeout(() => send('scanner', { active: scanning }), 1500);

    screen.on('display-metrics-changed', placeOverlay);
    screen.on('display-added', () => { placeOverlay(); buildTray(); });
    screen.on('display-removed', () => { placeOverlay(); buildTray(); });
  });

  ipcMain.on('set-ignore', (_e, ignore) => {
    if (!overlay || ignore === ignoring) return;
    ignoring = ignore;
    overlay.setIgnoreMouseEvents(ignore, { forward: true });
  });
  ipcMain.on('set-setting', (_e, { key, value }) => { if (key in DEFAULTS) setSetting(key, value); });
  ipcMain.on('get-cursor', (e) => { e.returnValue = cursorInOverlay(); });
  ipcMain.on('quit', () => app.quit());
  ipcMain.on('hide', () => toggleVisible());
  ipcMain.on('autostart', (_e, on) => { app.setLoginItemSettings({ openAtLogin: !!on }); buildTray(); });

  app.on('will-quit', () => { globalShortcut.unregisterAll(); if (scanner) scanner.stop(); });
  app.on('window-all-closed', () => app.quit());
}
