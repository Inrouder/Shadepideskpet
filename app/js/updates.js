// Update-Anzeige im Spiel: Raven (oder wer gerade da ist) meldet neue Versionen,
// zeigt den Download-Fortschritt als Hologramm und bietet den Neustart an.
'use strict';

class UpdateUI {
  constructor(world, bridge) {
    this.world = world; this.bridge = bridge;
    this.state = { state: 'idle' };
    this.card = null; this.hero = null; this.manual = false; this.announced = {};
  }

  check() { this.manual = true; if (this.bridge && this.bridge.checkUpdate) this.bridge.checkUpdate(); }

  onState(st) {
    const prev = this.state.state;
    this.state = st;
    const W = this.world;
    const h = this.messenger();
    const v = st.version ? `v${st.version}` : '';
    if (st.state === 'available' && !this.announced['a' + st.version]) {
      this.announced['a' + st.version] = true;
      W.cinema.letterbox(2.2);
      W.cinema.card('UPDATE GEFUNDEN', `SHADEPI DESKPET ${v}`, COLORS.cyan, 2.4, { always: true });
      Sound.play('calib_accept', 0.6);
      if (h) {
        h.talk(h.name === 'raven' ? (st.installable ? `Neues Update ${v}! Ich lade es schon runter…` : `Neues Update ${v}! Holst du es dir?`) : (st.installable ? `Eine neue Version: ${v}. Sie wird geladen.` : `Eine neue Version: ${v}.`), true);
        if (h.name === 'raven' && st.installable) h.setTask('update', this.downloadDance(h), 2.5);
      }
      this.showCard();
    } else if (st.state === 'downloading') {
      this.showCard();
    } else if (st.state === 'ready' && prev !== 'ready') {
      W.cinema.card('UPDATE BEREIT', `${v} · WIRD BEIM NEUSTART INSTALLIERT`, COLORS.cyan, 2.6, { always: true });
      Sound.play('legacy_transfer', 0.4, 1.3);
      if (h) h.talk(h.name === 'raven' ? 'Fertig geladen! Neustart, und wir sind auf dem neuesten Stand.' : 'Das Update ist bereit.', true);
      this.showCard();
    } else if (st.state === 'none' && this.manual) {
      this.manual = false;
      if (h) h.talk(h.name === 'raven' ? `Alles aktuell. Version ${st.current}.` : `Wir sind auf dem neuesten Stand. ${st.current}.`, true);
    } else if (st.state === 'error' && this.manual) {
      this.manual = false;
      if (h) h.talk(h.name === 'raven' ? 'Update-Server antwortet nicht. Später nochmal.' : 'Keine Verbindung zum Update-Server.', true);
    }
  }

  messenger() {
    const hs = this.world.presentHeroes().filter((x) => !x.ko);
    return hs.find((x) => x.name === 'raven') || hs[0] || null;
  }

  *downloadDance(h) {
    const W = this.world, u = W.u;
    h.faceCam = true;
    let t = 0;
    while (t < 30 && ['available', 'downloading'].includes(this.state.state)) {
      t += W.dt;
      h.forcePose = 'cast'; h.forceDir = DIR.down; h.castRow = Math.floor(t * 2) % 2;
      if (chance(W.dt * 25)) W.fx.add({ type: 'text', x: h.x + rnd(-60, 60) * u, y: h.y - rnd(120, 170) * u, vx: 0, vy: rnd(30, 70), g: 0, life: 0.9, text: pick(['0', '1', '▮', '▯']), color: COLORS.cyan, size: 12 });
      yield;
    }
    h.forcePose = null; h.forceDir = null; h.faceCam = false;
  }

  showCard() {
    const st = this.state;
    if (!this.card) {
      const c = document.createElement('div');
      c.className = 'remcard interactive update';
      document.getElementById('ui').appendChild(c);
      c.addEventListener('click', (e) => {
        const a = e.target.closest('button');
        if (!a) return;
        if (a.dataset.a === 'install') { if (this.bridge) this.bridge.installUpdate(); }
        this.hide();
      });
      this.card = c;
    }
    const v = st.version ? `v${st.version}` : '';
    let html = `<div class="rc-head">UPDATE ${v}</div>`;
    if (st.state === 'downloading' || (st.state === 'available' && st.installable)) {
      const p = st.percent || 0;
      html += `<div class="rc-text">Wird geladen …</div><div class="bar"><i style="width:${p}%"></i></div><div class="rc-btns"><button data-a="later">Ausblenden</button></div>`;
    } else if (st.state === 'ready') {
      html += `<div class="rc-text">Bereit zur Installation</div><div class="rc-btns"><button data-a="install">Jetzt neu starten</button><button data-a="later">Beim Beenden</button></div>`;
    } else {
      html += `<div class="rc-text">Neue Version verfügbar (du hast ${st.current || '?'})</div><div class="rc-btns"><button data-a="install">Herunterladen</button><button data-a="later">Später</button></div>`;
    }
    if (this.card.innerHTML !== html) this.card.innerHTML = html;
    this.place();
  }
  hide() { if (this.card) { this.card.remove(); this.card = null; } }

  update() {
    if (!this.card) return;
    this.place();
  }
  place() {
    const W = this.world, T = W.terrain;
    const h = this.messenger();
    const w = this.card.offsetWidth, hh = this.card.offsetHeight;
    const x = h ? h.x : T.W - w / 2 - 60, y = h ? h.y - 235 * W.u : T.floorY - 120;
    const busy = W.reminders && W.reminders.card ? 120 : 0;
    this.card.style.left = clamp(x - w / 2, 8, T.W - w - 8) + 'px';
    this.card.style.top = clamp(y - hh - busy, 8, T.H - hh - 8) + 'px';
  }
}
