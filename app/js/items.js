// Spielzeug, Requisiten und Waffen/Power-ups.
'use strict';

const ITEM_DEF = {
  // Requisiten aus dem Spiel
  crate: { label: 'Kiste', img: 'crate', height: 52, hp: 6, breakable: true, solid: true, toy: true, friction: 14, sound: 'prop_wood' },
  barrel: { label: 'Explosives Fass', img: 'barrel', height: 58, hp: 3, breakable: true, solid: true, toy: true, friction: 12, sound: 'prop_metal', explosive: true },
  holocube: { label: 'Holowürfel', img: 'holocube', height: 50, hp: 999, toy: true, bounce: 0.45, friction: 6, sound: 'prop_hit', kind: 'cube' },
  vending: { label: 'Snackautomat', img: 'vending', height: 104, hp: 12, breakable: true, solid: true, toy: true, friction: 20, sound: 'prop_metal', mass: 4 },
  server: { label: 'Server', img: 'server', height: 108, hp: 14, breakable: true, solid: true, toy: true, friction: 20, sound: 'prop_metal', mass: 4 },
  fusebox: { label: 'Sicherungskasten', img: 'fusebox', height: 74, hp: 10, breakable: true, solid: true, toy: true, friction: 20, sound: 'prop_metal', mass: 3 },
  ball: { label: 'Neon-Ball', proc: true, size: 26, hp: 999, toy: true, bounce: 0.72, friction: 2.5, sound: 'drive_knock' },
  // Power-ups
  core: { label: 'Heiligtums-Kern', proc: true, size: 22, pickup: true, desc: 'Doppelter Schaden, weiße Aura' },
  blade: { label: 'Drachenklinge', proc: true, size: 34, pickup: true, forHero: 'shadepi', desc: 'Schwertwellen' },
  shuriken: { label: 'Wurfsterne', proc: true, size: 22, pickup: true, forHero: 'shadepi', desc: '3er-Würfe' },
  overclock: { label: 'Overclock-Chip', proc: true, size: 22, pickup: true, forHero: 'raven', desc: 'Schnellfeuer' },
  emp: { label: 'EMP-Granate', proc: true, size: 20, pickup: true, desc: 'Schockwelle gegen Technik' },
  medkit: { label: 'Nanitenpaket', proc: true, size: 24, pickup: true, desc: 'Heilt' },
  can: { label: 'Neon-Limo', proc: true, size: 14, pickup: true, desc: 'Ein Schluck' },
};

class Item extends Entity {
  constructor(world, kind, x, y) {
    super(world, x, y);
    const d = ITEM_DEF[kind];
    this.kind = kind; this.def = d;
    this.team = 'item';
    this.breakable = !!d.breakable; this.toy = !!d.toy; this.pickup = !!d.pickup; this.forHero = d.forHero || null;
    this.maxHp = this.hp = d.hp || 1;
    this.mass = d.mass || 1;
    this.friction = d.friction || 8;
    this.edgeStop = false;
    this.spinA = 0; this.spinV = 0;
    this.state = 'intact'; this.brokenT = 0;
    this.age = 0;
    this.ignoreSurface = 'item:' + this.id;
    this.seen = false;
    const u = world.u;
    if (d.img) {
      const im = IMG[d.img + '-intact'];
      this.scale = (d.height * u) / (im ? im.height : 100);
      this.w = (im ? im.width : 60) * this.scale * 0.86; this.h = d.height * u * 0.92;
    } else { this.w = this.h = d.size * u; }
    this.materialize = 0.6;
  }
  get u() { return this.world.u; }

  surface() {
    if (!this.def.solid || this.state === 'broken' || this.dead || this.dragged || !this.ground) return null;
    return { id: 'item:' + this.id, wid: 'item:' + this.id, x1: this.x - this.w * 0.42, x2: this.x + this.w * 0.42, y: this.y - this.h };
  }

  kick(vx, vy, by) {
    this.leaveGround();
    this.vx = vx / this.mass; this.vy = vy / this.mass;
    this.spinV = vx * 0.02;
    Sound.play(this.def.sound || 'prop_hit', 0.5, rnd(0.9, 1.2));
    this.world.fx.sparks(this.x, this.y - this.h / 2, this.kind === 'ball' ? COLORS.cyan : COLORS.white, 5, 200);
    if (this.kind === 'holocube' || this.kind === 'ball') this.lastKick = by;
  }

  hit(dmg, src, dir = 1) {
    if (this.dead) return;
    const W = this.world;
    if (!this.breakable || this.state === 'broken') { if (this.toy) this.kick(dir * 300 * this.u, -260 * this.u, src); return; }
    this.hp -= dmg;
    this.flash = 0.1;
    Sound.play(this.def.sound || 'prop_hit', 0.5, rnd(0.9, 1.1));
    W.fx.pixels(this.x, this.y - this.h / 2, this.kind === 'crate' ? ['#8a5a2b', '#5c3a1a', '#b98a4a'] : ['#555c66', '#9aa0a8', '#2a3342'], 6, 200, { g: 900, size: 4 });
    if (this.kind === 'vending' && chance(0.6)) this.dropCan();
    if (this.hp <= this.maxHp / 2 && this.state === 'intact') this.state = 'damaged';
    if (this.hp <= 0) this.smash(src);
  }
  smash(src) {
    const W = this.world;
    if (this.def.explosive) { this.explode(); return; }
    this.state = 'broken';
    this.brokenT = 0;
    Sound.play('prop_blast', 0.5);
    W.fx.dust(this.x, this.y, 8, this.u);
    W.cinema.shake(3, 0.15);
    if (this.kind === 'vending') for (let i = 0; i < 4; i++) this.dropCan();
    if (this.kind === 'server' || this.kind === 'fusebox') W.fx.sparks(this.x, this.y - this.h / 2, COLORS.cyan, 20, 400);
  }
  explode() {
    const W = this.world, u = this.u;
    this.dead = true; this.removed = true;
    W.fx.explosion(this.x, this.y - this.h / 2, 1.1 * u);
    W.fx.fire(this.x, this.y, 2.2, 0.45 * u);
    Sound.play('drive_explosion', 0.8);
    W.cinema.shake(10, 0.4); W.cinema.flash('#ffb43a', 0.2);
    const r = 150 * u;
    for (const e of W.enemies) if (!e.dead && e.team === 'enemy' && dist(e.x, e.y - e.h / 2, this.x, this.y - this.h / 2) < r) damage(W, e, 10, null, { dir: sign(e.x - this.x), knock: 600, up: 420, color: COLORS.amber });
    for (const h of W.heroes) if (!h.absent && !h.ko && dist(h.x, h.y - h.h / 2, this.x, this.y - this.h / 2) < r * 0.8) damage(W, h, 6, null, { dir: sign(h.x - this.x), knock: 500, up: 400 });
    for (const it of W.items) if (it !== this && !it.dead && dist(it.x, it.y, this.x, this.y) < r) { if (it.def.explosive) setTimeout(() => !it.dead && it.explode(), 180); else it.kick(sign(it.x - this.x) * 600 * u, -500 * u); }
  }
  dropCan() {
    const W = this.world;
    const c = new Item(W, 'can', this.x + rnd(-10, 10), this.y - this.h * 0.3);
    c.materialize = 0;
    c.leaveGround(); c.vx = rnd(-220, 220); c.vy = -rnd(200, 420);
    W.items.push(c);
  }
  hacked(by) {
    const W = this.world;
    W.fx.sparks(this.x, this.y - this.h / 2, COLORS.cyan, 14, 300);
    if (this.kind === 'vending') { for (let i = 0; i < 2; i++) this.dropCan(); by.talk('Kostenlos. Für mich.', true); }
    else if (this.kind === 'server') { W.fx.label(this.x, this.y - this.h - 10, 'ZUGRIFF', COLORS.cyan, 16, 1.4); by.talk(pick(['Interessante Daten…', 'Root-Zugriff. Zu einfach.']), true); }
    else if (this.kind === 'fusebox') { W.fx.lightning(this.x, this.y - this.h, this.x + rnd(-120, 120), this.y - this.h - 120, COLORS.cyan, 0.3); by.talk('Strom umgeleitet. Shadepi, nicht anfassen!', true); }
  }

  collect(hero) {
    if (this.dead) return;
    const W = this.world, k = this.kind;
    this.dead = true; this.removed = true;
    Sound.play('calib_accept', 0.5, 1.2);
    W.fx.ring(this.x, this.y - 12, COLORS.cyan, 40, 0.3, 2);
    let label = ITEM_DEF[k].label.toUpperCase();
    switch (k) {
      case 'core': hero.buffs.core = 25; W.fx.ring(hero.x, hero.y - 40 * hero.u, '#ffffff', 110 * hero.u, 0.6, 5); Sound.play('legacy_aura', 0.6); W.cinema.flash('#ffffff', 0.18); break;
      case 'blade': hero.buffs.blade = 25; break;
      case 'overclock': hero.buffs.overclock = 18; break;
      case 'shuriken': hero.inventory.shuriken += 4; break;
      case 'emp': hero.inventory.emp += 1; break;
      case 'medkit': hero.hp = hero.maxHp; W.fx.nanites(hero, 20); label = '+ HEILUNG'; break;
      case 'can': hero.hp = Math.min(hero.maxHp, hero.hp + 10); label = '+10'; hero.talk(hero.name === 'raven' ? pick(['Mmh, Neon-Limo.', 'Zuckerschock!']) : pick(['Zu süß.', 'Hm. Erfrischend.']), true); break;
    }
    W.fx.label(hero.x, hero.y - 110 * hero.u, label, hero.voiceColor, 16, 1.3);
    if (LINES[hero.name].pickup[k]) hero.say('pickup', k, true);
  }

  onLand(impact) {
    const d = this.def;
    if (this.thrown && d.explosive && impact > 1300) { this.explode(); return; }
    if (d.bounce && impact > 260) { this.vy = -impact * d.bounce; this.leaveGround(); Sound.play(d.sound || 'prop_hit', clamp(impact / 2500, 0.1, 0.5), 1.3); }
    else if (impact > 500) { Sound.play(d.sound || 'prop_hit', clamp(impact / 3000, 0.1, 0.5)); this.world.fx.dust(this.x, this.y, 3, this.u); }
    if (this.thrown && this.breakable && impact > 1400) this.hit(3, null, sign(this.vx));
    this.thrown = false;
  }

  release(vx, vy) { super.release(vx / Math.sqrt(this.mass), vy / Math.sqrt(this.mass)); this.spinV = vx * 0.01; }

  update(dt) {
    this.tickTimers(dt);
    this.age += dt;
    this.materialize = Math.max(0, this.materialize - dt);
    if (this.dragged) return;
    if (this.state === 'broken') { this.brokenT += dt; if (this.brokenT > 18) { this.dead = true; this.removed = true; } }
    if (this.pickup && this.age > 120) { this.dead = true; this.removed = true; }
    this.physics(dt);
    if (this.ground) this.spinV *= Math.pow(0.02, dt); else this.spinV *= Math.pow(0.6, dt);
    if (this.ground && (this.kind === 'ball' || this.kind === 'holocube')) this.spinV = this.vx * 0.03;
    this.spinA += this.spinV * dt;
    // Wand-Abpraller für Bälle
    if (this.def.bounce && (this.x <= this.w / 2 + 1 || this.x >= this.world.terrain.W - this.w / 2 - 1)) this.vx = -this.vx;
    // Fliegende Gegenstände treffen Gegner
    if (!this.ground && Math.hypot(this.vx, this.vy) > 650) {
      for (const e of this.world.enemies) if (!e.dead && e.team === 'enemy' && rectsOverlap(this.bounds(), e.bounds()) && this.lastHit !== e) {
        this.lastHit = e;
        damage(this.world, e, this.mass > 2 ? 8 : 4, null, { dir: sign(this.vx), knock: 400, up: 200 });
        this.vx *= -0.4; Sound.play('hit', 0.7); this.world.cinema.stop(0.05);
      }
    } else this.lastHit = null;
    // Sicherungskasten zwickt Shadepi
    if (this.kind === 'fusebox' && this.state !== 'broken' && chance(dt * 0.5)) {
      const s = this.world.heroes.find((h) => h.name === 'shadepi' && !h.absent && Math.abs(h.x - this.x) < 40 * this.u && Math.abs(h.y - this.y) < 10);
      if (s) { this.world.fx.lightning(this.x, this.y - this.h * 0.7, s.x, s.y - 50 * this.u, COLORS.cyan, 0.2); s.flash = 0.1; s.talk('Bzzt. …Raven!', true); Sound.play('electric', 0.4); }
    }
  }

  draw(ctx) {
    const u = this.u, d = this.def;
    ctx.save();
    if (this.state === 'broken') ctx.globalAlpha = Math.min(1, (18 - this.brokenT) / 2);
    if (this.materialize > 0) {
      const k = this.materialize / 0.6;
      ctx.save();
      const g = ctx.createLinearGradient(this.x, 0, this.x, this.y);
      g.addColorStop(0, 'rgba(98,227,238,0)'); g.addColorStop(1, `rgba(98,227,238,${0.35 * k})`);
      ctx.fillStyle = g; ctx.fillRect(this.x - this.w * 0.6, this.y - 400, this.w * 1.2, 400);
      ctx.restore();
      ctx.globalAlpha *= 1 - k * 0.7;
    }
    if (!this.pickup) this.drawShadow(ctx, this.w * 0.45);
    if (d.img) {
      const im = IMG[d.img + '-' + this.state] || IMG[d.img + '-intact'];
      if (im) {
        const glow = this.kind === 'holocube' ? 0.15 + 0.1 * Math.sin(this.age * 3) : 0;
        if (glow) { ctx.save(); ctx.globalAlpha *= glow; ctx.fillStyle = COLORS.violet; ctx.shadowColor = COLORS.violet; ctx.shadowBlur = 30; ctx.beginPath(); ctx.ellipse(this.x, this.y - this.h / 2, this.w * 0.5, this.h * 0.5, 0, 0, 7); ctx.fill(); ctx.restore(); }
        const sc = this.state === 'broken' ? this.scale * 0.95 : this.scale;
        drawRegion(ctx, im, 0, 0, im.width, im.height, im.width / 2, im.height * 0.97, this.x, this.y, sc, { flash: this.flash > 0 ? 0.6 : 0, rot: this.ground ? 0 : this.spinA * 0.2, pivotY: this.h / 2 });
      }
    } else {
      const bob = this.pickup && this.ground ? Math.sin(this.age * 3) * 3 - 6 * u : 0;
      ctx.translate(this.x, this.y - this.h / 2 + bob);
      drawProcItem(ctx, this.kind, this.w, this.age, this.spinA, this.flash);
    }
    ctx.restore();
  }
}

function drawProcItem(ctx, kind, size, age, spin, flash) {
  const r = size / 2;
  ctx.save();
  switch (kind) {
    case 'ball': {
      const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 2, 0, 0, r);
      g.addColorStop(0, '#3a4456'); g.addColorStop(1, '#0b0f17');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
      ctx.rotate(spin);
      ctx.strokeStyle = COLORS.cyan; ctx.shadowColor = COLORS.cyan; ctx.shadowBlur = 10; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 0, r * 0.95, r * 0.35, 0, 0, 7); ctx.stroke();
      ctx.strokeStyle = COLORS.magenta; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.35, r * 0.95, 0, 0, 7); ctx.stroke();
      break;
    }
    case 'core': {
      const p = 1 + Math.sin(age * 5) * 0.08;
      const g = ctx.createRadialGradient(0, 0, 1, 0, 0, r * 2.2);
      g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.35, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 2.2, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.shadowColor = '#fff'; ctx.shadowBlur = 16; ctx.beginPath(); ctx.arc(0, 0, r * 0.45 * p, 0, 7); ctx.fill();
      for (let i = 0; i < 8; i++) { const a = age * 2 + i; ctx.fillRect(Math.cos(a) * r * 1.1, Math.sin(a * 1.3) * r * 0.9, 2, 2); }
      break;
    }
    case 'blade': {
      ctx.rotate(-0.7);
      ctx.fillStyle = '#1b1b22'; ctx.fillRect(-r, -2, r * 0.55, 4);
      ctx.fillStyle = '#7a1520'; ctx.fillRect(-r * 0.45, -3.5, 3, 7);
      ctx.shadowColor = COLORS.red; ctx.shadowBlur = 14; ctx.fillStyle = COLORS.red; ctx.fillRect(-r * 0.4, -1.5, r * 1.35, 3);
      ctx.fillStyle = '#ffd0d8'; ctx.fillRect(-r * 0.4, -0.5, r * 1.3, 1);
      break;
    }
    case 'shuriken': {
      ctx.rotate(age * 2);
      for (const off of [-5, 5]) {
        ctx.save(); ctx.translate(off, off * 0.4);
        ctx.fillStyle = '#c9ccd3'; ctx.beginPath();
        for (let i = 0; i < 8; i++) { const rr = i % 2 ? 2.5 : 8; const a = (i / 8) * Math.PI * 2; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
        ctx.closePath(); ctx.fill(); ctx.restore();
      }
      break;
    }
    case 'overclock': {
      ctx.shadowColor = COLORS.cyan; ctx.shadowBlur = 12;
      ctx.fillStyle = '#0d1b17'; ctx.fillRect(-r * 0.8, -r * 0.6, r * 1.6, r * 1.2);
      ctx.strokeStyle = COLORS.cyan; ctx.lineWidth = 1.5; ctx.strokeRect(-r * 0.8, -r * 0.6, r * 1.6, r * 1.2);
      ctx.fillStyle = '#9aa0a8'; for (let i = -2; i <= 2; i++) { ctx.fillRect(i * 4 - 1, -r * 0.6 - 3, 2, 3); ctx.fillRect(i * 4 - 1, r * 0.6, 2, 3); }
      ctx.fillStyle = COLORS.cyan; ctx.font = '9px Silkscreen'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('OC', 0, 1);
      break;
    }
    case 'emp': drawEmpIcon(ctx, size / 20); break;
    case 'medkit': {
      ctx.fillStyle = '#e9e2cf'; ctx.fillRect(-r * 0.85, -r * 0.6, r * 1.7, r * 1.2);
      ctx.fillStyle = '#2a3342'; ctx.fillRect(-r * 0.85, -r * 0.6, r * 1.7, 3);
      ctx.shadowColor = COLORS.cyan; ctx.shadowBlur = 10; ctx.fillStyle = COLORS.cyan;
      ctx.fillRect(-2, -r * 0.4, 4, r * 0.8); ctx.fillRect(-r * 0.4, -2, r * 0.8, 4);
      break;
    }
    case 'can': {
      ctx.rotate(spin * 0.3);
      ctx.fillStyle = '#ff7fc0'; ctx.fillRect(-r * 0.5, -r, r, r * 2);
      ctx.fillStyle = '#c8cdd4'; ctx.fillRect(-r * 0.5, -r, r, 2); ctx.fillRect(-r * 0.5, r - 2, r, 2);
      ctx.fillStyle = '#070a12'; ctx.fillRect(-r * 0.5, -r * 0.2, r, r * 0.4);
      break;
    }
  }
  if (flash > 0) { ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(-r * 2, -r * 2, r * 4, r * 4); }
  ctx.restore();
}
