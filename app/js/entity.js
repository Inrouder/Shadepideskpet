// Grundklasse aller Figuren/Gegenstände + Schaden + Projektile.
'use strict';

let _nextId = 1;
const GRAVITY = 2300;

class Entity {
  constructor(world, x, y) {
    this.world = world;
    this.id = _nextId++;
    this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.w = 40; this.h = 80;
    this.facing = 1;
    this.ground = null; this.wid = null; this.winRef = null;
    this.team = 'neutral';
    this.hp = 10; this.maxHp = 10;
    this.dead = false; this.removed = false;
    this.flying = false;
    this.dragged = false;
    this.flash = 0; this.stun = 0; this.invuln = 0;
    this.gravity = 1;
    this.friction = 10;
    this.walkVx = 0;          // gewünschte Laufgeschwindigkeit (KI)
    this.edgeStop = true;     // an Kanten stehen bleiben statt fallen
    this.mass = 1;
    this.airTime = 0;
    this.thrown = false;
    this.layer = 1;
  }

  get grounded() { return !!this.ground; }
  bounds() { return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h }; }
  center() { return { x: this.x, y: this.y - this.h / 2 }; }
  hitTest(px, py) { const b = this.bounds(); return px >= b.x - 6 && px <= b.x + b.w + 6 && py >= b.y - 6 && py <= b.y + b.h + 4; }

  anchorOf(wid) {
    if (!wid || wid === 'floor') return null;
    const w = this.world.terrain.byId.get(wid);
    return w ? { x: w.x, y: w.y } : null;
  }

  leaveGround() { this.ground = null; this.wid = null; this.winRef = null; }

  land(s, impact) {
    this.ground = s; this.wid = s.wid; this.y = s.y; this.vy = 0;
    this.winRef = this.anchorOf(s.wid);
    const air = this.airTime;
    this.airTime = 0;
    this.onLand(impact, air);
  }
  onLand() {}

  physics(dt) {
    const T = this.world.terrain;
    if (this.dragged || this.flying) return;
    if (this.ground) {
      // mit dem Fenster mitfahren
      if (this.wid && this.wid !== 'floor') {
        const a = this.anchorOf(this.wid);
        if (a && this.winRef) {
          const dx = a.x - this.winRef.x, dy = a.y - this.winRef.y;
          this.x += dx; this.winRef = a;
          // Fenster ruckartig bewegt → herunterfallen
          if (this.onWindowJolt && Math.hypot(dx, dy) > 45 && this.onWindowJolt(dx, dy)) return;
        }
      }
      const s = this.wid === 'floor' ? T.surfaces[0] : T.surfaceOf(this.wid, this.x, 1);
      if (!s) { this.leaveGround(); }
      else {
        this.ground = s; this.y = s.y;
        const target = this.stun > 0 ? 0 : this.walkVx;
        if (Math.abs(this.vx - target) > 0.01) {
          const k = this.walkVx !== 0 && this.stun <= 0 ? 14 : this.friction;
          this.vx += (target - this.vx) * Math.min(1, k * dt);
        }
        let nx = this.x + this.vx * dt;
        if (nx < s.x1 || nx > s.x2) {
          if (this.edgeStop && !this.thrown && this.wid !== 'floor' && Math.abs(this.vx) < 500) { nx = clamp(nx, s.x1, s.x2); this.vx = 0; this.onEdge && this.onEdge(); }
          else if (this.wid === 'floor') { if (!this.noClamp) { nx = clamp(nx, s.x1 + this.w / 2, s.x2 - this.w / 2); this.vx = -this.vx * 0.3; } }
          else this.leaveGround();
        }
        this.x = nx;
        if (Math.abs(this.vx) < 30 && this.thrown) this.thrown = false;
      }
    }
    if (!this.ground) {
      this.airTime += dt;
      this.vy += GRAVITY * this.gravity * dt;
      if (this.vy > 2200) this.vy = 2200;
      const y0 = this.y;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (this.vy > 0) {
        const s = T.landing(this.x, y0, this.y, this.ignoreSurface);
        if (s) { const imp = this.vy; this.land(s, imp); }
      }
      if (this.y > T.floorY + 2 && !this.ground) this.land(T.surfaces[0], this.vy);
    }
    // Bildschirmränder
    const W = T.W;
    if (this.noClamp) return;
    if (this.x < this.w / 2) { this.x = this.w / 2; if (this.vx < 0) this.vx = -this.vx * 0.5; this.onWall && this.onWall(-1); }
    if (this.x > W - this.w / 2) { this.x = W - this.w / 2; if (this.vx > 0) this.vx = -this.vx * 0.5; this.onWall && this.onWall(1); }
    if (this.y - this.h < 0 && this.vy < 0) { this.y = this.h; this.vy = -this.vy * 0.3; }
  }

  tickTimers(dt) {
    this.flash = Math.max(0, this.flash - dt);
    this.stun = Math.max(0, this.stun - dt);
    this.invuln = Math.max(0, this.invuln - dt);
  }

  update(dt) { this.tickTimers(dt); this.physics(dt); }
  draw() {}
  drawShadow(ctx, r = 22) {
    if (!this.ground && !this.climbing) {
      const below = this.world.terrain.below(this.x, this.y);
      const d = below.y - this.y;
      if (d > 400) return;
      ctx.save(); ctx.globalAlpha = 0.25 * (1 - d / 400); ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(this.x, below.y, r * (1 - d / 800), r * 0.25, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      return;
    }
    if (this.climbing) return;
    ctx.save(); ctx.globalAlpha = 0.32; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(this.x, this.y, r, r * 0.22, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }

  // Wurf durch den Nutzer
  release(vx, vy) {
    this.dragged = false;
    this.vx = clamp(vx, -2400, 2400);
    this.vy = clamp(vy, -2400, 2400);
    this.leaveGround();
    this.thrown = Math.hypot(vx, vy) > 500;
  }
}

// ------------------------------------------------------------ Schaden
function damage(world, target, amount, src, opts = {}) {
  if (!target || target.dead || target.invuln > 0) return false;
  if (target.onBeforeHit && target.onBeforeHit(amount, src, opts) === false) return false;
  const mult = src && src.dmgMult ? src.dmgMult : 1;
  amount = Math.max(1, Math.round(amount * mult));
  target.hp -= amount;
  target.flash = 0.12;
  target.stun = Math.max(target.stun, opts.stun ?? 0.22);
  const dir = opts.dir ?? (src ? sign(target.x - src.x) : 1);
  const knock = (opts.knock ?? 220) / (target.mass || 1);
  if (!target.flying) {
    target.vx = dir * knock;
    if (opts.up) { target.vy = -opts.up / (target.mass || 1); target.leaveGround(); }
  } else {
    target.vx += dir * knock; target.vy += -(opts.up || 60);
  }
  const c = target.center();
  const col = target.team === 'hero' ? COLORS.warn : (opts.color || COLORS.white);
  world.fx.number(c.x, c.y - target.h * 0.3, amount, col, amount >= 8);
  if (opts.sparks !== false) world.fx.sparks(c.x, c.y, opts.color || COLORS.white, 8, 300);
  if (target.team !== 'hero') world.stats.hits++;
  target.onHurt && target.onHurt(amount, src, opts);
  if (target.hp <= 0 && !target.dead) {
    target.hp = 0;
    target.die(src, opts);
  }
  return true;
}

function enemiesOf(world, team) {
  if (team === 'enemy') return world.heroes.filter((h) => !h.ko && !h.absent).concat(world.enemies.filter((e) => e.team === 'ally' && !e.dead));
  return world.enemies.filter((e) => !e.dead && e.team === 'enemy');
}

// ------------------------------------------------------------ Projektile
class Projectile {
  constructor(world, o) {
    Object.assign(this, { r: 6, dmg: 3, life: 2.2, g: 0, pierce: 0, t: 0, hitSet: new Set(), knock: 160 }, o);
    this.world = world;
    this.dead = false;
  }
  update(dt) {
    const W = this.world;
    this.t += dt;
    this.vy += this.g * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.kind === 'shuriken' || this.kind === 'emp') this.rot = (this.rot || 0) + dt * 22;
    if (this.t > this.life || this.x < -80 || this.x > W.terrain.W + 80 || this.y > W.terrain.floorY + 10 || this.y < -200) {
      if (this.kind === 'emp') this.explode();
      this.dead = true; return;
    }
    if (this.trail && chance(dt * 40)) W.fx.add({ type: 'pixel', x: this.x, y: this.y, vx: 0, vy: 0, g: 0, life: 0.3, color: this.color, size: 2 });
    // Treffer
    for (const t of enemiesOf(W, this.team)) {
      if (this.hitSet.has(t)) continue;
      const b = t.bounds();
      if (this.x + this.r > b.x && this.x - this.r < b.x + b.w && this.y + this.r > b.y && this.y - this.r < b.y + b.h) {
        if (t.deflect && t.deflect(this)) return;
        if (this.kind === 'emp') { this.explode(); this.dead = true; return; }
        damage(W, t, this.dmg, this.owner, { dir: sign(this.vx), knock: this.knock, color: this.color, stun: this.stun });
        this.hitSet.add(t);
        if (this.onHit) this.onHit(t);
        if (this.pierce-- <= 0) { this.dead = true; W.fx.sparks(this.x, this.y, this.color, 6, 220); return; }
      }
    }
    // Gegenstände (Fässer etc.)
    for (const it of W.items) {
      if (it.dead || !it.breakable || this.hitSet.has(it)) continue;
      if (it.hitTest(this.x, this.y)) { this.hitSet.add(it); it.hit(this.dmg, this.owner, sign(this.vx)); if (this.pierce-- <= 0) { this.dead = true; return; } }
    }
  }
  explode() {
    const W = this.world;
    W.fx.add({ type: 'shockwave', x: this.x, y: this.y, r: 190, life: 0.5, color: COLORS.cyan });
    W.fx.ring(this.x, this.y, COLORS.cyanHot, 160, 0.4, 5);
    W.fx.sparks(this.x, this.y, COLORS.cyan, 24, 500);
    W.cinema.shake(7, 0.3); W.cinema.flash('#62e3ee', 0.18);
    Sound.play('electric', 1); Sound.play('prop_blast', 0.6);
    for (const e of enemiesOf(W, this.team)) {
      if (dist(e.x, e.y - e.h / 2, this.x, this.y) < 190) damage(W, e, e.flying ? 9 : 5, this.owner, { dir: sign(e.x - this.x), knock: 300, up: 200, color: COLORS.cyan, stun: 1.6 });
    }
  }
  draw(ctx) {
    ctx.save();
    switch (this.kind) {
      case 'bolt': { // Ravens Impulspistole
        const a = Math.atan2(this.vy, this.vx);
        ctx.translate(this.x, this.y); ctx.rotate(a);
        ctx.shadowColor = COLORS.cyan; ctx.shadowBlur = 14;
        ctx.fillStyle = COLORS.cyan; ctx.fillRect(-16 * (this.big ? 1.8 : 1), -2.5 * (this.big ? 2 : 1), 22 * (this.big ? 1.8 : 1), 5 * (this.big ? 2 : 1));
        ctx.fillStyle = '#fff'; ctx.fillRect(-8, -1, 14, 2);
        break;
      }
      case 'bullet': case 'botshot': {
        const a = Math.atan2(this.vy, this.vx);
        ctx.translate(this.x, this.y); ctx.rotate(a);
        if (IMG.bullet) { ctx.drawImage(IMG.bullet, 0, 0, 192, 48, -24, -6, 48, 12); }
        if (this.kind === 'botshot') { ctx.shadowColor = COLORS.amber; ctx.shadowBlur = 12; ctx.fillStyle = COLORS.amber; ctx.beginPath(); ctx.arc(10, 0, 5, 0, 7); ctx.fill(); }
        break;
      }
      case 'laser': {
        const a = Math.atan2(this.vy, this.vx);
        ctx.translate(this.x, this.y); ctx.rotate(a);
        ctx.shadowColor = COLORS.red; ctx.shadowBlur = 12; ctx.fillStyle = COLORS.red; ctx.fillRect(-18, -2, 30, 4);
        ctx.fillStyle = '#ffd0d8'; ctx.fillRect(-10, -1, 18, 2);
        break;
      }
      case 'shuriken': {
        ctx.translate(this.x, this.y); ctx.rotate(this.rot || 0);
        ctx.fillStyle = '#c9ccd3'; ctx.strokeStyle = '#2a2f38'; ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) { const r = i % 2 ? 3 : 10; const a = (i / 8) * Math.PI * 2; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ff3150'; ctx.fillRect(-1.5, -1.5, 3, 3);
        break;
      }
      case 'wave': { // Drachenklinge
        ctx.translate(this.x, this.y); ctx.scale(sign(this.vx), 1);
        ctx.globalAlpha = Math.min(1, (this.life - this.t) * 3);
        ctx.shadowColor = COLORS.red; ctx.shadowBlur = 20; ctx.strokeStyle = COLORS.red; ctx.lineWidth = 6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(-20, 0, 34, -1.1, 1.1); ctx.stroke();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
        break;
      }
      case 'emp': {
        ctx.translate(this.x, this.y); ctx.rotate(this.rot || 0);
        drawEmpIcon(ctx, 0.9);
        break;
      }
      case 'orb': { // Virus-/ICE-Geschoss
        ctx.shadowColor = this.color; ctx.shadowBlur = 16; ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(this.x, this.y, this.r * 0.4, 0, Math.PI * 2); ctx.fill();
        break;
      }
    }
    ctx.restore();
  }
}

function drawEmpIcon(ctx, s = 1) {
  ctx.save(); ctx.scale(s, s);
  ctx.fillStyle = '#1b222d'; ctx.strokeStyle = '#3d4a5c'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.shadowColor = COLORS.cyan; ctx.shadowBlur = 10; ctx.fillStyle = COLORS.cyan;
  ctx.fillRect(-6, -1.5, 12, 3); ctx.fillRect(-1.5, -6, 3, 12);
  ctx.restore();
}
