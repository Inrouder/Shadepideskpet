// Menü im Pixel-UI von ShadepiRPG (Raven-Thema) + Seitenleiste.
'use strict';

const MENU_TABS = [
  { id: 'toys', label: 'SPIELZEUG' },
  { id: 'gear', label: 'AUSRÜSTUNG' },
  { id: 'foes', label: 'GEGNER' },
  { id: 'scenes', label: 'SZENEN' },
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
      for (const id of ['drohnen', 'schwarm', 'viren', 'gang', 'bots', 'training', 'luke', 'besuch', 'sparring', 'plaudern', 'ball', 'wechsel']) card(EVENT_LABELS[id], '', null, () => D.startEvent(id), 'text');
      card('Alles aufräumen', 'Gegner & Spielzeug weg', null, () => W.clearAll(), 'text warn');
    } else if (this.tab === 'cast') {
      const modes = [['shadepi', 'Shadepi', 'nur er (mit Besuchen)'], ['raven', 'Raven', 'nur sie (mit Besuchen)'], ['beide', 'Beide', 'immer zusammen'], ['wechselnd', 'Abwechselnd', 'Schichtwechsel & Besuche']];
      for (const [id, l, s] of modes) card(l, s, id === 'shadepi' || id === 'raven' ? this.icon('hero', id) : null, () => { this.api.set('mode', id); this.render(); }, (W.settings.mode === id ? 'on ' : '') + (id === 'beide' || id === 'wechselnd' ? 'text' : ''));
      card('Partner rufen', 'kommt kurz vorbei', null, () => D.startEvent('besuch'), 'text');
      card('Schichtwechsel', 'nur bei „Abwechselnd“', null, () => D.swapMain(), 'text');
    } else if (this.tab === 'system') {
      this.renderSystem(c);
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
    toggle('Seitenleiste', 'dock');
    toggle('Ruhemodus', 'paused');
    const actions = document.createElement('div'); actions.className = 'actions';
    const act = (l, fn, cls = '') => { const b = document.createElement('button'); b.className = 'act ' + cls; b.textContent = l; b.addEventListener('click', fn); actions.appendChild(b); };
    if (this.bridge) {
      act('Ausblenden (Strg+Alt+H)', () => this.bridge.hide());
      act('Beenden', () => this.bridge.quit(), 'warn');
    }
    act(s.debug ? 'Flächen verbergen' : 'Flächen anzeigen', () => { this.api.set('debug', !s.debug); setTimeout(() => this.render(), 30); });
    c.appendChild(wrap); c.appendChild(actions);
    const st = document.createElement('div'); st.className = 'status';
    st.textContent = this.bridge ? (W.scanner === false ? 'Fenstererkennung: nur unter Windows verfügbar' : `Fenster erkannt: ${W.terrain.windowSurfaces().length} begehbare Kanten`) : 'Browser-Vorschau mit simulierten Fenstern';
    c.appendChild(st);
  }

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
