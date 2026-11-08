// Wecker, Timer und automatische Erinnerungen (Pause, Trinken, Stundenansage).
// Fällige Erinnerungen überbringen Shadepi und/oder Raven persönlich.
'use strict';

const REM_LINES = {
  raven: {
    timer: () => ['Bling! Dein Timer ist abgelaufen!', 'Zeit ist um! Hopp, hopp!', 'Ding-ding! Erinnerung!'],
    alarm: (t, c) => [`Es ist ${c}! Aufwachen!`, `${c} Uhr! Dein Wecker klingelt!`],
    break: () => ['Pause! Steh mal auf und streck dich.', 'Bildschirmpause. Deine Augen danken es dir.', 'Zehn Kniebeugen. Ich zähle mit!'],
    drink: () => ['Trink was! Wasser, nicht Neon-Limo.', 'Hydrations-Check: Glas Wasser, jetzt.'],
    chime: (c) => [`Es ist ${c} Uhr.`, `${c} Uhr. Die Zeit rennt.`],
    nag: () => ['HALLO?! Erinnerung!', 'Ich wedel hier nicht zum Spaß!', 'Klick auf „Erledigt“, sonst klingel ich weiter!'],
    done: () => ['Gern geschehen!', 'Sauber.', 'Notiert und abgehakt.'],
    snooze: (m) => [`Okay, in ${m} Minuten nochmal.`, `Schlummern… ${m} Minuten. Aber dann!`],
    set: (t) => [`Gespeichert: ${t}. Ich sag Bescheid.`, `Läuft. ${t}.`],
  },
  shadepi: {
    timer: () => ['Die Zeit ist um.', 'Der Timer ist abgelaufen.'],
    alarm: (t, c) => [`Es ist ${c}.`, `${c}. Zeit zu handeln.`],
    break: () => ['Ein Krieger braucht Ruhe. Mach eine Pause.', 'Steh auf. Atme. Dann weiter.'],
    drink: () => ['Trink Wasser. Auch Krieger brauchen das.', 'Ein Schluck Wasser. Jetzt.'],
    chime: (c) => [`${c} Uhr.`, `Es ist ${c} Uhr. Bleib wachsam.`],
    nag: () => ['Ich warte.', 'Die Erinnerung. Bitte.', '…Hallo?'],
    done: () => ['Gut.', 'Erledigt.', 'Weiter so.'],
    snooze: (m) => [`${m} Minuten. Nicht mehr.`, `Ich erinnere dich in ${m} Minuten.`],
    set: (t) => [`Verstanden: ${t}.`, `Ich halte die Zeit im Blick. ${t}.`],
  },
};
const remLine = (who, key, ...a) => pick(REM_LINES[who][key](...a));

function fmtClock(d) { return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }); }
function fmtLeft(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
}
function nextAt(hh, mm, repeat, from = new Date()) {
  const d = new Date(from); d.setSeconds(0, 0); d.setHours(hh, mm);
  if (d <= from) d.setDate(d.getDate() + 1);
  if (repeat === 'werktags') while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d.getTime();
}

class Reminders {
  constructor(world, api, bridge) {
    this.world = world; this.api = api; this.bridge = bridge;
    this.active = null;     // gerade überbrachte Erinnerung
    this.queue = [];
    this.lastBreak = Date.now(); this.lastDrink = Date.now();
    this.lastChimeHour = new Date().getHours();
    this.acc = 0; this.ringT = 0; this.rings = 0; this.since = 0;
    this.card = null; this.hud = null;
    this.buildHud();
  }

  get list() { return Array.isArray(this.world.settings.reminders) ? this.world.settings.reminders : []; }
  save(list) { this.api.set('reminders', list); }

  addTimer(minutes, text) {
    const r = { id: Date.now() + '' + rndi(10, 99), kind: 'timer', at: Date.now() + minutes * 60000, text: text || '', min: minutes };
    this.save([...this.list, r]);
    this.ack('set', text || `Timer ${minutes} Min`);
    return r;
  }
  addAlarm(hh, mm, repeat, text) {
    const r = { id: Date.now() + '' + rndi(10, 99), kind: 'alarm', hh, mm, repeat, at: nextAt(hh, mm, repeat), text: text || '' };
    this.save([...this.list, r]);
    this.ack('set', `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}${text ? ' – ' + text : ''}`);
    return r;
  }
  remove(id) { this.save(this.list.filter((r) => r.id !== id)); }

  ack(key, arg) {
    const h = this.speaker();
    if (h) h.talk(remLine(h.name, key, arg), true);
  }
  speaker() {
    const hs = this.world.presentHeroes().filter((h) => !h.ko);
    return hs.length ? pick(hs) : null;
  }

  // ---------------------------------------------------------- Takt (Echtzeit)
  update(realDt) {
    this.acc += realDt;
    this.updateHud();
    if (this.active) this.updateActive(realDt);
    if (this.acc < 1) return;
    this.acc = 0;
    const now = Date.now();
    const d0 = new Date(now);
    const s = this.world.settings;
    // fällige Einträge
    const due = this.list.filter((r) => r.at <= now);
    if (due.length) {
      const keep = [];
      for (const r of this.list) {
        if (r.at > now) { keep.push(r); continue; }
        const q = { ...r };
        // Während eines Spiels: nur eine stille Windows-Benachrichtigung, Auftritt danach
        if (this.world.gaming && this.bridge && this.bridge.notify) { this.bridge.notify(r.kind === 'alarm' ? 'Wecker' : 'Timer', r.text || 'Zeit ist um.'); q.notified = true; }
        // Im Dojo: Hinweis einblenden, Auftritt nach dem Kampf
        else if (this.world.duel) {
          const W = this.world, sh = W.hero('shadepi');
          W.cinema.card(r.kind === 'alarm' ? 'WECKER' : r.kind === 'timer' ? 'TIMER' : 'ERINNERUNG', (r.text || 'Zeit ist um.').toUpperCase(), COLORS.amber, 2.6, { always: true, small: true, y: W.terrain.H * 0.5 });
          Sound.play('calib_alarm', 0.6);
          if (sh) sh.talk(r.kind === 'alarm' || r.kind === 'timer' ? 'Dein Wecker, Bruder. Ich sag es dir nach dem Kampf noch mal.' : 'Erinnerung wartet. Erst die Runde.', true);
        }
        this.queue.push(q);
        if (r.kind === 'alarm' && r.repeat && r.repeat !== 'einmalig') keep.push({ ...r, at: nextAt(r.hh, r.mm, r.repeat, new Date(now + 1000)) });
      }
      this.save(keep);
    }
    // automatische Erinnerungen
    if (this.world.gaming) { this.lastBreak = Math.max(this.lastBreak, now - 5 * 60000); this.lastDrink = Math.max(this.lastDrink, now - 5 * 60000); this.lastChimeHour = d0.getHours(); }
    if (s.breakEvery > 0 && now - this.lastBreak > s.breakEvery * 60000) { this.lastBreak = now; this.queue.push({ kind: 'break', text: '' }); }
    if (s.drinkEvery > 0 && now - this.lastDrink > s.drinkEvery * 60000) { this.lastDrink = now; this.queue.push({ kind: 'drink', text: '' }); }
    const d = new Date();
    if (s.chime && d.getMinutes() === 0 && d.getHours() !== this.lastChimeHour) {
      this.lastChimeHour = d.getHours();
      const h = this.speaker();
      if (h) { h.talk(remLine(h.name, 'chime', d.getHours()), true); Sound.play('calib_accept', 0.4, 0.9); this.world.fx.label(h.x, h.y - 130 * this.world.u, fmtClock(d), COLORS.cyan, 22, 2.2); }
    }
    if (!this.active && this.queue.length && !this.world.gaming && !this.world.duel && now > (this.holdUntil || 0)) this.deliver(this.queue.shift());
  }

  // ---------------------------------------------------------- Überbringen
  deliver(rem) {
    const W = this.world, D = W.director;
    this.active = rem; this.ringT = 0; this.rings = 0; this.since = 0; this.nagT = 25;
    const strong = rem.kind === 'timer' || rem.kind === 'alarm';
    const clock = rem.kind === 'alarm' ? `${String(rem.hh).padStart(2, '0')}:${String(rem.mm).padStart(2, '0')}` : fmtClock(new Date());
    // Überbringer: sichtbare Helden, sonst Hauptfigur herholen
    let heroes = W.presentHeroes().filter((h) => !h.ko);
    if (!heroes.length) { D.applyMode(); heroes = W.heroes.filter((h) => !h.absent); }
    rem.title = { timer: 'TIMER ABGELAUFEN', alarm: `WECKER · ${clock}`, break: 'PAUSE', drink: 'TRINKEN' }[rem.kind] || 'ERINNERUNG';
    rem.line = (h) => remLine(h.name, rem.kind, rem.kind === 'alarm' ? rem.text : rem.text, clock);
    if (strong) { W.cinema.letterbox(2.4); W.cinema.card(rem.title, rem.text ? rem.text.toUpperCase() : 'SHADEPI DESKPET', COLORS.amber, 2.6, { always: true }); }
    Sound.play(strong ? 'calib_alarm' : 'calib_accept', strong ? 0.7 : 0.5);
    if (this.bridge && this.bridge.notify && !rem.notified) this.bridge.notify(rem.title.charAt(0) + rem.title.slice(1).toLowerCase(), rem.text || ({ break: 'Zeit für eine Pause.', drink: 'Trink ein Glas Wasser.' }[rem.kind] || 'Zeit ist um.'));
    this.deliverers = heroes.slice(0, 2);
    for (const h of this.deliverers) h.setTask('remind', h.remind(rem, this), 4.5);
    this.buildCard(rem, strong);
  }

  updateActive(dt) {
    const rem = this.active;
    this.since += dt;
    const strong = rem.kind === 'timer' || rem.kind === 'alarm';
    if (strong && this.since < 120) {
      this.ringT -= dt;
      if (this.ringT <= 0) { this.ringT = 2.6; this.rings++; Sound.play('calib_alarm', this.rings < 4 ? 0.7 : 0.35); }
    }
    this.nagT -= dt;
    if (this.nagT <= 0 && this.since < 180) { this.nagT = 30; const h = this.deliverers && this.deliverers[0]; if (h && !h.absent) h.talk(remLine(h.name, 'nag'), true); }
    // Weiche Erinnerungen räumen sich nach 45 s selbst ab
    if (!strong && this.since > 45) this.resolve('done', true);
    this.placeCard();
  }

  resolve(action, quiet) {
    const rem = this.active;
    if (!rem) return;
    this.active = null;
    if (this.card) { this.card.remove(); this.card = null; }
    const h = this.deliverers && this.deliverers.find((x) => !x.absent);
    if (action === 'done') { if (h && !quiet) h.talk(remLine(h.name, 'done'), true); Sound.play('calib_accept', 0.5); }
    else {
      const m = +action;
      this.save([...this.list, { id: Date.now() + 's', kind: 'timer', at: Date.now() + m * 60000, text: rem.text || rem.title, min: m }]);
      if (h) h.talk(remLine(h.name, 'snooze', m), true);
      Sound.play('calib_tick', 0.5);
    }
    for (const x of this.deliverers || []) if (x.taskName === 'remind') x.cancelTask();
    this.deliverers = null;
  }

  // ---------------------------------------------------------- DOM: Karte + Anzeige
  buildCard(rem, strong) {
    if (this.card) this.card.remove();
    const c = document.createElement('div');
    c.className = 'remcard interactive' + (strong ? ' strong' : '');
    c.innerHTML = `<div class="rc-head">${rem.title}</div>${rem.text ? `<div class="rc-text"></div>` : ''}
      <div class="rc-btns"><button data-a="done">✓ Erledigt</button>${strong ? '<button data-a="5">+5 Min</button><button data-a="10">+10 Min</button>' : ''}</div>`;
    if (rem.text) c.querySelector('.rc-text').textContent = rem.text;
    c.querySelectorAll('button').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); this.resolve(b.dataset.a); }));
    document.getElementById('ui').appendChild(c);
    this.card = c;
    this.placeCard();
  }
  placeCard() {
    if (!this.card) return;
    const W = this.world, T = W.terrain;
    const hs = (this.deliverers || []).filter((h) => !h.absent);
    const x = hs.length ? hs.reduce((s, h) => s + h.x, 0) / hs.length : T.W / 2;
    const y = hs.length ? Math.min(...hs.map((h) => h.y)) - 235 * W.u : T.floorY - 200;
    const w = this.card.offsetWidth, h = this.card.offsetHeight;
    this.card.style.left = clamp(x - w / 2, 8, T.W - w - 8) + 'px';
    this.card.style.top = clamp(y - h, 8, T.H - h - 8) + 'px';
  }

  buildHud() {
    const d = document.createElement('div');
    d.id = 'remhud';
    document.getElementById('ui').appendChild(d);
    this.hud = d;
  }
  updateHud() {
    const next = [...this.list].sort((a, b) => a.at - b.at)[0];
    const left = next ? next.at - Date.now() : Infinity;
    if (!next || left > 6 * 3600000 || !this.world.settings.dock) { this.hud.style.display = 'none'; return; }
    this.hud.style.display = '';
    const label = next.text ? next.text.slice(0, 18) : next.kind === 'alarm' ? 'Wecker' : 'Timer';
    const txt = next.kind === 'alarm' && left > 3600000 ? `⏰ ${String(next.hh).padStart(2, '0')}:${String(next.mm).padStart(2, '0')} · ${label}` : `⏱ ${fmtLeft(left)} · ${label}`;
    if (this.hud.textContent !== txt) this.hud.textContent = txt;
    this.hud.classList.toggle('soon', left < 60000);
  }
}
