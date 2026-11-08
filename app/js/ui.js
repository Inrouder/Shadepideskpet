// Menü im Pixel-UI von ShadepiRPG (Raven-Thema) + Seitenleiste.
'use strict';

const MENU_TABS = [
  { id: 'toys', label: 'SPIELZEUG' },
  { id: 'gear', label: 'AUSRÜSTUNG' },
  { id: 'foes', label: 'GEGNER' },
  { id: 'scenes', label: 'SZENEN' },
  { id: 'alarm', label: 'WECKER' },
  { id: 'cast', label: 'FIGUREN' },
  { id: 'system', label: 'SYSTEM' },
];

class UI {
  constructor(world, bridge, settingsApi) {
    this.world = world; this.bridge = bridge; this.api = settingsApi;
    this.root = document.getElementById('ui');
    this.menu = null; this.tab = 'toys'; this.pos = { x: 0, y: 0 };
    this.leaveTimer = null;
    this.icons = {};
    this.buildDock();
  }

  isOver(x, y) {
    const el = document.elementFromPoint(x, y);
    return !!(el && el.closest && el.closest('.interactive'));
  }

  buildDock() {
    const d = document.createElement('div');
    d.id = 'dock'; d.className = 'interactive';
    d.innerHTML = `<img src="assets/ui/icon.png" alt=""><span>MENÜ</span>`;
    d.addEventListener('click', () => { const r = d.getBoundingClientRect(); this.open(r.left - 20, r.top + 20); });
    this.root.appendChild(d);
    this.dock = d;
    this.syncDock();
  }
  syncDock() { this.dock.style.display = this.world.settings.dock ? '' : 'none'; }

  open(x, y, ent) {
    this.pos = { x, y };
    if (!this.menu) this.buildMenu();
    if (ent instanceof Hero) this.tab = 'cast';
    this.menu.classList.remove('hidden');
    this.render();
    this.place();
    requestAnimationFrame(() => this.place());
    setTimeout(() => this.place(), 250);
    Sound.play('calib_tick', 0.4);
  }
  place() {
    if (!this.menu) return;
    const { x, y } = this.pos;
    const w = this.menu.offsetWidth, h = this.menu.offsetHeight;
    const T = this.world.terrain;
    let left = x + 14, top = y - h / 2;
    if (left + w > T.W - 8) left = x - w - 14;
    top = clamp(top, 8, Math.max(8, T.H - h - 8));
    left = clamp(left, 8, Math.max(8, T.W - w - 8));
    this.menu.style.left = left + 'px'; this.menu.style.top = top + 'px';
  }
  close() { if (this.menu) this.menu.classList.add('hidden'); Sound.play('calib_tick', 0.25, 0.8); }
  get isOpen() { return this.menu && !this.menu.classList.contains('hidden'); }

  buildMenu() {
    const m = document.createElement('div');
    m.id = 'menu'; m.className = 'panel interactive hidden';
    m.innerHTML = `
      <div class="menu-head"><div><div class="title">SHADEPI DESKPET</div><div class="sys">NIGHTWING · RAVENS EIGENES NETZ</div></div><button class="close" title="Schließen">✕</button></div>
      <div class="tabs">${MENU_TABS.map((t) => `<button class="tab" data-tab="${t.id}">${t.label}</button>`).join('')}</div>
      <div class="content"></div>
      <div class="hint">Figuren mit der Maus packen und werfen · Rechtsklick auf eine Figur · Strg+Alt+P</div>`;
    new ResizeObserver(() => this.place()).observe(m);
    m.querySelector('.close').addEventListener('click', () => this.close());
    m.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => { this.tab = b.dataset.tab; this.render(); Sound.play('calib_tick', 0.3, 1.2); }));
    m.addEventListener('mouseleave', () => { clearTimeout(this.leaveTimer); this.leaveTimer = setTimeout(() => this.close(), 2600); });
    m.addEventListener('mouseenter', () => clearTimeout(this.leaveTimer));
    this.root.appendChild(m);
    this.menu = m;
  }

  spawnPoint() {
    const T = this.world.terrain;
    return { x: clamp(this.pos.x, 40, T.W - 40), y: clamp(this.pos.y, 40, T.floorY - 60) };
  }

  render() {
    const m = this.menu, W = this.world, D = W.director;
    m.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === this.tab));
    const c = m.querySelector('.content');
    c.innerHTML = '';
    clearInterval(this.remTick);
    const grid = document.createElement('div'); grid.className = 'grid';
    const card = (label, sub, icon, onClick, extraClass = '') => {
      const b = document.createElement('button');
      b.className = 'card ' + extraClass;
      if (icon) b.appendChild(icon);
      const t = document.createElement('span'); t.className = 'lbl'; t.textContent = label; b.appendChild(t);
      if (sub) { const s = document.createElement('small'); s.textContent = sub; b.appendChild(s); }
      b.addEventListener('click', (e) => { e.stopPropagation(); onClick(); b.classList.add('fired'); setTimeout(() => b.classList.remove('fired'), 300); });
      grid.appendChild(b);
      return b;
    };
    const sp = () => this.spawnPoint();
    if (this.tab === 'toys') {
      for (const k of ['crate', 'barrel', 'holocube', 'ball', 'vending', 'server', 'fusebox']) card(ITEM_DEF[k].label, '', this.icon('item', k), () => { const p = sp(); W.spawnItem(k, p.x, p.y); });
    } else if (this.tab === 'gear') {
      for (const k of ['core', 'blade', 'shuriken', 'overclock', 'emp', 'medkit']) card(ITEM_DEF[k].label, ITEM_DEF[k].desc + (ITEM_DEF[k].forHero ? ` · ${HERO_DEF[ITEM_DEF[k].forHero].display}` : ''), this.icon('item', k), () => { const p = sp(); W.spawnItem(k, p.x, p.y); });
    } else if (this.tab === 'foes') {
      const foes = [['drone', 'Drohne'], ['virus', 'Datenvirus'], ['bigvirus', 'Großer Virus'], ['punk', 'Cyberpunk'], ['shooter', 'Schütze'], ['bot', 'Kampfbot']];
      for (const [k, l] of foes) card(l, '', this.icon('foe', k), () => this.spawnFoe(k));
      card('ICE-Wächter', 'Boss', this.icon('foe', 'ice'), () => D.startEvent('ice'), 'boss');
      card('Chrome Jackal', 'Boss', this.icon('foe', 'jackal'), () => D.startEvent('jackal'), 'boss');
    } else if (this.tab === 'scenes') {
      card('Dojo', 'Kämpfe selbst gegen Shadepi · WASD, Maus, Controller', null, () => { this.close(); W.dojo && W.dojo.open(); }, 'text dojo');
      for (const id of ['drohnen', 'schwarm', 'viren', 'gang', 'bots', 'training', 'luke', 'system', 'besuch', 'sparring', 'plaudern', 'ball', 'blick', 'bluete', 'wechsel']) card(EVENT_LABELS[id], '', null, () => D.startEvent(id), 'text');
      card('Alles aufräumen', 'Gegner & Spielzeug weg', null, () => W.clearAll(), 'text warn');
    } else if (this.tab === 'cast') {
      const modes = [['shadepi', 'Shadepi', 'nur er (mit Besuchen)'], ['raven', 'Raven', 'nur sie (mit Besuchen)'], ['beide', 'Beide', 'immer zusammen'], ['wechselnd', 'Abwechselnd', 'Schichtwechsel & Besuche']];
      for (const [id, l, s] of modes) card(l, s, id === 'shadepi' || id === 'raven' ? this.icon('hero', id) : null, () => { this.api.set('mode', id); this.render(); }, (W.settings.mode === id ? 'on ' : '') + (id === 'beide' || id === 'wechselnd' ? 'text' : ''));
      card('Partner rufen', 'kommt kurz vorbei', null, () => D.startEvent('besuch'), 'text');
      card('Schichtwechsel', 'nur bei „Abwechselnd“', null, () => D.swapMain(), 'text');
    } else if (this.tab === 'system') {
      this.renderSystem(c);
      return;
    } else if (this.tab === 'alarm') {
      this.renderAlarm(c);
      return;
    }
    c.appendChild(grid);
  }

  renderSystem(c) {
    const W = this.world, s = W.settings;
    const wrap = document.createElement('div'); wrap.className = 'sys-grid';
    const slider = (label, key, min, max, step, fmt) => {
      const row = document.createElement('label'); row.className = 'row';
      row.innerHTML = `<span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${s[key]}"><em>${fmt(s[key])}</em>`;
      const inp = row.querySelector('input'), em = row.querySelector('em');
      inp.addEventListener('input', () => { em.textContent = fmt(+inp.value); this.api.set(key, +inp.value); });
      wrap.appendChild(row);
    };
    const toggle = (label, key) => {
      const b = document.createElement('button'); b.className = 'toggle' + (s[key] ? ' on' : '');
      b.innerHTML = `<span>${label}</span><b>${s[key] ? 'AN' : 'AUS'}</b>`;
      b.addEventListener('click', () => { this.api.set(key, !W.settings[key]); setTimeout(() => this.render(), 30); });
      wrap.appendChild(b);
    };
    const radio = (label, key, opts) => {
      const row = document.createElement('div'); row.className = 'row radio';
      row.innerHTML = `<span>${label}</span>` + opts.map(([v, l]) => `<button class="${s[key] === v ? 'on' : ''}" data-v="${v}">${l}</button>`).join('');
      row.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { this.api.set(key, b.dataset.v); setTimeout(() => this.render(), 30); }));
      wrap.appendChild(row);
    };
    slider('Größe', 'size', 0.45, 1.2, 0.01, (v) => Math.round((v / 0.72) * 100) + ' %');
    slider('Lautstärke', 'volume', 0, 1, 0.01, (v) => Math.round(v * 100) + ' %');
    radio('Aktivität', 'activity', [['ruhig', 'Ruhig'], ['normal', 'Normal'], ['chaos', 'Chaos']]);
    toggle('Kino-Effekte', 'cinematic');
    toggle('Bildschirmschäden', 'screenDamage');
    toggle('Fenster beklettern', 'climbWindows');
    toggle('Sprechblasen', 'bubbles');
    toggle('Kampfmusik', 'music');
    toggle('Bei Vollbild ausblenden', 'hideFullscreen');
    toggle('Bei Spielen pausieren', 'gamePause');
    toggle('Systemberichte (Raven)', 'sysReports');
    toggle('Romantische Momente', 'romance');
    toggle('Seitenleiste', 'dock');
    toggle('Ruhemodus', 'paused');
    const actions = document.createElement('div'); actions.className = 'actions';
    const act = (l, fn, cls = '') => { const b = document.createElement('button'); b.className = 'act ' + cls; b.textContent = l; b.addEventListener('click', fn); actions.appendChild(b); };
    if (this.bridge) {
      act('Ausblenden (Strg+Alt+H)', () => this.bridge.hide());
      act(`Nach Updates suchen (v${W.version || '?'})`, () => W.updates.check());
      act('Protokollordner', () => this.bridge.openLog && this.bridge.openLog());
      act('Beenden', () => this.bridge.quit(), 'warn');
    }
    act(s.debug ? 'Flächen verbergen' : 'Flächen anzeigen', () => { this.api.set('debug', !s.debug); setTimeout(() => this.render(), 30); });
    c.appendChild(wrap);
    const games = document.createElement('div'); games.className = 'games';
    c.appendChild(games);
    this.updateGames(games);
    c.appendChild(actions);
    const st = document.createElement('div'); st.className = 'status';
    st.textContent = this.statusText();
    c.appendChild(st);
  }

  renderAlarm(c) {
    const W = this.world, R = W.reminders, s = W.settings;
    const now = new Date();
    if (!this.draft) {
      const d = new Date(now.getTime() + 60 * 60000);
      this.draft = { min: 10, hh: d.getHours(), mm: Math.ceil(d.getMinutes() / 5) * 5 % 60, repeat: 'einmalig', text: '' };
    }
    const D = this.draft;
    const pad = (n) => String(n).padStart(2, '0');
    const el = (html, cls) => { const d = document.createElement('div'); if (cls) d.className = cls; d.innerHTML = html; return d; };
    const wrap = el('', 'alarm');

    // Text
    const txt = el(`<input class="rem-input" type="text" maxlength="60" placeholder="Woran sollen sie dich erinnern? (optional)">`, 'row');
    const inp = txt.querySelector('input');
    inp.value = D.text;
    inp.addEventListener('input', () => (D.text = inp.value));
    inp.addEventListener('focus', () => this.bridge && this.bridge.setFocusable(true));
    inp.addEventListener('blur', () => this.bridge && this.bridge.setFocusable(false));
    wrap.appendChild(txt);

    // Timer
    const timer = el(`<h4>TIMER</h4><div class="quick">${[1, 5, 10, 15, 25, 30, 45, 60].map((m) => `<button data-m="${m}">${m} Min</button>`).join('')}</div>
      <div class="stepper"><button data-d="-5">−5</button><button data-d="-1">−1</button><b>${D.min} Min</b><button data-d="1">+1</button><button data-d="5">+5</button><button class="go" data-go="timer">Timer starten</button></div>`, 'sec');
    timer.querySelectorAll('.quick button').forEach((b) => b.addEventListener('click', () => { R.addTimer(+b.dataset.m, D.text.trim()); D.text = ''; this.render(); }));
    timer.querySelectorAll('[data-d]').forEach((b) => b.addEventListener('click', () => { D.min = clamp(D.min + +b.dataset.d, 1, 600); this.render(); }));
    timer.querySelector('[data-go]').addEventListener('click', () => { R.addTimer(D.min, D.text.trim()); D.text = ''; this.render(); });
    wrap.appendChild(timer);

    // Wecker
    const alarm = el(`<h4>WECKER</h4><div class="stepper clock"><button data-h="-1">−</button><b>${pad(D.hh)}</b><button data-h="1">+</button><span>:</span><button data-n="-5">−</button><b>${pad(D.mm)}</b><button data-n="5">+</button>
      <span class="rep">${[['einmalig', 'Einmal'], ['täglich', 'Täglich'], ['werktags', 'Mo–Fr']].map(([v, l]) => `<button data-r="${v}" class="${D.repeat === v ? 'on' : ''}">${l}</button>`).join('')}</span>
      <button class="go" data-go="alarm">Wecker stellen</button></div>`, 'sec');
    alarm.querySelectorAll('[data-h]').forEach((b) => b.addEventListener('click', () => { D.hh = (D.hh + +b.dataset.h + 24) % 24; this.render(); }));
    alarm.querySelectorAll('[data-n]').forEach((b) => b.addEventListener('click', () => { D.mm = (D.mm + +b.dataset.n + 60) % 60; this.render(); }));
    alarm.querySelectorAll('[data-r]').forEach((b) => b.addEventListener('click', () => { D.repeat = b.dataset.r; this.render(); }));
    alarm.querySelector('[data-go]').addEventListener('click', () => { R.addAlarm(D.hh, D.mm, D.repeat, D.text.trim()); D.text = ''; this.render(); });
    wrap.appendChild(alarm);

    // Aktive
    const list = [...R.list].sort((a, b) => a.at - b.at);
    const act = el(`<h4>AKTIV</h4>`, 'sec');
    if (!list.length) act.appendChild(el('Keine Timer oder Wecker gestellt.', 'empty'));
    for (const r of list) {
      const row = el(`<span class="kind">${r.kind === 'alarm' ? '⏰' : '⏱'}</span><span class="when"></span><span class="what"></span><button title="Löschen">✕</button>`, 'rem-row');
      row.querySelector('.what').textContent = r.text || (r.kind === 'alarm' ? (r.repeat === 'einmalig' ? 'Wecker' : r.repeat === 'täglich' ? 'täglich' : 'Mo–Fr') : `Timer ${r.min || ''} Min`);
      row.dataset.id = r.id;
      row.querySelector('button').addEventListener('click', () => { R.remove(r.id); setTimeout(() => this.render(), 30); });
      act.appendChild(row);
    }
    wrap.appendChild(act);
    const tickRows = () => {
      for (const row of wrap.querySelectorAll('.rem-row')) {
        const r = R.list.find((x) => x.id === row.dataset.id);
        if (!r) continue;
        const left = r.at - Date.now();
        row.querySelector('.when').textContent = r.kind === 'alarm' ? `${pad(r.hh)}:${pad(r.mm)} · in ${fmtLeft(left)}` : fmtLeft(left);
      }
    };
    tickRows();
    this.remTick = setInterval(tickRows, 1000);

    // Automatisch
    const auto = el(`<h4>AUTOMATISCH</h4>`, 'sec');
    const cyc = (label, key, opts) => {
      const row = el(`<span>${label}</span>` + opts.map(([v, l]) => `<button data-v="${v}" class="${s[key] === v ? 'on' : ''}">${l}</button>`).join(''), 'row radio');
      row.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
        const v = b.dataset.v === 'true' ? true : b.dataset.v === 'false' ? false : +b.dataset.v;
        this.api.set(key, v);
        if (key === 'breakEvery') R.lastBreak = Date.now();
        if (key === 'drinkEvery') R.lastDrink = Date.now();
        setTimeout(() => this.render(), 30);
      }));
      auto.appendChild(row);
    };
    cyc('Pausen', 'breakEvery', [[0, 'Aus'], [30, '30 Min'], [45, '45 Min'], [60, '60 Min'], [90, '90 Min']]);
    cyc('Trinken', 'drinkEvery', [[0, 'Aus'], [30, '30 Min'], [60, '60 Min'], [90, '90 Min']]);
    cyc('Stunden', 'chime', [[false, 'Aus'], [true, 'Ansage zur vollen Stunde']]);
    wrap.appendChild(auto);
    c.appendChild(wrap);
  }

  // Spielmodus: eigene Spiele merken / Fehlalarme ignorieren
  updateGames(el) {
    el = el || (this.menu && this.menu.querySelector('.games'));
    if (!el) return;
    const W = this.world, s = W.settings, info = W.gameInfo;
    const chip = (name, cls, title, onClick) => { const b = document.createElement('button'); b.className = 'chip ' + cls; b.textContent = name; b.title = title; b.addEventListener('click', onClick); return b; };
    el.innerHTML = '<h4>SPIELMODUS</h4>';
    const st = document.createElement('div'); st.className = 'gstatus';
    st.textContent = !this.bridge ? 'In der Browser-Vorschau nicht verfügbar.'
      : info && info.supported === false ? 'Spielerkennung nur unter Windows.'
      : !s.gamePause ? 'Aus – die beiden bleiben auch beim Spielen sichtbar.'
      : info && info.game ? `Erkannt: ${info.game.name} – pausiert` : 'Kein Spiel erkannt. Spiele aus Steam, Epic, GOG, Ubisoft, EA, Xbox, Rockstar und Vollbild-Spiele pausieren automatisch.';
    el.appendChild(st);
    const row = (label, items) => { const r = document.createElement('div'); r.className = 'grow'; const l = document.createElement('span'); l.textContent = label; r.appendChild(l); items.forEach((i) => r.appendChild(i)); el.appendChild(r); };
    const own = s.gameOwn || [], ign = s.gameIgnore || [];
    const visible = ((info && info.visible) || []).filter((e) => !own.includes(e) && !ign.includes(e));
    if (visible.length) row('Als Spiel merken:', visible.slice(0, 8).map((e) => chip('+ ' + e.replace(/\.exe$/, ''), 'add', e, () => { this.api.set('gameOwn', [...own, e]); setTimeout(() => this.updateGames(), 40); })));
    if (own.length) row('Eigene Spiele:', own.map((e) => chip(e.replace(/\.exe$/, '') + ' ✕', 'own', 'Entfernen', () => { this.api.set('gameOwn', own.filter((x) => x !== e)); setTimeout(() => this.updateGames(), 40); })));
    if (ign.length) row('Kein Spiel:', ign.map((e) => chip(e.replace(/\.exe$/, '') + ' ✕', 'ign', 'Wieder erkennen', () => { this.api.set('gameIgnore', ign.filter((x) => x !== e)); setTimeout(() => this.updateGames(), 40); })));
  }

  statusText() {
    const W = this.world, sc = W.scanner;
    const method = sc ? ({ native: 'Windows-API', powershell: 'PowerShell', none: 'aus' }[sc.method] || sc.method) : '…';
    if (!this.bridge) return 'Browser-Vorschau mit simulierten Fenstern';
    if (sc && sc.platform && sc.platform !== 'win32') return 'Fenstererkennung: nur unter Windows verfügbar';
    return `Fenstererkennung: ${method} · ${sc ? sc.windows : 0} Fenster · ${W.terrain.windowSurfaces().length} begehbare Kanten` + (sc && sc.error ? ` · Fehler: ${sc.error}` : '');
  }
  updateStatus() { const el = this.menu && this.menu.querySelector('.status'); if (el) el.textContent = this.statusText(); }

  spawnFoe(k) {
    const W = this.world, p = this.spawnPoint();
    if (!W.director.fightActive) { W.director.fightActive = true; W.director.fightGraceUntil = W.time + 3; W.stats.kills = 0; W.stats.hits = 0; W.stats.fightStart = W.time; W.fightKind = 'custom'; Sound.setMusic('Fight'); }
    if (k === 'virus' || k === 'bigvirus') {
      const tear = new GlitchTear(p.x, p.y, 90 * W.u); W.screen.push(tear);
      setTimeout(() => W.spawnEnemy(k, { x: p.x, y: p.y }), 400);
      setTimeout(() => (tear.closing = true), 1300);
    } else W.spawnEnemy(k, { x: p.x, side: p.x < W.terrain.W / 2 ? -1 : 1 });
    for (const h of W.presentHeroes()) if (!h.ko && h.taskName !== 'fight' && h.taskPrio < 3) setTimeout(() => h.setTask('fight', h.fight(), 3), 400);
  }

  // Kleine Vorschaubilder für die Karten
  icon(type, k) {
    const key = type + k;
    const cv = document.createElement('canvas');
    cv.width = 56; cv.height = 56; cv.className = 'ic';
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    const fit = (img, rx, ry, rw, rh) => { const s = Math.min(52 / rw, 52 / rh); ctx.drawImage(img, rx, ry, rw, rh, 28 - (rw * s) / 2, 28 - (rh * s) / 2, rw * s, rh * s); };
    if (type === 'item') {
      const d = ITEM_DEF[k];
      if (d.img && IMG[d.img + '-intact']) { const im = IMG[d.img + '-intact']; fit(im, 0, 0, im.width, im.height); }
      else { ctx.translate(28, 28); drawProcItem(ctx, k, k === 'ball' ? 30 : 28, 1, 0.3, 0); }
    } else if (type === 'foe') {
      if (k === 'drone' && IMG.drone) fit(IMG.drone, 0, 0, IMG.drone.width, IMG.drone.height);
      else if ((k === 'virus' || k === 'bigvirus') && IMG.virus) fit(IMG.virus, 0, 0, IMG.virus.width, IMG.virus.height);
      else if (k === 'ice' && IMG.ice) fit(IMG.ice, 0, 0, IMG.ice.width, IMG.ice.height);
      else if (k === 'bot') { const p = MANIFEST.bot.idle[0]; fit(IMG.bot, ...p.region); }
      else { const img = IMG[k === 'punk' ? 'punk-1' : k === 'shooter' ? 'shooter-visor' : 'jackal']; if (img) fit(img, 24, 6, 80, 150); }
    } else if (type === 'hero') { const img = IMG[k]; if (img) fit(img, 24, 6, 80, 150); }
    this.icons[key] = cv;
    return cv;
  }
}
