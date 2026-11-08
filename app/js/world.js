// Die Spielwelt: hält alle Figuren, Gegner, Gegenstände und Effekte,
// aktualisiert und zeichnet sie in der richtigen Reihenfolge.
'use strict';

class World {
  constructor(canvas, settings) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.settings = settings;
    this.terrain = new Terrain();
    this.fx = new FX(this);
    this.bubbles = new Bubbles(this);
    this.cinema = new Cinema(this);
    this.heroes = [];
    this.enemies = [];
    this.items = [];
    this.projectiles = [];
    this.screen = [];
    this.time = 0; this.dt = 0;
    this.mouse = { x: -1000, y: -1000, active: false };
    this.stats = { hits: 0, kills: 0, fightStart: 0 };
    this.fightKind = null;
    this.hidden = false; this.fade = 1;
    this.demoWindows = null;
    this.director = null;
  }

  get u() { return this.settings.size / 0.72; }
  get calmFactor() { return ({ ruhig: 1.8, normal: 1, chaos: 0.6 }[this.settings.activity] || 1) * (isNight() ? 1.6 : 1); }
  hasEnemies() { return this.enemies.some((e) => !e.dead && e.team === 'enemy'); }
  hero(name) { return this.heroes.find((h) => h.name === name); }
  presentHeroes() { return this.heroes.filter((h) => !h.absent); }

  resize(w, h) {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.dpr = dpr;
  }

  onEnemyKilled(e, src) {
    this.stats.kills++;
    const left = this.enemies.filter((x) => !x.dead && x.team === 'enemy');
    if (e.boss) {
      this.cinema.slowmo(0.15, 1.6); this.cinema.letterbox(3.5); this.cinema.flash('#ffffff', 0.35); this.cinema.shake(12, 0.8);
      setTimeout(() => this.cinema.card(`${e.displayName.toUpperCase()} BESIEGT`, 'ORDEN DES WEISSEN DRACHEN · SIEG', COLORS.amber, 3), 700);
    } else if (!left.length && this.fightKind) {
      this.cinema.slowmo(0.2, 0.9); this.cinema.letterbox(2.4); this.cinema.flash('#ffffff', 0.15);
      const secs = Math.round(this.time - this.stats.fightStart);
      setTimeout(() => this.cinema.card('BEREINIGT', `${this.stats.kills} GEGNER · ${this.stats.hits} TREFFER · ${secs}s`, COLORS.cyan, 2.4, { small: true }), 450);
    }
  }

  update(realDt) {
    realDt = Math.min(realDt, 0.05);
    const dt = this.cinema.step(realDt);
    this.dt = dt;
    this.time += dt;
    Sound.update(realDt);
    if (this.hidden) { this.fade = Math.max(0, this.fade - realDt * 3); if (this.fade <= 0) return; }
    else this.fade = Math.min(1, this.fade + realDt * 2);
    if (dt <= 0) return;
    // Flächen von Kisten, Automaten …
    this.terrain.dynamic = this.items.map((i) => i.surface()).filter(Boolean);
    for (const h of this.heroes) h.update(dt);
    for (const e of this.enemies) e.update(dt);
    for (const i of this.items) i.update(dt);
    for (const p of this.projectiles) p.update(dt);
    this.screen = this.screen.filter((s) => s.update(dt, this));
    this.fx.update(dt);
    this.bubbles.update(dt);
    if (this.director) this.director.update(dt);
    this.enemies = this.enemies.filter((e) => !e.removed);
    this.items = this.items.filter((i) => !i.removed);
    this.projectiles = this.projectiles.filter((p) => !p.dead);
  }

  draw() {
    const ctx = this.ctx, T = this.terrain;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, T.W, T.H);
    if (this.fade <= 0) return;
    ctx.globalAlpha = this.fade;
    if (this.demoWindows) this.demoWindows.draw(ctx, this);
    ctx.save();
    ctx.translate(this.cinema.ox, this.cinema.oy);
    for (const s of this.screen) s.draw(ctx);
    if (this.settings.debug) this.drawDebug(ctx);
    for (const i of this.items) i.draw(ctx);
    const actors = [...this.enemies.filter((e) => !e.flying), ...this.heroes.filter((h) => !h.absent || h.alpha > 0)];
    actors.sort((a, b) => (a.dragged ? 1 : 0) - (b.dragged ? 1 : 0) || a.y - b.y);
    for (const a of actors) a.draw(ctx);
    for (const e of this.enemies) if (e.flying) e.draw(ctx);
    for (const p of this.projectiles) p.draw(ctx);
    this.fx.draw(ctx);
    this.bubbles.draw(ctx);
    this.fx.draw(ctx, 'top');
    ctx.restore();
    this.drawBossBar(ctx);
    this.cinema.drawOverlay(ctx, T.W, T.H);
    ctx.globalAlpha = 1;
  }

  drawBossBar(ctx) {
    const b = this.enemies.find((e) => e.boss && !e.dead);
    if (!b) return;
    const T = this.terrain, w = Math.min(520, T.W * 0.4), x = (T.W - w) / 2, y = 26 + this.cinema.bars * T.H * 0.075;
    ctx.save();
    ctx.fillStyle = 'rgba(7,10,18,0.85)'; ctx.fillRect(x - 8, y - 18, w + 16, 34);
    ctx.strokeStyle = b.voiceColor; ctx.lineWidth = 1; ctx.strokeRect(x - 8, y - 18, w + 16, 34);
    ctx.font = '11px Silkscreen, monospace'; ctx.fillStyle = b.voiceColor; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(b.displayName.toUpperCase(), x, y - 7);
    ctx.fillStyle = '#2a1018'; ctx.fillRect(x, y + 2, w, 8);
    ctx.fillStyle = b.voiceColor; ctx.shadowColor = b.voiceColor; ctx.shadowBlur = 8; ctx.fillRect(x, y + 2, w * (b.hp / b.maxHp), 8);
    ctx.restore();
  }

  drawDebug(ctx) {
    ctx.save();
    ctx.strokeStyle = 'rgba(0,255,120,0.8)'; ctx.lineWidth = 2;
    for (const s of this.terrain.allSurfaces()) { ctx.beginPath(); ctx.moveTo(s.x1, s.y); ctx.lineTo(s.x2, s.y); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(255,200,0,0.8)';
    for (const w of this.terrain.walls) { ctx.beginPath(); ctx.moveTo(w.x, w.y1); ctx.lineTo(w.x, w.y2); ctx.stroke(); }
    ctx.restore();
  }

  // -------------------------------------------------- Spawns
  spawnItem(kind, x, y) {
    const T = this.terrain;
    x = clamp(x ?? rnd(T.W * 0.2, T.W * 0.8), 30, T.W - 30);
    y = y ?? 40;
    const it = new Item(this, kind, x, y);
    it.leaveGround(); it.vy = 0;
    this.items.push(it);
    Sound.play('calib_lock', 0.4, 1.3);
    if (it.pickup) Sound.play('legacy_transfer', 0.25, 1.6);
    // Helden kommentieren
    const h = pick(this.presentHeroes());
    if (h && !h.task && chance(0.7)) setTimeout(() => h.say(it.pickup ? 'pickup' : 'toy', it.pickup ? kind : (it.def.kind || kind)), 600);
    return it;
  }

  spawnEnemy(type, opts = {}) {
    const T = this.terrain, u = this.u;
    const side = opts.side ?? (chance(0.5) ? -1 : 1);
    let e;
    const ground = ['punk', 'shooter', 'jackal'].includes(type);
    if (ground) {
      e = makeEnemy(this, type, side < 0 ? -50 : T.W + 50, T.floorY);
      e.noClamp = true; e.land(T.surfaces[0], 0); e.facing = -side;
      e.walkVx = -side * 120 * u;
    } else if (type === 'bot') {
      e = makeEnemy(this, type, clamp(opts.x ?? rnd(T.W * 0.15, T.W * 0.85), 60, T.W - 60), -120);
      e.leaveGround(); e.vy = 400;
      e.onLand = (imp) => { if (imp > 300) { this.cinema.shake(6, 0.25); this.fx.dust(e.x, e.y, 12, 1.4 * u); Sound.play('drive_touchdown', 0.6); } e.onLand = Enemy.prototype.onLand; };
    } else if (type === 'drone') {
      const fromTop = chance(0.3);
      e = makeEnemy(this, type, fromTop ? rnd(100, T.W - 100) : (side < 0 ? -80 : T.W + 80), fromTop ? -60 : rnd(100, T.floorY * 0.5));
      e.vx = -side * 200;
    } else if (type === 'virus' || type === 'bigvirus') {
      e = makeEnemy(this, type, opts.x ?? rnd(100, T.W - 100), opts.y ?? rnd(120, T.floorY * 0.6));
      e.noClamp = false;
      this.fx.pixels(e.x, e.y, [COLORS.violet, COLORS.magenta], 12, 200, { g: 0 });
    } else if (type === 'ice') {
      e = makeEnemy(this, type, opts.x ?? T.W / 2, opts.y ?? T.floorY * 0.35);
      e.noClamp = false;
    }
    if (!e) return null;
    this.enemies.push(e);
    return e;
  }

  clearAll() {
    for (const e of this.enemies) if (!e.dead) { this.fx.pixels(e.x, e.y - e.h / 2, [COLORS.cyan, '#fff'], 10, 200, { g: 0 }); e.removed = true; }
    for (const i of this.items) { i.removed = true; }
    this.projectiles = [];
    this.screen.forEach((s) => { if (s instanceof ScreenHole) { s.state = 'patched'; s.patchedAt = 45; } if (s instanceof GlitchTear) s.closing = true; });
  }
}
