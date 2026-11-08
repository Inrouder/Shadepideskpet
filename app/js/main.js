// Start: Assets laden, Welt aufbauen, mit dem Electron-Hauptprozess verbinden
// (oder im Browser eine Vorschau mit simulierten Fenstern zeigen).
'use strict';

const DEFAULT_SETTINGS = {
  mode: 'wechselnd', size: 0.72, volume: 0.55, activity: 'normal', cinematic: true, screenDamage: true, music: false,
  bubbles: true, hideFullscreen: true, climbWindows: true, display: 0, dock: true, paused: false, debug: false,
  reminders: [], chime: false, breakEvery: 0, drinkEvery: 0, gamePause: true, gameOwn: [], gameIgnore: [], sysReports: true, romance: true,
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
      this.anim = { w, x0: w.x, y0: w.y, x1: clamp(w.x + rnd(-260, 260), 0, T.W - w.w), y1: clamp(w.y + rnd(-120, 120), 90, T.floorY - w.h - 10), t: 0 };
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
  draw(ctx, world) {
    const T = world.terrain;
    // Hintergrund + Taskleiste
    const g = ctx.createLinearGradient(0, 0, 0, T.H);
    g.addColorStop(0, '#1a2233'); g.addColorStop(1, '#0c111b');
    ctx.fillStyle = g; ctx.fillRect(0, 0, T.W, T.H);
    ctx.fillStyle = '#05070c'; ctx.fillRect(0, T.floorY, T.W, T.H - T.floorY);
    ctx.fillStyle = 'rgba(98,227,238,0.25)'; ctx.fillRect(0, T.floorY, T.W, 1);
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
    if (k in DEFAULT_SETTINGS && !Array.isArray(DEFAULT_SETTINGS[k])) settings[k] = typeof DEFAULT_SETTINGS[k] === 'number' ? +v : typeof DEFAULT_SETTINGS[k] === 'boolean' ? v !== '0' && v !== 'false' : v;
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
    world.resize(l.width, l.height);
    world.terrain.setLayout(l);
  }

  let ui = null;
  if (bridge) {
    await new Promise((res) => {
      let got = false;
      bridge.on('layout', (l) => { layout(l); if (!got) { got = true; res(); } });
      setTimeout(() => { if (!got) { got = true; layout({ width: innerWidth, height: innerHeight, workArea: { x: 0, y: 0, w: innerWidth, h: innerHeight - 48 } }); res(); } }, 1500);
    });
    bridge.on('settings', (s) => { Object.assign(settings, s); applySettings(); if (ui && ui.isOpen) ui.render(); });
    bridge.on('windows', (d) => { world.terrain.setWindows(d.windows); world.hidden = settings.hideFullscreen && d.fullscreen; });
    bridge.on('open-menu', (p) => ui.open(p.x, p.y));
    bridge.on('event', (id) => director.startEvent(id));
    bridge.on('scanner', (s) => { world.scanner = s; if (ui && ui.isOpen) ui.updateStatus(); });
    window.addEventListener('error', (e) => bridge.log && bridge.log(`${e.message} @ ${e.filename}:${e.lineno}`));
    const origError = console.error;
    console.error = (...a) => { try { bridge.log && bridge.log(a.map((x) => (x && x.stack) || String(x)).join(' ')); } catch (_) {} origError(...a); };
  } else {
    const taskbar = 48;
    layout({ width: innerWidth, height: innerHeight, workArea: { x: 0, y: 0, w: innerWidth, h: innerHeight - taskbar } });
    world.demoWindows = new DemoWindows(world);
    window.addEventListener('resize', () => { layout({ width: innerWidth, height: innerHeight, workArea: { x: 0, y: 0, w: innerWidth, h: innerHeight - taskbar } }); });
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
  director.setup();
  applySettings();
  Object.assign(window.PET, { director, ui, input, api, reminders, updates, sys });

  if (params.get('event')) setTimeout(() => director.startEvent(params.get('event')), +(params.get('delay') || 1500));
  if (params.has('menu')) setTimeout(() => ui.open(innerWidth * 0.55, innerHeight * 0.35), 400);

  let last = performance.now();
  const speed = +(params.get('speed') || 1);
  function frame(now) {
    const dt = ((now - last) / 1000) * speed;
    last = now;
    if (world.gaming) { frame.prev = now; requestAnimationFrame(frame); return; }
    if (world.demoWindows) world.demoWindows.update(dt);
    input.update(Math.min(dt, 0.05));
    reminders.update((now - (frame.prev || now)) / 1000);
    updates.update();
    sys.update();
    frame.prev = now;
    world.update(dt);
    world.draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
