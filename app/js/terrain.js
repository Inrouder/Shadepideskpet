// Begehbare Flächen: Taskleisten-Oberkante (Boden), sichtbare Fensteroberkanten
// und kletterbare Fensterseiten. Verdeckte Teile werden herausgerechnet.
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
  }

  setLayout(layout) {
    this.W = layout.width;
    this.H = layout.height;
    const wa = layout.workArea || { x: 0, y: 0, w: this.W, h: this.H };
    this.floorY = Math.round(wa.y + wa.h);
    this.floorX1 = wa.x;
    this.floorX2 = wa.x + wa.w;
    this.rebuild();
  }

  setWindows(list) {
    this.windows = list || [];
    this.rebuild();
  }

  usableWindow(w) {
    if (!this.enabled) return false;
    if (w.max) return false;
    if (w.w < 160 || w.h < 90) return false;
    if (w.y < 24 || w.y > this.floorY - 70) return false;
    if (w.x > this.W - 60 || w.x + w.w < 60) return false;
    return true;
  }

  rebuild() {
    this.byId.clear();
    const wins = [...this.windows].sort((a, b) => a.z - b.z); // oberstes zuerst
    for (const w of wins) this.byId.set(w.id, w);
    const surfaces = [{ id: 'floor', wid: 'floor', x1: this.floorX1, x2: this.floorX2, y: this.floorY }];
    const walls = [];
    wins.forEach((w, i) => {
      if (!this.usableWindow(w)) return;
      const above = wins.slice(0, i);
      // Oberkante: Intervall [x, x+w] minus alle darüberliegenden Fenster, die diese Linie überdecken.
      // rechts liegen Minimieren/Maximieren/Schließen – dort nicht stehen
      let segs = [[Math.max(0, w.x + 6), Math.min(this.W, w.x + w.w - Math.min(150, w.w * 0.3))]];
      for (const a of above) {
        if (a.y <= w.y && a.y + a.h > w.y - 4) segs = subtract(segs, a.x, a.x + a.w);
      }
      segs.filter((s) => s[1] - s[0] > 46).forEach((s, k) => surfaces.push({ id: `${w.id}:${k}`, wid: w.id, x1: s[0], x2: s[1], y: w.y }));
      // Seiten: nur wenn die obere Ecke frei ist und die Fläche oben erreichbar bleibt.
      for (const side of [-1, 1]) {
        const x = side < 0 ? w.x : w.x + w.w;
        if (x < 30 || x > this.W - 30) continue;
        let vs = [[w.y, Math.min(w.y + w.h, this.floorY)]];
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
    return best || this.surfaces[0];
  }

  windowSurfaces() { return this.surfaces.filter((s) => s.wid !== 'floor'); }
  wallsOf(wid) { return this.walls.filter((w) => w.wid === wid); }
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
