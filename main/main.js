// Shadepi Deskpet · Hauptprozess
// Ein randloses, transparentes Overlay liegt über dem ganzen Bildschirm.
// Mausklicks gehen durch, außer der Zeiger steht über einer Figur, einem
// Gegenstand oder dem Menü (der Renderer meldet das per IPC).
const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage, globalShortcut, shell, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const { WindowScanner, toOverlaySpace } = require('./windows');
const { Updater } = require('./updater');
const { Sensors } = require('./sensors');
let sensors = null;
let updater = null;
let gameDetect = null;
let gaming = { active: false, name: '', exe: '', reason: '', since: 0 };
let gameOverride = false;   // „Trotzdem anzeigen“ bis das Spiel endet
let userHidden = false;
let lastGameInfo = null;

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
  reminders: [],
  chime: false,
  breakEvery: 0,
  drinkEvery: 0,
  gamePause: true,
  gameOwn: [],
  gameIgnore: [],
  sysReports: true,
  romance: true,
};

let overlay = null;
let tray = null;
let scanner = null;
let settings = { ...DEFAULTS };
let ignoring = true;
let lastWindows = null;
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');
let lastLoggedError = '';
function log(msg) {
  try { fs.appendFileSync(path.join(app.getPath('userData'), 'deskpet.log'), `${new Date().toISOString()} ${msg}\n`); } catch (_) {}
}

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
    version: app.getVersion(),
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
  setInterval(() => { if (overlay && !overlay.isDestroyed() && overlay.isVisible() && !gaming.active) { overlay.setAlwaysOnTop(true, 'screen-saver'); overlay.moveTop(); } }, 4000);
}

function sendWindows(raw) {
  if (!overlay || overlay.isDestroyed() || gamePaused()) return;
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
  if (key.startsWith('game')) setTimeout(checkGames, 50);
  buildTray();
}

const EVENTS = [
  ['drohnen', 'Drohnenpatrouille'], ['schwarm', 'Drohnenschwarm'], ['viren', 'Virusausbruch'],
  ['gang', 'Cyberpunk-Gang'], ['bots', 'Kampfbots'], ['ice', 'Boss: ICE-Wächter'], ['jackal', 'Boss: Chrome Jackal'],
  ['training', 'Shadepi trainiert'], ['luke', 'Raven repariert Kabel'], ['system', 'Raven: Systembericht'], ['besuch', 'Partner kommt vorbei'], ['sparring', 'Sparring'],
  ['blick', 'Verliebter Blick'], ['bluete', 'Shadepis Lichtblüte'],
];

function buildTray() {
  if (!tray) return;
  const radio = (label, key, value) => ({ label, type: 'radio', checked: settings[key] === value, click: () => setSetting(key, value) });
  const check = (label, key) => ({ label, type: 'checkbox', checked: !!settings[key], click: (i) => setSetting(key, i.checked) });
  const displays = screen.getAllDisplays();
  const gameItems = gaming.active ? [
    { label: `🎮 Spielmodus: ${gaming.name}${gameOverride ? ' (trotzdem sichtbar)' : ' – pausiert'}`, enabled: false },
    gameOverride ? { label: 'Wieder pausieren', click: () => { gameOverride = false; applyGaming(); } } : { label: 'Trotzdem anzeigen', click: () => { gameOverride = true; userHidden = false; applyGaming(); } },
    ...(gaming.exe ? [{ label: `„${gaming.exe}“ ist kein Spiel`, click: () => { setSetting('gameIgnore', [...new Set([...(settings.gameIgnore || []), gaming.exe])]); checkGames(); } }] : []),
    { type: 'separator' },
  ] : [];
  const menu = Menu.buildFromTemplate([
    { label: 'Shadepi Deskpet', enabled: false },
    ...gameItems,
    { label: 'Menü öffnen  (Strg+Alt+P)', click: () => send('open-menu', cursorInOverlay()) },
    { type: 'separator' },
    { label: 'Maskottchen', submenu: [radio('Shadepi', 'mode', 'shadepi'), radio('Raven', 'mode', 'raven'), radio('Beide', 'mode', 'beide'), radio('Abwechselnd (Besuche)', 'mode', 'wechselnd')] },
    { label: 'Ereignis starten', submenu: EVENTS.map(([id, label]) => ({ label, click: () => send('event', id) })) },
    { label: 'Aktivität', submenu: [radio('Ruhig', 'activity', 'ruhig'), radio('Normal', 'activity', 'normal'), radio('Chaos', 'activity', 'chaos')] },
    { label: 'Einstellungen', submenu: [
      check('Kino-Effekte', 'cinematic'), check('Bildschirmschäden (Löcher, Luke)', 'screenDamage'), check('Fenster beklettern', 'climbWindows'),
      check('Bei Spielen pausieren', 'gamePause'), check('Systemberichte (Raven)', 'sysReports'), check('Romantische Momente', 'romance'), check('Sprechblasen', 'bubbles'), check('Kampfmusik', 'music'), check('Bei Vollbild ausblenden', 'hideFullscreen'), check('Seitenleiste anzeigen', 'dock'),
      { label: 'Bildschirm', submenu: displays.map((d, i) => radio(`Bildschirm ${i + 1} (${d.bounds.width}×${d.bounds.height})`, 'display', i)) },
    ] },
    { type: 'separator' },
    check('Ruhemodus', 'paused'),
    { label: 'Mit Windows starten', type: 'checkbox', checked: autostartEnabled(), click: (i) => setAutostart(i.checked) },
    { label: 'Ausblenden / Einblenden  (Strg+Alt+H)', click: toggleVisible },
    updater && updater.state.state === 'ready'
      ? { label: `Update ${updater.state.version} jetzt installieren`, click: () => updater.install() }
      : { label: `Nach Updates suchen (v${app.getVersion()})`, click: () => updater && updater.check(true) },
    { label: 'Projektseite', click: () => shell.openExternal('https://github.com/Inrouder/Shadepideskpet') },
    { type: 'separator' },
    { label: 'Beenden', click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
}

// Bei der portablen EXE zeigt execPath in einen Temp-Ordner – dann die echte Datei verwenden.
const exePath = () => process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
function autostartEnabled() { try { return app.getLoginItemSettings({ path: exePath() }).openAtLogin; } catch (_) { return false; } }
function setAutostart(on) { try { app.setLoginItemSettings({ openAtLogin: !!on, path: exePath() }); } catch (_) {} buildTray(); }

function toggleVisible() {
  if (!overlay) return;
  if (overlay.isVisible()) { overlay.hide(); userHidden = true; }
  else { userHidden = false; if (gaming.active) gameOverride = true; overlay.showInactive(); }
  buildTray();
}

// ---------------------------------------------------------------- Spielmodus
function gamePaused() { return gaming.active && !gameOverride; }
function applyGaming() {
  if (!overlay || overlay.isDestroyed()) return;
  if (gamePaused()) { if (overlay.isVisible()) overlay.hide(); }
  else if (!userHidden && !overlay.isVisible()) { overlay.showInactive(); overlay.setAlwaysOnTop(true, 'screen-saver'); }
  send('gaming', { active: gamePaused(), name: gaming.name, exe: gaming.exe, reason: gaming.reason, minutes: gaming.since ? Math.round((Date.now() - gaming.since) / 60000) : 0 });
  buildTray();
}
function checkGames() {
  if (!gameDetect) return;
  let res;
  try { res = gameDetect({ own: settings.gameOwn, ignore: settings.gameIgnore }); } catch (e) { log('Spielerkennung: ' + e.message); return; }
  const game = settings.gamePause ? res.game : null;
  // Kandidaten zum Merken: Programme mit sichtbarem Fenster
  const exeByPid = new Map(res.procs.map((p) => [p.pid, p.path.slice(p.path.lastIndexOf('\\') + 1).toLowerCase()]));
  const visible = [];
  for (const w of (lastWindows && lastWindows.w) || []) { const e = exeByPid.get(w.pid); if (e && !visible.includes(e) && e !== 'explorer.exe' && e !== 'applicationframehost.exe') visible.push(e); }
  lastGameInfo = { supported: true, game, visible: visible.slice(0, 10) };
  send('games', lastGameInfo);
  const was = gaming.active;
  if (game && !was) {
    gaming = { active: true, name: game.name, exe: game.exe, reason: game.reason, since: Date.now() };
    gameOverride = false;
    log(`Spiel erkannt: ${game.name} (${game.exe || game.reason}) – pausiert`);
    applyGaming();
  } else if (!game && was) {
    gaming = { ...gaming, active: false };
    gameOverride = false;
    applyGaming();
    gaming.since = 0;
  }
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

    try { gameDetect = require('./games').createGameDetector(); } catch (e) { if (process.platform === 'win32') log('Spielerkennung nicht verfügbar: ' + e.message); }
    if (gameDetect) { setInterval(checkGames, 2500); setTimeout(checkGames, 1500); }
    else setInterval(() => send('games', { supported: false }), 5000);

    sensors = new Sensors((d) => { sensors.paused = gamePaused(); send('sensors', d); }, log);
    setTimeout(() => sensors.start(), 4000);
    setInterval(() => { if (sensors) sensors.paused = gamePaused(); }, 2000);

    updater = new Updater((ch, st) => { send(ch, st); if (st.state === 'ready' || st.state === 'none') buildTray(); }, log);
    updater.start();

    scanner = new WindowScanner((raw) => { lastWindows = raw; sendWindows(raw); });
    scanner.start();
    setInterval(() => {
      const st = scanner.status();
      st.platform = process.platform;
      if (st.error && st.error !== lastLoggedError) { lastLoggedError = st.error; log('Fensterscanner: ' + st.error); }
      send('scanner', st);
    }, 2000);

    // Selbsttest für den Build: --selftest=<datei> schreibt den Scannerstatus und beendet
    const st = process.argv.find((a) => a.startsWith('--selftest='));
    if (st) setTimeout(() => {
      const out = { ...scanner.status(), surfacesRaw: lastWindows ? lastWindows.w.length : 0, games: !!gameDetect, gameInfo: lastGameInfo };
      try { fs.writeFileSync(st.slice(11), JSON.stringify(out)); } catch (_) {}
      app.exit(0);
    }, 6000);

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
  ipcMain.on('game-check', () => checkGames());
  ipcMain.on('update-check', () => updater && updater.check(true));
  ipcMain.on('update-install', () => updater && updater.install());
  ipcMain.on('set-focusable', (_e, on) => {
    if (!overlay) return;
    overlay.setFocusable(!!on);
    if (on) { overlay.setIgnoreMouseEvents(false); ignoring = false; overlay.focus(); }
  });
  ipcMain.on('notify', (_e, { title, body }) => {
    try { if (Notification.isSupported()) new Notification({ title: `Shadepi Deskpet · ${title}`, body, icon: path.join(__dirname, '..', 'app', 'assets', 'ui', 'icon.png'), silent: true }).show(); } catch (_) {}
  });
  ipcMain.on('log', (_e, msg) => log('Renderer: ' + String(msg).slice(0, 2000)));
  ipcMain.on('open-log', () => shell.openPath(path.join(app.getPath('userData'))));
  ipcMain.on('hide', () => toggleVisible());
  ipcMain.on('autostart', (_e, on) => setAutostart(on));

  app.on('will-quit', () => { globalShortcut.unregisterAll(); if (scanner) scanner.stop(); if (sensors) sensors.stop(); });
  app.on('window-all-closed', () => app.quit());
}
