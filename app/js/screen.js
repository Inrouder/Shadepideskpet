// "Bildschirmschäden": Loch im Glas (mit Klebeband-Flicken), Ravens
// Wartungsluke mit Kabeln und der Glitch-Riss, aus dem Viren kriechen.
'use strict';

class ScreenHole {
  constructor(x, y, r) {
    this.x = x; this.y = y; this.r = r;
    this.t = 0; this.state = 'open'; this.tapes = []; this.fade = 1; this.patchedAt = 0;
    const n = 15;
    this.poly = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd(-0.12, 0.12);
      const rr = r * rnd(0.62, 1.08);
      this.poly.push([Math.cos(a) * rr, Math.sin(a) * rr * 0.92]);
    }
    this.cracks = [];
    for (let i = 0; i < 11; i++) {
      const a = rnd(0, Math.PI * 2);
      const pts = [[Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9]];
      let ca = a, len = r * rnd(1.4, 3.2), cx = pts[0][0], cy = pts[0][1];
      const steps = rndi(3, 5);
      for (let s = 0; s < steps; s++) {
        ca += rnd(-0.35, 0.35);
        cx += Math.cos(ca) * len / steps; cy += Math.sin(ca) * len / steps;
        pts.push([cx, cy]);
        if (chance(0.3)) this.cracks.push([[cx, cy], [cx + Math.cos(ca + rnd(-1.2, 1.2)) * r * 0.5, cy + Math.sin(ca + rnd(-1.2, 1.2)) * r * 0.5]]);
      }
      this.cracks.push(pts);
    }
    // Ringriss
    const ring = [];
    for (let i = 0; i <= 18; i++) { const a = (i / 18) * Math.PI * 2; const rr = r * rnd(1.35, 1.6); ring.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
    this.cracks.push(ring);
    this.traces = [];
    for (let i = 0; i < 7; i++) {
      const y0 = rnd(-r, r), x0 = -r * 1.2;
      const pts = [[x0, y0]]; let xx = x0, yy = y0;
      while (xx < r * 1.2) { xx += rnd(8, 18); if (chance(0.4)) yy += rnd(-10, 10); pts.push([xx, yy]); }
      this.traces.push({ pts, phase: rnd(0, 6), color: pick(['#62e3ee', '#ff3150', '#b26bff']) });
    }
  }

  addTape(angle, len) {
    const t = { a: angle, len, p: 0, off: rnd(-this.r * 0.35, this.r * 0.35), seed: rnd(0, 100) };
    this.tapes.push(t);
    return t;
  }

  update(dt, world) {
    this.t += dt;
    for (const t of this.tapes) t.p = Math.min(1, t.p + dt * 2.6);
    if (this.state === 'open' && chance(dt * 1.6)) world.fx.sparks(this.x + rnd(-this.r, this.r) * 0.5, this.y + rnd(-this.r, this.r) * 0.5, pick([COLORS.cyan, COLORS.redHot]), 4, 160);
    if (this.state === 'patched') {
      this.patchedAt += dt;
      if (this.patchedAt > 45) this.fade -= dt / 4;
    }
    return this.fade > 0;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.globalAlpha = clamp(this.fade, 0, 1);
    // Risse im Glas
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(220,245,255,0.55)'; ctx.lineWidth = 1.2;
    ctx.shadowColor = 'rgba(98,227,238,0.5)'; ctx.shadowBlur = 3;
    for (const c of this.cracks) { ctx.beginPath(); c.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); }
    ctx.shadowBlur = 0;
    // Loch
    ctx.beginPath(); this.poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, this.r);
    g.addColorStop(0, '#010205'); g.addColorStop(0.7, '#05070d'); g.addColorStop(1, '#141a26');
    ctx.fillStyle = g; ctx.fill();
    ctx.save(); ctx.clip();
    // Elektronik hinter dem Glas
    for (const tr of this.traces) {
      const pulse = 0.25 + 0.35 * Math.max(0, Math.sin(this.t * 3 + tr.phase));
      ctx.globalAlpha = pulse * this.fade; ctx.strokeStyle = tr.color; ctx.lineWidth = 1.5;
      ctx.beginPath(); tr.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = clamp(this.fade, 0, 1);
    // Glaskante + Hitzeschimmer der Klinge
    const heat = Math.max(0, 1 - this.t / 3);
    ctx.lineWidth = 2.5; ctx.strokeStyle = `rgba(200,235,255,0.75)`;
    ctx.beginPath(); this.poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.stroke();
    if (heat > 0) { ctx.strokeStyle = `rgba(255,80,100,${heat})`; ctx.shadowColor = '#ff3150'; ctx.shadowBlur = 16; ctx.lineWidth = 2; ctx.stroke(); ctx.shadowBlur = 0; }
    // Klebeband
    for (const t of this.tapes) drawTape(ctx, t, this.r);
    ctx.restore();
  }
}

function drawTape(ctx, t, r) {
  const L = t.len * easeOut(t.p);
  ctx.save();
  ctx.rotate(t.a);
  ctx.translate(-t.len / 2, t.off);
  const h = r * 0.42;
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 2;
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  g.addColorStop(0, '#c7ccd2'); g.addColorStop(0.45, '#9aa0a8'); g.addColorStop(1, '#7c828b');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, -h / 2);
  ctx.lineTo(L, -h / 2);
  // gerissene Enden
  for (let i = 0; i <= 4; i++) ctx.lineTo(L + (i % 2 ? 3 : -1), -h / 2 + (h * i) / 4);
  ctx.lineTo(0, h / 2);
  for (let i = 4; i >= 0; i--) ctx.lineTo(i % 2 ? -3 : 1, -h / 2 + (h * i) / 4);
  ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1;
  for (let x = 6; x < L - 4; x += 5) { ctx.beginPath(); ctx.moveTo(x, -h / 2 + 1); ctx.lineTo(x - 2, h / 2 - 1); ctx.stroke(); }
  ctx.restore();
}

class Hatch {
  constructor(x, y, w, h) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.t = 0; this.scan = 0; this.screws = 1; this.open = 0; this.alpha = 0; this.done = false;
    this.signal = rndi(12, 34);
    const n = 5;
    this.colors = ['#ff3150', '#62e3ee', '#ffb43a', '#ff7fc0', '#e9e2cf'];
    const target = [0, 1, 2, 3, 4];
    let current;
    do { current = [...target].sort(() => rand() - 0.5); } while (current.every((v, i) => v === i));
    this.cables = target.map((t, i) => ({ from: i, to: current[i], want: t, move: 1, broken: current[i] !== t && chance(0.5), fixed: current[i] === t }));
    this.n = n;
  }
  port(side, i) {
    const pad = this.h * 0.2, step = (this.h - pad * 2) / (this.n - 1);
    return { x: this.x + (side < 0 ? -this.w * 0.34 : this.w * 0.34), y: this.y - this.h / 2 + pad + i * step };
  }
  rewire(idx) {
    const c = this.cables[idx];
    c.prev = c.to; c.to = c.want; c.move = 0; c.broken = false; c.fixed = true;
  }
  update(dt, world) {
    this.t += dt;
    for (const c of this.cables) if (c.move < 1) c.move = Math.min(1, c.move + dt * 1.8);
    if (this.open > 0.6) {
      for (const c of this.cables) if (c.broken && chance(dt * 5)) { const p = this.port(1, c.to); world.fx.sparks(p.x, p.y, COLORS.amber, 3, 140); }
    }
    if (this.done) { this.alpha -= dt * 1.2; return this.alpha > 0; }
    this.alpha = Math.min(1, this.alpha + dt * 3);
    return true;
  }
  draw(ctx) {
    const { x, y, w, h } = this;
    ctx.save();
    ctx.globalAlpha = clamp(this.alpha, 0, 1);
    // Scanrahmen
    if (this.scan > 0 && this.scan < 1) {
      ctx.strokeStyle = COLORS.cyan; ctx.lineWidth = 2; ctx.shadowColor = COLORS.cyan; ctx.shadowBlur = 10;
      const c = 14;
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const cx = x + sx * w / 2, cy = y + sy * h / 2;
        ctx.beginPath(); ctx.moveTo(cx, cy - sy * c); ctx.lineTo(cx, cy); ctx.lineTo(cx - sx * c, cy); ctx.stroke();
      }
      const ly = y - h / 2 + h * this.scan;
      ctx.globalAlpha *= 0.7; ctx.beginPath(); ctx.moveTo(x - w / 2, ly); ctx.lineTo(x + w / 2, ly); ctx.stroke();
      ctx.globalAlpha = clamp(this.alpha, 0, 1);
      ctx.shadowBlur = 0;
    }
    if (this.scan >= 1 || this.open > 0 || this.screws < 1) {
      // Einbaurahmen
      ctx.fillStyle = '#0b0f17'; ctx.fillRect(x - w / 2 - 6, y - h / 2 - 6, w + 12, h + 12);
      ctx.strokeStyle = '#2a3342'; ctx.lineWidth = 2; ctx.strokeRect(x - w / 2 - 6, y - h / 2 - 6, w + 12, h + 12);
      ctx.strokeStyle = 'rgba(98,227,238,0.5)'; ctx.lineWidth = 1; ctx.strokeRect(x - w / 2 - 3, y - h / 2 - 3, w + 6, h + 6);
      // Innenraum
      const g = ctx.createLinearGradient(0, y - h / 2, 0, y + h / 2);
      g.addColorStop(0, '#03050a'); g.addColorStop(1, '#0c1420');
      ctx.fillStyle = g; ctx.fillRect(x - w / 2, y - h / 2, w, h);
      ctx.fillStyle = '#0d1b17'; ctx.fillRect(x - w * 0.42, y - h * 0.42, w * 0.84, h * 0.84);
      ctx.strokeStyle = 'rgba(98,227,238,0.18)'; ctx.lineWidth = 1;
      for (let i = 0; i < 9; i++) { const yy = y - h * 0.38 + i * h * 0.095; ctx.beginPath(); ctx.moveTo(x - w * 0.4, yy); ctx.lineTo(x - w * 0.1, yy); ctx.lineTo(x - w * 0.05, yy + 4); ctx.lineTo(x + w * 0.4, yy + 4); ctx.stroke(); }
      // Anzeige
      const fixedCount = this.cables.filter((c) => c.fixed).length;
      const sig = Math.round(lerp(this.signal, 100, fixedCount / this.n));
      ctx.fillStyle = '#05080c'; ctx.fillRect(x - 26, y + h / 2 - 17, 52, 12);
      ctx.font = '10px Silkscreen, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = sig >= 100 ? COLORS.cyan : COLORS.warn; ctx.fillText(`SIG ${sig}%`, x, y + h / 2 - 11);
      // Ports + Kabel
      for (let i = 0; i < this.n; i++) {
        for (const s of [-1, 1]) {
          const p = this.port(s, i);
          ctx.fillStyle = '#1d2430'; ctx.fillRect(p.x - 5, p.y - 4, 10, 8);
          if (s > 0) {
            const ok = this.cables.find((c) => c.to === i && c.fixed);
            ctx.fillStyle = ok ? COLORS.cyan : (Math.sin(this.t * 8 + i) > 0 ? COLORS.warn : '#401018');
            ctx.fillRect(p.x + 8, p.y - 2, 4, 4);
          }
        }
      }
      for (const c of this.cables) {
        const a = this.port(-1, c.from);
        const bNew = this.port(1, c.to);
        const bOld = this.port(1, c.prev ?? c.to);
        const k = easeInOut(c.move);
        const bx = lerp(bOld.x, bNew.x, k), by = lerp(bOld.y, bNew.y, k) - Math.sin(k * Math.PI) * 18;
        const sag = 16 + c.from * 3;
        ctx.strokeStyle = '#05070b'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.bezierCurveTo(a.x + w * 0.2, a.y + sag, bx - w * 0.2, by + sag, bx, by); ctx.stroke();
        ctx.strokeStyle = this.colors[c.from]; ctx.lineWidth = 3;
        if (c.broken) ctx.setLineDash([10, 4]);
        ctx.stroke(); ctx.setLineDash([]);
      }
    }
    // Klappe (unten angeschlagen) + Schrauben
    const ang = this.open * 1.95; // bis ~112°
    const ph = h * Math.cos(ang);
    const widen = 1 + 0.12 * Math.sin(ang);
    const hy = y + h / 2;
    ctx.fillStyle = ph >= 0 ? '#242c38' : '#141920';
    ctx.strokeStyle = '#3d4a5c'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, hy); ctx.lineTo(x + w / 2, hy);
    ctx.lineTo(x + (w / 2) * widen, hy - ph); ctx.lineTo(x - (w / 2) * widen, hy - ph); ctx.closePath();
    if (this.scan >= 1 || this.open > 0) { ctx.fill(); ctx.stroke(); }
    if (ph > h * 0.3) {
      // Warnstreifen + Lüftungsschlitze auf der Außenseite
      const top = hy - ph;
      ctx.save(); ctx.beginPath(); ctx.rect(x - w / 2 + 6, top + 6, w - 12, Math.max(0, ph * 0.12)); ctx.clip();
      for (let i = -10; i < 20; i++) { ctx.fillStyle = i % 2 ? '#ffb43a' : '#151515'; ctx.beginPath(); ctx.moveTo(x - w / 2 + i * 10, top + 6); ctx.lineTo(x - w / 2 + i * 10 + 10, top + 6); ctx.lineTo(x - w / 2 + i * 10, top + 6 + ph * 0.12); ctx.lineTo(x - w / 2 + i * 10 - 10, top + 6 + ph * 0.12); ctx.fill(); }
      ctx.restore();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      for (let i = 0; i < 5; i++) { const yy = top + ph * (0.35 + i * 0.1); ctx.beginPath(); ctx.moveTo(x - w * 0.3, yy); ctx.lineTo(x + w * 0.3, yy); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(98,227,238,0.55)'; ctx.beginPath(); ctx.moveTo(x - w / 2 + 4, top + 3); ctx.lineTo(x + w / 2 - 4, top + 3); ctx.stroke();
      // Schrauben
      for (const [sx, sy] of [[-1, 0.08], [1, 0.08], [-1, 0.92], [1, 0.92]]) {
        const s = this.screws;
        if (s <= 0) continue;
        ctx.save(); ctx.translate(x + sx * (w / 2 - 9), top + ph * sy); ctx.rotate(this.t * (1 - s) * 20);
        ctx.fillStyle = '#9aa0a8'; ctx.beginPath(); ctx.arc(0, 0, 3.5 * s + 0.5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#222'; ctx.beginPath(); ctx.moveTo(-3, 0); ctx.lineTo(3, 0); ctx.stroke(); ctx.restore();
      }
    }
    ctx.restore();
  }
}

class GlitchTear {
  constructor(x, y, h) { this.x = x; this.y = y; this.h = h; this.t = 0; this.open = 0; this.closing = false; this.slices = []; }
  update(dt, world) {
    this.t += dt;
    this.open = this.closing ? Math.max(0, this.open - dt * 1.5) : Math.min(1, this.open + dt * 2);
    if (chance(dt * 18)) this.slices.push({ y: rnd(-this.h / 2, this.h / 2), w: rnd(20, 90), h: rnd(2, 8), life: rnd(0.05, 0.18), t: 0, dx: rnd(-40, 40), c: pick(['rgba(178,107,255,0.6)', 'rgba(98,227,238,0.5)', 'rgba(255,127,192,0.45)']) });
    this.slices = this.slices.filter((s) => (s.t += dt) < s.life);
    if (this.open > 0.5 && chance(dt * 10)) world.fx.pixels(this.x, this.y + rnd(-this.h / 2, this.h / 2), [COLORS.violet, COLORS.cyan, COLORS.magenta], 2, 120, { g: 0, up: 0 });
    return !(this.closing && this.open <= 0);
  }
  draw(ctx) {
    const o = easeOut(this.open);
    if (o <= 0) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    const w = 22 * o, h = this.h * o;
    ctx.shadowColor = COLORS.violet; ctx.shadowBlur = 30;
    ctx.fillStyle = '#05010c';
    ctx.beginPath();
    const n = 12;
    for (let i = 0; i <= n; i++) { const yy = -h / 2 + (h * i) / n; const xx = (i === 0 || i === n ? 0 : w * (0.6 + 0.4 * Math.sin(this.t * 9 + i * 1.7))) ; ctx.lineTo(-xx, yy); }
    for (let i = n; i >= 0; i--) { const yy = -h / 2 + (h * i) / n; const xx = (i === 0 || i === n ? 0 : w * (0.6 + 0.4 * Math.cos(this.t * 7 + i * 2.1))); ctx.lineTo(xx, yy); }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = COLORS.violet; ctx.lineWidth = 2; ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = 'lighter';
    for (const s of this.slices) { ctx.fillStyle = s.c; ctx.fillRect(s.dx - s.w / 2, s.y, s.w, s.h); }
    ctx.restore();
  }
}
