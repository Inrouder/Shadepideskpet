// Shadepi Deskpet · Hauptprozess
// Ein randloses, transparentes Overlay liegt über dem ganzen Bildschirm.
// Mausklicks gehen durch, außer der Zeiger steht über einer Figur, einem
// Gegenstand oder dem Menü (der Renderer meldet das per IPC).
const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage, globalShortcut, shell, Notification, powerMonitor } = require('electron');
const path = require('path');
const fs = require('fs');
const { WindowScanner, toOverlaySpace } = require('./windows');
const { Updater } = require('./updater');
const { Sensors } = require('./sensors');
// Chromium hält transparente Overlays nach der Bildschirmsperre sonst manchmal für
// „verdeckt“ und zeichnet nicht mehr – die Animation bliebe stehen.
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
// Testhilfe: DESKPET_FAKE_DISPLAYS='[{"id":1,"bounds":{…},"workArea":{…},"scaleFactor":1}, …]' simuliert mehrere Monitore
if (process.env.DESKPET_FAKE_DISPLAYS) {
  app.whenReady().then(() => {
    const fake = JSON.parse(process.env.DESKPET_FAKE_DISPLAYS);
    screen.getAllDisplays = () => fake;
    screen.getPrimaryDisplay = () => fake[0];
  });
}
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
  dojo: {},
  allScreens: true,         // Figuren laufen über alle Monitore
};

let overlay = null;
let tray = null;
let scanner = null;
let settings = { ...DEFAULTS };
let ignoring = true;
const views = new Map();       // weitere Monitore: Display-ID → Fenster
const viewIgnore = new Map();
let viewFullscreen = new Set(); // Monitore mit Vollbildprogramm
let locked = false, lastReshow = 0, stallCount = 0;
let mouseRearms = 0, mouseAck = 0;
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

function activeDisplays() {
  const home = targetDisplay();
  return settings.allScreens ? screen.getAllDisplays() : [home];
}

function layoutPayload() {
  const d = targetDisplay();
  const hb = d.bounds;
  return {
    screens: activeDisplays().map((x) => ({
      id: String(x.id), home: x.id === d.id, scale: x.scaleFactor,
      x: x.bounds.x - hb.x, y: x.bounds.y - hb.y, w: x.bounds.width, h: x.bounds.height,
      wa: { x: x.workArea.x - hb.x, y: x.workArea.y - hb.y, w: x.workArea.width, h: x.workArea.height },
    })),
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
  for (const [id, win] of views) { const dd = screen.getAllDisplays().find((x) => String(x.id) === id); if (dd && !win.isDestroyed()) win.setBounds(dd.bounds); }
  overlay.webContents.send('layout', layoutPayload());
}

// ---------------------------------------------------------------- Fenster je Monitor
const allWins = () => [overlay, ...views.values()].filter((w) => w && !w.isDestroyed());
function viewShouldShow(id) { return overlay && overlay.isVisible() && !(settings.hideFullscreen && viewFullscreen.has(id)); }
function showAll() {
  if (!overlay) return;
  overlay.showInactive(); overlay.setAlwaysOnTop(true, 'screen-saver');
  for (const [id, w] of views) if (!w.isDestroyed() && viewShouldShow(id)) { w.showInactive(); w.setAlwaysOnTop(true, 'screen-saver'); }
}
function hideAll() { for (const w of allWins()) if (w.isVisible()) w.hide(); }

function setupViewWindows() {
  overlay.webContents.setWindowOpenHandler(({ url, frameName }) => {
    if (url === 'about:blank' && String(frameName).startsWith('screen-')) {
      return { action: 'allow', overrideBrowserWindowOptions: {
        show: false, transparent: true, frame: false, resizable: false, movable: false, minimizable: false, maximizable: false,
        fullscreenable: false, skipTaskbar: true, hasShadow: false, focusable: false, alwaysOnTop: true, backgroundColor: '#00000000',
        title: 'Shadepi Deskpet', webPreferences: { backgroundThrottling: false, contextIsolation: true, nodeIntegration: false },
      } };
    }
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  overlay.webContents.on('did-create-window', (win, details) => {
    const id = String(details.frameName || '').slice(7);
    const d = screen.getAllDisplays().find((x) => String(x.id) === id);
    if (!d) { win.close(); return; }
    views.set(id, win);
    viewIgnore.set(id, true);
    win.setIgnoreMouseEvents(true, { forward: true });
    win.setAlwaysOnTop(true, 'screen-saver');
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    win.setBounds(d.bounds);
    // Bei unterschiedlicher Skalierung stimmt die Größe erst nach dem zweiten Setzen
    setTimeout(() => { if (!win.isDestroyed()) { win.setBounds(d.bounds); if (viewShouldShow(id)) win.showInactive(); } }, 120);
    win.on('closed', () => { views.delete(id); viewIgnore.delete(id); });
    log(`Monitorfenster ${id}: ${d.bounds.width}×${d.bounds.height} @ ${d.bounds.x},${d.bounds.y} (Skalierung ${d.scaleFactor})`);
  });
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
  // Nach dem Aus-/Einblenden (z. B. Spielmodus) ist die Maus-Weiterleitung unter Windows
  // oft tot: Das Overlay bekommt keine Mausbewegungen mehr und das Menü reagiert nicht.
  overlay.on('show', () => setTimeout(() => rearmMouse('wieder sichtbar'), 150));
  setupViewWindows();
  overlay.loadFile(path.join(__dirname, '..', 'app', 'index.html'));
  overlay.webContents.on('did-finish-load', () => {
    overlay.webContents.send('layout', layoutPayload());
    overlay.webContents.send('settings', settings);
    if (lastWindows) sendWindows(lastWindows);
  });
  // Manche Programme drängeln sich nach vorn; regelmäßig wieder nach oben holen.
  setInterval(() => { if (!gaming.active) for (const w of allWins()) if (w.isVisible()) { w.setAlwaysOnTop(true, 'screen-saver'); w.moveTop(); } }, 4000);
}

function sendWindows(raw) {
  if (!overlay || overlay.isDestroyed() || gamePaused()) return;
  const data = toOverlaySpace(raw, targetDisplay(), activeDisplays());
  // Monitore mit Vollbildprogramm (Video, Spiel im Fenster …) ausblenden
  const fs2 = new Set(data.fullscreenScreens);
  if ([...fs2].join() !== [...viewFullscreen].join()) {
    viewFullscreen = fs2;
    for (const [id, w] of views) { if (w.isDestroyed()) continue; if (viewShouldShow(id)) { if (!w.isVisible()) w.showInactive(); } else if (w.isVisible()) w.hide(); }
  }
  overlay.webContents.send('windows', data);
}

// Klick-Durchlass samt Weiterleitung frisch einrichten. Electron installiert die
// Weiterleitung nur beim Wechsel aus/an – daher erst ausschalten, dann wieder an.
function rearmMouse(why) {
  if (!overlay || overlay.isDestroyed() || !overlay.isVisible()) return;
  for (const w of allWins()) { w.setIgnoreMouseEvents(false); w.setIgnoreMouseEvents(true, { forward: true }); }
  ignoring = true;
  for (const k of viewIgnore.keys()) viewIgnore.set(k, true);
  mouseRearms++;
  send('mouse-reset', cursorInOverlay());
  log(`Maus-Weiterleitung neu eingerichtet (${why})`);
}

// Nach Entsperren/Standby: Zeichnen und Maus wieder anstoßen
function wake(why) {
  if (!overlay || overlay.isDestroyed()) return;
  for (const w of allWins()) { try { w.webContents.invalidate(); } catch (_) {} }
  send('wake', why);
  rearmMouse(why);
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
  if (key === 'display' || key === 'allScreens') placeOverlay();
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
    { label: 'Dojo: Gegen Shadepi kämpfen  (Strg+Alt+D)', click: openDojo },
    { type: 'separator' },
    { label: 'Maskottchen', submenu: [radio('Shadepi', 'mode', 'shadepi'), radio('Raven', 'mode', 'raven'), radio('Beide', 'mode', 'beide'), radio('Abwechselnd (Besuche)', 'mode', 'wechselnd')] },
    { label: 'Ereignis starten', submenu: EVENTS.map(([id, label]) => ({ label, click: () => send('event', id) })) },
    { label: 'Aktivität', submenu: [radio('Ruhig', 'activity', 'ruhig'), radio('Normal', 'activity', 'normal'), radio('Chaos', 'activity', 'chaos')] },
    { label: 'Einstellungen', submenu: [
      check('Kino-Effekte', 'cinematic'), check('Bildschirmschäden (Löcher, Luke)', 'screenDamage'), check('Fenster beklettern', 'climbWindows'),
      check('Bei Spielen pausieren', 'gamePause'), check('Systemberichte (Raven)', 'sysReports'), check('Romantische Momente', 'romance'), check('Sprechblasen', 'bubbles'), check('Kampfmusik', 'music'), check('Bei Vollbild ausblenden', 'hideFullscreen'), check('Seitenleiste anzeigen', 'dock'),
      ...(displays.length > 1 ? [check('Auf allen Monitoren laufen', 'allScreens')] : []),
      { label: displays.length > 1 ? 'Heimbildschirm' : 'Bildschirm', submenu: displays.map((d, i) => radio(`Bildschirm ${i + 1} (${d.bounds.width}×${d.bounds.height})`, 'display', i)) },
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

function openDojo() {
  if (!overlay) return;
  if (!overlay.isVisible()) { userHidden = false; if (gaming.active) gameOverride = true; showAll(); buildTray(); }
  send('dojo');
}

function toggleVisible() {
  if (!overlay) return;
  if (overlay.isVisible()) { hideAll(); userHidden = true; }
  else { userHidden = false; if (gaming.active) gameOverride = true; showAll(); }
  buildTray();
}

// ---------------------------------------------------------------- Spielmodus
function gamePaused() { return gaming.active && !gameOverride; }
function applyGaming() {
  if (!overlay || overlay.isDestroyed()) return;
  if (gamePaused()) hideAll();
  else if (!userHidden && !overlay.isVisible()) showAll();
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
    globalShortcut.register('CommandOrControl+Alt+D', openDojo);

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
    if (st) {
      // Spielmodus einmal durchspielen: ausblenden, wieder einblenden → Maus muss neu eingerichtet werden
      setTimeout(() => { gaming = { active: true, name: 'Selbsttest', exe: 'selftest.exe', reason: 'test', since: Date.now() }; applyGaming(); }, 2000);
      setTimeout(() => { gaming = { ...gaming, active: false }; applyGaming(); }, 3200);
    }
    if (st && process.env.DESKPET_TEST_JS) setTimeout(() => overlay.webContents.executeJavaScript(process.env.DESKPET_TEST_JS).catch((e) => log('Test-JS: ' + e.message)), 2500);
    if (st) setTimeout(async () => {
      const out = { ...scanner.status(), surfacesRaw: lastWindows ? lastWindows.w.length : 0, games: !!gameDetect, gameInfo: lastGameInfo, visible: overlay.isVisible(), mouseRearms, mouseAck, displays: screen.getAllDisplays().length, views: views.size, viewsVisible: [...views.values()].filter((w) => w.isVisible()).length, stallCount };
      try {
        out.renderer = await overlay.webContents.executeJavaScript(`(() => { const W = PET.world, T = W.terrain; return { screens: T.screens.length, floors: T.floors().length, views: W.views ? W.views.list.length : -1, minX: T.minX, maxX: T.maxX, frames: Math.round(W.time * 10) / 10 }; })()`);
        if (process.env.DESKPET_SHOTS) {
          let i = 0;
          for (const w of allWins()) { const img = await w.webContents.capturePage(); fs.writeFileSync(path.join(process.env.DESKPET_SHOTS, `win${i++}.png`), img.toPNG()); }
        }
      } catch (e) { out.rendererError = e.message; }
      try { fs.writeFileSync(st.slice(11), JSON.stringify(out)); } catch (_) {}
      app.exit(0);
    }, 6000);

    screen.on('display-metrics-changed', placeOverlay);
    // Nach Standby/Sperrbildschirm verliert Windows ebenfalls gern die Maus-Weiterleitung
    powerMonitor.on('lock-screen', () => { locked = true; log('Bildschirm gesperrt'); });
    for (const ev of ['resume', 'unlock-screen']) powerMonitor.on(ev, () => {
      locked = false;
      log(ev === 'resume' ? 'Aus dem Standby zurück' : 'Bildschirm entsperrt');
      setTimeout(() => wake(ev), 800);
    });
    screen.on('display-added', () => { placeOverlay(); buildTray(); });
    screen.on('display-removed', () => { placeOverlay(); buildTray(); });
  });

  ipcMain.on('set-ignore', (_e, msg) => {
    const { ignore, key } = typeof msg === 'object' ? msg : { ignore: msg, key: 'home' };
    if (!overlay) return;
    if (key === 'home' || !key) {
      if (ignore === ignoring) return;
      ignoring = ignore;
      overlay.setIgnoreMouseEvents(ignore, { forward: true });
      return;
    }
    const w = views.get(String(key));
    if (!w || w.isDestroyed() || viewIgnore.get(String(key)) === ignore) return;
    viewIgnore.set(String(key), ignore);
    w.setIgnoreMouseEvents(ignore, { forward: true });
  });
  // Renderer meldet: seit Sekunden kein Bild mehr gezeichnet → Fenster neu einblenden
  ipcMain.on('stalled', (_e, info) => {
    stallCount++;
    if (locked || gamePaused() || userHidden || !overlay || !overlay.isVisible()) return;
    if (Date.now() - lastReshow < 15000) return;
    lastReshow = Date.now();
    log(`Animation stand still (${info && info.secs}s, Sichtbarkeit ${info && info.vis}) – Overlay wird neu eingeblendet`);
    hideAll();
    setTimeout(() => { showAll(); for (const w of allWins()) w.webContents.invalidate(); }, 150);
  });
  ipcMain.on('set-setting', (_e, { key, value }) => { if (key in DEFAULTS) setSetting(key, value); });
  ipcMain.on('get-cursor', (e) => { e.returnValue = cursorInOverlay(); });
  ipcMain.on('quit', () => app.quit());
  ipcMain.on('game-check', () => checkGames());
  ipcMain.on('update-check', () => updater && updater.check(true));
  ipcMain.on('update-install', () => updater && updater.install());
  ipcMain.on('rearm-mouse', (_e, why) => rearmMouse(String(why || 'Renderer')));
  ipcMain.on('set-focusable', (_e, on) => {
    if (!overlay) return;
    overlay.setFocusable(!!on);
    if (on) { overlay.setIgnoreMouseEvents(false); ignoring = false; overlay.focus(); }
  });
  ipcMain.on('notify', (_e, { title, body }) => {
    try { if (Notification.isSupported()) new Notification({ title: `Shadepi Deskpet · ${title}`, body, icon: path.join(__dirname, '..', 'app', 'assets', 'ui', 'icon.png'), silent: true }).show(); } catch (_) {}
  });
  ipcMain.on('log', (_e, msg) => { if (msg === 'mouse-reset ok') { mouseAck++; return; } log('Renderer: ' + String(msg).slice(0, 2000)); });
  ipcMain.on('open-log', () => shell.openPath(path.join(app.getPath('userData'))));
  ipcMain.on('hide', () => toggleVisible());
  ipcMain.on('autostart', (_e, on) => setAutostart(on));

  app.on('will-quit', () => { globalShortcut.unregisterAll(); if (scanner) scanner.stop(); if (sensors) sensors.stop(); });
  app.on('window-all-closed', () => app.quit());
}
