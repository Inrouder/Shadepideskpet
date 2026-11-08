// Effekte: Funken, Splitter, Explosionen, Schnittbögen, Schadenszahlen,
// Sprechblasen und die "Bildschirmschäden" (Löcher, Luke, Glitch-Riss).
'use strict';

const COLORS = {
  cyan: '#62e3ee', cyanHot: '#c8fbff', magenta: '#ff7fc0', red: '#ff3150', redHot: '#ff8aa0', amber: '#ffb43a',
  white: '#f4f0e4', violet: '#b26bff', deep: '#070a12', text: '#d9f3f7', muted: '#7f9fb0', warn: '#ff697c',
};

class FX {
  constructor(world) { this.world = world; this.list = []; this.top = []; }

  add(p) {
    p.t = 0;
    p.life = p.life || 0.5;
    (p.layer === 'top' ? this.top : this.list).push(p);
    if (this.list.length > 900) this.list.splice(0, this.list.length - 900);
    return p;
  }

  update(dt) {
    for (const arr of [this.list, this.top]) {
      for (let i = arr.length - 1; i >= 0; i--) {
        const p = arr[i];
        p.t += dt;
        if (p.follow) { p.x = p.follow.x + (p.fx || 0); p.y = p.follow.y + (p.fy || 0); }
        if (p.vx !== undefined) {
          p.vy += (p.g || 0) * dt;
          if (p.drag) { p.vx *= Math.pow(p.drag, dt * 60); p.vy *= Math.pow(p.drag, dt * 60); }
          p.x += p.vx * dt; p.y += p.vy * dt;
          if (p.bounce && p.y > this.world.terrain.floorY && p.vy > 0) {
            p.y = this.world.terrain.floorY; p.vy *= -p.bounce; p.vx *= 0.6;
          }
          if (p.rot !== undefined) p.rot += (p.spin || 0) * dt;
        }
        if (p.t >= p.life) arr.splice(i, 1);
      }
    }
  }

  draw(ctx, layer) {
    const arr = layer === 'top' ? this.top : this.list;
    for (const p of arr) drawParticle(ctx, p, this.world);
  }

  // ---- Vorlagen ---------------------------------------------------
  sparks(x, y, color, n = 10, speed = 320, opts = {}) {
    for (let i = 0; i < n; i++) {
      const a = opts.dir !== undefined ? opts.dir + rnd(-opts.spread || -0.8, opts.spread || 0.8) : rnd(0, Math.PI * 2);
      const v = rnd(speed * 0.35, speed);
      this.add({ type: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: opts.g ?? 600, drag: 0.93, life: rnd(0.18, 0.45), color, len: rnd(4, 10) });
    }
  }
  pixels(x, y, color, n = 16, speed = 240, opts = {}) {
    for (let i = 0; i < n; i++) {
      const a = rnd(0, Math.PI * 2), v = rnd(speed * 0.2, speed);
      this.add({ type: 'pixel', x: x + rnd(-8, 8), y: y + rnd(-8, 8), vx: Math.cos(a) * v, vy: Math.sin(a) * v - (opts.up || 60), g: opts.g ?? 300, drag: 0.94, life: rnd(0.4, 0.9), color: Array.isArray(color) ? pick(color) : color, size: rnd(2, opts.size || 4) });
    }
  }
  dust(x, y, n = 6, s = 1) {
    for (let i = 0; i < n; i++) this.add({ type: 'dust', x: x + rnd(-10, 10) * s, y: y - 2, vx: rnd(-90, 90) * s, vy: rnd(-40, -10), g: 0, drag: 0.9, life: rnd(0.4, 0.7), r: rnd(4, 9) * s });
  }
  shards(x, y, n = 14) {
    for (let i = 0; i < n; i++) {
      this.add({ type: 'shard', x: x + rnd(-14, 14), y: y + rnd(-14, 14), vx: rnd(-160, 160), vy: rnd(-180, 40), g: 1300, drag: 0.99, bounce: 0.35, life: rnd(1.2, 2.2), rot: rnd(0, 6), spin: rnd(-12, 12), size: rnd(3, 8) });
    }
  }
  explosion(x, y, scale = 1) {
    this.add({ type: 'strip', img: 'explosion', x, y, life: 0.55, frames: 4, scale: 0.9 * scale });
    this.add({ type: 'ring', x, y, life: 0.35, r0: 8 * scale, r1: 90 * scale, color: COLORS.amber, w: 4 });
    this.sparks(x, y, COLORS.amber, 18, 520);
    this.add({ type: 'strip', img: 'smoke', x: x + rnd(-10, 10), y: y - 20 * scale, vx: 0, vy: -30, g: 0, life: 1.1, frames: 4, scale: 0.7 * scale, alpha: 0.7 });
  }
  ring(x, y, color, r1 = 80, life = 0.35, w = 3) { this.add({ type: 'ring', x, y, life, r0: 4, r1, color, w }); }
  slash(x, y, dir, color = COLORS.red, size = 1, opts = {}) {
    this.add({ type: 'slash', x, y, dir, color, size, life: opts.life || 0.22, a0: opts.a0 ?? -1.25, a1: opts.a1 ?? 1.1, w: opts.w || 7 });
  }
  number(x, y, value, color = COLORS.white, big = false) {
    this.add({ type: 'text', layer: 'top', x: x + rnd(-6, 6), y, vx: rnd(-30, 30), vy: -110, g: 220, life: 0.8, text: String(value), color, size: big ? 26 : 18 });
  }
  label(x, y, text, color = COLORS.cyan, size = 18, life = 1.2) { this.add({ type: 'text', layer: 'top', x, y, vx: 0, vy: -26, g: 0, life, text, color, size, stay: true }); }
  nanites(entity, n = 3) {
    for (let i = 0; i < n; i++) {
      const a = rnd(0, Math.PI * 2);
      this.add({ type: 'nanite', x: entity.x + Math.cos(a) * 30, y: entity.y - 40 + Math.sin(a) * 40, vx: -Math.cos(a) * 30, vy: rnd(-70, -20), g: 0, drag: 0.97, life: rnd(0.5, 1.0) });
    }
  }
  lightning(x1, y1, x2, y2, color = COLORS.cyan, life = 0.18, width = 3) {
    const pts = [];
    const n = Math.max(4, Math.floor(Math.hypot(x2 - x1, y2 - y1) / 18));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const off = i === 0 || i === n ? 0 : rnd(-14, 14);
      const nx = -(y2 - y1), ny = x2 - x1, l = Math.hypot(nx, ny) || 1;
      pts.push([lerp(x1, x2, t) + (nx / l) * off, lerp(y1, y2, t) + (ny / l) * off]);
    }
    this.add({ type: 'bolt', pts, color, life, w: width });
  }
  beam(x1, y1, x2, y2, color, life = 0.15, w = 4, warn = false) { this.add({ type: 'beam', x1, y1, x2, y2, color, life, w, warn }); }
  afterimage(draw, life = 0.35, color = '#000000') { this.add({ type: 'ghost', draw, life, color }); }
  streak(x1, y1, x2, y2, color, life = 0.3, w = 10) { this.add({ type: 'streak', x1, y1, x2, y2, color, life, w }); }
  smokePuff(x, y, scale = 0.6, alpha = 0.8) { this.add({ type: 'strip', img: 'smoke', x, y, vx: rnd(-15, 15), vy: -25, g: 0, life: 0.9, frames: 4, scale, alpha }); }
  fire(x, y, life = 2.5, scale = 0.5) { this.add({ type: 'strip', img: 'fire', x, y, life, frames: 4, loop: 0.12, scale, anchorBottom: true }); }
  hearts(x, y, n = 6, spread = 1) {
    for (let i = 0; i < n; i++) {
      this.add({ type: 'heart', x: x + rnd(-14, 14) * spread, y: y + rnd(-6, 6), vx: rnd(-18, 18), vy: rnd(-70, -40), g: 0, drag: 0.995, life: rnd(1.6, 2.6), size: rnd(2, 3.2), phase: rnd(0, 6), color: pick(['#ff7fc0', '#ff4f9a', '#ff9ed2', '#ff3150']), delay: i * 0.12 });
    }
  }
  petals(x, y, w, n = 10) {
    for (let i = 0; i < n; i++) {
      this.add({ type: 'petal', layer: 'top', x: x + rnd(-w / 2, w / 2), y: y + rnd(-40, 0), vx: rnd(-20, 20), vy: rnd(18, 45), g: 0, life: rnd(2.5, 4.2), rot: rnd(0, 6), spin: rnd(-3, 3), phase: rnd(0, 6), size: rnd(3, 5) });
    }
  }
  speedLines(x, y, dir, color = 'rgba(255,255,255,0.6)') {
    for (let i = 0; i < 8; i++) this.add({ type: 'line', x: x + rnd(-30, 30), y: y - rnd(10, 90), dx: -dir * rnd(40, 110), life: rnd(0.15, 0.3), color });
  }
}

function drawParticle(ctx, p, world) {
  const k = p.t / p.life;
  ctx.save();
  switch (p.type) {
    case 'spark': {
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = p.color; ctx.lineWidth = 2; ctx.shadowColor = p.color; ctx.shadowBlur = 8;
      const l = Math.hypot(p.vx, p.vy) || 1;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - (p.vx / l) * p.len, p.y - (p.vy / l) * p.len); ctx.stroke();
      break;
    }
    case 'pixel':
      ctx.globalAlpha = 1 - k * k; ctx.fillStyle = p.color; ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size); break;
    case 'dust':
      ctx.globalAlpha = (1 - k) * 0.35; ctx.fillStyle = '#9aa0a8';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 + k), 0, Math.PI * 2); ctx.fill(); break;
    case 'shard': {
      ctx.globalAlpha = Math.min(1, (1 - k) * 2);
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = 'rgba(200,240,255,0.55)'; ctx.strokeStyle = 'rgba(230,250,255,0.9)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-p.size, -p.size * 0.4); ctx.lineTo(p.size, 0); ctx.lineTo(-p.size * 0.3, p.size * 0.7); ctx.closePath(); ctx.fill(); ctx.stroke();
      break;
    }
    case 'strip': {
      const img = IMG[p.img];
      if (!img) break;
      const f = p.loop ? Math.floor(p.t / p.loop) % p.frames : Math.min(p.frames - 1, Math.floor(k * p.frames));
      ctx.globalAlpha = (p.alpha ?? 1) * (p.loop ? Math.min(1, (p.life - p.t) * 2) : 1);
      drawStrip(ctx, img, f, p.frames, p.x, p.y, p.scale, { anchorBottom: p.anchorBottom });
      break;
    }
    case 'ring':
      ctx.globalAlpha = 1 - k; ctx.strokeStyle = p.color; ctx.lineWidth = p.w * (1 - k) + 1; ctx.shadowColor = p.color; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(p.x, p.y, lerp(p.r0, p.r1, easeOut(k)), 0, Math.PI * 2); ctx.stroke(); break;
    case 'slash': {
      const s = p.size;
      ctx.translate(p.x, p.y); ctx.scale(p.dir, 1);
      const sweep = easeOut(Math.min(1, k * 2.2));
      const a0 = p.a0, a1 = lerp(p.a0, p.a1, sweep);
      ctx.globalAlpha = 1 - k;
      ctx.shadowColor = p.color; ctx.shadowBlur = 18;
      ctx.strokeStyle = p.color; ctx.lineCap = 'round';
      ctx.lineWidth = p.w * s; ctx.beginPath(); ctx.arc(0, 0, 46 * s, a0, a1); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = p.w * 0.35 * s; ctx.beginPath(); ctx.arc(0, 0, 46 * s, a0 + (a1 - a0) * 0.3, a1); ctx.stroke();
      break;
    }
    case 'text': {
      const a = p.stay ? Math.min(1, (p.life - p.t) * 3) : 1 - k * k;
      ctx.globalAlpha = a;
      ctx.font = `${p.size}px ShadepiPixel, monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(7,10,18,0.9)'; ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 6; ctx.fillText(p.text, p.x, p.y);
      break;
    }
    case 'nanite':
      ctx.globalAlpha = 1 - k; ctx.fillStyle = '#ffffff'; ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 8;
      ctx.fillRect(p.x, p.y, 2, 2); break;
    case 'bolt': {
      ctx.globalAlpha = 1 - k; ctx.strokeStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 14; ctx.lineJoin = 'round';
      ctx.lineWidth = p.w; ctx.beginPath(); p.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.stroke();
      break;
    }
    case 'beam': {
      if (p.warn) {
        ctx.globalAlpha = 0.25 + 0.5 * Math.abs(Math.sin(p.t * 30));
        ctx.setLineDash([8, 6]); ctx.strokeStyle = p.color; ctx.lineWidth = 1.5;
      } else {
        ctx.globalAlpha = 1 - k; ctx.strokeStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 16; ctx.lineWidth = p.w * (1 - k * 0.5);
      }
      ctx.beginPath(); ctx.moveTo(p.x1, p.y1); ctx.lineTo(p.x2, p.y2); ctx.stroke();
      if (!p.warn) { ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1, p.w * 0.3); ctx.stroke(); }
      break;
    }
    case 'streak': {
      const g = ctx.createLinearGradient(p.x1, p.y1, p.x2, p.y2);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, p.color);
      ctx.globalAlpha = 1 - k; ctx.strokeStyle = g; ctx.lineWidth = p.w * (1 - k); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(p.x1, p.y1); ctx.lineTo(p.x2, p.y2); ctx.stroke();
      break;
    }
    case 'ghost':
      ctx.globalAlpha = (1 - k) * 0.55; p.draw(ctx, p.color); break;
    case 'line':
      ctx.globalAlpha = 1 - k; ctx.strokeStyle = p.color; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.dx, p.y); ctx.stroke(); break;
    case 'heart': {
      const t = p.t - (p.delay || 0);
      if (t < 0) break;
      const k2 = t / (p.life - (p.delay || 0));
      const pop = Math.min(1, t * 6);
      ctx.globalAlpha = Math.min(1, (1 - k2) * 2) * pop;
      ctx.translate(p.x + Math.sin(t * 4 + p.phase) * 8, p.y);
      ctx.scale(pop * (1 + 0.08 * Math.sin(t * 10)), pop * (1 + 0.08 * Math.sin(t * 10)));
      const c = p.size;
      // Pixel-Herz (7×6)
      const H = ['0110110', '1111111', '1111111', '0111110', '0011100', '0001000'];
      ctx.shadowColor = p.color; ctx.shadowBlur = 8;
      ctx.fillStyle = p.color;
      H.forEach((row, yy) => { for (let xx = 0; xx < 7; xx++) if (row[xx] === '1') ctx.fillRect((xx - 3.5) * c, (yy - 3) * c, c + 0.4, c + 0.4); });
      ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(-2.5 * c, -2 * c, c, c);
      break;
    }
    case 'petal': {
      ctx.globalAlpha = Math.min(1, (1 - k) * 2.5) * Math.min(1, p.t * 3);
      ctx.translate(p.x + Math.sin(p.t * 2.2 + p.phase) * 18, p.y);
      ctx.rotate(p.rot);
      ctx.scale(1, 0.55 + 0.45 * Math.abs(Math.sin(p.t * 3 + p.phase)));
      const g = ctx.createLinearGradient(-p.size, 0, p.size, 0);
      g.addColorStop(0, '#ffd6e8'); g.addColorStop(1, '#ff8fbf');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * 0.6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(-p.size * 0.6, -0.5, p.size * 0.6, 1);
      break;
    }
    case 'blossom': drawBlossom(ctx, p); break;
    case 'shockwave':
      ctx.globalAlpha = (1 - k) * 0.8; ctx.strokeStyle = p.color; ctx.lineWidth = 6 * (1 - k) + 1; ctx.shadowColor = p.color; ctx.shadowBlur = 20;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, lerp(10, p.r, easeOut(k)), lerp(4, p.r * 0.28, easeOut(k)), 0, 0, Math.PI * 2); ctx.stroke(); break;
  }
  ctx.restore();
}

// Lichtblüte (Shadepis Geschenk): fünf Kirschblütenblätter aus Licht, roter Kern wie seine Klinge
function drawBlossom(ctx, p) {
  const grow = easeOut(Math.min(1, p.t / 0.6));
  const fade = Math.min(1, (p.life - p.t) / 0.8);
  const r = p.r * grow;
  ctx.globalAlpha = fade;
  ctx.translate(p.x, p.y + Math.sin(p.t * 2.4) * 3);
  ctx.rotate(p.t * 0.6);
  const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, r * 2.4);
  glow.addColorStop(0, 'rgba(255,170,210,0.55)'); glow.addColorStop(1, 'rgba(255,120,180,0)');
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, r * 2.4, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 5; i++) {
    ctx.save();
    ctx.rotate((i / 5) * Math.PI * 2);
    const g = ctx.createLinearGradient(0, 0, 0, -r * 1.25);
    g.addColorStop(0, '#ffd9ea'); g.addColorStop(1, '#ff8ec0');
    ctx.fillStyle = g; ctx.shadowColor = '#ff9ed2'; ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(r * 0.7, -r * 0.35, r * 0.6, -r * 1.15, r * 0.12, -r * 1.25);
    ctx.lineTo(0, -r * 1.12);
    ctx.lineTo(-r * 0.12, -r * 1.25);
    ctx.bezierCurveTo(-r * 0.6, -r * 1.15, -r * 0.7, -r * 0.35, 0, 0);
    ctx.fill();
    ctx.restore();
  }
  ctx.shadowColor = COLORS.red; ctx.shadowBlur = 12; ctx.fillStyle = COLORS.red;
  ctx.beginPath(); ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0; ctx.fillStyle = '#ffe1ec';
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 + 0.6; ctx.fillRect(Math.cos(a) * r * 0.45 - 1, Math.sin(a) * r * 0.45 - 1, 2, 2); }
}

// ------------------------------------------------------------ Sprechblasen
class Bubbles {
  constructor(world) { this.world = world; this.list = []; }
  say(entity, text, opts = {}) {
    if (!text) return null;
    if (!this.world.settings.bubbles && !opts.force) return null;
    this.list = this.list.filter((b) => b.who !== entity);
    const b = { who: entity, text, t: 0, life: opts.life || clamp(1.6 + text.length * 0.055, 2, 6), name: opts.name || entity.displayName || '', color: opts.color || entity.voiceColor || COLORS.cyan, x: entity.x, y: entity.y };
    this.list.push(b);
    return b;
  }
  sayAt(x, y, name, color, text, life) {
    if (!this.world.settings.bubbles) return null;
    const b = { who: { x, y, h: 0, bubbleY: 0, dead: false }, text, t: 0, life: life || clamp(1.6 + text.length * 0.055, 2, 6), name, color, x, y };
    this.list.push(b);
    return b;
  }
  clear(entity) { this.list = this.list.filter((b) => b.who !== entity); }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const b = this.list[i];
      b.t += dt;
      if (b.t > b.life || (b.who.dead && b.who.removed)) this.list.splice(i, 1);
    }
  }
  draw(ctx) {
    const placed = [];
    const avoid = [];
    if (this.list.length) for (const el of document.querySelectorAll('.holo, .remcard')) { const r = el.getBoundingClientRect(); avoid.push({ x: r.left, y: r.top, w: r.width, h: r.height }); }
    ctx.save();
    for (const b of this.list) {
      const shown = b.text.slice(0, Math.ceil(b.t * 45));
      ctx.font = '20px ShadepiPixel, monospace';
      const lines = wrapText(ctx, b.text, 260);
      const w = Math.max(...lines.map((l) => ctx.measureText(l).width), ctx.measureText(b.name).width * 0.75) + 30;
      const h = lines.length * 19 + 24;
      const headY = b.who.y - (b.who.bubbleY || b.who.h || 90);
      let x = clamp(b.who.x - w / 2, 6, this.world.terrain.W - w - 6);
      let y = headY - h - 16;
      for (const p of placed) if (x < p.x + p.w && x + w > p.x && y < p.y + p.h && y + h > p.y) y = p.y - h - 6;
      // Hologramme/Karten nicht verdecken: seitlich ausweichen
      for (const r of avoid) {
        if (x < r.x + r.w && x + w > r.x && y < r.y + r.h && y + h > r.y) {
          const left = r.x - w - 8, right = r.x + r.w + 8;
          x = (b.who.x < r.x + r.w / 2 && left > 6) || right + w > this.world.terrain.W - 6 ? left : right;
          x = clamp(x, 6, this.world.terrain.W - w - 6);
        }
      }
      if (y < 6) y = headY + 40;
      placed.push({ x, y, w, h });
      const appear = Math.min(1, b.t * 8), vanish = Math.min(1, (b.life - b.t) * 4);
      ctx.globalAlpha = Math.min(appear, vanish);
      const pop = 0.85 + 0.15 * easeOut(appear);
      ctx.save();
      ctx.translate(x + w / 2, y + h);
      ctx.scale(pop, pop);
      ctx.translate(-(x + w / 2), -(y + h));
      // Zeiger
      const tx = clamp(b.who.x, x + 14, x + w - 14);
      ctx.fillStyle = 'rgba(7,10,18,0.94)'; ctx.strokeStyle = b.color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(tx - 7, y + h - 4); ctx.lineTo(tx, y + h + 10); ctx.lineTo(tx + 7, y + h - 4); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = 'rgba(7,10,18,0.9)'; ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
      nineSlice(ctx, IMG.frame, x, y, w, h, [22, 8, 22, 8], 1);
      ctx.fillStyle = b.color; ctx.fillRect(x + 6, y + 4, 3, h - 8);
      // Name
      ctx.font = '10px Silkscreen, monospace'; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
      ctx.fillStyle = b.color; ctx.fillText(b.name.toUpperCase(), x + 14, y + 6);
      ctx.font = '20px ShadepiPixel, monospace'; ctx.fillStyle = COLORS.text;
      let remaining = shown.length;
      lines.forEach((l, i) => {
        const part = l.slice(0, Math.max(0, remaining));
        remaining -= l.length + 1;
        ctx.fillText(part, x + 14, y + 18 + i * 19);
      });
      ctx.restore();
    }
    ctx.restore();
  }
}

function wrapText(ctx, text, maxW) {
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}
