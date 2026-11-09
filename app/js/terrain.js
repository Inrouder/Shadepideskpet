// Begehbare Flächen: Taskleisten-Oberkante (Boden), sichtbare Fensteroberkanten
// und kletterbare Fensterseiten. Verdeckte Teile werden herausgerechnet.
// Mehrere Monitore: Alle Koordinaten sind relativ zum Heimbildschirm (0,0 = dessen
// linke obere Ecke). Weitere Bildschirme liegen daneben (auch negativ) und haben
// eigene Böden. W/H/floorY beschreiben weiterhin den Heimbildschirm (Bühne).
'use strict';

class Terrain {
  constructor() {
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.floorY = this.H - 48;
    this.floorX1 = 0;
    this.floorX2 = this.W;
    this.windows = [];
    this.byId = new Map();
    this.surfaces = [];
    this.walls = [];
    this.dynamic = []; // Flächen von Gegenständen (Kisten …)
    this.enabled = true;
    this.screens = [{ id: 'home', home: true, x: 0, y: 0, w: this.W, h: this.H, floor: this.floorY, fx1: 0, fx2: this.W }];
    this.blocked = new Set(); // Bildschirme mit Vollbild-Programm
    this.minX = 0; this.maxX = this.W;
  }

  setLayout(layout) {
    this.W = layout.width;
    this.H = layout.height;
    const wa = layout.workArea || { x: 0, y: 0, w: this.W, h: this.H };
    this.floorY = Math.round(wa.y + wa.h);
    this.floorX1 = wa.x;
    this.floorX2 = wa.x + wa.w;
    const home = { id: 'home', home: true, x: 0, y: 0, w: this.W, h: this.H, floor: this.floorY, fx1: this.floorX1, fx2: this.floorX2 };
    const extra = (layout.screens || []).filter((sc) => !sc.home).map((sc) => ({
      id: String(sc.id), home: false, x: sc.x, y: sc.y, w: sc.w, h: sc.h, scale: sc.scale || 1,
      floor: Math.round(sc.wa.y + sc.wa.h), fx1: sc.wa.x, fx2: sc.wa.x + sc.wa.w,
    }));
    const homeInfo = (layout.screens || []).find((sc) => sc.home);
    if (homeInfo) home.realId = String(homeInfo.id);
    this.screens = [home, ...extra];
    this.rebuild();
  }

  setBlocked(ids) {
    const next = new Set((ids || []).map(String));
    if ([...next].join() === [...this.blocked].join()) return;
    this.blocked = next;
    this.rebuild();
  }

  // Bildschirme, auf denen gerade gelaufen werden darf (Heim immer)
  liveScreens() { return this.screens.filter((sc) => sc.home || !this.blocked.has(sc.id)); }
  get multi() { return this.liveScreens().length > 1; }
  screenById(id) { return this.screens.find((sc) => sc.id === id) || this.screens[0]; }

  // Bildschirm, in dem ein Punkt liegt (sonst der horizontal nächste)
  screenAt(x, y) {
    const live = this.liveScreens();
    let best = null, bd = Infinity;
    for (const sc of live) {
      if (x >= sc.x && x < sc.x + sc.w && (y === undefined || (y >= sc.y && y < sc.y + sc.h))) return sc;
      const d = x < sc.x ? sc.x - x : x >= sc.x + sc.w ? x - sc.x - sc.w : 0;
      const dy = y === undefined ? 0 : (y < sc.y ? sc.y - y : y > sc.y + sc.h ? y - sc.y - sc.h : 0);
      if (d + dy < bd) { bd = d + dy; best = sc; }
    }
    return best || this.screens[0];
  }

  // Waagerechter Bereich, in dem sich ein Körper auf Höhe y bewegen kann:
  // vom Bildschirm unter x aus, so weit benachbarte Bildschirme diese Höhe abdecken.
  xRangeAt(x, y) {
    const live = this.liveScreens();
    const covers = (sc) => y >= sc.y - 2 && y <= sc.floor + 2;
    let cur = live.find((sc) => x >= sc.x - 1 && x <= sc.x + sc.w + 1 && covers(sc)) || this.screenAt(x, y);
    let lo = cur.x, hi = cur.x + cur.w;
    for (let guard = 0; guard < 8; guard++) {
      const n = live.find((sc) => sc !== cur && Math.abs(sc.x + sc.w - lo) < 3 && covers(sc));
      if (!n) break; lo = n.x; cur = n;
    }
    cur = live.find((sc) => x >= sc.x - 1 && x <= sc.x + sc.w + 1 && covers(sc)) || this.screenAt(x, y);
    for (let guard = 0; guard < 8; guard++) {
      const n = live.find((sc) => sc !== cur && Math.abs(sc.x - hi) < 3 && covers(sc));
      if (!n) break; hi = n.x + n.w; cur = n;
    }
    return [lo, hi];
  }

  // Oberer Rand an Stelle x
  topAt(x) { return this.screenAt(x).y; }

  // Boden unter x (Boden des Bildschirms, sonst der nächste)
  floorAt(x) { return floorUnder(this.surfaces, x); }
  floors() { return this.surfaces.filter((s) => s.wid === 'floor'); }
  // Bildschirm, der den Punkt wirklich enthält (auch gesperrte), sonst null
  screenContaining(x, y) { return this.screens.find((sc) => x >= sc.x && x < sc.x + sc.w && y >= sc.y && y < sc.y + sc.h) || null; }
  isHome(x, y) { return (this.screenContaining(x, y) || this.screenAt(x, y)).home; }

  setWindows(list) {
    this.windows = list || [];
    this.rebuild();
  }

  usableWindow(w) {
    if (!this.enabled) return false;
    if (w.max) return false;
    if (w.w < 160 || w.h < 90) return false;
    const sc = this.screenAt(clamp(w.x + w.w / 2, this.minX, this.maxX - 1), w.y);
    if (!sc.home && this.blocked.has(sc.id)) return false;
    if (w.y < sc.y + 24 || w.y > sc.floor - 70) return false;
    if (w.x > this.maxX - 60 || w.x + w.w < this.minX + 60) return false;
    return true;
  }

  rebuild() {
    this.byId.clear();
    const wins = [...this.windows].sort((a, b) => a.z - b.z); // oberstes zuerst
    for (const w of wins) this.byId.set(w.id, w);
    // Böden: Heimboden zuerst (surfaces[0]); gleich hohe, aneinandergrenzende Böden verschmelzen
    const live = this.liveScreens();
    this.minX = Math.min(...live.map((sc) => sc.x));
    this.maxX = Math.max(...live.map((sc) => sc.x + sc.w));
    const home = this.screens[0];
    const floor0 = { id: 'floor', wid: 'floor', x1: home.fx1, x2: home.fx2, y: this.floorY, screen: 'home' };
    const others = [];
    for (const sc of live.filter((x) => !x.home).sort((a, b) => a.x - b.x)) others.push({ id: `floor@${sc.id}`, wid: 'floor', x1: sc.fx1, x2: sc.fx2, y: sc.floor, screen: sc.id });
    let grown = true;
    while (grown) {
      grown = false;
      for (let i = 0; i < others.length; i++) {
        const f = others[i];
        if (Math.abs(f.y - floor0.y) > 2) continue;
        if (Math.abs(f.x1 - floor0.x2) < 4) { floor0.x2 = f.x2; others.splice(i, 1); grown = true; break; }
        if (Math.abs(f.x2 - floor0.x1) < 4) { floor0.x1 = f.x1; others.splice(i, 1); grown = true; break; }
      }
    }
    for (let i = 0; i < others.length - 1; i++) {
      const a = others[i], b = others[i + 1];
      if (Math.abs(a.y - b.y) <= 2 && Math.abs(a.x2 - b.x1) < 4) { a.x2 = b.x2; others.splice(i + 1, 1); i--; }
    }
    const surfaces = [floor0, ...others];
    const walls = [];
    wins.forEach((w, i) => {
      if (!this.usableWindow(w)) return;
      const above = wins.slice(0, i);
      // Oberkante: Intervall [x, x+w] minus alle darüberliegenden Fenster, die diese Linie überdecken.
      // rechts liegen Minimieren/Maximieren/Schließen – dort nicht stehen
      let segs = [[Math.max(this.minX, w.x + 6), Math.min(this.maxX, w.x + w.w - Math.min(150, w.w * 0.3))]];
      for (const a of above) {
        if (a.y <= w.y && a.y + a.h > w.y - 4) segs = subtract(segs, a.x, a.x + a.w);
      }
      segs.filter((s) => s[1] - s[0] > 46).forEach((s, k) => surfaces.push({ id: `${w.id}:${k}`, wid: w.id, x1: s[0], x2: s[1], y: w.y }));
      // Seiten: nur wenn die obere Ecke frei ist und die Fläche oben erreichbar bleibt.
      for (const side of [-1, 1]) {
        const x = side < 0 ? w.x : w.x + w.w;
        if (x < this.minX + 30 || x > this.maxX - 30) continue;
        let vs = [[w.y, Math.min(w.y + w.h, floorUnder(surfaces, x).y)]];
        for (const a of above) {
          if (a.x - 18 <= x && a.x + a.w + 18 >= x) vs = subtract(vs, a.y, a.y + a.h);
        }
        const top = vs.find((s) => Math.abs(s[0] - w.y) < 2);
        if (top && top[1] - top[0] > 60) walls.push({ wid: w.id, side, x, y1: top[0], y2: top[1] });
      }
    });
    this.surfaces = surfaces;
    this.walls = walls;
  }

  allSurfaces() { return this.dynamic.length ? this.surfaces.concat(this.dynamic) : this.surfaces; }

  // Fläche, auf der ein fallender Körper zwischen y0 und y1 landet.
  landing(x, y0, y1, ignore) {
    let best = null;
    for (const s of this.allSurfaces()) {
      if (s === ignore || s.wid === ignore) continue;
      if (x < s.x1 || x > s.x2) continue;
      if (s.y >= y0 - 1 && s.y <= y1 + 1 && (!best || s.y < best.y)) best = s;
    }
    return best;
  }

  // Fläche desselben Fensters unter x (für Figuren, die auf einem Fenster stehen).
  surfaceOf(wid, x, pad = 0) {
    for (const s of this.allSurfaces()) if (s.wid === wid && x >= s.x1 - pad && x <= s.x2 + pad) return s;
    return null;
  }

  surfaceAt(x, y, tol = 3) {
    let best = null;
    for (const s of this.allSurfaces()) {
      if (x >= s.x1 && x <= s.x2 && Math.abs(s.y - y) <= tol) best = s;
    }
    return best;
  }

  // Erste Fläche unterhalb von (x, y)
  below(x, y) {
    let best = null;
    for (const s of this.allSurfaces()) {
      if (x >= s.x1 && x <= s.x2 && s.y >= y && (!best || s.y < best.y)) best = s;
    }
    return best || this.floorAt(x);
  }

  windowSurfaces() { return this.surfaces.filter((s) => s.wid !== 'floor'); }
  wallsOf(wid) { return this.walls.filter((w) => w.wid === wid); }
}

function floorUnder(surfaces, x) {
  let best = surfaces[0], bd = Infinity;
  for (const s of surfaces) {
    if (s.wid !== 'floor') continue;
    if (x >= s.x1 && x <= s.x2) return s;
    const d = x < s.x1 ? s.x1 - x : x - s.x2;
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}

function subtract(segs, a, b) {
  const out = [];
  for (const [s, e] of segs) {
    if (b <= s || a >= e) { out.push([s, e]); continue; }
    if (a > s) out.push([s, a]);
    if (b < e) out.push([b, e]);
  }
  return out;
}
