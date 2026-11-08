// Gegner: Cyberpunks, Schützen, Chrome Jackal, Kampfbots, Drohnen,
// Datenviren und der ICE-Wächter.
'use strict';

class Enemy extends Entity {
  constructor(world, x, y, o = {}) {
    super(world, x, y);
    this.team = 'enemy';
    this.kind = o.kind || 'enemy';
    this.maxHp = this.hp = o.hp || 6;
    this.dyingT = 0;
    this.attackCd = rnd(0.8, 1.6);
    this.target = null;
    this.anim = 'idle'; this.animT = 0;
    this.edgeStop = true;
    this.boss = !!o.boss;
    this.displayName = o.name || '';
    this.voiceColor = o.color || COLORS.warn;
    this.lastTalk = -5;
    this.life = 0;
  }
  get u() { return this.world.u; }
  get S() { return this.world.settings.size; }
  talk(text, force) {
    if (!text || (!force && this.world.time - this.lastTalk < 4)) return;
    this.lastTalk = this.world.time;
    this.world.bubbles.say(this, text);
  }
  findTarget() {
    const list = enemiesOf(this.world, this.team);
    if (!list.length) return null;
    let best = null, bd = 1e9;
    for (const t of list) {
      let d = Math.abs(t.x - this.x) + Math.abs(t.y - this.y);
      if (!this.flying && t.wid && t.wid !== this.wid) d += 400;
      if (d < bd) { bd = d; best = t; }
    }
    return best;
  }
  die(src) {
    this.dead = true;
    this.dyingT = 0;
    this.world.onEnemyKilled(this, src);
    Sound.play(pick(['enemy_death_0', 'enemy_death_1', 'enemy_death_2']), 0.6);
  }
  onHurt() {
    if (this.kind === 'punk' && chance(0.2)) this.talk(pick(LINES.enemy.punkHurt));
  }
  updateEntering() {
    if (this.noClamp && this.x > 40 && this.x < this.world.terrain.W - 40) this.noClamp = false;
  }
  update(dt) {
    this.tickTimers(dt);
    this.life += dt;
    this.animT += dt;
    if (this.dead) {
      this.dyingT += dt;
      this.walkVx = 0;
      if (!this.flying) this.physics(dt);
      if (this.dyingT > 0.7) this.removed = true;
      return;
    }
    if (this.dragged) return;
    this.updateEntering();
    this.attackCd -= dt;
    if (!this.target || this.target.ko || this.target.absent || this.target.dead || chance(dt * 0.5)) this.target = this.findTarget();
    if (this.stun <= 0) this.ai(dt); else this.walkVx = 0;
    this.physics(dt);
    // Geworfene Gegner treffen andere
    if (this.thrown && !this.ground) {
      for (const e of this.world.enemies) {
        if (e === this || e.dead || e.team !== 'enemy') continue;
        if (rectsOverlap(this.bounds(), e.bounds())) { damage(this.world, e, 4, null, { dir: sign(this.vx), knock: 400, up: 150 }); damage(this.world, this, 3, null, { dir: -sign(this.vx), knock: 100 }); this.thrown = false; Sound.play('hit', 0.8); this.world.cinema.stop(0.06); }
      }
    }
  }
  onLand(impact) {
    if (impact > 1100 && this.thrownByUser) { damage(this.world, this, 3, null, { knock: 0 }); this.world.fx.dust(this.x, this.y, 8, this.u); Sound.play('drive_knock', 0.6); }
    this.thrownByUser = false;
  }
  release(vx, vy) { super.release(vx, vy); this.thrownByUser = true; this.stun = 0.8; }
  ai() {}
  drawHp(ctx) {
    if (this.boss || this.hp >= this.maxHp || this.dead) return;
    const w = 36 * this.u, x = this.x - w / 2, y = this.y - this.h - 12 * this.u;
    ctx.fillStyle = 'rgba(7,10,18,0.8)'; ctx.fillRect(x - 1, y - 1, w + 2, 5);
    ctx.fillStyle = this.team === 'ally' ? COLORS.cyan : COLORS.warn; ctx.fillRect(x, y, w * (this.hp / this.maxHp), 3);
  }
  deathAlpha() { return this.dead ? Math.max(0, 1 - this.dyingT / 0.7) : 1; }
}

// ------------------------------------------------------------ Bodengegner mit Heldenatlas
class StreetEnemy extends Enemy {
  constructor(world, x, y, o) {
    super(world, x, y, o);
    this.sprite = o.sprite;
    this.ranged = !!o.ranged;
    this.scaleMul = o.scaleMul || 1;
    this.speed = (o.speed || 120);
    this.dmg = o.dmg || 5;
    this.w = 34 * this.u * this.scaleMul; this.h = 86 * this.u * this.scaleMul;
    this.mass = o.mass || 1;
    this.dashT = 0; this.windup = 0;
  }
  ai(dt) {
    const W = this.world, u = this.u, t = this.target;
    if (this.attacking > 0) {
      this.attacking -= dt; this.walkVx = 0;
      if (!this.struck && this.attacking < this.attackDur * 0.55) {
        this.struck = true;
        if (this.ranged) this.fire();
        else if (t && Math.abs(t.x - this.x) < 72 * u * this.scaleMul && Math.abs(t.y - this.y) < 40 * u) {
          damage(W, t, this.dmg, this, { dir: this.facing, knock: this.boss ? 420 : 220, up: this.boss ? 200 : 0, color: COLORS.warn });
          Sound.play(pick(['enemy_attack_0', 'enemy_attack_1']), 0.5);
          W.cinema.shake(this.boss ? 6 : 2, 0.15);
        } else Sound.play('slash', 0.3, 0.8);
      }
      return;
    }
    if (this.dashT > 0) { this.dashBehaviour(dt); return; }
    if (!t || !this.ground) { this.walkVx = 0; this.idleT = (this.idleT || 0) + dt; return; }
    const dx = t.x - this.x, ad = Math.abs(dx);
    this.facing = sign(dx);
    if (this.boss && this.attackCd < -2 && ad > 200 * u && this.ground && t.wid === this.wid) { this.startDash(); return; }
    if (this.ranged) {
      const want = 290 * u;
      if (ad > want + 120 * u) this.walkVx = sign(dx) * this.speed * u;
      else if (ad < want - 120 * u) this.walkVx = -sign(dx) * this.speed * u * 0.7;
      else this.walkVx = 0;
      if (this.attackCd <= 0 && ad < 700 * u) this.startAttack(0.6);
      return;
    }
    if (t.wid !== this.wid && !t.flying) {
      // Ziel steht auf einem Fenster: darunter warten und pöbeln
      if (ad > 60 * u) this.walkVx = sign(dx) * this.speed * u * 0.6; else this.walkVx = 0;
      if (chance(dt * 0.25)) this.talk(this.boss ? pick(LINES.enemy.jackal) : pick(['Komm runter, Feigling!', 'Da oben bist du auch nicht sicher!', 'Runter mit dir!']));
      return;
    }
    if (ad > 56 * u * this.scaleMul) this.walkVx = sign(dx) * this.speed * u;
    else { this.walkVx = 0; if (this.attackCd <= 0) this.startAttack(this.boss ? 0.7 : 0.5); }
  }
  startAttack(dur) {
    this.attacking = this.attackDur = dur; this.struck = false; this.animT = 0;
    this.attackCd = this.ranged ? rnd(1.2, 2.2) : rnd(0.9, 1.6) * (this.boss ? 0.8 : 1);
  }
  fire() {
    const W = this.world, u = this.u, t = this.target;
    if (!t) return;
    const ox = this.x + this.facing * 40 * u, oy = this.y - 58 * u;
    let a = Math.atan2(t.y - t.h * 0.5 - oy, t.x - ox) + rnd(-0.06, 0.06);
    W.projectiles.push(new Projectile(W, { kind: 'bullet', x: ox, y: oy, vx: Math.cos(a) * 720 * u, vy: Math.sin(a) * 720 * u, team: 'enemy', owner: this, dmg: this.dmg, r: 5 * u, life: 1.6, color: COLORS.amber }));
    W.fx.add({ type: 'strip', img: 'muzzle', x: ox, y: oy, life: 0.08, frames: 4, scale: 0.3 * u });
    Sound.play('drive_shot', 0.4, rnd(0.9, 1.1));
  }
  startDash() {
    this.dashT = 1.2; this.windup = 0.5; this.attackCd = rnd(2, 4);
    this.talk(pick(LINES.enemy.jackal), true);
    this.world.fx.ring(this.x, this.y - 50 * this.u, COLORS.magenta, 60 * this.u, 0.5, 3);
    Sound.play('drive_laser_warn', 0.5);
  }
  dashBehaviour(dt) {
    const W = this.world, u = this.u;
    this.dashT -= dt;
    if (this.windup > 0) { this.windup -= dt; this.walkVx = 0; this.flash = 0.05; return; }
    this.walkVx = this.facing * 720 * u;
    if (chance(dt * 40)) W.fx.streak(this.x - this.facing * 40, this.y - 50 * u, this.x, this.y - 50 * u, 'rgba(255,127,192,0.6)', 0.2, 8);
    for (const h of enemiesOf(W, 'enemy')) if (!this.hitSet?.has(h) && rectsOverlap(this.bounds(), h.bounds())) { (this.hitSet = this.hitSet || new Set()).add(h); damage(W, h, 12, this, { dir: this.facing, knock: 600, up: 350, color: COLORS.warn }); W.cinema.shake(8, 0.3); }
    if (this.dashT <= 0 || (this.ground && (this.x <= this.ground.x1 + 30 || this.x >= this.ground.x2 - 30))) { this.dashT = 0; this.walkVx = 0; this.hitSet = null; }
  }
  draw(ctx) {
    const S = this.S * this.scaleMul;
    const side = this.facing < 0 ? DIR.left : DIR.right;
    const img = IMG[this.sprite];
    this.drawShadow(ctx, 20 * this.u * this.scaleMul);
    const o = { flash: this.flash > 0 ? 0.8 : 0, alpha: this.deathAlpha() };
    if (this.windup > 0) { o.tint = COLORS.magenta; o.tintAmt = 0.4; }
    if (this.dead) { o.tint = '#ff3150'; o.tintAmt = Math.min(0.7, this.dyingT); }
    if (this.dragged) drawAtlas(ctx, img, GROUP.hit, DIR.down, 0, this.x, this.y, S, o);
    else if (this.dead || this.stun > 0.05) drawAtlas(ctx, img, GROUP.hit, side, 0, this.x, this.y, S, o);
    else if (this.attacking > 0) drawAtlas(ctx, img, GROUP.attack, side, Math.min(7, Math.floor((1 - this.attacking / this.attackDur) * 8)), this.x, this.y, S, o);
    else if (Math.abs(this.vx) > 15) drawAtlas(ctx, img, GROUP.walk, side, Math.floor(this.animT * (this.dashT > 0 ? 18 : 9)) % 8, this.x, this.y, S, o);
    else drawAtlas(ctx, img, GROUP.idle, side === DIR.left ? DIR.downLeft : DIR.downRight, Math.floor(this.animT * 3) % 8, this.x, this.y, S, o);
    this.drawHp(ctx);
  }
}

// ------------------------------------------------------------ Kampfbot
class Bot extends Enemy {
  constructor(world, x, y) {
    super(world, x, y, { kind: 'bot', hp: 14, name: 'Kampfbot', color: COLORS.amber });
    this.w = 40 * this.u; this.h = 92 * this.u; this.mass = 2.2; this.speed = 70;
  }
  ai(dt) {
    const u = this.u, t = this.target;
    if (this.attacking > 0) {
      this.attacking -= dt; this.walkVx = 0;
      if (!this.struck && this.attacking < 0.35) { this.struck = true; this.fire(); }
      return;
    }
    if (!t) { this.walkVx = 0; return; }
    const dx = t.x - this.x, ad = Math.abs(dx);
    this.facing = sign(dx);
    if (ad > 360 * u) this.walkVx = sign(dx) * this.speed * u; else this.walkVx = 0;
    if (this.attackCd <= 0 && ad < 800 * u) { this.attacking = 0.7; this.struck = false; this.attackCd = rnd(1.6, 2.6); }
  }
  fire() {
    const W = this.world, u = this.u, t = this.target; if (!t) return;
    const ox = this.x + this.facing * 46 * u, oy = this.y - 62 * u;
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        if (this.dead) return;
        const a = Math.atan2(t.y - t.h * 0.5 - oy, t.x - ox) + rnd(-0.08, 0.08);
        W.projectiles.push(new Projectile(W, { kind: 'botshot', x: ox, y: oy, vx: Math.cos(a) * 640 * u, vy: Math.sin(a) * 640 * u, team: this.team, owner: this, dmg: 4, r: 6 * u, life: 1.8, color: COLORS.amber }));
        W.fx.add({ type: 'strip', img: 'muzzle', x: ox, y: oy, life: 0.08, frames: 4, scale: 0.35 * u });
        Sound.play('drive_shot', 0.4, 0.8);
      }, i * 110);
    }
  }
  die(src) {
    super.die(src);
    this.world.fx.explosion(this.x, this.y - 45 * this.u, 0.8 * this.u);
    Sound.play('drive_explosion', 0.6);
    this.world.cinema.shake(6, 0.3);
  }
  draw(ctx) {
    const S = this.S;
    const dirs = [DIR.left, DIR.right];
    const dir = this.facing < 0 ? dirs[0] : dirs[1];
    this.drawShadow(ctx, 24 * this.u);
    const o = { flash: this.flash > 0 ? 0.8 : 0, alpha: this.deathAlpha() };
    if (this.stun > 0.3) { o.tint = COLORS.cyan; o.tintAmt = 0.25; }
    let set = 'idle';
    if (this.attacking > 0) set = 'attack';
    else if (Math.abs(this.vx) > 10) set = Math.floor(this.animT * 4) % 2 ? 'run_a' : 'run_b';
    drawBot(ctx, set, this.dragged ? DIR.down : dir, this.x, this.y, S, o);
    this.drawHp(ctx);
  }
}

// ------------------------------------------------------------ Fliegende Gegner
class Flyer extends Enemy {
  constructor(world, x, y, o) {
    super(world, x, y, o);
    this.flying = true;
    this.noClamp = true;
    this.hoverY = 0;
  }
  physicsFly(dt, tx, ty, accel, maxV) {
    const dx = tx - this.x, dy = ty - this.y;
    const d = Math.hypot(dx, dy) || 1;
    this.vx += (dx / d) * accel * dt; this.vy += (dy / d) * accel * dt;
    const v = Math.hypot(this.vx, this.vy);
    if (v > maxV) { this.vx *= maxV / v; this.vy *= maxV / v; }
    this.vx *= Math.pow(0.985, dt * 60); this.vy *= Math.pow(0.985, dt * 60);
    this.x += this.vx * dt; this.y += this.vy * dt;
    const T = this.world.terrain;
    if (!this.noClamp) { this.x = clamp(this.x, 20, T.W - 20); this.y = clamp(this.y, this.h + 10, T.floorY - 6); }
  }
  update(dt) {
    if (this.dead) {
      this.dyingT += dt;
      this.vy += 900 * dt; this.x += this.vx * dt; this.y += this.vy * dt;
      if (this.dyingT > 0.6) this.removed = true;
      return;
    }
    if (this.dragged) { this.tickTimers(dt); return; }
    super.update(dt);
    if (this.thrownByUser) {
      // geworfen: kurz trudeln
      this.x += this.vx * dt; this.y += this.vy * dt; this.vx *= 0.96; this.vy *= 0.96;
      if (Math.hypot(this.vx, this.vy) < 120 || this.y > this.world.terrain.floorY - 10) { if (this.y > this.world.terrain.floorY - 10) damage(this.world, this, 2, null, { knock: 0 }); this.thrownByUser = false; }
    }
  }
  release(vx, vy) { this.dragged = false; this.vx = vx; this.vy = vy; this.thrownByUser = true; this.stun = 0.6; }
}

class Drone extends Flyer {
  constructor(world, x, y) {
    super(world, x, y, { kind: 'drone', hp: 4, name: 'Drohne', color: COLORS.amber });
    this.w = 70 * this.u; this.h = 34 * this.u;
    this.offset = rnd(-1, 1);
    this.orbit = rnd(0, 6);
    this.warn = 0; this.hacked = false; this.hackT = 0;
  }
  bounds() { return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h }; }
  center() { return { x: this.x, y: this.y - this.h / 2 }; }
  hack(by) {
    if (this.hacked) return;
    this.hacked = true; this.team = 'ally'; this.hackT = 9; this.hp = this.maxHp; this.target = null;
    this.world.fx.label(this.x, this.y - 40, 'ÜBERNOMMEN', COLORS.cyan, 16, 1.2);
    Sound.play('calib_accept', 0.5);
  }
  ai(dt) {
    const W = this.world, u = this.u;
    this.orbit += dt * 0.8;
    if (this.hacked) {
      this.hackT -= dt;
      if (this.hackT <= 0) { this.selfDestruct(); return; }
    }
    const t = this.target;
    let tx, ty;
    if (t) {
      tx = t.x + Math.cos(this.orbit + this.offset * 3) * 200 * u;
      ty = t.y - 170 * u + Math.sin(this.orbit * 1.7) * 40 * u;
    } else { tx = W.terrain.W / 2 + Math.cos(this.orbit) * 300; ty = 200; }
    ty = Math.min(ty, W.terrain.floorY - 60 * u);
    if (this.warn > 0) {
      this.warn -= dt;
      this.vx *= 0.9; this.vy *= 0.9; this.x += this.vx * dt; this.y += this.vy * dt;
      if (t) { this.aim = { x: t.x, y: t.y - t.h * 0.5 }; }
      if (this.warn <= 0 && this.aim) this.fire();
      return;
    }
    this.physicsFly(dt, tx, ty, 900 * u, 260 * u);
    if (t && this.attackCd <= 0 && !this.noClamp) {
      this.warn = 0.55; this.attackCd = rnd(1.8, 3.2);
      this.aim = { x: t.x, y: t.y - t.h * 0.5 };
      Sound.play('drive_laser_warn', 0.25);
    }
  }
  fire() {
    const W = this.world, u = this.u;
    const a = Math.atan2(this.aim.y - (this.y - 10), this.aim.x - this.x);
    W.projectiles.push(new Projectile(W, { kind: 'laser', x: this.x, y: this.y - 10, vx: Math.cos(a) * 820 * u, vy: Math.sin(a) * 820 * u, team: this.team, owner: this, dmg: 4, r: 5 * u, life: 1.6, color: this.hacked ? COLORS.cyan : COLORS.red }));
    Sound.play('drive_laser', 0.35);
  }
  selfDestruct() {
    const W = this.world;
    for (const e of W.enemies) if (e !== this && !e.dead && e.team === 'enemy' && dist(e.x, e.y, this.x, this.y) < 140 * this.u) damage(W, e, 6, this, { dir: sign(e.x - this.x), knock: 300, up: 200 });
    this.hp = 0; this.die(null);
  }
  die(src) {
    super.die(src);
    this.world.fx.explosion(this.x, this.y - 10, 0.55 * this.u);
    Sound.play('drive_explosion', 0.45, 1.2);
    this.world.cinema.shake(4, 0.2);
  }
  draw(ctx) {
    const u = this.u, img = IMG.drone;
    if (!img) return;
    const bob = Math.sin(this.life * 6 + this.offset) * 3;
    const tilt = clamp(this.vx / 900, -0.35, 0.35);
    const s = (70 * u) / img.width;
    ctx.save();
    ctx.globalAlpha = this.deathAlpha();
    // Schatten auf dem Boden
    const fy = this.world.terrain.floorY;
    ctx.save(); ctx.globalAlpha *= 0.18; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(this.x, fy, 28 * u, 5 * u, 0, 0, 7); ctx.fill(); ctx.restore();
    ctx.translate(this.x, this.y - this.h / 2 + bob);
    ctx.rotate(this.dead ? this.dyingT * 6 : tilt);
    ctx.scale(s, s * 0.55);
    let src = img;
    const o = { flash: this.flash > 0 ? 0.8 : 0, tint: this.hacked ? COLORS.cyan : null, tintAmt: 0.35 };
    drawRegion(ctx, src, 0, 0, img.width, img.height, img.width / 2, img.height / 2, 0, 0, 1, o);
    // Rotoren
    ctx.globalAlpha *= 0.55;
    ctx.fillStyle = this.hacked ? 'rgba(98,227,238,0.35)' : 'rgba(220,230,240,0.28)';
    const rx = img.width * 0.33, ry = img.height * 0.33;
    for (const [px, py] of [[-rx, -ry], [rx, -ry], [-rx, ry], [rx, ry]]) {
      ctx.beginPath(); ctx.ellipse(px, py, img.width * 0.17, img.height * 0.17 * (0.8 + 0.2 * Math.sin(this.life * 40)), 0, 0, 7); ctx.fill();
    }
    ctx.restore();
    if (this.warn > 0 && this.aim) this.world.fx.beam(this.x, this.y - 10, this.aim.x, this.aim.y, this.hacked ? COLORS.cyan : COLORS.red, 0.02, 1, true);
    this.drawHp(ctx);
  }
}

class Virus extends Flyer {
  constructor(world, x, y, big = false) {
    super(world, x, y, { kind: 'virus', hp: big ? 6 : 3, name: 'Virus', color: COLORS.violet });
    this.big = big;
    this.size = (big ? 64 : 42) * this.u;
    this.w = this.h = this.size * 0.8;
    this.seed = rnd(0, 100);
    this.lunge = 0; this.rot = rnd(0, 6);
  }
  bounds() { return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h }; }
  ai(dt) {
    const W = this.world, u = this.u, t = this.target;
    this.rot += dt * (this.lunge > 0 ? 9 : 1.5);
    if (chance(dt * 10)) W.fx.add({ type: 'pixel', x: this.x + rnd(-10, 10), y: this.y - this.h / 2 + rnd(-10, 10), vx: 0, vy: 0, g: 0, life: 0.35, color: pick([COLORS.violet, COLORS.magenta]), size: 3 });
    if (!t) { this.physicsFly(dt, W.terrain.W / 2, 220, 500, 160); return; }
    if (this.lunge > 0) {
      this.lunge -= dt;
      this.x += this.vx * dt; this.y += this.vy * dt;
      if (rectsOverlap(this.bounds(), t.bounds())) { damage(W, t, this.big ? 6 : 4, this, { dir: sign(this.vx), knock: 200, color: COLORS.violet }); this.lunge = 0; this.vx *= -0.6; this.vy = -200; Sound.play('calib_error', 0.4, 1.4); }
      return;
    }
    const n = this.life * 1.7 + this.seed;
    const tx = t.x + Math.cos(n) * 130 * u + Math.sin(n * 2.3) * 40 * u;
    const ty = t.y - 60 * u + Math.sin(n * 1.3) * 90 * u - 40 * u;
    this.physicsFly(dt, tx, Math.min(ty, W.terrain.floorY - 30), 1100 * u, 230 * u);
    if (this.attackCd <= 0 && !this.noClamp) {
      const a = Math.atan2(t.y - t.h / 2 - (this.y - this.h / 2), t.x - this.x);
      this.vx = Math.cos(a) * 620 * u; this.vy = Math.sin(a) * 620 * u; this.lunge = 0.5; this.attackCd = rnd(1.8, 3.2);
      Sound.play('hack', 0.25, 1.8);
    }
  }
  die(src) {
    super.die(src);
    const W = this.world;
    W.fx.pixels(this.x, this.y - this.h / 2, [COLORS.violet, COLORS.magenta, COLORS.cyan, '#ffffff'], this.big ? 40 : 22, 300, { g: 0, size: 5 });
    W.fx.ring(this.x, this.y - this.h / 2, COLORS.violet, 50 * this.u, 0.3, 3);
    Sound.play('calib_error', 0.5, 0.8);
    if (this.big) for (let i = 0; i < 2; i++) { const v = new Virus(W, this.x + (i ? 20 : -20), this.y, false); v.vx = (i ? 1 : -1) * 300; v.vy = -200; v.noClamp = false; W.enemies.push(v); }
  }
  draw(ctx) {
    const img = IMG.virus; if (!img) return;
    const s = this.size / img.width;
    const glitch = this.flash > 0 || chance(0.04) ? rnd(-4, 4) : 0;
    ctx.save();
    ctx.globalAlpha = this.deathAlpha();
    const cx = this.x, cy = this.y - this.h / 2;
    const pulse = 1 + Math.sin(this.life * 8) * 0.05;
    ctx.translate(cx, cy); ctx.rotate(this.rot * 0.2);
    if (glitch) { ctx.globalAlpha *= 0.5; drawRegion(ctx, img, 0, 0, img.width, img.height, img.width / 2, img.height / 2, glitch, 0, s * pulse, { tint: COLORS.cyan, tintAmt: 0.7 }); ctx.globalAlpha *= 2; }
    drawRegion(ctx, img, 0, 0, img.width, img.height, img.width / 2, img.height / 2, 0, 0, s * pulse, { flash: this.flash > 0 ? 0.8 : 0, tint: this.stun > 0.3 ? COLORS.cyan : null, tintAmt: 0.4 });
    ctx.restore();
    this.drawHp(ctx);
  }
}

class IceGuardian extends Flyer {
  constructor(world, x, y) {
    super(world, x, y, { kind: 'ice', hp: 130, boss: true, name: 'ICE-Wächter', color: COLORS.violet });
    this.size = 170 * this.u;
    this.w = this.h = this.size * 0.75;
    this.mass = 4;
    this.phase = 0; this.beam = null; this.spawnCd = 5;
  }
  bounds() { return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h }; }
  ai(dt) {
    const W = this.world, u = this.u, t = this.target;
    this.phase += dt;
    this.spawnCd -= dt;
    const tx = W.terrain.W / 2 + Math.sin(this.phase * 0.35) * W.terrain.W * 0.3;
    const ty = W.terrain.floorY * 0.38 + Math.sin(this.phase * 0.8) * 40 * u;
    if (this.beam) {
      const b = this.beam; b.t += dt;
      this.vx *= 0.9; this.vy *= 0.9;
      if (b.t < 0.9) { if (t) { b.x = t.x; b.y = t.y - t.h / 2; } W.fx.beam(this.x, this.y - this.h / 2, b.x, b.y, COLORS.violet, 0.02, 1, true); if (b.t > 0.88 && !b.played) { b.played = true; Sound.play('drive_laser', 0.7, 0.6); } }
      else if (b.t < 1.5) {
        const sx = this.x, sy = this.y - this.h / 2;
        const ex = sx + (b.x - sx) * 3, ey = sy + (b.y - sy) * 3;
        W.fx.beam(sx, sy, ex, ey, COLORS.violet, 0.06, 14 * u);
        W.cinema.shake(3, 0.1);
        for (const h of enemiesOf(W, 'enemy')) {
          const c = h.center();
          const d = distToSeg(c.x, c.y, sx, sy, ex, ey);
          if (d < 34 * u && !b.hit?.has(h)) { (b.hit = b.hit || new Set()).add(h); damage(W, h, 12, this, { dir: sign(h.x - this.x), knock: 400, up: 260, color: COLORS.violet }); }
        }
      } else this.beam = null;
      return;
    }
    this.physicsFly(dt, tx, ty, 300 * u, 120 * u);
    if (this.noClamp) return;
    if (this.spawnCd <= 0) {
      this.spawnCd = rnd(7, 10);
      for (let i = 0; i < 2; i++) { const v = new Virus(W, this.x, this.y - this.h / 2, false); v.vx = (i ? 1 : -1) * 260; v.vy = 120; v.noClamp = false; W.enemies.push(v); }
      W.fx.ring(this.x, this.y - this.h / 2, COLORS.violet, 90 * u, 0.4, 3);
      Sound.play('hack', 0.5, 0.7);
    } else if (this.attackCd <= 0 && t) {
      this.attackCd = rnd(2.5, 4);
      if (chance(0.5)) { this.beam = { t: 0, x: t.x, y: t.y }; Sound.play('drive_laser_warn', 0.6, 0.7); }
      else {
        for (let i = -2; i <= 2; i++) {
          const a = Math.atan2(t.y - t.h / 2 - (this.y - this.h / 2), t.x - this.x) + i * 0.18;
          W.projectiles.push(new Projectile(W, { kind: 'orb', x: this.x, y: this.y - this.h / 2, vx: Math.cos(a) * 420 * u, vy: Math.sin(a) * 420 * u, team: 'enemy', owner: this, dmg: 4, r: 7 * u, life: 2.5, color: COLORS.violet }));
        }
        Sound.play('electric', 0.5, 0.7);
      }
    }
  }
  die(src) {
    super.die(src);
    const W = this.world;
    for (let i = 0; i < 5; i++) setTimeout(() => W.fx.explosion(this.x + rnd(-60, 60), this.y - this.h / 2 + rnd(-60, 60), rnd(0.6, 1.1) * this.u), i * 140);
    W.fx.pixels(this.x, this.y - this.h / 2, [COLORS.violet, COLORS.cyan, '#ffffff'], 70, 500, { g: 0, size: 6 });
    Sound.play('drive_explosion', 0.9, 0.7);
  }
  draw(ctx) {
    const img = IMG.ice; if (!img) return;
    const s = this.size / img.width;
    ctx.save();
    ctx.globalAlpha = this.deathAlpha();
    ctx.translate(this.x, this.y - this.h / 2);
    ctx.rotate(this.phase * 0.25);
    const g = ctx.createRadialGradient(0, 0, 10, 0, 0, this.size * 0.7);
    g.addColorStop(0, 'rgba(178,107,255,0.25)'); g.addColorStop(1, 'rgba(178,107,255,0)');
    ctx.fillStyle = g; ctx.fillRect(-this.size, -this.size, this.size * 2, this.size * 2);
    drawRegion(ctx, img, 0, 0, img.width, img.height, img.width / 2, img.height / 2, 0, 0, s, { flash: this.flash > 0 ? 0.7 : 0, tint: this.stun > 0.4 ? COLORS.cyan : null, tintAmt: 0.3 });
    ctx.restore();
  }
}

function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// ------------------------------------------------------------ Fabrik
function makeEnemy(world, type, x, y) {
  const u = world.u;
  switch (type) {
    case 'punk': return new StreetEnemy(world, x, y, { kind: 'punk', sprite: pick(['punk-1', 'punk-2', 'punk-3', 'punk-4']), hp: 7, speed: rnd(110, 140), dmg: 5, name: 'Straßenkämpfer', color: COLORS.amber });
    case 'shooter': return new StreetEnemy(world, x, y, { kind: 'shooter', sprite: pick(['shooter-visor', 'shooter-violet']), hp: 6, ranged: true, speed: 90, dmg: 4, name: 'Schütze', color: COLORS.amber });
    case 'jackal': return new StreetEnemy(world, x, y, { kind: 'jackal', sprite: 'jackal', hp: 70, speed: 105, dmg: 9, boss: true, scaleMul: 1.18, mass: 2.5, name: 'Chrome Jackal', color: COLORS.magenta });
    case 'bot': return new Bot(world, x, y);
    case 'drone': return new Drone(world, x, y);
    case 'virus': return new Virus(world, x, y, false);
    case 'bigvirus': return new Virus(world, x, y, true);
    case 'ice': return new IceGuardian(world, x, y);
  }
  return null;
}
