// Start: Assets laden, Welt aufbauen, mit dem Electron-Hauptprozess verbinden
// (oder im Browser eine Vorschau mit simulierten Fenstern zeigen).
'use strict';

const DEFAULT_SETTINGS = {
  mode: 'wechselnd', size: 0.72, volume: 0.55, activity: 'normal', cinematic: true, screenDamage: true, music: false,
  bubbles: true, hideFullscreen: true, climbWindows: true, display: 0, dock: true, paused: false, debug: false,
  reminders: [], chime: false, breakEvery: 0, drinkEvery: 0, gamePause: true, gameOwn: [], gameIgnore: [], sysReports: true, romance: true,
  dojo: {}, allScreens: true,
};

// ---------------------------------------------------------------- Browser-Vorschau
class DemoWindows {
  constructor(world) {
    this.world = world;
    const W = world.terrain.W, H = world.terrain.H;
    this.list = [
      { id: 'd1', x: W * 0.08, y: H * 0.42, w: W * 0.3, h: H * 0.36, title: 'Night City · Karte', z: 2 },
      { id: 'd2', x: W * 0.46, y: H * 0.24, w: W * 0.28, h: H * 0.3, title: 'Terminal — raven@nightwing', z: 1 },
      { id: 'd3', x: W * 0.62, y: H * 0.58, w: W * 0.3, h: H * 0.26, title: 'Musik', z: 0 },
    ];
    // Zweiter (simulierter) Bildschirm: dort auch ein Fenster
    for (const sc of world.terrain.screens.filter((x) => !x.home)) this.list.push({ id: 'd4' + sc.id, x: sc.x + sc.w * 0.2, y: sc.y + sc.h * 0.45, w: sc.w * 0.45, h: sc.h * 0.3, title: 'Monitor 2 · Notizen', z: 3 });
    this.t = 0; this.moveT = 18; this.anim = null;
    world.terrain.setWindows(this.list);
  }
  update(dt) {
    this.t += dt;
    if (this.world.params.has('static')) return;
    this.moveT -= dt;
    if (this.moveT <= 0 && !this.anim) {
      const w = pick(this.list);
      const T = this.world.terrain;
      const sc = T.screenAt(w.x + w.w / 2, w.y);
      this.anim = { w, x0: w.x, y0: w.y, x1: clamp(w.x + rnd(-260, 260), sc.x, sc.x + sc.w - w.w), y1: clamp(w.y + rnd(-120, 120), sc.y + 90, sc.floor - w.h - 10), t: 0 };
      this.moveT = rnd(14, 26);
    }
    if (this.anim) {
      const a = this.anim; a.t += dt / 1.6;
      const k = easeInOut(Math.min(1, a.t));
      a.w.x = lerp(a.x0, a.x1, k); a.w.y = lerp(a.y0, a.y1, k);
      this.world.terrain.setWindows(this.list);
      if (a.t >= 1) this.anim = null;
    }
  }
  draw(ctx, world, v) {
    const T = world.terrain;
    const sc = (v && v.sc) || T.screens[0];
    // Hintergrund + Taskleiste
    const g = ctx.createLinearGradient(0, sc.y, 0, sc.y + sc.h);
    g.addColorStop(0, sc.home ? '#1a2233' : '#221a33'); g.addColorStop(1, '#0c111b');
    ctx.fillStyle = g; ctx.fillRect(sc.x, sc.y, sc.w, sc.h);
    ctx.fillStyle = '#05070c'; ctx.fillRect(sc.x, sc.floor, sc.w, sc.y + sc.h - sc.floor);
    ctx.fillStyle = 'rgba(98,227,238,0.25)'; ctx.fillRect(sc.x, sc.floor, sc.w, 1);
    const sorted = [...this.list].sort((a, b) => b.z - a.z);
    for (const w of sorted) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
      ctx.fillStyle = '#e8ecf2'; ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.restore();
      ctx.fillStyle = '#f7f8fa'; ctx.fillRect(w.x, w.y, w.w, 32);
      ctx.fillStyle = '#22262e'; ctx.font = '13px Segoe UI, sans-serif'; ctx.textBaseline = 'middle'; ctx.fillText(w.title, w.x + 12, w.y + 16);
      ctx.fillStyle = '#8a9099'; ctx.fillText('—   ▢   ✕', w.x + w.w - 86, w.y + 16);
      ctx.fillStyle = '#d4dae3';
      for (let i = 0; i < 6; i++) ctx.fillRect(w.x + 16, w.y + 52 + i * 22, (w.w - 32) * (0.4 + ((i * 37) % 50) / 100), 9);
    }
  }
}

// ---------------------------------------------------------------- Start
(async function boot() {
  const bridge = window.deskpet || null;
  const params = new URLSearchParams(location.search);
  const canvas = document.getElementById('stage');
  let stored = {};
  if (!bridge) { try { stored = JSON.parse(localStorage.getItem('deskpet-settings') || '{}'); } catch (_) {} }
  const settings = { ...DEFAULT_SETTINGS, ...stored };
  for (const [k, v] of params) {
    if (k in DEFAULT_SETTINGS && typeof DEFAULT_SETTINGS[k] !== 'object') settings[k] = typeof DEFAULT_SETTINGS[k] === 'number' ? +v : typeof DEFAULT_SETTINGS[k] === 'boolean' ? v !== '0' && v !== 'false' : v;
  }
  if (params.has('seed')) setSeed(+params.get('seed'));

  const world = new World(canvas, settings);
  world.params = params;
  window.PET = { world };

  await loadImages();
  try { await Promise.all([document.fonts.load('20px ShadepiPixel'), document.fonts.load('10px Silkscreen')]); } catch (_) {}
  Sound.init();

  const api = {
    set(key, value) {
      settings[key] = value;
      if (bridge && key !== 'debug') bridge.setSetting(key, value);
      else { try { localStorage.setItem('deskpet-settings', JSON.stringify(settings)); } catch (_) {} }
      applySettings();
    },
  };

  const director = new Director(world);
  world.director = director;
  world.api = api;
  let lastMode = settings.mode;
  function applySettings() {
    Sound.volume = settings.volume;
    Sound.musicEnabled = settings.music;
    if (!settings.music) Sound.setMusic(null);
    else if (director.fightActive) Sound.setMusic(world.enemies.some((e) => e.boss && !e.dead) ? 'Boss' : 'Fight');
    world.terrain.enabled = settings.climbWindows;
    world.terrain.rebuild();
    for (const h of world.heroes) h.resize();
    if (ui) ui.syncDock();
    if (settings.mode !== lastMode && world.heroes.length) { lastMode = settings.mode; director.visit = null; director.applyMode(); }
  }

  function layout(l) {
    if (l.version) world.version = l.version;
    world.layoutDisplays = l.displays || 1;
    world.resize(l.width, l.height);
    world.terrain.setLayout(l);
    if (world.views) world.views.sync();
    // Wer auf einem verschwundenen Bildschirm stand, kommt nach Hause
    for (const h of world.heroes) if (!h.absent && (h.x < world.terrain.minX || h.x > world.terrain.maxX)) h.warpHome();
  }

  let ui = null;
  if (bridge) {
    await new Promise((res) => {
      let got = false;
      bridge.on('layout', (l) => { layout(l); if (!got) { got = true; res(); } });
      setTimeout(() => { if (!got) { got = true; layout({ width: innerWidth, height: innerHeight, workArea: { x: 0, y: 0, w: innerWidth, h: innerHeight - 48 } }); res(); } }, 1500);
    });
    bridge.on('settings', (s) => { Object.assign(settings, s); applySettings(); if (ui && ui.isOpen) ui.render(); });
    bridge.on('windows', (d) => {
      world.terrain.setWindows(d.windows);
      world.hidden = settings.hideFullscreen && d.fullscreen;
      world.terrain.setBlocked(settings.hideFullscreen ? d.fullscreenScreens : []);
      // Auf einem Monitor läuft jetzt ein Vollbildprogramm: Figuren dort kommen heim
      for (const h of world.heroes) { const sc = world.terrain.screenContaining(h.x, h.y - 20); if (!h.absent && sc && !sc.home && world.terrain.blocked.has(sc.id)) h.warpHome(); }
    });
    bridge.on('open-menu', (p) => ui.open(p.x, p.y));
    bridge.on('event', (id) => director.startEvent(id));
    bridge.on('dojo', () => world.dojo && (world.dojo.active ? world.dojo.togglePause() : world.dojo.open()));
    bridge.on('scanner', (s) => { world.scanner = s; if (ui && ui.isOpen) ui.updateStatus(); });
    window.addEventListener('error', (e) => bridge.log && bridge.log(`${e.message} @ ${e.filename}:${e.lineno}`));
    const origError = console.error;
    console.error = (...a) => { try { bridge.log && bridge.log(a.map((x) => (x && x.stack) || String(x)).join(' ')); } catch (_) {} origError(...a); };
  } else {
    const taskbar = 48;
    // ?screens=2[&s2=1280x900[&s2y=0]] simuliert einen zweiten Monitor rechts (als Popup-Fenster)
    const demoLayout = () => {
      const l = { width: innerWidth, height: innerHeight, workArea: { x: 0, y: 0, w: innerWidth, h: innerHeight - taskbar } };
      if (+(params.get('screens') || 1) > 1) {
        const [w2, h2] = (params.get('s2') || '1280x900').split('x').map(Number);
        const y2 = +(params.get('s2y') || 0);
        const side = params.get('s2side') === 'left' ? -1 : 1;
        const x2 = side > 0 ? innerWidth : -w2;
        l.screens = [{ id: 'home', home: true, x: 0, y: 0, w: innerWidth, h: innerHeight, wa: l.workArea },
          { id: '2', x: x2, y: y2, w: w2, h: h2, wa: { x: x2, y: y2, w: w2, h: h2 - taskbar } }];
      }
      return l;
    };
    layout(demoLayout());
    world.demoWindows = new DemoWindows(world);
    window.addEventListener('resize', () => layout(demoLayout()));
  }

  ui = new UI(world, bridge, api);
  const reminders = new Reminders(world, api, bridge);
  world.reminders = reminders;
  const sys = new SysReport(world, bridge);
  world.sys = sys;
  if (bridge) bridge.on('sensors', (d) => sys.onData(d));
  const updates = new UpdateUI(world, bridge);
  world.updates = updates;
  if (bridge) {
    bridge.on('update', (st) => updates.onState(st));
    bridge.on('games', (info) => { world.gameInfo = info; if (ui.isOpen && ui.tab === 'system') ui.updateGames(); });
    bridge.on('gaming', (g) => {
      const was = world.gaming;
      world.gaming = g.active;
      Sound.setMusic(null);
      if (was && !g.active) { reminders.holdUntil = Date.now() + 7000; setTimeout(() => director.afterGame(g), 900); }
    });
  }
  // Erinnerungen laufen auch weiter, wenn das Overlay im Spielmodus unsichtbar ist
  setInterval(() => { if (world.gaming) reminders.update(1.01); }, 1000);
  const input = new Input(world, ui, bridge);
  new Views(world, input);
  world.views.sync();
  if (bridge) bridge.on('mouse-reset', (c) => input.reset(c));
  const dojo = new Dojo(world, bridge, input);
  world.dojo = dojo; world.ui = ui;
  director.setup();
  applySettings();
  Object.assign(window.PET, { director, ui, input, api, reminders, updates, sys, dojo });
  // Dojo direkt öffnen (Vorschau/Tests): ?dojo=1 bzw. ?duel=oni&level=schwer
  if (params.has('dojo') || params.has('duel')) setTimeout(() => {
    dojo.open();
    const who = params.get('duel');
    if (who && BROTHERS[who]) { dojo.sel = DOJO_ORDER.indexOf(who); dojo.lvl = Math.max(0, DOJO_LEVELS.indexOf(params.get('level') || 'mittel')); dojo.start(); }
  }, +(params.get('delay') || 1500));

  if (params.get('event')) setTimeout(() => director.startEvent(params.get('event')), +(params.get('delay') || 1500));
  if (params.has('menu')) setTimeout(() => ui.open(innerWidth * 0.55, innerHeight * 0.35), 400);

  let last = performance.now();
  const speed = +(params.get('speed') || 1);
  let lastRaf = performance.now(), fallback = null, stalledSince = 0, lastErr = '';
  function step(now) {
    const dt = ((now - last) / 1000) * speed;
    last = now;
    try {
      if (world.gaming) { if (dojo.active) dojo.close(); frame.prev = now; return; }
      if (world.demoWindows) world.demoWindows.update(dt);
      input.update(Math.min(dt, 0.05));
      reminders.update((now - (frame.prev || now)) / 1000);
      updates.update();
      sys.update();
      frame.prev = now;
      world.update(dt);
      world.draw();
    } catch (e) {
      // Ein Fehler in einem Bild darf die Animation nie dauerhaft anhalten
      const msg = (e && e.stack) || String(e);
      if (msg !== lastErr) { lastErr = msg; console.error('Fehler im Bild: ' + msg); }
    }
  }
  // Jede Bildkette hat eine Nummer; startet der Wächter eine neue, endet die alte still.
  let chain = 0;
  const go = (id) => requestAnimationFrame((t) => frame(t, id));
  function frame(now, id) {
    if (id !== chain) return;
    lastRaf = performance.now();
    go(id);
    if (fallback) { clearInterval(fallback); fallback = null; if (bridge && bridge.log) bridge.log(`Animation läuft wieder (nach ${Math.round((lastRaf - stalledSince) / 1000)} s)`); }
    step(now);
  }
  go(chain);
  // Wächter: Bleibt requestAnimationFrame aus (z. B. nach der Bildschirmsperre), mit Timern
  // weiterzeichnen und den Hauptprozess bitten, das Overlay neu einzublenden.
  setInterval(() => {
    const idle = performance.now() - lastRaf;
    if (idle < 2500 || world.gaming) return;
    if (!fallback) {
      stalledSince = lastRaf;
      fallback = setInterval(() => step(performance.now()), 33);
      if (bridge && bridge.log) bridge.log(`Animation stand ${Math.round(idle / 1000)} s still (Sichtbarkeit: ${document.visibilityState}) – zeichne mit Timer weiter`);
    }
    go(++chain); // falls die alte Kette verloren ging
    if (bridge && bridge.stalled) bridge.stalled({ secs: Math.round(idle / 1000), vis: document.visibilityState });
  }, 1000);
  if (bridge) bridge.on('wake', () => { last = performance.now(); });
})();
