// Shadepis Gaming-News: Er ruft ein Ordens-Hologramm auf und liest Schlagzeilen vor –
// aus den RSS-Feeds großer Spieleseiten (gesammelt im Hauptprozess, main/news.js).
'use strict';

const NEWS_EVERY = { selten: [900, 1800], normal: [420, 900], oft: [180, 420] }; // Sekunden zwischen Lesungen

// Kommentare je nach Thema der Schlagzeile (erste passende Regel gewinnt)
const NEWS_TAKES = [
  [/gta|grand theft/i, ['Noch ein Raub. Diesmal mit Wartezeit.', 'Los Santos. Laut, bunt, gefährlich. Wie Night City.']],
  [/kostenlos|gratis|free|umsonst|geschenkt|epic games store/i, ['Kostenlos? Raven, hol das. Schnell.', 'Gratis. Das Wort mag ich.']],
  [/rabatt|sale|deal|angebot|prozent|%|günstig/i, ['Ein Angebot. Dein Geldbeutel zittert.', 'Rabatt. Der Stapel ungespielter Spiele wächst.']],
  [/patch|update|hotfix|bugfix|fehler|bug/i, ['Ein Patch. Klebeband für Spiele.', 'Sie reparieren es. Wie ich meine Bildschirmlöcher.']],
  [/release|erscheint|veröffentlich|launch|datum|termin|launches|out now/i, ['Noch ein Spiel für den Stapel.', 'Ich notiere es. Im Kopf.']],
  [/trailer|teaser|enthüllt|reveal|gezeigt|showcase/i, ['Ein Trailer. Versprechen in Bewegung.', 'Schön anzusehen. Abwarten.']],
  [/test|review|wertung|im test|impressions/i, ['Ein Urteil. Ich kämpfe lieber selbst.', 'Zahlen. Spiel es selbst.']],
  [/ps5|playstation|sony/i, ['Die PlayStation. Raven hätte sie längst gehackt.']],
  [/xbox|microsoft|game pass/i, ['Grüne Kiste. Ordentlich.']],
  [/nintendo|switch|zelda|mario|pokémon|pokemon/i, ['Nintendo. Selbst der Orden spielt manchmal Mario.', 'Bunte Welten. Gut für die Seele.']],
  [/steam|valve/i, ['Steam. Dein Archiv wird größer.']],
  [/server|down|störung|outage|ausfall/i, ['Server tot. Zeit zum Trainieren.', 'Störung. Ich kenne das von Raven.']],
  [/cyberpunk|night city|netrunner|hack/i, ['Netrunner? Raven, das ist deins.', 'Night City. Klingt nach Zuhause.']],
  [/mmo|wow|world of warcraft|raid|dungeon/i, ['Ein Dungeon. Ich gehe lieber allein.', 'Gruppen. Nervig. Aber manchmal nötig.']],
  [/strategie|strategy|aufbau|4x/i, ['Strategie. Wie Schach mit Explosionen.']],
  [/horror|grusel|zombie/i, ['Grusel. Mich erschreckt höchstens Ravens Kaffeekonsum.']],
  [/ki\b|\bai\b|künstliche intelligenz/i, ['Künstliche Intelligenz. Ich bin gespannt, wie lange noch.']],
];
const NEWS_GENERIC = ['Interessant.', 'Merk dir das.', 'Hm. Der Orden beobachtet.', 'Klingt nach Arbeit für die Welt da draußen.', 'Notiert.'];
const NEWS_OPEN = ['Neuigkeiten aus dem Netz.', 'Gaming-News. Hör zu.', 'Das Ordensnetz meldet etwas.', 'Kurzer Lagebericht aus der Spielewelt.', 'Neue Meldungen. Ich lese vor.'];
const NEWS_CLOSE = ['Das war es. Zurück zur Wache.', 'Genug Nachrichten. Training.', 'Mehr später.', 'Ende des Berichts.'];
const RAVEN_NEWS = ['Ooh, das will ich sehen!', 'Schick mir den Link, Hutmann.', 'Pff, das wusste ich schon gestern.', 'Das kommt auf meine Liste.', 'Du liest das so ernst vor. Süß.'];

class NewsReader {
  constructor(world, bridge) {
    this.world = world; this.bridge = bridge;
    this.items = []; this.sources = []; this.total = 0;
    this.panel = null; this.item = null; this.queue = [];
    this.read = new Set();
    try { this.read = new Set(JSON.parse(localStorage.getItem('deskpet.newsRead') || '[]')); } catch (_) {}
    this.next = rnd(150, 300);
    world.news = this;
    if (!bridge) this.demo();
  }

  get on() { return this.world.settings.news !== false; }

  set(data) {
    this.items = data.items || []; this.sources = data.sources || []; this.total = data.total || this.items.length;
    if (this.world.ui && this.world.ui.isOpen && this.world.ui.tab === 'news') this.world.ui.render();
  }

  demo() {
    const now = Date.now();
    this.set({ total: 5, sources: [{ id: 'demo', name: 'Vorschau', ok: true, n: 5 }], items: [
      { id: 'd1', title: 'Beispiel: Großes Rollenspiel bekommt kostenloses Wochenende', teaser: 'In der Browser-Vorschau zeigt Shadepi Beispielmeldungen. Im Programm kommen echte Schlagzeilen aus den RSS-Feeds großer Spieleseiten.', link: 'https://github.com/Inrouder/Shadepideskpet', date: now - 30 * 60000, source: 'Vorschau', src: 'demo' },
      { id: 'd2', title: 'Beispiel: Neuer Patch für ein Cyberpunk-Abenteuer verbessert Netrunner', teaser: 'Mehr Hacks, weniger Fehler.', link: 'https://github.com/Inrouder/Shadepideskpet', date: now - 2 * 3600000, source: 'Vorschau', src: 'demo' },
      { id: 'd3', title: 'Beispiel: Release-Termin für ein Strategiespiel steht fest', teaser: 'Erscheint im Dezember.', link: 'https://github.com/Inrouder/Shadepideskpet', date: now - 5 * 3600000, source: 'Vorschau', src: 'demo' },
    ] });
  }

  unread() { return this.items.filter((i) => !this.read.has(i.id)); }
  markRead(it) {
    this.read.add(it.id);
    const arr = [...this.read].slice(-600);
    this.read = new Set(arr);
    try { localStorage.setItem('deskpet.newsRead', JSON.stringify(arr)); } catch (_) {}
  }

  // Regelmäßig von selbst vorlesen (nur wenn Neues da ist und gerade nichts los ist)
  update(dt) {
    const W = this.world;
    if (this.panel) this.place();
    if (!this.on || W.gaming || W.duel || W.hidden || W.hasEnemies()) return;
    this.next -= dt;
    if (this.next > 0) return;
    const [a, b] = NEWS_EVERY[W.settings.newsEvery] || NEWS_EVERY.normal;
    this.next = rnd(a, b);
    if (this.unread().length) this.start();
  }

  reader() {
    const W = this.world;
    const sh = W.hero('shadepi');
    if (sh && !sh.absent && !sh.ko) return sh;
    return null;
  }

  // Lesung starten; item = bestimmte Meldung (aus dem Menü), sonst die neuesten ungelesenen
  start(item) {
    const W = this.world;
    const h = this.reader();
    if (!h) { const ra = W.hero('raven'); if (ra && !ra.absent) ra.talk(item ? 'Shadepi liest das später vor. Er ist gerade unterwegs.' : 'Keine News ohne Hutmann.', true); return false; }
    if (!this.items.length) { h.talk('Das Ordensnetz ist still. Keine Meldungen.', true); if (this.bridge) this.bridge.refreshNews(); return false; }
    const list = item ? [item] : this.unread().slice(0, rndi(1, 3));
    if (!list.length) { h.talk('Nichts Neues. Ich habe alles vorgelesen.', true); return false; }
    h.warpHome();
    return h.setTask('news', this.read_(h, list, !item), 2.4);
  }

  *read_(h, list, auto) {
    const W = this.world, u = W.u;
    h.walkVx = 0; h.faceCam = true;
    h.forcePose = 'pose'; h.poseRow = 0; // ruft das Hologramm (Aufladepose)
    Sound.play('legacy_aura', 0.3, 1.5);
    yield* h.wait(0.5);
    h.forcePose = null;
    try {
      if (auto || chance(0.5)) { h.talk(pick(NEWS_OPEN), true); yield* h.wait(2.2); }
      for (let i = 0; i < list.length; i++) {
        const it = list[i];
        this.item = it;
        this.markRead(it);
        this.open(it, i, list.length);
        Sound.play('calib_accept', 0.35, 1.3);
        h.talk(`${it.source}: ${it.title}`, true);
        yield* h.wait(clamp(2 + it.title.length * 0.055, 3.2, 8));
        const take = (NEWS_TAKES.find(([re]) => re.test(it.title + ' ' + it.teaser)) || [null, NEWS_GENERIC])[1];
        h.talk(pick(take), true);
        const ra = W.hero('raven');
        if (ra && !ra.absent && !ra.ko && chance(0.35)) { yield* h.wait(1.6); ra.talk(pick(RAVEN_NEWS), true); }
        yield* h.wait(2.6);
        if (this.skip) { this.skip = false; }
      }
      if (auto && list.length > 1) { h.talk(pick(NEWS_CLOSE), true); yield* h.wait(1.6); }
      yield* h.wait(2.5);
    } finally {
      h.faceCam = false; h.forcePose = null;
      this.close();
    }
  }

  // ------------------------------------------------------------ Hologramm
  open(it, i, n) {
    if (!this.panel) {
      const p = document.createElement('div');
      p.className = 'holo news interactive';
      document.getElementById('ui').appendChild(p);
      this.panel = p;
    }
    const p = this.panel;
    p.innerHTML = '';
    const head = document.createElement('div'); head.className = 'hh';
    const b = document.createElement('b'); b.textContent = 'ORDENSNETZ · GAMING-NEWS';
    const s = document.createElement('span'); s.textContent = n > 1 ? `${i + 1}/${n}` : ago(it.date);
    head.append(b, s);
    const src = document.createElement('div'); src.className = 'nsrc'; src.textContent = `${it.source.toUpperCase()} · ${ago(it.date)}`;
    const t = document.createElement('div'); t.className = 'ntitle'; t.textContent = it.title;
    const d = document.createElement('div'); d.className = 'nteaser'; d.textContent = it.teaser || '';
    const row = document.createElement('div'); row.className = 'nbtns';
    const open = document.createElement('button'); open.textContent = 'ARTIKEL ÖFFNEN';
    open.addEventListener('click', () => { if (this.bridge) this.bridge.openUrl(it.link); else window.open(it.link, '_blank'); Sound.play('calib_tick', 0.4, 1.3); });
    const x = document.createElement('button'); x.textContent = '✕'; x.title = 'Schließen';
    x.addEventListener('click', () => { const h = this.reader(); if (h && h.taskName === 'news') h.cancelTask(); this.close(); });
    row.append(open, x);
    p.append(head, src, t, d, row);
    p.classList.remove('out');
    this.place();
  }

  close() {
    if (!this.panel) return;
    const p = this.panel;
    p.classList.add('out');
    setTimeout(() => p.remove(), 350);
    this.panel = null; this.item = null;
  }

  place() {
    const h = this.reader();
    if (!this.panel || !h) return;
    const W = this.world, T = W.terrain;
    const w = this.panel.offsetWidth, hh = this.panel.offsetHeight;
    const p = W.presentHeroes().find((x) => x !== h);
    let side = p ? (p.x > h.x ? -1 : 1) : (h.x > T.W / 2 ? -1 : 1);
    if (side > 0 && h.x + 44 * W.u + w > T.W - 8) side = -1;
    if (side < 0 && h.x - 44 * W.u - w < 8) side = 1;
    const x = side > 0 ? h.x + 44 * W.u : h.x - 44 * W.u - w;
    this.panel.style.left = clamp(x, 8, T.W - w - 8) + 'px';
    this.panel.style.top = clamp(h.y - 10 * W.u - hh, 8, T.H - hh - 8) + 'px';
  }
}

function ago(t) {
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (m < 1) return 'gerade eben';
  if (m < 60) return `vor ${m} Min.`;
  const h = Math.round(m / 60);
  if (h < 24) return `vor ${h} Std.`;
  const d = Math.round(h / 24);
  return d === 1 ? 'gestern' : `vor ${d} Tagen`;
}
