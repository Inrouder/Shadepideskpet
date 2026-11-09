// Ravens Systembericht: echte Werte des Rechners als Hologramm + kommentiert,
// dazu Warnungen bei Hitze, Volllast, vollem Speicher oder großen Downloads.
'use strict';

const fmtRate = (b) => (b == null ? '–' : b >= 1048576 ? `${(b / 1048576).toFixed(b >= 10485760 ? 0 : 1).replace('.', ',')} MB/s` : b >= 1024 ? `${Math.round(b / 1024)} KB/s` : `${Math.round(b)} B/s`);
const fmtGB = (b) => (b / 1073741824).toFixed(1).replace('.', ',');
const fmtUp = (s) => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? `${h} h ${m} min` : `${m} min`; };
const deg = (t) => `${Math.round(t)} °C`;

class SysReport {
  constructor(world, bridge) {
    this.world = world; this.bridge = bridge;
    this.data = null; this.panel = null; this.until = 0;
    this.cool = {}; this.busySince = 0;
    if (!bridge) this.fake();
  }

  // Browser-Vorschau: plausible Testwerte
  fake() {
    let t = 0;
    setInterval(() => {
      t += 3;
      this.onData({
        cpu: { load: Math.round(25 + 20 * Math.sin(t / 20) + Math.random() * 10), temp: 52 + Math.round(8 * Math.sin(t / 30)), name: 'Vorschau-CPU', cores: 16, tempSrc: 'zone' },
        gpu: { load: Math.round(12 + Math.random() * 8), temp: 44, name: 'Vorschau-GPU', memUsed: 2100, memTotal: 8192, src: 'nvidia-smi' },
        ram: { used: 9.3 * 1073741824, total: 32 * 1073741824 },
        net: { down: 1.4e6 + Math.random() * 6e5, up: 9e4 }, uptime: 11520 + t, ts: Date.now(),
      });
    }, 3000);
  }

  onData(d) {
    this.data = d;
    if (this.panel) this.render();
    this.checkAlerts();
  }

  can(kind, minutes) {
    const now = Date.now();
    if (this.cool[kind] && now - this.cool[kind] < minutes * 60000) return false;
    this.cool[kind] = now;
    return true;
  }

  checkAlerts() {
    const W = this.world, d = this.data;
    if (!d || !W.settings.sysReports || W.gaming || W.hasEnemies() || this.panel) return;
    const ra = W.presentHeroes().find((h) => h.name === 'raven' && !h.ko);
    const who = ra || W.presentHeroes().find((h) => !h.ko);
    if (!who || (who.task && who.taskPrio >= 2)) return;
    const c = d.cpu || {}, g = d.gpu || {}, r = d.ram || {}, n = d.net || {};
    if (c.load >= 92) { if (!this.busySince) this.busySince = Date.now(); } else this.busySince = 0;
    let alert = null;
    if (c.temp >= 88 && this.can('cpuHot', 15)) alert = { focus: 'cpu', line: ra ? `Achtung! Dein Prozessor kocht: ${deg(c.temp)}!` : `Die Maschine glüht. ${deg(c.temp)}.` };
    else if (g.temp >= 85 && this.can('gpuHot', 15)) alert = { focus: 'gpu', line: ra ? `Die Grafikkarte ist bei ${deg(g.temp)}! Lüfter, gebt alles!` : `Die Grafikkarte brennt. ${deg(g.temp)}.` };
    else if (this.busySince && Date.now() - this.busySince > 20000 && this.can('cpuBusy', 20)) alert = { focus: 'cpu', line: ra ? `Da rechnet was gewaltig – CPU seit einer Weile bei ${c.load} %.` : `Die Maschine kämpft. ${c.load} Prozent.` };
    else if (n.down >= 15 * 1048576 && this.can('download', 10)) alert = { focus: 'net', line: ra ? `Whoa, ${fmtRate(n.down)} Download! Was ziehst du dir da?` : `Daten strömen herein. ${fmtRate(n.down)}.` };
    else if (r.total && r.used / r.total >= 0.92 && this.can('ram', 20)) alert = { focus: 'ram', line: ra ? `Arbeitsspeicher fast voll: ${fmtGB(r.used)} von ${fmtGB(r.total)} GB.` : 'Der Speicher ist fast voll.' };
    if (alert) this.report(alert);
  }

  // Bericht starten (Szene, Menü oder Warnung)
  report(alert = null) {
    const W = this.world;
    const hs = W.presentHeroes().filter((h) => !h.ko);
    const ra = hs.find((h) => h.name === 'raven');
    if (!this.data) { const h = ra || hs[0]; if (h) h.talk(h.name === 'raven' ? 'Moment, ich verbinde mich noch mit den Sensoren…' : 'Noch keine Werte.', true); return; }
    for (const h of hs) h.warpHome();
    if (ra) ra.setTask('sysreport', this.ravenReport(ra, alert), 2.5);
    else if (hs[0]) hs[0].setTask('sysreport', this.shadepiReport(hs[0], alert), 2.5);
  }

  lines(alert) {
    const d = this.data, c = d.cpu || {}, g = d.gpu || {}, r = d.ram || {}, n = d.net || {};
    const out = [];
    if (alert) out.push(alert.line);
    else out.push(pick(['Systembericht!', 'Kurzer Statuscheck!', 'Diagnose läuft…']) + ` CPU ${c.load ?? '–'} %` + (c.temp ? ` bei ${deg(c.temp)}.` : '.'));
    if (!alert || alert.focus !== 'gpu') {
      if (g.load != null || g.temp) out.push(`Grafik: ${g.load != null ? g.load + ' %' : 'Last unbekannt'}${g.temp ? ', ' + deg(g.temp) : ''}.` + (g.temp ? '' : ' Die Temperatur verrät sie mir nicht – schüchtern.'));
    }
    if (!alert || alert.focus !== 'net') out.push(`Netz: ${fmtRate(n.down)} runter, ${fmtRate(n.up)} hoch.`);
    if (!alert) {
      const hot = (c.temp || 0) >= 80 || (g.temp || 0) >= 80;
      const busy = (c.load || 0) >= 80 || (g.load || 0) >= 85;
      out.push(hot ? 'Ganz schön warm hier drin. Lüften wäre nett.' : busy ? 'Viel zu tun gerade. Ich halte die Füße still.' : pick(['Alles im grünen Bereich.', 'Läuft rund. Wie ich.', `Seit ${fmtUp(d.uptime || 0)} online. Respekt.`]));
    }
    return out;
  }

  *ravenReport(h, alert) {
    const W = this.world, u = W.u;
    h.faceCam = true;
    h.forcePose = 'cast'; h.forceDir = DIR.down; h.castRow = 0;
    Sound.play('hack', 0.4, 1.4);
    yield* h.wait(0.4);
    h.castRow = 1;
    this.open(h, alert);
    Sound.play('calib_accept', 0.4, 1.2);
    try {
    for (const l of this.lines(alert)) {
      h.talk(l, true);
      const dur = clamp(1.4 + l.length * 0.055, 2.2, 4.5);
      for (let e = 0; e < dur; e += W.dt) {
        h.castRow = Math.floor((W.time * 1.5)) % 2;
        if (chance(W.dt * 12)) { const p = castPalm(1, DIR.down, h.x, h.y, h.S); W.fx.add({ type: 'pixel', x: p.x + rnd(-12, 12), y: p.y, vx: 0, vy: -rnd(40, 90), g: 0, life: 0.7, color: COLORS.cyan, size: 2 }); }
        yield;
      }
    }
    } finally {
      h.forcePose = null; h.forceDir = null; h.faceCam = false;
      this.close();
    }
  }

  *shadepiReport(h, alert) {
    const d = this.data, c = d.cpu || {};
    h.faceCam = true;
    h.talk(alert ? alert.line : `Die Maschine arbeitet. ${c.load ?? '?'} Prozent${c.temp ? ', ' + deg(c.temp) : ''}.`, true);
    yield* h.wait(3);
    if (!alert) { h.talk('Raven würde dir mehr erzählen.', true); yield* h.wait(2.4); }
    h.faceCam = false;
  }

  // ------------------------------------------------ Hologramm
  open(h, alert) {
    this.close();
    const p = document.createElement('div');
    p.className = 'holo';
    document.getElementById('ui').appendChild(p);
    this.panel = p; this.hero = h; this.focus = alert ? alert.focus : null;
    this.render();
  }
  close() {
    if (!this.panel) return;
    const p = this.panel;
    p.classList.add('out');
    setTimeout(() => p.remove(), 350);
    this.panel = null; this.hero = null;
  }
  render() {
    const d = this.data, c = d.cpu || {}, g = d.gpu || {}, r = d.ram || {}, n = d.net || {};
    const cls = (v, warn, hot) => (v == null ? '' : v >= hot ? 'hot' : v >= warn ? 'warn' : '');
    const bar = (label, pct, value, sub, state, key) => `
      <div class="hrow ${this.focus === key ? 'focus' : ''}"><span class="hl">${label}</span>
      <span class="hb"><i class="${state}" style="width:${clamp(pct ?? 0, 0, 100)}%"></i></span><span class="hv">${value}</span></div>${sub ? `<div class="hs">${sub}</div>` : ''}`;
    const ramPct = r.total ? (100 * r.used) / r.total : null;
    const netPct = n.down != null ? clamp((Math.log10(Math.max(1, n.down)) - 3) * 25, 0, 100) : null;
    this.panel.innerHTML = `
      <div class="hh"><b>SYSTEMDIAGNOSE</b><span>NIGHTWING · LIVE</span></div>
      ${bar('CPU', c.load, `${c.load ?? '–'} %${c.temp ? ' · ' + deg(c.temp) : ''}`, (c.name || '').replace(/\(R\)|\(TM\)|CPU|Processor/gi, '').replace(/\s+/g, ' ').trim().slice(0, 34) + (c.temp && c.tempSrc === 'zone' ? ' · Thermalzone' : ''), cls(Math.max(c.load || 0, (c.temp || 0) + 5), 75, 90), 'cpu')}
      ${bar('GPU', g.load, `${g.load ?? '–'} %${g.temp ? ' · ' + deg(g.temp) : ''}`, (g.name || '').slice(0, 34), cls(Math.max(g.load || 0, (g.temp || 0) + 5), 80, 90), 'gpu')}
      ${bar('RAM', ramPct, r.total ? `${fmtGB(r.used)} / ${fmtGB(r.total)} GB` : '–', '', cls(ramPct, 80, 92), 'ram')}
      ${bar('NETZ', netPct, `↓ ${fmtRate(n.down)}`, `↑ ${fmtRate(n.up)}`, '', 'net')}
      <div class="hf">Laufzeit ${fmtUp(d.uptime || 0)}</div>`;
    this.place();
  }
  place() {
    if (!this.panel || !this.hero) return;
    const W = this.world, T = W.terrain, h = this.hero;
    const w = this.panel.offsetWidth, hh = this.panel.offsetHeight;
    // neben Raven schweben, auf der Seite ohne Partner (Sprechblase bleibt über ihrem Kopf frei)
    const p = W.presentHeroes().find((x) => x !== h);
    let side = p ? (p.x > h.x ? -1 : 1) : (h.x > T.W / 2 ? -1 : 1);
    if (side > 0 && h.x + 40 * W.u + w > T.W - 8) side = -1;
    if (side < 0 && h.x - 40 * W.u - w < 8) side = 1;
    const x = side > 0 ? h.x + 40 * W.u : h.x - 40 * W.u - w;
    const y = h.y - 12 * W.u - hh;
    this.panel.style.left = clamp(x, 8, T.W - w - 8) + 'px';
    this.panel.style.top = clamp(y, 8, T.H - hh - 8) + 'px';
  }
  update() { if (this.panel) this.place(); }
}
