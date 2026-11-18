// THE REAL DRAGON – Dojo-Modus, in dem Shadepi Runde für Runde stärker wird.
// Runde 1–3: immer stärker. Danach rote Aura mit Ki-Kugeln, dann die Macht des
// Drachen (weiße Flammenaura, Drachenwelle, berstender Desktop) und zum Schluss
// das Kugel-Duell in der Luft. Wird als Erweiterung an die Duel-Klasse gehängt.
'use strict';

const DRAGON_STAGES = [
  null,
  { title: 'RUNDE 1', sub: 'DER DRACHE SCHLÄFT', color: '#f4f0e4', hp: 1, dmg: 1, react: 1, aggro: 0, block: 0, timer: 75 },
  { title: 'RUNDE 2', sub: 'SHADEPI WIRD STÄRKER', color: '#ffb43a', hp: 1.2, dmg: 1.2, react: 0.8, aggro: 0.1, block: 0.08, shadow: true, timer: 75 },
  { title: 'RUNDE 3', sub: 'KEINE ZURÜCKHALTUNG MEHR', color: '#ff697c', hp: 1.4, dmg: 1.4, react: 0.65, aggro: 0.18, block: 0.14, shadow: true, timer: 75 },
  { title: 'ROTE AURA', sub: 'SHADEPIS KRAFT VERDREIFACHT SICH', color: '#ff2a3a', hp: 1.5, dmg: 1.6, react: 0.55, aggro: 0.22, block: 0.16, shadow: true, timer: 99, aura: 'red' },
  { title: 'DIE MACHT DES DRACHEN', sub: 'ÜBERLEBE', color: '#ffffff', hp: 1.8, dmg: 1.8, react: 0.5, aggro: 0.25, block: 0.18, shadow: true, timer: Infinity, aura: 'white' },
];
const DRAGON_STAGE_NAMES = ['', 'Runde 1', 'Runde 2', 'Runde 3', 'Rote Aura', 'Macht des Drachen', 'Finale'];

function dragonLevel(level, stage) {
  const b = DUEL_LEVELS[level] || DUEL_LEVELS.mittel, s = DRAGON_STAGES[stage];
  return {
    ...b, hp: Math.round(b.hp * s.hp), dmg: b.dmg * s.dmg, react: b.react * s.react,
    aggro: Math.min(0.95, b.aggro + s.aggro), block: Math.min(0.8, b.block + s.block),
    shadow: b.shadow || !!s.shadow, tips: b.tips && stage === 1,
  };
}

const DR_TALK = {
  start: ['Du willst den echten Drachen sehen? Dann verdien ihn dir.', 'Drei Runden. Überlebst du sie, zeige ich dir, wer ich wirklich bin.', 'Heute halte ich mich nicht zurück. Fast nicht.'],
  r2: ['Gut. Dann eben etwas schneller.', 'Aufgewärmt? Ich auch.', 'Runde zwei. Jetzt mit Absicht.'],
  r3: ['Jetzt wird es ernst.', 'Du kratzt am Panzer. Keine gute Idee.', 'Letzte Warnung, Bruder.'],
  up: ['…Nicht schlecht. Noch einmal.', 'Das zählt nicht. Ich war noch kalt.', 'Hm. Du bist schneller als gedacht.'],
  redPre: ['Du zwingst mich, ernst zu machen.', 'Gut. Dann eben so.'],
  red: ['Rote Aura. Dreifache Kraft.', 'Jetzt brennt die Luft.'],
  tauntRed: ['Spürst du die Hitze?', 'Der Boden hält das nicht mehr lange aus.', 'Zu langsam für die rote Aura!', 'Fang!'],
  tauntDragon: ['Der Desktop bricht. Du auch?', 'Hörst du den Drachen?', 'Weich aus, wenn du kannst!', 'Hahaha! Mehr!'],
  beam: ['DRACHENWELLE!', 'Spring, Bruder!', 'Friss das!'],
  finale: ['GENUG! Ich beende das jetzt!', 'Alles, was ich habe. In einer Kugel.'],
  finaleMid: ['Meine Naniten lassen dich nicht los!', 'Spürst du, wie sie wächst?', 'Das hier überlebt kein Bildschirm.'],
  clash: ['Unmöglich…!', 'Gib auf!', 'NEIN!'],
  win: 'Arg… das war gut. Das hat noch niemand geschafft. Du hast meinen Respekt, Dragonking!',
  lose: ["Hahaha… Das war's. Für alle.", 'Ups. Das Dojo braucht einen neuen Bildschirm.'],
  loseEarly: ['Der Drache schläft weiter. Komm wieder, wenn du stärker bist.', 'Nicht mal die rote Aura gesehen. Training!'],
};
const DR_RAVEN = {
  red: ['Äh… Hutmann? Seit wann kannst du DAS?', 'Rot steht dir. Bedrohlich, aber gut.'],
  dragon: ['Ich hol schon mal den Feuerlöscher.', 'Mein Bildschirm! Der war geleast!'],
  win: ['DRAGONKING! Ich mach ein Banner!', 'Er liegt. Er liegt wirklich!'],
  lose: ['…Mein Desktop.', 'Ich ruf den Support.'],
};

// Augenposition je NEON-KOMBAT-Bild (Pixel im Blatt, relativ zum Fußpunkt, Blick nach rechts)
const SH_EYES = { 0: [4.8, -119.2], 1: [3.8, -120.2], 2: [33.2, -116.6], 3: [42.6, -114], 4: [31, -92], 5: [2.2, -92.4], 6: [-43.6, -118.8], 7: [52.8, -12.2], 8: [1.2, -103.2], 9: [6.8, -102.4], 10: [5.2, -116.4], 11: [1.4, -114.2], 12: [8.6, -97.6], 13: [5.2, -83], 14: [0.6, -121.2], 15: [34.2, -69] };

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${clamp(a, 0, 1)})`;
}

const AURA_PAL = {
  red: { glow: '#ff2030', layers: [[1.22, '#ff1a2e', 0.32], [1.0, '#ff4a3a', 0.4], [0.76, '#ffb09a', 0.42]], spark: ['#ff3150', '#ff8a6a', '#ffd0c0'] },
  white: { glow: '#ffffff', layers: [[1.34, '#ff3150', 0.2], [1.14, '#d8ecff', 0.34], [0.96, '#ffffff', 0.42], [0.74, '#ffffff', 0.5]], spark: ['#ffffff', '#d8ecff', '#ff8aa0'] },
};

// Flammenaura um eine Figur (x/y = Füße)
function drawFlameAura(ctx, x, y, u, t, k, kind) {
  const pal = AURA_PAL[kind];
  if (!pal || k <= 0.01) return;
  const big = kind === 'white';
  const cy = y - 46 * u;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const R = (big ? 120 : 100) * u;
  const g = ctx.createRadialGradient(x, cy, 6 * u, x, cy, R);
  g.addColorStop(0, hexA(pal.glow, 0.32 * k)); g.addColorStop(1, hexA(pal.glow, 0));
  ctx.fillStyle = g; ctx.fillRect(x - R, cy - R * 1.3, R * 2, R * 2.3);
  for (const [s, col, a] of pal.layers) {
    ctx.beginPath();
    const N = 56;
    for (let i = 0; i <= N; i++) {
      const th = (i / N) * Math.PI * 2;
      const up = Math.max(0, -Math.sin(th));
      const wob = 1 + 0.07 * Math.sin(th * 7 + t * 9 + s * 3);
      const tongue = (Math.pow(Math.max(0, Math.sin(th * 5 + t * 10 + s * 4)), 3) * 0.6 + Math.pow(Math.max(0, Math.sin(th * 9 - t * 13 + 1 + s)), 4) * 0.4) * up * (big ? 1 : 0.7);
      const rx = 40 * u * s * wob, ry = (Math.sin(th) > 0 ? 54 : 62) * u * s * wob;
      const px = x + Math.cos(th) * rx;
      const py = cy + Math.sin(th) * ry - tongue * 74 * u * s - up * 10 * u;
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.closePath();
    const lg = ctx.createLinearGradient(0, cy + 60 * u, 0, cy - 160 * u);
    lg.addColorStop(0, hexA(col, a * k)); lg.addColorStop(0.55, hexA(col, a * 0.85 * k)); lg.addColorStop(1, hexA(col, 0));
    ctx.fillStyle = lg; ctx.fill();
  }
  ctx.restore();
}

// Leuchtende Energiekugel
function drawKiBall(ctx, x, y, r, col, t, o = {}) {
  if (r <= 0.5) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.3);
  g.addColorStop(0, hexA(col, 0.45)); g.addColorStop(1, hexA(col, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 2.3, 0, Math.PI * 2); ctx.fill();
  const g2 = ctx.createRadialGradient(x - r * 0.2, y - r * 0.25, r * 0.08, x, y, r);
  g2.addColorStop(0, '#ffffff'); g2.addColorStop(0.42, hexA(o.core || '#ffffff', 0.95)); g2.addColorStop(0.78, hexA(col, 0.9)); g2.addColorStop(1, hexA(col, 0));
  ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = Math.max(1, r * 0.05);
  for (let i = 0; i < 3; i++) { const a = t * (4 + i * 1.3) * (i % 2 ? -1 : 1) + i * 2.1; ctx.beginPath(); ctx.arc(x, y, r * (0.5 + i * 0.15), a, a + 1.5); ctx.stroke(); }
  if (o.crackle) {
    ctx.strokeStyle = hexA(o.crackleColor || '#ffffff', 0.85); ctx.lineWidth = Math.max(1, r * 0.025); ctx.shadowColor = col; ctx.shadowBlur = 10;
    for (let i = 0; i < o.crackle; i++) {
      let a = rnd(0, Math.PI * 2), rr = r * 0.85;
      ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      for (let s = 0; s < 4; s++) { rr += r * rnd(0.12, 0.25); a += rnd(-0.25, 0.25); ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
      ctx.stroke();
    }
  }
  ctx.restore();
}

// Kopf des Energiedrachen; Blick in Richtung dir, Mittelpunkt etwa an der Kieferwurzel
function drawDragonHead(ctx, x, y, dir, s, t, a) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(dir * s, s);
  ctx.globalAlpha *= a;
  const jaw = 0.5 + 0.5 * Math.sin(t * 16);
  const shape = (pass) => {
    // Mähne
    ctx.beginPath();
    for (let i = 0; i < 5; i++) { const yy = -26 + i * 11; ctx.moveTo(-18, yy); ctx.lineTo(-58 - (i % 2) * 14 - Math.sin(t * 20 + i) * 5, yy - 8 + i * 2); ctx.lineTo(-22, yy + 7); }
    ctx.fill(); if (pass) ctx.stroke();
    // Hörner
    ctx.beginPath(); ctx.moveTo(2, -26); ctx.quadraticCurveTo(-26, -44, -60, -60); ctx.quadraticCurveTo(-30, -36, -6, -20); ctx.closePath(); ctx.fill(); if (pass) ctx.stroke();
    ctx.beginPath(); ctx.moveTo(18, -27); ctx.quadraticCurveTo(-6, -52, -32, -74); ctx.quadraticCurveTo(-8, -46, 10, -22); ctx.closePath(); ctx.fill(); if (pass) ctx.stroke();
    // Oberkiefer und Schädel
    ctx.beginPath(); ctx.moveTo(-24, -18); ctx.quadraticCurveTo(4, -40, 36, -26); ctx.lineTo(70, -14); ctx.quadraticCurveTo(80, -9, 76, -2); ctx.lineTo(34, -2 - jaw * 2); ctx.lineTo(-8, 6); ctx.closePath(); ctx.fill(); if (pass) ctx.stroke();
    // Unterkiefer (offen)
    ctx.save(); ctx.translate(-8, 6); ctx.rotate(0.12 + jaw * 0.32);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(42, 0); ctx.lineTo(70, 6); ctx.lineTo(64, 14); ctx.lineTo(24, 16); ctx.lineTo(-10, 12); ctx.closePath(); ctx.fill(); if (pass) ctx.stroke();
    ctx.restore();
  };
  ctx.globalCompositeOperation = 'lighter';
  ctx.shadowColor = '#ff3150'; ctx.shadowBlur = 30;
  ctx.fillStyle = 'rgba(255,90,60,0.55)'; ctx.strokeStyle = 'rgba(255,200,120,0.9)'; ctx.lineWidth = 3;
  shape(true);
  ctx.shadowBlur = 0;
  const g = ctx.createLinearGradient(0, -40, 0, 20);
  g.addColorStop(0, '#fff6d8'); g.addColorStop(0.6, '#ffc060'); g.addColorStop(1, '#ff5040');
  ctx.fillStyle = g; ctx.globalAlpha *= 0.85;
  shape(false);
  ctx.globalAlpha /= 0.85;
  // Zähne
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 5; i++) { const xx = 30 + i * 9; ctx.beginPath(); ctx.moveTo(xx, -2); ctx.lineTo(xx + 4, -2); ctx.lineTo(xx + 2, 5); ctx.fill(); }
  // Auge
  ctx.shadowColor = '#ff2030'; ctx.shadowBlur = 14; ctx.fillStyle = '#ff2030';
  ctx.beginPath(); ctx.ellipse(30, -20, 7, 3.5, -0.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(31, -20, 2.5, 1.5, -0.2, 0, Math.PI * 2); ctx.fill();
  // Barteln
  ctx.shadowBlur = 8; ctx.strokeStyle = 'rgba(255,230,180,0.9)'; ctx.lineWidth = 2;
  for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(70, -10 + k * 2); ctx.bezierCurveTo(50, 10 + k * 18 + Math.sin(t * 12) * 8, 10, 22 + k * 14, -40, 18 + k * 20 + Math.sin(t * 9 + k) * 10); ctx.stroke(); }
  ctx.restore();
}

// ---------------------------------------------------------------- Risse im Desktop
class DeskCrack {
  constructor(x, y, size, kind = 'floor', o = {}) {
    this.x = x; this.y = y; this.size = size; this.kind = kind;
    this.t = 0; this.life = o.life || 40; this.dying = false; this.fadeK = 1;
    this.hot = o.color || '#ff3150';
    this.lines = [];
    const branch = (x0, y0, a, len, depth) => {
      const pts = [[x0, y0]]; let cx = x0, cy = y0, ca = a;
      const steps = rndi(3, 6);
      for (let s = 0; s < steps; s++) {
        ca += rnd(-0.45, 0.45);
        cx += Math.cos(ca) * len / steps; cy += Math.sin(ca) * len / steps;
        pts.push([cx, cy]);
        if (depth < 2 && chance(0.35)) branch(cx, cy, ca + rnd(-1.1, 1.1), len * rnd(0.3, 0.5), depth + 1);
      }
      this.lines.push({ pts, w: depth ? 1 : 1.8, d: Math.hypot(x0 - x, y0 - y) });
    };
    if (kind === 'floor') {
      // entlang des Bodens (Taskleistenkante) und nach oben/unten verästelt
      branch(x, y, rnd(-0.12, 0.12), size * rnd(1.1, 1.6), 0);
      branch(x, y, Math.PI + rnd(-0.12, 0.12), size * rnd(1.1, 1.6), 0);
      const n = rndi(3, 5);
      for (let i = 0; i < n; i++) branch(x + rnd(-size * 0.3, size * 0.3), y, -Math.PI / 2 + rnd(-1.15, 1.15), size * rnd(0.45, 1.0), 1);
      const below = (o.bottom ?? y + size * 0.6) - y;
      if (below > 6) for (let i = 0; i < 3; i++) branch(x + rnd(-size * 0.4, size * 0.4), y, Math.PI / 2 + rnd(-0.7, 0.7), Math.min(below, size * rnd(0.3, 0.7)), 1);
    } else {
      const n = rndi(7, 11);
      for (let i = 0; i < n; i++) branch(x, y, rnd(0, Math.PI * 2), size * rnd(0.6, 1.3), 0);
      const ring = [];
      for (let i = 0; i <= 14; i++) { const a = (i / 14) * Math.PI * 2; const rr = size * rnd(0.32, 0.45); ring.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
      this.lines.push({ pts: ring, w: 1, d: size * 0.3 });
    }
  }
  update(dt) {
    this.t += dt;
    if (this.dying) this.fadeK -= dt * 1.5;
    else if (this.t > this.life - 3) this.fadeK = Math.max(0, (this.life - this.t) / 3);
    return this.fadeK > 0;
  }
  // Kalte Risse einmal in ein eigenes Bild zeichnen (Schatten/Weichzeichner sind pro Bild teuer)
  bake() {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (const l of this.lines) for (const [x, y] of l.pts) { x1 = Math.min(x1, x); y1 = Math.min(y1, y); x2 = Math.max(x2, x); y2 = Math.max(y2, y); }
    const pad = 6, dpr = window.devicePixelRatio || 1;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil((x2 - x1 + pad * 2) * dpr)); c.height = Math.max(1, Math.ceil((y2 - y1 + pad * 2) * dpr));
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, (pad - x1) * dpr, (pad - y1) * dpr);
    this.strokeAll(g, Infinity, 0);
    this.img = c; this.ix = x1 - pad; this.iy = y1 - pad; this.iw = c.width / dpr; this.ih = c.height / dpr;
  }
  strokeAll(ctx, maxD, heat) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const path = (l) => {
      ctx.beginPath();
      const pts = l.pts;
      for (let i = 0; i < pts.length; i++) {
        if (l.d + i * (this.size / 5) > maxD) break;
        if (i) ctx.lineTo(pts[i][0], pts[i][1]); else ctx.moveTo(pts[i][0], pts[i][1]);
      }
    };
    // dunkle Spalte, helle Glaskante, glühender Rand solange heiß
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    for (const l of this.lines) { path(l); ctx.lineWidth = l.w * 3.2; ctx.stroke(); }
    ctx.strokeStyle = 'rgba(225,240,255,0.75)';
    for (const l of this.lines) { path(l); ctx.lineWidth = l.w; ctx.stroke(); }
    if (heat > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = hexA(this.hot, heat * 0.35);
      for (const l of this.lines) { path(l); ctx.lineWidth = l.w * 6; ctx.stroke(); }
      ctx.strokeStyle = hexA(this.hot, heat * 0.9);
      for (const l of this.lines) { path(l); ctx.lineWidth = l.w * 1.8; ctx.stroke(); }
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  draw(ctx) {
    const grow = Math.min(1, this.t / 0.22), heat = Math.max(0, 1 - this.t / 1.6);
    ctx.save();
    ctx.globalAlpha = clamp(this.fadeK, 0, 1);
    if (grow >= 1 && heat <= 0) {
      if (!this.img) this.bake();
      ctx.drawImage(this.img, this.ix, this.iy, this.iw, this.ih);
    } else this.strokeAll(ctx, this.size * 1.6 * grow, heat);
    ctx.restore();
  }
}

// ---------------------------------------------------------------- Der ganze Bildschirm zerspringt
class ScreenShatter {
  constructor(x, y) { this.x = x; this.y = y; this.t = 0; this.views = new Map(); }
  pattern(v) {
    const key = `${v.x},${v.y},${v.w},${v.h}`;
    let p = this.views.get(key);
    if (p) return p;
    const ix = clamp(this.x - v.x, -v.w * 0.2, v.w * 1.2), iy = clamp(this.y - v.y, -v.h * 0.2, v.h * 1.2);
    const cs = 170, cols = Math.ceil(v.w / cs) + 1, rows = Math.ceil(v.h / cs) + 1;
    const pts = [];
    for (let r = 0; r <= rows; r++) for (let c = 0; c <= cols; c++) {
      const edge = r === 0 || c === 0 || r === rows || c === cols;
      pts.push([c * (v.w / cols) + (edge ? 0 : rnd(-55, 55)), r * (v.h / rows) + (edge ? 0 : rnd(-55, 55))]);
    }
    const at = (c, r) => pts[r * (cols + 1) + c];
    const tris = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const a = at(c, r), b = at(c + 1, r), d = at(c, r + 1), e = at(c + 1, r + 1);
      for (const tri of (chance(0.5) ? [[a, b, e], [a, e, d]] : [[a, b, d], [b, e, d]])) {
        const cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3, cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
        const dd = Math.hypot(cx - ix, cy - iy);
        tris.push({ p: tri, cx, cy, d: dd, delay: 1.0 + dd / 1500 + rnd(0, 0.45), vx: (cx - ix) / (dd + 1) * rnd(40, 160), spin: rnd(-3, 3) });
      }
    }
    // große Risse vom Einschlag aus
    const rays = [];
    for (let i = 0; i < 16; i++) {
      let a = (i / 16) * Math.PI * 2 + rnd(-0.15, 0.15), x = ix, y = iy; const pts2 = [[x, y]];
      const L = Math.hypot(v.w, v.h);
      for (let s = 0; s < 14; s++) { a += rnd(-0.3, 0.3); x += Math.cos(a) * L / 14; y += Math.sin(a) * L / 14; pts2.push([x, y]); }
      rays.push(pts2);
    }
    p = { tris, rays, ix, iy };
    this.views.set(key, p);
    return p;
  }
  draw(ctx, v, home) {
    const p = this.pattern(v), t = this.t;
    const spread = t * 2600;
    ctx.save();
    // herausgefallene Scherben → schwarze Leere mit glühenden Kanten
    ctx.fillStyle = '#020306';
    for (const tr of p.tris) if (t > tr.delay) { ctx.beginPath(); ctx.moveTo(tr.p[0][0], tr.p[0][1]); ctx.lineTo(tr.p[1][0], tr.p[1][1]); ctx.lineTo(tr.p[2][0], tr.p[2][1]); ctx.closePath(); ctx.fill(); }
    const voidK = clamp((t - 1.4) / 2, 0, 1);
    if (voidK > 0) {
      // Glitch-Streifen und Glut in der Leere
      ctx.globalAlpha = voidK;
      for (let i = 0; i < 6; i++) { const y = (Math.sin(t * 1.7 + i * 7.3) * 0.5 + 0.5) * v.h; ctx.fillStyle = i % 2 ? 'rgba(255,49,80,0.10)' : 'rgba(98,227,238,0.06)'; ctx.fillRect(0, y, v.w, rnd(2, 8)); }
      ctx.globalAlpha = 1;
    }
    // Risse breiten sich aus
    ctx.lineCap = 'round';
    for (const tr of p.tris) {
      if (tr.d > spread) continue;
      const a = clamp((spread - tr.d) / 300, 0, 1);
      ctx.strokeStyle = `rgba(230,245,255,${0.55 * a})`; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(tr.p[0][0], tr.p[0][1]); ctx.lineTo(tr.p[1][0], tr.p[1][1]); ctx.lineTo(tr.p[2][0], tr.p[2][1]); ctx.closePath(); ctx.stroke();
    }
    for (const r of p.rays) {
      ctx.beginPath();
      for (let i = 0; i < r.length; i++) { if (Math.hypot(r[i][0] - p.ix, r[i][1] - p.iy) > spread) break; if (i) ctx.lineTo(r[i][0], r[i][1]); else ctx.moveTo(r[i][0], r[i][1]); }
      ctx.strokeStyle = 'rgba(255,49,80,0.35)'; ctx.lineWidth = 8; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,240,240,0.9)'; ctx.lineWidth = 2.4; ctx.stroke();
    }
    // fallende Scherben
    for (const tr of p.tris) {
      const ft = t - tr.delay;
      if (ft <= 0 || ft > 2.2) continue;
      const dy = 0.5 * 2600 * ft * ft, dx = tr.vx * ft, rot = tr.spin * ft;
      ctx.save(); ctx.translate(tr.cx + dx, tr.cy + dy); ctx.rotate(rot);
      ctx.beginPath(); ctx.moveTo(tr.p[0][0] - tr.cx, tr.p[0][1] - tr.cy); ctx.lineTo(tr.p[1][0] - tr.cx, tr.p[1][1] - tr.cy); ctx.lineTo(tr.p[2][0] - tr.cx, tr.p[2][1] - tr.cy); ctx.closePath();
      ctx.fillStyle = 'rgba(170,215,255,0.13)'; ctx.fill();
      ctx.strokeStyle = 'rgba(235,248,255,0.7)'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.restore();
    }
    // Text in der Leere
    if (home && t > 2.3) {
      const ty = Math.max(70, v.h * 0.16);
      const a = clamp((t - 2.3) / 0.6, 0, 1);
      ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const j = Math.random() < 0.08 ? rnd(-6, 6) : 0;
      ctx.font = '64px ShadepiPixel, monospace';
      ctx.fillStyle = 'rgba(255,49,80,0.7)'; ctx.fillText('SYSTEM ZERSTÖRT', v.w / 2 - 3 + j, ty);
      ctx.fillStyle = 'rgba(98,227,238,0.7)'; ctx.fillText('SYSTEM ZERSTÖRT', v.w / 2 + 3 - j, ty);
      ctx.fillStyle = '#f4f0e4'; ctx.fillText('SYSTEM ZERSTÖRT', v.w / 2, ty);
      ctx.font = '14px Silkscreen, monospace'; ctx.fillStyle = '#ff697c';
      ctx.fillText('DER DRACHE HAT GEWONNEN · GAME OVER', v.w / 2, ty + 52);
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------- Erweiterung des Kampfes
Object.assign(Duel.prototype, {
  dragonReset() {
    const W = this.world, sh = this.sh;
    if (this.dragon) this.dragon = { stage: 0, aura: null, auraK: 0, eyes: 0, beams: [], beamCd: 4, beamsShown: 0, tauntT: 9, stepT: 0, fly: false, fin: null, shatter: null, win: null };
    this.scene = null;
    for (const s of W.screen) if (s instanceof DeskCrack) s.dying = true;
    sh.glow = null; sh.gravity = 1; sh.arcadePose = null;
  },

  dragonRoundStart() {
    const D = this.dragon, W = this.world, st = this.round;
    D.stage = st;
    this.L = dragonLevel(this.level, st);
    const S = DRAGON_STAGES[st];
    this.timer = S.timer;
    if (st >= 4) { D.aura = S.aura; D.auraK = 1; D.eyes = st === 5 ? 1 : 0; }
    D.beamCd = 3.5; D.tauntT = rnd(7, 11);
    W.cinema.card(S.title, `THE REAL DRAGON · ${S.sub}`, S.color === '#ffffff' ? COLORS.red : S.color, 1.9, { always: true });
    Sound.setMusic(st >= 4 ? 'Boss' : 'Fight');
    if (st === 1) setTimeout(() => this.say(pick(DR_TALK.start), true), 500);
    else if (st === 2 || st === 3) setTimeout(() => this.say(pick(DR_TALK['r' + st]), true), 600);
  },

  // Rundenende im Drachenmodus: verlieren beendet alles, gewinnen macht ihn stärker
  dragonEndRound(winner, reason) {
    if (this.phase !== 'fight') return;
    const W = this.world, D = this.dragon, st = D.stage, p = this.player, u = this.u;
    this.projectiles = []; D.beams = [];
    W.cinema.slowmo(0.2, 1.2); W.cinema.letterbox(3); W.cinema.flash('#ffffff', 0.3);
    Sound.play('drive_explosion', 0.4, 0.8);
    if (winner === 'me') {
      this.wins.me++;
      this.matchOver = true;
      if (st >= 4) { this.destroyScreen(p.x, p.y - 50 * u); return; }
      this.phase = 'roundEnd'; this.phaseT = 0;
      W.cinema.card(reason === 'time' ? 'ZEIT!' : 'K.O.', 'DER DRACHE SCHLÄFT WEITER', COLORS.red, 2.2, { always: true });
      setTimeout(() => this.say(pick(DR_TALK.loseEarly), true), 900);
      setTimeout(() => { if (this.phase === 'roundEnd' && !this.sh.ko) this.sh.forcePose = 'victory'; }, 700);
      return;
    }
    this.wins.you++;
    p.state = 'win';
    if (st <= 2) {
      this.phase = 'roundEnd'; this.phaseT = 0; this.matchOver = false;
      W.cinema.card(reason === 'time' ? 'ZEIT!' : 'K.O.', 'SHADEPI STEHT WIEDER AUF …', BROTHERS[this.who].color, 2.2, { always: true });
      setTimeout(() => this.say(pick(DR_TALK.up), true), 1000);
      return;
    }
    W.cinema.card(reason === 'time' ? 'ZEIT!' : 'K.O.?', st === 3 ? 'ETWAS STIMMT NICHT …' : 'DER BODEN BEBT …', COLORS.red, 1.8, { always: true });
    this.phase = 'scene'; this.phaseT = 0;
    this.scene = st === 3 ? this.sceneRed() : this.sceneDragon();
  },

  *waitS(s) { yield* waitFor(this.world, s); },

  // Lebensanzeige füllt sich in der Zwischensequenz
  *refill(stage, secs) {
    const sh = this.sh;
    const L = dragonLevel(this.level, stage);
    sh.maxHp = L.hp; sh.hp = 0;
    for (let t = 0; t < secs; t += this.world.dt) {
      sh.hp = Math.round(sh.maxHp * easeOut(t / secs));
      if (chance(this.world.dt * 18)) Sound.play('calib_tick', 0.25, 0.8 + (t / secs) * 1.2);
      yield;
    }
    sh.hp = sh.maxHp;
  },

  scenePrep() {
    const p = this.player, sh = this.sh;
    p.move = null; p.walkVx = 0; p.vx = 0; p.blockT = 0; p.dashT = 0;
    this.ai.move = null; this.ai.blocking = false;
  },

  // Runde 3 gewonnen → rote Aura
  *sceneRed() {
    const W = this.world, sh = this.sh, u = this.u, D = this.dragon;
    this.scenePrep();
    yield* this.waitS(1.6);
    sh.ko = false; sh.hurtT = 0; sh.forcePose = 'crouch';
    W.fx.smokePuff(sh.x, sh.y - 30 * u, 0.7 * u, 0.7);
    this.say('…Hm.', true);
    yield* this.waitS(1.1);
    sh.forcePose = 'arcade'; sh.arcadePose = AP.special0;
    this.say(pick(DR_TALK.redPre), true);
    yield* this.waitS(1.4);
    // Aura flammt auf
    D.aura = 'red'; D.auraK = 0;
    W.cinema.flash('#ff2030', 0.45); W.cinema.shake(9, 0.7); W.cinema.letterbox(4);
    W.fx.ring(sh.x, sh.y - 46 * u, '#ff3150', 160 * u, 0.6, 5);
    W.fx.add({ type: 'shockwave', x: sh.x, y: sh.y, r: 260 * u, life: 0.7, color: '#ff3150' });
    Sound.play('legacy_aura', 0.9, 0.6); Sound.play('drive_explosion', 0.5, 1.3);
    W.cinema.card('ROTE AURA', 'SHADEPIS KRAFT VERDREIFACHT SICH', '#ff2a3a', 2.4, { always: true });
    this.crack(sh.x, W.terrain.floorY, 90 * u, 'floor');
    sh.arcadePose = AP.victory;
    yield* this.refill(4, 1.6);
    this.say(pick(DR_TALK.red), true);
    if (this.ra) setTimeout(() => this.ra && this.ra.talk(pick(DR_RAVEN.red), true), 1300);
    yield* this.waitS(1.8);
  },

  // Rote Aura besiegt → Schrei, weiße Flammenaura, rote Augen
  *sceneDragon() {
    const W = this.world, sh = this.sh, u = this.u, D = this.dragon, T = W.terrain;
    this.scenePrep();
    yield* this.waitS(1.6);
    sh.ko = false; sh.hurtT = 0; sh.forcePose = 'crouch';
    D.auraFade = true;
    this.say('Nein… nein…', true);
    yield* this.waitS(1.3);
    // Wutschrei
    sh.forcePose = 'arcade'; sh.arcadePose = AP.special0;
    this.say('AAAAAARRRRGH!', true);
    D.scream = 1.6;
    W.cinema.shake(16, 1.6); W.cinema.flash('#ff2030', 0.5); W.cinema.letterbox(6);
    Sound.play('legacy_aura', 1, 0.45); Sound.play('drive_explosion', 0.7, 0.6);
    for (let i = 0; i < 6; i++) {
      const x = sh.x + rnd(-260, 260) * u;
      setTimeout(() => { if (this.dragon) { this.crack(x, T.floorY, rnd(60, 110) * u, 'floor'); this.kiBoom(x, T.floorY - 10 * u, 0.7, '#ff3150'); } }, i * 220);
    }
    yield* this.waitS(1.7);
    // weiße Flammen, rote Augen
    D.auraFade = false; D.aura = 'white'; D.auraK = 0; D.eyes = 0;
    W.cinema.flash('#ffffff', 0.7); W.cinema.shake(10, 0.6);
    W.fx.add({ type: 'shockwave', x: sh.x, y: sh.y, r: 340 * u, life: 0.8, color: '#ffffff' });
    W.fx.ring(sh.x, sh.y - 46 * u, '#ffffff', 220 * u, 0.7, 6);
    Sound.play('electric', 0.8, 0.7); Sound.play('legacy_aura', 0.9, 0.8);
    yield* this.waitS(0.5);
    D.eyes = 1; Sound.play('calib_lock', 0.7, 0.5);
    sh.arcadePose = AP.victory;
    this.say('Hahahaha… HAHAHAHA!', true);
    yield* this.waitS(1.8);
    this.say('Nun spürst du die Macht des Drachen in mir.', true);
    W.cinema.card('DIE MACHT DES DRACHEN', 'WEICH DER DRACHENWELLE MIT EINEM SPRUNG AUS', COLORS.red, 2.8, { always: true });
    yield* this.refill(5, 1.8);
    if (this.ra) this.ra.talk(pick(DR_RAVEN.dragon), true);
    yield* this.waitS(1.4);
  },

  // ------------------------------------------ jeden Takt
  dragonTick(dt) {
    const W = this.world, D = this.dragon, sh = this.sh, u = this.u;
    if (D.auraFade) D.auraK = Math.max(0, D.auraK - dt * 1.5);
    else if (D.aura) D.auraK = Math.min(1, D.auraK + dt * 2.5);
    if (D.scream > 0) D.scream -= dt;
    sh.glow = D.aura && D.auraK > 0 && !sh.ko ? (D.aura === 'red' ? '#ff2a3a' : '#ffffff') : null;
    sh.glowAmt = D.aura === 'red' ? 0.22 * D.auraK : 0.1 * D.auraK;
    // Funken aus der Aura
    if (D.aura && D.auraK > 0.3 && !sh.ko) {
      const pal = AURA_PAL[D.aura];
      if (chance(dt * (D.aura === 'white' ? 45 : 30))) W.fx.add({ type: 'pixel', x: sh.x + rnd(-30, 30) * u, y: sh.y - rnd(0, 90) * u, vx: rnd(-20, 20), vy: -rnd(160, 320), g: 0, life: rnd(0.4, 0.8), color: pick(pal.spark), size: rndi(2, 3) });
      if (D.aura === 'white' && chance(dt * 1.6)) { const a = rnd(0, 6.28); W.fx.lightning(sh.x + Math.cos(a) * 30 * u, sh.y - 50 * u + Math.sin(a) * 50 * u, sh.x + Math.cos(a) * 80 * u, sh.y - 50 * u + Math.sin(a) * 90 * u, chance(0.5) ? '#ffffff' : COLORS.red, 0.15, 2); }
    }
    if (D.scream > 0 && chance(dt * 30)) W.fx.add({ type: 'shard', x: sh.x + rnd(-200, 200) * u, y: W.terrain.floorY - 2, vx: rnd(-120, 120), vy: rnd(-500, -200), g: 1300, drag: 0.99, bounce: 0.35, life: rnd(0.8, 1.4), rot: rnd(0, 6), spin: rnd(-12, 12), size: rnd(3, 7) });
    this.updateBeams(dt);
    if (D.shatter) D.shatter.t += dt;
    if (this.phase === 'fight' && D.stage >= 4) {
      D.beamCd -= dt; D.tauntT -= dt;
      if (D.tauntT <= 0) { D.tauntT = rnd(9, 14); this.say(pick(D.stage === 5 ? DR_TALK.tauntDragon : DR_TALK.tauntRed)); }
    }
  },

  dragonUpdate(inp, dt) {
    const D = this.dragon;
    if (this.phase === 'scene' && this.scene) {
      let r;
      try { r = this.scene.next(); } catch (e) { console.error('Zwischensequenz', e); r = { done: true }; }
      if (r.done) { this.scene = null; this.nextRound(); }
    } else if (this.phase === 'finale') this.updateFinale(inp, dt);
    else if (this.phase === 'dragonWin') this.updateDragonWin(dt);
    else if (this.phase === 'shatter') {
      if (D.shatter && D.shatter.t > 4.8 && !D.shatter.done) { D.shatter.done = true; this.finish(); }
    }
  },

  // Schadepi nach der Physik: Landungen und Schritte lassen den Boden bersten
  dragonShadepi(sh, dt, air, vy0) {
    const D = this.dragon, W = this.world, T = W.terrain, u = this.u, st = D.stage;
    if (st < 4 || this.phase !== 'fight') return;
    if (air && sh.ground && vy0 > 380 && !(this.ai.move && this.ai.move.kind === 'stomp')) {
      this.crack(sh.x, T.floorY, (st === 5 ? 80 : 50) * u, 'floor');
      W.fx.dust(sh.x, sh.y, 8, 1.2 * u); W.cinema.shake(st === 5 ? 6 : 4, 0.2);
      if (st === 5) this.kiBoom(sh.x, T.floorY - 8 * u, 0.6);
      Sound.play('drive_touchdown', 0.5, st === 5 ? 0.7 : 0.9);
    }
    if (st === 5 && sh.ground && Math.abs(sh.vx) > 120) {
      D.stepT -= dt;
      if (D.stepT <= 0) { D.stepT = 0.34; this.crack(sh.x + rnd(-6, 6) * u, T.floorY, 26 * u, 'floor', { life: 25 }); }
    }
  },

  // Schadepi schlägt zu (Treffer oder nicht): im Drachenmodus reißt der Desktop dort ein
  dragonStrike(x, y) {
    const D = this.dragon;
    if (!D || D.stage !== 5) return;
    this.crack(x, y, 50 * this.u, 'burst', { life: 30 });
    this.kiBoom(x, y, 0.45);
  },

  dragonCheck() {
    const D = this.dragon, sh = this.sh;
    if (D.stage === 5 && this.phase === 'fight' && sh.hp <= sh.maxHp / 3) { sh.hp = Math.ceil(sh.maxHp / 3); this.startFinale(); return true; }
    return false;
  },

  crack(x, y, size, kind, o = {}) {
    const W = this.world, T = W.terrain;
    const list = W.screen.filter((s) => s instanceof DeskCrack && !s.dying);
    if (list.length > 46) list[0].dying = true;
    W.screen.push(new DeskCrack(x, y, size, kind, { ...o, bottom: kind === 'floor' ? T.H : undefined, color: o.color || (this.dragon && this.dragon.aura === 'white' ? '#ffffff' : '#ff3150') }));
    if (kind === 'floor') { W.fx.shards(x, y - 4, 6); W.fx.dust(x, y, 5, this.u); }
    else W.fx.shards(x, y, 10);
  },

  kiBoom(x, y, s = 1, color) {
    const W = this.world, u = this.u;
    const col = color || (this.dragon && this.dragon.aura === 'white' ? '#ffffff' : '#ff3150');
    W.fx.add({ type: 'custom', x, y, life: 0.45, r: 70 * u * s, col, draw: (ctx, p, k) => {
      const r = p.r * easeOut(Math.min(1, k * 1.6));
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      g.addColorStop(0, `rgba(255,255,255,${0.9 * (1 - k)})`); g.addColorStop(0.45, hexA(p.col, 0.75 * (1 - k))); g.addColorStop(1, hexA(p.col, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
    } });
    W.fx.ring(x, y, col, 90 * u * s, 0.35, 3);
    W.fx.sparks(x, y, col, Math.round(10 * s) + 4, 420);
    Sound.play('drive_explosion', 0.35 * Math.min(1.5, s + 0.3), rnd(1.1, 1.4));
  },

  // ------------------------------------------ neue Angriffe
  dragonPick(ad) {
    const D = this.dragon, st = D.stage, u = this.u;
    if (st < 4) return false;
    if (st === 5 && D.beamCd <= 0 && ad > 170 * u && chance(0.6)) { D.beamCd = rnd(5.5, 8.5); this.aiStart('dragonbeam'); return true; }
    if (ad > 220 * u && chance(0.5)) { this.aiStart('kiball', { n: st === 5 ? 3 : chance(0.4) ? 2 : 1 }); return true; }
    if (this.player.ground && chance(st === 5 ? 0.24 : 0.17)) { this.aiStart('stomp'); return true; }
    return false;
  },

  dragonMove(m, dt, done, dx) {
    const W = this.world, sh = this.sh, p = this.player, u = this.u, D = this.dragon;
    switch (m.kind) {
      case 'kiball': {
        sh.walkVx = 0; sh.facing = sign(dx) || sh.facing;
        const charge = 0.38, per = 0.22;
        sh.forcePose = 'arcade';
        if (m.t < charge) { sh.arcadePose = AP.special0; m.glow = m.t / charge; }
        else {
          sh.arcadePose = AP.special1; m.glow = 0;
          const i = Math.floor((m.t - charge) / per);
          while (m.step <= i && m.step < m.n) { m.step++; this.fireKi(); }
          if (m.t > charge + m.n * per + 0.25) done();
        }
        return true;
      }
      case 'stomp': {
        if (m.step === 0) {
          m.step = 1; sh.facing = sign(dx) || sh.facing;
          sh.vy = -980; const tf = (2 * 980) / (GRAVITY * 1.3);
          sh.vx = clamp(dx / tf, -900 * u, 900 * u); sh.walkVx = 0; sh.leaveGround();
          sh.forcePose = 'arcade'; sh.arcadePose = AP.jump;
          Sound.play('legacy_aura', 0.4, 1.6); W.fx.dust(sh.x, sh.y, 6, u);
        }
        if (!sh.ground) { sh.arcadePose = sh.vy > 0 ? AP.kick1 : AP.jump; if (sh.vy > 0) sh.vy += GRAVITY * 0.3 * dt; }
        else if (m.step === 1 && m.t > 0.12) { m.step = 2; m.land = m.t; sh.arcadePose = AP.land; sh.vx = 0; sh.walkVx = 0; this.stompImpact(sh.x); }
        if (m.step === 2 && m.t - m.land > 0.42) done();
        if (m.t > 2.5) done();
        return true;
      }
      case 'dragonbeam': {
        sh.walkVx = 0;
        if (m.step === 0) {
          m.step = 1; sh.facing = sign(dx) || sh.facing;
          this.say(pick(DR_TALK.beam), true);
          Sound.play('legacy_aura', 0.8, 0.55); W.cinema.letterbox(1.8);
          if (D.beamsShown < 2) W.fx.label(p.x, p.y - 150 * u, 'SPRING!', COLORS.amber, 24, 1.3);
          D.beamsShown++;
        }
        sh.forcePose = 'arcade';
        if (m.t < 1.05) {
          sh.arcadePose = AP.special0; m.glow = m.t / 1.05;
          if (chance(dt * 40)) { const a = rnd(0, 6.28), h = this.beamOrigin(); W.fx.add({ type: 'pixel', x: h.x + Math.cos(a) * 90 * u, y: h.y + Math.sin(a) * 90 * u, vx: -Math.cos(a) * 260 * u, vy: -Math.sin(a) * 260 * u, g: 0, life: 0.34, color: chance(0.5) ? '#ffffff' : COLORS.red, size: 3 }); }
        } else if (m.step === 1) {
          m.step = 2; m.glow = 0; sh.arcadePose = AP.special1;
          const h = this.beamOrigin();
          D.beams.push({ x0: h.x, y: h.y, dir: sh.facing, head: h.x, t: 0, hit: false, out: 0, edge: false });
          W.cinema.shake(9, 0.8); W.cinema.flash('#ffffff', 0.25);
          Sound.play('drive_laser', 0.9, 0.6); Sound.play('drive_explosion', 0.6, 0.7);
        }
        if (m.step === 2) { sh.vx = -sh.facing * 30 * u; if (m.t > 1.95) done(); }
        return true;
      }
    }
    return false;
  },

  beamOrigin() {
    const sh = this.sh, u = this.u;
    return { x: sh.x + sh.facing * 46 * u, y: sh.y - 40 * u };
  },

  fireKi() {
    const W = this.world, sh = this.sh, p = this.player, u = this.u, D = this.dragon;
    const e = sh.arcadeOn ? arcadeEmitter('shadepi', sh.x, sh.y, sh.S, sh.facing) : { x: sh.x + sh.facing * 40 * u, y: sh.y - 60 * u };
    let a = Math.atan2(p.y - 48 * u - e.y, p.x - e.x);
    const base = sh.facing > 0 ? 0 : Math.PI;
    const da = Math.atan2(Math.sin(a - base), Math.cos(a - base));
    a = base + clamp(da, -0.35, 0.35) + rnd(-0.04, 0.04);
    const sp = (D.stage === 5 ? 780 : 650) * u;
    this.projectiles.push({ x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, from: 'me', dmg: D.stage === 5 ? 8 : 7, kind: 'ki', t: 0, r: 13 * u, white: D.stage === 5 });
    Sound.play('hack', 0.6, 0.55); W.cinema.shake(2, 0.08);
  },

  stompImpact(x) {
    const W = this.world, T = W.terrain, u = this.u, D = this.dragon, p = this.player;
    const big = D.stage === 5;
    W.cinema.shake(big ? 14 : 9, 0.4);
    W.fx.add({ type: 'shockwave', x, y: T.floorY, r: (big ? 260 : 190) * u, life: 0.55, color: big ? '#ffffff' : '#ff3150' });
    W.fx.dust(x, T.floorY, 16, 1.6 * u);
    this.crack(x, T.floorY, (big ? 140 : 95) * u, 'floor');
    if (big) { this.kiBoom(x, T.floorY - 12 * u, 1.1); this.kiBoom(x - 110 * u, T.floorY - 6 * u, 0.5); this.kiBoom(x + 110 * u, T.floorY - 6 * u, 0.5); }
    Sound.play('drive_touchdown', 0.8, 0.7); Sound.play('drive_explosion', 0.5, 0.8);
    if (p.ground && Math.abs(p.x - x) < (big ? 170 : 140) * u) this.hitPlayer(12, { heavy: true, knock: 420, up: 420, fromX: x });
  },

  updateBeams(dt) {
    const D = this.dragon, W = this.world, T = W.terrain, p = this.player, u = this.u;
    for (const b of D.beams) {
      b.t += dt;
      b.head += b.dir * 1500 * u * dt;
      const off = b.dir > 0 ? b.head > T.W + 40 * u : b.head < -40 * u;
      if (off && !b.edge) {
        b.edge = true;
        const ex = b.dir > 0 ? T.W - 6 : 6;
        this.crack(ex, b.y, 130 * u, 'burst'); this.kiBoom(ex, b.y, 1.2); W.cinema.shake(8, 0.4);
      }
      if (b.edge) b.out += dt;
      if (!b.hit && p && !p.ko && this.phase === 'fight') {
        const x1 = Math.min(b.head - b.dir * 220 * u, b.head + b.dir * 34 * u), x2 = Math.max(b.head - b.dir * 220 * u, b.head + b.dir * 34 * u);
        const box = { x: Math.max(x1, Math.min(b.x0, b.head)), y: b.y - 30 * u, w: Math.max(0, Math.min(x2, Math.max(b.x0, b.head)) - Math.max(x1, Math.min(b.x0, b.head))), h: 60 * u };
        if (box.w > 0 && rectsOverlap(box, p.bounds())) {
          const r = this.hitPlayer(26, { unblockable: true, heavy: true, knock: 620, up: 520, fromX: b.head - b.dir * 100 * u });
          if (r !== 'miss') { b.hit = true; this.kiBoom(p.x, p.y - 50 * u, 1.1); this.crack(p.x, p.y - 50 * u, 90 * u, 'burst'); }
        }
      }
    }
    D.beams = D.beams.filter((b) => b.out < 0.7);
  },

  // ------------------------------------------ Finale: Kugel-Duell in der Luft
  startFinale() {
    const W = this.world, T = W.terrain, sh = this.sh, p = this.player, u = this.u, D = this.dragon;
    this.phase = 'finale'; this.phaseT = 0;
    this.ai.move = null; this.ai.blocking = false; this.ai.stun = 0; sh.hurtT = 0; sh.akind = null;
    this.projectiles = []; D.beams = [];
    p.move = null; p.blockT = 0; p.dashT = 0; p.walkVx = 0;
    const hy = T.floorY - Math.min(T.floorY * 0.42, 300 * u);
    const side = sh.x >= p.x ? 1 : -1;
    const tx = clamp(T.W * 0.5 + side * T.W * 0.14, 160 * u, T.W - 160 * u);
    const R = Math.max(50 * u, Math.min(120 * u, (hy - 150 * u) / 2.5));
    D.fin = { t: 0, step: 'rise', from: { x: sh.x, y: sh.y }, to: { x: tx, y: hy }, R, free: 0, my: 0, sh: 0, shield: 0, nan: 0, ct: 0, c: 0.5, fx: 0, fy: 0, said: false, prs: 0 };
    D.fly = true; sh.leaveGround(); sh.vx = 0; sh.vy = 0; sh.gravity = 0; sh.walkVx = 0;
    sh.forcePose = 'arcade'; sh.arcadePose = AP.jump;
    W.cinema.letterbox(4); W.cinema.flash('#ffffff', 0.4); W.cinema.shake(10, 0.6); W.cinema.slowmo(0.4, 0.5);
    W.cinema.card('LETZTES DRITTEL', 'SHADEPI SAMMELT ALLES IN EINER KUGEL', COLORS.red, 2.2, { always: true, small: true, y: T.H * 0.22 });
    this.say(pick(DR_TALK.finale), true);
    Sound.play('legacy_aura', 0.9, 0.5);
  },

  // Kugelgrößen: Kraft → Radius
  ballR(pow) { const F = this.dragon.fin; return pow <= 0 ? 0 : F.R * (0.14 + 0.86 * Math.sqrt(Math.min(pow, 170) / 100)); },
  shBallPos() { const F = this.dragon.fin, sh = this.sh, u = this.u, r = this.ballR(Math.max(F.sh, 1)); return { x: sh.x, y: sh.y - 104 * u - r }; },
  myBallPos() { const p = this.player, u = this.u, r = this.ballR(Math.max(this.dragon.fin.my, 1)); return { x: p.x, y: p.y - 112 * u - r }; },

  updateFinale(inp, dt) {
    const W = this.world, sh = this.sh, p = this.player, u = this.u, D = this.dragon, F = D.fin, L = this.level;
    F.t += dt; F.fx = Math.max(0, F.fx - dt * 5); F.fy = Math.max(0, F.fy - dt * 5);
    const freeStep = { leicht: 0.13, mittel: 0.1, schwer: 0.085 }[L] || 0.1;
    const press = { leicht: 4, mittel: 3, schwer: 2.5 }[L] || 3;
    const shRate = { leicht: 8, mittel: 10, schwer: 12 }[L] || 10;
    const chargeKey = inp.special || inp.heavy;
    p.walkVx = 0; if (p.ground) p.vx = 0;
    if (F.step === 'rise') {
      const k = easeInOut(Math.min(1, F.t / 1.3));
      sh.x = lerp(F.from.x, F.to.x, k); sh.y = lerp(F.from.y, F.to.y, k);
      F.shield = clamp((F.t - 0.6) / 0.5, 0, 1);
      F.nan = clamp((F.t - 0.6) / 0.8, 0, 1);
      if (F.t > 0.7) p.fpose = 'hurt';
      if (F.t >= 1.4) { F.step = 'bound'; sh.arcadePose = AP.victory; Sound.play('electric', 0.6, 1.3); }
    }
    if (F.step !== 'rise' && F.step !== 'resolve') {
      sh.y = F.to.y + Math.sin(F.t * 2.2) * 6 * u;
      if (!F.throwT) F.sh = Math.min(100, (F.t - 1.4) * 100 / 9.5);
      const bp = this.shBallPos();
      if (chance(dt * 50)) { const a = rnd(0, 6.28), r = this.ballR(F.sh) + 120 * u; W.fx.add({ type: 'pixel', x: bp.x + Math.cos(a) * r, y: bp.y + Math.sin(a) * r, vx: -Math.cos(a) * 300 * u, vy: -Math.sin(a) * 300 * u, g: 0, life: 0.35, color: chance(0.5) ? '#ffffff' : COLORS.red, size: 3 }); }
      if (chance(dt * 4)) Sound.play('electric', 0.2, rnd(0.5, 0.8));
      if (!F.said && F.t > 5) { F.said = true; this.say(pick(DR_TALK.finaleMid), true); }
    }
    if (F.step === 'bound') {
      F.nan = 1;
      if (inp.light) { F.free += freeStep; F.fx = 1; F.prs++; Sound.play('hit', 0.35, 1.2 + F.free * 0.6); W.cinema.shake(2, 0.06); W.fx.sparks(p.x + rnd(-30, 30) * u, p.y - rnd(20, 80) * u, COLORS.red, 3, 200); }
      F.free = Math.max(0, F.free - dt * 0.12);
      if (F.free >= 1) {
        F.step = 'charge'; p.fpose = 'charge'; F.nan = 0;
        W.fx.pixels(p.x, p.y - 50 * u, [COLORS.red, '#ffffff', COLORS.cyan], 30, 420, { g: 0 });
        W.fx.label(p.x, p.y - 150 * u, 'FREI!', COLORS.cyan, 24, 1.1);
        W.cinema.flash(BROTHERS[this.who].color, 0.2); Sound.play('calib_accept', 0.7, 1.2);
      }
    }
    if (F.step === 'charge') {
      if (chargeKey) { F.my += press; F.fy = 1; Sound.play('calib_tick', 0.35, 0.8 + Math.min(1.6, F.my / 90)); const bp = this.myBallPos(); W.fx.sparks(bp.x, bp.y, BROTHERS[this.who].color, 3, 220); }
    }
    // Shadepis Kugel ist voll → Wurf
    if ((F.step === 'bound' || F.step === 'charge') && F.sh >= 100) {
      F.step = 'clash'; F.ct = 0; F.throwT = 1;
      if (p.fpose !== 'charge') p.fpose = 'hurt';
      else p.fpose = 'throw';
      F.myStart = this.myBallPos(); F.shStart = this.shBallPos();
      sh.arcadePose = AP.special1;
      this.say(F.my > 0 ? pick(DR_TALK.clash) : 'Zu spät!', true);
      W.cinema.shake(8, 0.5); W.cinema.letterbox(4); Sound.play('drive_laser', 0.8, 0.5);
    }
    if (F.step === 'clash') {
      F.ct += dt;
      F.sh += shRate * dt;
      if (p.fpose === 'throw' && chargeKey) { F.my += press; F.fy = 1; Sound.play('calib_tick', 0.3, 1.4); }
      if (F.ct > 0.45) {
        const diff = F.my - F.sh;
        F.c = clamp(F.c + clamp(diff / 100, -1, 1) * 0.3 * dt, 0.06, 0.94);
        W.cinema.shake(3, 0.1);
        if (chance(dt * 12)) { const c = this.clashPoint(); W.fx.lightning(c.x, c.y, c.x + rnd(-120, 120) * u, c.y + rnd(-120, 120) * u, chance(0.5) ? '#ffffff' : COLORS.red, 0.12, 2); }
        if (chance(dt * 20)) { const c = this.clashPoint(); W.fx.sparks(c.x, c.y, chance(0.5) ? '#ffffff' : BROTHERS[this.who].color, 4, 520); }
      }
      if (F.my <= 0 && F.ct > 0.45) F.c = Math.max(0.06, F.c - dt * 0.6);
      if (F.ct >= 3.0) {
        F.step = 'resolve'; F.rt = 0; F.win = F.my >= F.sh && F.my > 0;
        F.resFrom = this.clashPoint();
        Sound.play('drive_explosion', 0.6, 0.6);
      }
    }
    if (F.step === 'resolve') {
      F.rt += dt;
      if (F.rt > 0.55 && !F.done) {
        F.done = true;
        if (F.win) this.dragonWinStart();
        else { p.fpose = 'hurt'; this.destroyScreen(p.x, p.y - 50 * u); }
      }
    }
  },

  // Treffpunkt der beiden Kugeln
  clashPoint() {
    const F = this.dragon.fin;
    const a = F.myStart || this.myBallPos(), b = F.shStart || this.shBallPos();
    return { x: lerp(a.x, b.x, F.c), y: lerp(a.y, b.y, F.c) };
  },

  dragonWinStart() {
    const W = this.world, sh = this.sh, p = this.player, u = this.u, D = this.dragon;
    this.phase = 'dragonWin'; this.phaseT = 0;
    D.win = { t: 0, landT: -1, said: false, up: 0 };
    const F = D.fin;
    F.shieldBreak = true;
    W.fx.pixels(sh.x, sh.y - 50 * u, ['#ffffff', COLORS.red, COLORS.cyan], 60, 700, { g: 600 });
    W.fx.shards(sh.x, sh.y - 50 * u, 30);
    this.kiBoom(sh.x, sh.y - 50 * u, 2.4, BROTHERS[this.who].color);
    this.kiBoom(sh.x, sh.y - 50 * u, 1.6, '#ffffff');
    W.fx.add({ type: 'shockwave', x: sh.x, y: sh.y - 50 * u, r: 520 * u, life: 0.9, color: '#ffffff' });
    W.cinema.flash('#ffffff', 0.85); W.cinema.shake(20, 1.3); W.cinema.slowmo(0.25, 1.4); W.cinema.letterbox(6);
    Sound.play('drive_explosion', 1, 0.5); setTimeout(() => Sound.play('drive_explosion', 0.8, 0.8), 260);
    D.aura = null; D.auraK = 0; D.eyes = 0;
    D.fly = false; sh.gravity = 1; sh.vy = -260; sh.vx = 0; sh.walkVx = 0; sh.leaveGround();
    sh.forcePose = 'arcade'; sh.arcadePose = AP.hurt;
    p.fpose = null; p.state = 'idle';
    this.stats.dmg += Math.ceil(sh.hp); sh.hp = 0;
  },

  updateDragonWin(dt) {
    const W = this.world, sh = this.sh, p = this.player, u = this.u, D = this.dragon, w = D.win, T = W.terrain;
    w.t += dt;
    if (w.landT < 0) {
      if (sh.ground) {
        w.landT = w.t;
        sh.ko = true; sh.forcePose = null;
        this.crack(sh.x, T.floorY, 150 * u, 'floor', { color: '#ffb43a' });
        W.fx.dust(sh.x, sh.y, 20, 2 * u); W.cinema.shake(14, 0.5);
        Sound.play('drive_touchdown', 1, 0.6);
        W.cinema.card('DER DRACHE FÄLLT', `${BROTHERS[this.who].name.toUpperCase()} HAT SHADEPI BESIEGT`, COLORS.amber, 2.6, { always: true });
      }
      return;
    }
    const since = w.t - w.landT;
    if (sh.ko && chance(dt * 6)) W.fx.smokePuff(sh.x + rnd(-30, 30) * u, sh.y - 10 * u, 0.4 * u, 0.6);
    if (sh.ko && chance(dt * 4)) W.fx.sparks(sh.x + rnd(-30, 30) * u, sh.y - 12 * u, COLORS.amber, 3, 160);
    if (since > 1.2 && p.state !== 'win') { p.state = 'win'; if (this.ra) this.ra.talk(pick(DR_RAVEN.win), true); }
    if (since > 2.8 && sh.ko) { sh.ko = false; sh.forcePose = 'crouch'; W.fx.smokePuff(sh.x, sh.y - 20 * u, 0.6 * u, 0.7); }
    if (since > 3.8 && !w.said) {
      w.said = true; sh.forcePose = 'arcade'; sh.arcadePose = AP.ready; sh.facing = sign(p.x - sh.x) || 1;
      this.say(DR_TALK.win, true);
    }
    if (since > 9 && !w.done) { w.done = true; this.finish(); }
  },

  // Verloren gegen den Drachen: der ganze Bildschirm zerbricht
  destroyScreen(x, y) {
    const W = this.world, p = this.player, u = this.u, D = this.dragon;
    this.phase = 'shatter'; this.phaseT = 0;
    this.projectiles = []; D.beams = [];
    D.shatter = new ScreenShatter(x, y);
    p.hp = 0; p.ko = true; p.koT = 0; p.fpose = null;
    for (let i = 0; i < 4; i++) setTimeout(() => this.dragon && this.kiBoom(x + rnd(-200, 200) * u, y + rnd(-120, 80) * u, rnd(1, 1.8)), i * 140);
    W.cinema.flash('#ffffff', 0.9); W.cinema.shake(24, 1.6); W.cinema.letterbox(8);
    Sound.play('drive_explosion', 1, 0.45); setTimeout(() => Sound.play('drive_explosion', 1, 0.6), 300); setTimeout(() => Sound.play('calib_error', 0.8, 0.6), 1200);
    setTimeout(() => this.dragon && this.phase === 'shatter' && this.say(pick(DR_TALK.lose), true), 1600);
    if (this.ra) setTimeout(() => this.ra && this.ra.talk(pick(DR_RAVEN.lose), true), 3000);
  },

  // Sprung zu einer Stufe (Vorschau/Tests)
  dragonJump(n) {
    if (!this.dragon) return;
    const D = this.dragon;
    if (n >= 6) { this.round = 4; this.nextRound(); this.phase = 'fight'; this.sh.hp = Math.ceil(this.sh.maxHp / 3); this.startFinale(); return; }
    this.round = clamp(n, 1, 5) - 1;
    this.nextRound();
  },

  // ------------------------------------------ Zeichnen
  drawBehind(ctx) {
    const D = this.dragon;
    if (!D || !this.player) return;
    const sh = this.sh, u = this.u, t = this.world.time;
    if (D.aura && D.auraK > 0 && !sh.absent) drawFlameAura(ctx, sh.x, sh.y, u, t, D.auraK * (D.scream > 0 ? 1.3 : 1), D.aura);
    const F = D.fin;
    // Spieler-Aura beim Laden der Kugel
    if (F && (F.step === 'charge' || (F.step === 'clash' && this.player.fpose === 'throw'))) {
      const col = BROTHERS[this.who].color;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const p = this.player, g = ctx.createRadialGradient(p.x, p.y - 46 * u, 4, p.x, p.y - 46 * u, 90 * u);
      g.addColorStop(0, hexA(col, 0.35 + 0.15 * F.fy)); g.addColorStop(1, hexA(col, 0));
      ctx.fillStyle = g; ctx.fillRect(p.x - 90 * u, p.y - 140 * u, 180 * u, 180 * u);
      ctx.restore();
    }
  },

  drawDragonFront(ctx) {
    const D = this.dragon, W = this.world, sh = this.sh, u = this.u, t = W.time, p = this.player;
    // rote Augen
    if (D.eyes > 0 && !sh.ko && sh.arcadeOn) {
      const fr = sh.arcadeFrame(sh.currentPose());
      const e = SH_EYES[fr];
      if (e) {
        const sc = arcadeScale(sh.S), ex = sh.x + e[0] * sc * sh.facing, ey = sh.y + e[1] * sc;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const fl = 0.75 + 0.25 * Math.sin(t * 23);
        ctx.shadowColor = '#ff2030'; ctx.shadowBlur = 16;
        ctx.fillStyle = `rgba(255,40,50,${fl})`; ctx.beginPath(); ctx.ellipse(ex, ey, 5 * u, 2.4 * u, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(ex, ey, 1.4 * u, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = `rgba(255,40,50,${0.5 * fl})`; ctx.lineWidth = 2 * u;
        ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex - sh.facing * (16 + Math.sin(t * 9) * 4) * u, ey - 3 * u); ctx.stroke();
        ctx.restore();
      }
    }
    // Ladeleuchten an der Hand (Ki-Kugel, Drachenwelle)
    const m = this.ai.move;
    if (m && m.glow > 0) {
      const h = m.kind === 'dragonbeam' ? this.beamOrigin() : (sh.arcadeOn ? arcadeEmitter('shadepi', sh.x, sh.y, sh.S, sh.facing) : { x: sh.x + sh.facing * 40 * u, y: sh.y - 60 * u });
      drawKiBall(ctx, h.x, h.y, (m.kind === 'dragonbeam' ? 6 + 16 * m.glow : 4 + 8 * m.glow) * u, D.stage === 5 ? '#ff3150' : '#ff2030', t, { crackle: m.kind === 'dragonbeam' ? 2 : 0 });
    }
    // Warnstreifen vor der Drachenwelle
    if (m && m.kind === 'dragonbeam' && m.t < 1.05) {
      const h = this.beamOrigin(), T = W.terrain;
      ctx.save(); ctx.globalAlpha = 0.1 + 0.12 * Math.max(0, Math.sin(t * 18));
      ctx.fillStyle = COLORS.red;
      const x0 = sh.facing > 0 ? h.x : 0, x1 = sh.facing > 0 ? T.W : h.x;
      ctx.fillRect(x0, h.y - 30 * u, x1 - x0, 60 * u);
      ctx.restore();
    }
    for (const b of D.beams) this.drawBeam(ctx, b);
    const F = D.fin;
    if (F) this.drawFinale(ctx);
  },

  drawBeam(ctx, b) {
    const u = this.u, t = this.world.time;
    const a = b.out > 0 ? 1 - b.out / 0.7 : 1;
    const L = 560 * u, seg = 9 * u;
    const pts = [];
    for (let s = 0; s <= L; s += seg) {
      const px = b.head - b.dir * s;
      if (b.dir * (px - b.x0) < 0) break;
      pts.push([px, b.y + Math.sin(s * 0.016 / u - t * 12) * 24 * u * Math.min(1, s / (90 * u)), s]);
    }
    ctx.save(); ctx.globalAlpha *= clamp(a, 0, 1);
    ctx.globalCompositeOperation = 'lighter';
    // Strahl von den Händen bis zum Schwanz
    const tail = pts.length ? pts[pts.length - 1][0] : b.head;
    if (b.dir * (tail - b.x0) > 0) {
      const x0 = Math.min(b.x0, tail), w = Math.abs(tail - b.x0), h = 46 * u, fl = 0.85 + 0.15 * Math.sin(t * 40);
      const g = ctx.createLinearGradient(0, b.y - h / 2, 0, b.y + h / 2);
      g.addColorStop(0, 'rgba(255,49,80,0)'); g.addColorStop(0.22, hexA('#ff3150', 0.45 * fl)); g.addColorStop(0.4, hexA('#ffb43a', 0.8 * fl));
      g.addColorStop(0.5, 'rgba(255,255,255,0.95)'); g.addColorStop(0.6, hexA('#ffb43a', 0.8 * fl)); g.addColorStop(0.78, hexA('#ff3150', 0.45 * fl)); g.addColorStop(1, 'rgba(255,49,80,0)');
      ctx.fillStyle = g; ctx.fillRect(x0, b.y - h / 2, w, h);
    }
    // Körper des Drachen
    for (const [mul, col, al] of [[2.6, '#ff3150', 0.18], [1.7, '#ff3150', 0.4], [1.0, '#ffb43a', 0.75], [0.42, '#ffffff', 0.95]]) {
      ctx.strokeStyle = hexA(col, al); ctx.lineCap = 'round';
      for (let i = 1; i < pts.length; i++) {
        ctx.lineWidth = lerp(36, 8, pts[i][2] / L) * u * mul;
        ctx.beginPath(); ctx.moveTo(pts[i - 1][0], pts[i - 1][1]); ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke();
      }
    }
    ctx.shadowBlur = 0;
    // Rückenzacken
    ctx.fillStyle = 'rgba(255,220,150,0.85)';
    for (let i = 3; i < pts.length - 1; i += 3) {
      const [x, y, s] = pts[i], hgt = lerp(20, 6, s / L) * u;
      ctx.beginPath(); ctx.moveTo(x - b.dir * 6 * u, y - hgt * 0.5); ctx.lineTo(x + b.dir * 4 * u, y - hgt * 1.5); ctx.lineTo(x + b.dir * 8 * u, y - hgt * 0.5); ctx.fill();
    }
    ctx.restore();
    if (b.dir * (b.head - b.x0) > 20 * u) drawDragonHead(ctx, b.head + b.dir * 6 * u, b.y - 4 * u, b.dir, 1.5 * u, t, clamp(a, 0, 1));
  },

  drawFinale(ctx) {
    const D = this.dragon, F = D.fin, W = this.world, sh = this.sh, p = this.player, u = this.u, t = W.time;
    if (F.done) return; // Einschlag ist passiert – ab jetzt erzählen Explosion und Sturz
    const col = BROTHERS[this.who].color === '#f4f0e4' ? '#e9f6ff' : BROTHERS[this.who].color;
    // Schutzschild
    if (F.shield > 0 && !F.shieldBreak) {
      const cx = sh.x, cy = sh.y - 48 * u, r = 82 * u * (0.6 + 0.4 * F.shield);
      ctx.save(); ctx.globalAlpha = F.shield;
      const g = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r);
      g.addColorStop(0, 'rgba(255,49,80,0)'); g.addColorStop(1, 'rgba(255,90,110,0.22)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = `rgba(255,140,150,${0.5 + 0.25 * Math.sin(t * 6)})`; ctx.lineWidth = 2; ctx.shadowColor = '#ff3150'; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(255,200,205,0.35)';
      for (let i = 0; i < 6; i++) { const a = t * 0.8 + (i / 6) * Math.PI * 2; ctx.beginPath(); ctx.arc(cx, cy, r * 0.92, a, a + 0.6); ctx.stroke(); }
      ctx.restore();
    }
    // Naniten halten den Spieler fest
    if (F.nan > 0) {
      const N = 26, pts = [];
      for (let i = 0; i < N; i++) {
        const k = clamp(F.nan * 1.4 - (i / N) * 0.4, 0, 1);
        const a = (i / N) * Math.PI * 2 + t * 2.4 * (i % 2 ? 1 : -1);
        const tx = p.x + Math.cos(a) * 34 * u + Math.sin(t * 30 + i) * F.free * 4 * u;
        const ty = p.y - 46 * u + Math.sin(a) * 52 * u;
        pts.push([lerp(sh.x, tx, easeInOut(k)), lerp(sh.y - 50 * u, ty, easeInOut(k))]);
      }
      ctx.save();
      ctx.strokeStyle = 'rgba(255,49,80,0.35)'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < N; i++) { const a = pts[i], b = pts[(i + 5) % N]; ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,49,80,0.3)';
      for (const [x, y] of pts) ctx.fillRect(x - 4 * u, y - 4 * u, 8 * u, 8 * u);
      for (const [x, y] of pts) { ctx.fillStyle = chance(0.1) ? '#ffffff' : '#ff3150'; ctx.fillRect(x - 2 * u, y - 2 * u, 4 * u, 4 * u); }
      ctx.restore();
    }
    // Kugeln
    const shCol = '#ff3150';
    if (F.step === 'clash' || F.step === 'resolve') {
      const a = F.myStart, b = F.shStart;
      const rMy = this.ballR(F.my), rSh = this.ballR(F.sh);
      const dx = b.x - a.x, dy = b.y - a.y, dl = Math.hypot(dx, dy) || 1, nx = dx / dl, ny = dy / dl;
      let c = this.clashPoint();
      const e = easeOut(Math.min(1, F.ct / 0.45));
      let my = { x: lerp(a.x, c.x - nx * rMy, e), y: lerp(a.y, c.y - ny * rMy, e) };
      let sb = { x: lerp(b.x, c.x + nx * rSh, e), y: lerp(b.y, c.y + ny * rSh, e) };
      if (F.step === 'resolve') {
        const k = easeIn(Math.min(1, F.rt / 0.55));
        if (F.win) { my = { x: lerp(my.x, sh.x, k), y: lerp(my.y, sh.y - 50 * u, k) }; sb = { x: lerp(sb.x, sh.x, k), y: lerp(sb.y, sh.y - 50 * u, k) }; }
        else { sb = { x: lerp(sb.x, p.x, k), y: lerp(sb.y, p.y - 50 * u, k) }; my = { x: lerp(my.x, p.x, k), y: lerp(my.y, p.y - 50 * u, k) }; }
      }
      const loser = F.step === 'resolve' ? (F.win ? 'sh' : 'my') : null;
      if (rSh > 0 && !(loser === 'sh' && F.rt > 0.3)) drawKiBall(ctx, sb.x, sb.y, rSh * (loser === 'sh' ? 1 - F.rt : 1), shCol, t, { crackle: 3 });
      if (rMy > 0 && !(loser === 'my' && F.rt > 0.3)) drawKiBall(ctx, my.x, my.y, rMy * (loser === 'my' ? 1 - F.rt : 1), col, t, { crackle: 3, crackleColor: '#ffffff' });
      if (F.ct > 0.45 && F.step === 'clash') {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, 60 * u);
        g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c.x, c.y, 60 * u, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
    } else if (!F.shieldBreak) {
      const bp = this.shBallPos();
      if (F.sh > 0) {
        // Energiefäden von Shadepi zur Kugel
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,90,110,0.5)'; ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(sh.x + (i - 1) * 16 * u, sh.y - 92 * u); ctx.quadraticCurveTo(sh.x + Math.sin(t * 8 + i) * 30 * u, (sh.y - 92 * u + bp.y) / 2, bp.x, bp.y); ctx.stroke(); }
        ctx.restore();
        drawKiBall(ctx, bp.x, bp.y, this.ballR(F.sh), shCol, t, { crackle: F.sh > 50 ? 3 : 1 });
      }
      if (F.my > 0) { const mp = this.myBallPos(); drawKiBall(ctx, mp.x, mp.y, this.ballR(F.my), col, t, { crackle: 2, crackleColor: '#ffffff' }); }
    }
  },

  // Anzeige: Stufen, Aufforderungen im Finale
  drawDragonHud(ctx) {
    const D = this.dragon, W = this.world, T = W.terrain, t = W.time;
    const top = 18 + W.cinema.bars * T.H * 0.075;
    ctx.save();
    // Stufenanzeige unter der Zeit
    const n = 6, gap = 18, x0 = T.W / 2 - ((n - 1) * gap) / 2, y = top + 60;
    const reached = D.fin ? 6 : D.stage;
    for (let i = 0; i < n; i++) {
      const s = i + 1, col = s === 4 ? '#ff2a3a' : s === 5 ? '#ffffff' : s === 6 ? COLORS.amber : '#7f9fb0';
      ctx.save(); ctx.translate(x0 + i * gap, y); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = s <= reached ? col : 'rgba(42,51,66,0.9)';
      if (s === reached) { ctx.shadowColor = col; ctx.shadowBlur = 10; }
      ctx.fillRect(-4, -4, 8, 8); ctx.restore();
    }
    ctx.font = '8px Silkscreen, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = COLORS.red;
    ctx.fillText('THE REAL DRAGON', T.W / 2, y + 16);
    const F = D.fin, pad = !!this.padConnected;
    if (F && (F.step === 'bound' || F.step === 'charge' || F.step === 'clash')) {
      const py = T.floorY - 30 * this.u;
      const chip = (label, x, yy, hot) => {
        ctx.font = '22px ShadepiPixel, monospace';
        const w = ctx.measureText(label).width + 26;
        ctx.fillStyle = hot ? '#ffffff' : 'rgba(7,10,18,0.92)'; ctx.strokeStyle = hot ? '#ffffff' : COLORS.cyan; ctx.lineWidth = 2;
        ctx.fillRect(x - w / 2, yy - 16, w, 32); ctx.strokeRect(x - w / 2, yy - 16, w, 32);
        ctx.fillStyle = hot ? '#070a12' : '#ffffff'; ctx.fillText(label, x, yy + 1);
      };
      const band = (h) => { const g = ctx.createLinearGradient(T.W / 2 - 360, 0, T.W / 2 + 360, 0); g.addColorStop(0, 'rgba(7,10,18,0)'); g.addColorStop(0.2, 'rgba(7,10,18,0.88)'); g.addColorStop(0.8, 'rgba(7,10,18,0.88)'); g.addColorStop(1, 'rgba(7,10,18,0)'); ctx.fillStyle = g; ctx.fillRect(T.W / 2 - 360, py - h, 720, h + 26); };
      if (F.step === 'bound') {
        band(96);
        const pulse = 1 + 0.06 * Math.sin(t * 14);
        ctx.font = `${Math.round(34 * pulse)}px ShadepiPixel, monospace`; ctx.fillStyle = COLORS.cyan; ctx.shadowColor = COLORS.cyan; ctx.shadowBlur = 12;
        ctx.fillText('BEFREIE DICH!', T.W / 2, py - 68); ctx.shadowBlur = 0;
        chip(pad ? 'X' : 'J / LINKSKLICK', T.W / 2, py - 30, F.fx > 0.5);
        ctx.font = '8px Silkscreen, monospace'; ctx.fillStyle = COLORS.muted; ctx.fillText('SO SCHNELL DU KANNST DRÜCKEN', T.W / 2, py - 4);
        ctx.fillStyle = '#2a1018'; ctx.fillRect(T.W / 2 - 150, py + 8, 300, 8);
        ctx.fillStyle = COLORS.cyan; ctx.fillRect(T.W / 2 - 150, py + 8, 300 * clamp(F.free, 0, 1), 8);
      } else {
        band(110);
        const txt = F.step === 'clash' ? 'HALTE DAGEGEN!' : 'LADE DEINE KUGEL!';
        const pulse = 1 + 0.06 * Math.sin(t * 14);
        ctx.font = `${Math.round(32 * pulse)}px ShadepiPixel, monospace`; ctx.fillStyle = COLORS.amber; ctx.shadowColor = COLORS.amber; ctx.shadowBlur = 12;
        ctx.fillText(txt, T.W / 2, py - 84); ctx.shadowBlur = 0;
        if (this.player.fpose !== 'hurt') {
          chip(pad ? 'LB' : 'E', T.W / 2, py - 46, F.fy > 0.5);
          ctx.font = '8px Silkscreen, monospace'; ctx.fillStyle = COLORS.muted; ctx.fillText(pad ? 'AKTIONSTASTE HÄMMERN (AUCH Y)' : 'AKTIONSTASTE HÄMMERN (AUCH K / RECHTSKLICK)', T.W / 2, py - 20);
        }
        // Kräftevergleich
        const bw = 300, my = F.my, shp = Math.max(1, F.sh), tot = my + shp;
        const cx = T.W / 2 - bw + (2 * bw) * (my / tot);
        ctx.fillStyle = hexA(BROTHERS[this.who].color === '#f4f0e4' ? '#e9f6ff' : BROTHERS[this.who].color, 0.9); ctx.fillRect(T.W / 2 - bw, py - 2, cx - (T.W / 2 - bw), 10);
        ctx.fillStyle = 'rgba(255,49,80,0.9)'; ctx.fillRect(cx, py - 2, T.W / 2 + bw - cx, 10);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(cx - 1.5, py - 6, 3, 18);
        ctx.font = '8px Silkscreen, monospace'; ctx.textAlign = 'left'; ctx.fillStyle = '#ffffff';
        ctx.fillText(`DU ${Math.round(my)}`, T.W / 2 - bw, py + 18);
        ctx.textAlign = 'right'; ctx.fillText(`SHADEPI ${Math.round(F.sh)}`, T.W / 2 + bw, py + 18);
      }
    }
    ctx.restore();
  },

  drawScreen(ctx, v) {
    const D = this.dragon;
    if (D && D.shatter) D.shatter.draw(ctx, v, !!v.home);
  },
});
