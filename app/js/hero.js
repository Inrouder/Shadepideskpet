// Shadepi und Raven: Darstellung, Bewegung (Laufen, Springen, Klettern),
// Kampf, Training, Wartungsluke und Reaktionen aufs Herumtragen.
'use strict';

const HERO_DEF = {
  shadepi: { display: 'Shadepi', color: COLORS.red, walk: 92, run: 310, jump: 330, hp: 120 },
  raven: { display: 'Raven', color: COLORS.cyan, walk: 98, run: 285, jump: 240, hp: 95 },
};
// Mündung der Impulspistole im 128×160-Angriffsbild (aus player.gd), relativ zum Fußpunkt (64,152)
const MUZZLE = { left: [24 - 64, 57 - 152], right: [105 - 64, 58 - 152] };

class Hero extends Entity {
  constructor(world, name, x, y) {
    super(world, x, y);
    this.name = name;
    this.def = HERO_DEF[name];
    this.displayName = this.def.display;
    this.voiceColor = this.def.color;
    this.team = 'hero';
    this.maxHp = this.hp = this.def.hp;
    this.pose = 'idle'; this.animT = 0; this.forcePose = null; this.forceDir = null; this.poseRow = 0; this.castRow = 0; this.attackDur = 0.4;
    this.task = null; this.taskName = ''; this.taskPrio = 0;
    this.thinkCd = rnd(1, 3);
    this.inventory = { emp: 0, shuriken: 0 };
    this.buffs = { core: 0, overclock: 0, blade: 0 };
    this.ko = false; this.koT = 0; this.absent = false;
    this.climbing = null; this.climbDist = 0;
    this.faceCam = false;
    this.swing = 0; this.swingV = 0;
    this.dragLineCd = 0; this.shakeMeter = 0; this.dizzy = 0; this.afterThrow = false;
    this.specialCd = rnd(5, 9); this.shootCd = 0; this.castCd = rnd(2, 4); this.hurtT = 0;
    this.alpha = 1; this.spin = 0; this.lastTalk = -10; this.grapple = null; this.dashing = false;
    this.mouseNear = 0; this.squash = 1;
    this.edgeStop = true;
    this.resize();
  }

  get u() { return this.world.u; }
  get S() { return this.world.scale; }
  get partner() { return this.world.heroes.find((h) => h !== this && !h.absent); }
  get dmgMult() { return this.buffs.core > 0 ? 2 : 1; }
  get jumpMax() { return this.def.jump * this.u; }
  resize() { this.w = 34 * this.u; this.h = 86 * this.u; }
  get bubbleY() { const p = this.forcePose; return (p === 'sit' ? 74 : p === 'lie' ? 46 : p === 'climb' ? 112 : 104) * this.u; }

  say(key, arg, force) { return this.talk(line(this.name, key, arg), force); }
  talk(text, force) {
    if (!text) return;
    if (!force && this.world.time - this.lastTalk < 2.2) return;
    this.lastTalk = this.world.time;
    this.world.bubbles.say(this, text);
  }

  // ======================================================== Aufgaben
  setTask(name, gen, prio = 1) {
    if (this.ko || this.absent && name !== 'arrive') return false;
    if (this.task && this.taskPrio > prio) return false;
    this.cancelTask();
    this.task = gen; this.taskName = name; this.taskPrio = prio;
    return true;
  }
  cancelTask() {
    const t = this.task;
    this.task = null; this.taskName = ''; this.taskPrio = 0;
    if (t) { try { t.return(); } catch (e) { console.warn(e); } }
    this.forcePose = null; this.forceDir = null; this.walkVx = 0; this.faceCam = false;
    this.gravity = 1; this.ignoreSurface = null; this.grapple = null; this.dashing = false; this.alpha = 1;
    if (this.climbing) { this.climbing = null; this.leaveGround(); }
  }

  *wait(t) { let e = 0; while (e < t) { e += this.world.dt; yield; } }
  *waitGround(max = 4) { let e = 0; while (!this.ground && e < max) { e += this.world.dt; yield; } }
  *anim(pose, dur, opts = {}) {
    this.forcePose = pose; this.animT = 0;
    if (opts.row !== undefined) this.poseRow = opts.row;
    if (opts.cast !== undefined) this.castRow = opts.cast;
    if (opts.dir !== undefined) this.forceDir = opts.dir;
    if (pose === 'attack') this.attackDur = dur;
    yield* this.wait(dur);
    if (!opts.keep) { this.forcePose = null; this.forceDir = null; }
  }

  *walkTo(x, run = false, tol = 6, timeout = 14) {
    let e = 0, stuck = 0, lastX = this.x;
    while (e < timeout) {
      e += this.world.dt;
      if (!this.ground) { this.walkVx = 0; stuck = 0; yield; continue; }
      const dx = x - this.x;
      if (Math.abs(dx) <= tol) break;
      const s = this.ground;
      // Am Rand: Auf dem Boden hält die Physik die Figur eine halbe Breite vor der Kante an.
      // Ohne diese Grenze lief sie bis zum Zeitlimit gegen den Bildschirmrand.
      const pad = this.wid === 'floor' && !this.floorContinues(s, sign(dx)) ? this.w / 2 + 2 : 1;
      if ((dx < 0 && this.x <= s.x1 + pad) || (dx > 0 && this.x >= s.x2 - pad)) break;
      // Kommt nicht vom Fleck (Wand, Nachbarmonitor höher …)
      if (Math.abs(this.x - lastX) < 0.3 * this.u) { stuck += this.world.dt; if (stuck > 0.45) break; } else stuck = 0;
      lastX = this.x;
      this.facing = sign(dx);
      this.walkVx = sign(dx) * (run ? this.def.run : this.def.walk) * this.u * (this.buffs.overclock > 0 ? 1.2 : 1);
      yield;
    }
    this.walkVx = 0;
  }

  // Geht der Boden hinter der Kante auf einem anderen Monitor tiefer weiter?
  floorContinues(s, dir) {
    const T = this.world.terrain;
    if (!T.multi) return false;
    const edge = dir > 0 ? s.x2 : s.x1;
    const [lo, hi] = T.xRangeAt(this.x, s.y - 2);
    if (edge + dir * this.w >= hi || edge + dir * this.w <= lo) return false;
    return T.floorAt(edge + dir * this.w).y > s.y + 4;
  }

  // Ballistischer Sprung auf einen Punkt
  *jumpTo(tx, ty, opts = {}) {
    if (!this.ground) yield* this.waitGround();
    const g = GRAVITY;
    const apex = Math.min(this.y, ty) - (opts.arc ?? 55) * this.u;
    const vy0 = -Math.sqrt(2 * g * Math.max(10, this.y - apex));
    const t1 = -vy0 / g, t2 = Math.sqrt(Math.max(1, (2 * (ty - apex)) / g));
    const T = t1 + t2;
    this.facing = sign(tx - this.x) || this.facing;
    if (!opts.quick) { this.forcePose = 'crouch'; yield* this.wait(0.09); }
    const fromWid = this.wid;
    this.leaveGround();
    this.leaping = true;
    if (ty > this.y + 4) this.ignoreSurface = fromWid;
    this.vx = (tx - this.x) / T; this.vy = vy0;
    this.forcePose = 'jump'; this.animT = 0;
    Sound.play('drive_roll', 0.2, 1.7);
    this.world.fx.dust(this.x, this.y, 4, this.u);
    let e = 0;
    while (!this.ground && e < T + 2.5) {
      e += this.world.dt;
      if (this.ignoreSurface && this.y > ty - 30 * this.u) this.ignoreSurface = null;
      if (opts.onAir && opts.onAir(e, T) === 'stop') break;
      yield;
    }
    this.ignoreSurface = null;
    if (this.forcePose === 'jump') this.forcePose = null;
  }

  // Große Höhen: Schattensprung (Shadepi) / Greifhaken (Raven)
  *leapTo(tx, ty) {
    const W = this.world, u = this.u;
    const sx = this.x, sy = this.y;
    this.facing = sign(tx - sx) || this.facing;
    this.leaveGround(); this.gravity = 0; this.vx = this.vy = 0; this.leaping = true;
    try {
      if (this.name === 'shadepi') {
        this.forcePose = 'pose'; this.poseRow = 0;
        W.fx.smokePuff(sx, sy - 30 * u, 0.5 * u, 0.9);
        Sound.play('slash', 0.6, 0.7);
        yield* this.wait(0.15);
        this.forcePose = 'jump'; this.dashing = true;
        const dur = 0.42;
        let e = 0;
        while (e < dur) {
          e += W.dt; const k = easeInOut(Math.min(1, e / dur));
          this.x = lerp(sx, tx, k); this.y = lerp(sy, ty, k) - Math.sin(k * Math.PI) * 60 * u;
          W.fx.streak(this.x - this.facing * 30, this.y - 50 * u, this.x, this.y - 40 * u, 'rgba(255,49,80,0.7)', 0.25, 6);
          yield;
        }
        this.dashing = false;
        W.fx.smokePuff(tx, ty - 20 * u, 0.4 * u, 0.6);
      } else {
        // Haken schießen
        this.forcePose = 'attack'; this.attackDur = 0.3; this.forceDir = tx < sx ? DIR.upLeft : DIR.upRight;
        this.grapple = { x: sx, y: sy - 60 * u, tx, ty: ty - 4, k: 0 };
        Sound.play('drive_shot', 0.6, 1.4);
        let e = 0;
        while (e < 0.18) { e += W.dt; this.grapple.k = e / 0.18; yield; }
        Sound.play('calib_lock', 0.6);
        W.fx.sparks(tx, ty, COLORS.cyan, 6, 160);
        this.forcePose = 'jump'; this.forceDir = null;
        e = 0;
        const dur = 0.55;
        while (e < dur) {
          e += W.dt; const k = easeIn(Math.min(1, e / dur)) * 0.6 + easeInOut(Math.min(1, e / dur)) * 0.4;
          this.x = lerp(sx, tx, k); this.y = lerp(sy, ty, k) + Math.sin(k * Math.PI) * 30 * u;
          this.grapple.x = this.x; this.grapple.y = this.y - 70 * u;
          yield;
        }
        this.grapple = null;
      }
      this.x = tx; this.y = ty;
      const s = W.terrain.surfaceAt(tx, ty, 8);
      if (s) this.land(s, 300);
      this.forcePose = null;
    } finally {
      this.gravity = 1; this.grapple = null; this.dashing = false; this.forceDir = null;
    }
  }

  *dropDown() {
    if (!this.ground || this.wid === 'floor') return;
    const s = this.ground;
    const edge = this.x - s.x1 < s.x2 - this.x ? s.x1 + 4 : s.x2 - 4;
    yield* this.walkTo(edge, false, 5);
    const dir = edge < (s.x1 + s.x2) / 2 ? -1 : 1;
    const below = this.world.terrain.below(this.x + dir * 50 * this.u, this.y + 5);
    yield* this.jumpTo(clamp(this.x + dir * 60 * this.u, this.world.terrain.minX + 20, this.world.terrain.maxX - 20), below.y, { arc: 25, quick: true });
  }

  // Landepunkt auf der Oberkante neben der Kletterseite
  topLanding(wall) {
    const T = this.world.terrain, u = this.u;
    const w = T.byId.get(wall.wid);
    if (!w) return null;
    const tops = T.surfaces.filter((q) => q.wid === wall.wid);
    if (!tops.length) return null;
    let x = (wall.side < 0 ? w.x : w.x + w.w) - wall.side * 30 * u;
    const q = tops.sort((a, b) => Math.abs((a.x1 + a.x2) / 2 - x) - Math.abs((b.x1 + b.x2) / 2 - x))[0];
    return { x: clamp(x, q.x1 + 10, q.x2 - 10), y: q.y, w };
  }

  *climbWall(wall) {
    const W = this.world, u = this.u, T = W.terrain;
    const side = wall.side;
    if (!T.byId.get(wall.wid)) return false;
    const outX = wall.x + side * 26 * u;
    yield* this.walkTo(outX, false, 5);
    if (Math.abs(this.x - outX) > 12 * u || !this.ground) return false;
    this.facing = -side;
    this.say('climb');
    if (!hasClimbArt(this.name)) return yield* this.ascendNoArt(wall);

    // ---- echte Kletterbilder vorhanden
    const S = this.S;
    const handOff = (152 - CLIMB_ART.climbHandY) * S;   // Hand über dem Fußpunkt
    let startY = this.y;
    if (wall.y2 < this.y - handOff) {
      const grabY = wall.y2 + handOff;
      if (this.y - grabY > this.jumpMax) { yield* this.leapTo(wall.x + side * 2 * u, grabY); }
      else {
        this.forcePose = 'crouch'; yield* this.wait(0.1);
        this.forcePose = 'jump';
        const y0 = this.y; let e = 0;
        this.leaveGround(); this.gravity = 0;
        while (e < 0.32) { e += W.dt; const k = easeOut(Math.min(1, e / 0.32)); this.y = lerp(y0, grabY, k); this.x = lerp(outX, wall.x + side * 2 * u, k); yield; }
      }
      startY = this.y;
    }
    this.leaveGround(); this.gravity = 0;
    this.climbing = { wid: wall.wid, side };
    this.forcePose = 'climb';
    const w0 = T.byId.get(wall.wid);
    let relY = startY - w0.y;
    const speed = 70 * u;
    try {
      while (relY > handOff) {
        const w = T.byId.get(wall.wid);
        if (!w || !T.wallsOf(wall.wid).some((x) => x.side === side) || !this.climbing) { this.forcePose = null; return false; }
        relY -= speed * W.dt;
        this.climbDist += speed * W.dt;
        this.x = (side < 0 ? w.x : w.x + w.w) + side * 6 * u;
        this.y = w.y + relY;
        this.vx = this.vy = 0;
        yield;
      }
      // Hochziehen: Bilder der Reihe „mantle“, jeweils an ihrer Kantenhöhe ausgerichtet
      this.climbing = null;
      const land = this.topLanding(wall);
      if (!land) return false;
      const x0 = this.x;
      this.forcePose = 'mantle';
      Sound.play('drive_knock', 0.2, 0.7);
      const dur = 1.25;
      for (let e = 0; e < dur; e += W.dt) {
        const k = Math.min(0.999, e / dur);
        this.mantleK = Math.floor(k * 8);
        const w = T.byId.get(wall.wid) || land.w;
        const edge = (side < 0 ? w.x : w.x + w.w);
        // ab Phase 5 (Knie auf der Kante) nach innen rücken
        const inward = clamp((k - 0.55) / 0.45, 0, 1);
        this.x = lerp(edge + side * 6 * u, edge - side * 30 * u, easeInOut(inward));
        this.y = w.y;
        yield;
      }
      const s = T.surfaceOf(wall.wid, this.x, 6);
      this.gravity = 1;
      if (s) { this.land(s, 0); this.facing = -side; return true; }
      return false;
    } finally {
      this.climbing = null; this.gravity = 1; if (['climb', 'jump', 'mantle', 'crouch'].includes(this.forcePose)) this.forcePose = null;
    }
  }

  // Ohne Kletterbilder: nur echte Spielposen – Raven nimmt den Greifhaken, Shadepi läuft die Kante hoch
  *ascendNoArt(wall) {
    const land = this.topLanding(wall);
    if (!land) return false;
    if (this.name === 'raven') { yield* this.leapTo(land.x, land.y); return this.wid === wall.wid; }
    return yield* this.wallKicks(wall);
  }

  // Shadepis Wandsprünge: im Zickzack an der Fensterkante hoch (Knie-Sprungpose aus dem Spiel)
  *wallKicks(wall) {
    const W = this.world, u = this.u, T = W.terrain, side = wall.side;
    this.leaveGround(); this.gravity = 0;
    try {
      let w = T.byId.get(wall.wid);
      if (!w) return false;
      const steps = Math.max(1, Math.ceil((this.y - w.y) / (140 * u)));
      this.forcePose = 'crouch';
      yield* this.wait(0.12);
      for (let i = 0; i < steps; i++) {
        w = T.byId.get(wall.wid);
        if (!w) return false;
        const edge = side < 0 ? w.x : w.x + w.w;
        const x0 = this.x, y0 = this.y;
        const x1 = edge + side * (i % 2 ? 34 : 12) * u;
        const y1 = i === steps - 1 ? w.y + 10 * u : y0 - (y0 - w.y) / (steps - i);
        this.facing = i % 2 ? -side : side;
        this.forcePose = 'pose'; this.poseRow = 1; this.forceDir = null;
        Sound.play('drive_knock', 0.35, 1.3 + i * 0.1);
        W.fx.dust(edge, y0 - 20 * u, 3, 0.7 * u);
        const dur = 0.24;
        for (let e = 0; e < dur; e += W.dt) {
          const k = easeOut(Math.min(1, e / dur));
          this.x = lerp(x0, x1, k); this.y = lerp(y0, y1, k);
          if (chance(W.dt * 30)) W.fx.streak(this.x, this.y - 30 * u, this.x, this.y - 60 * u, 'rgba(255,49,80,0.35)', 0.2, 4);
          yield;
        }
      }
      // Abschluss: Bogen auf die Oberkante
      const land = this.topLanding(wall);
      if (!land) return false;
      const x0 = this.x, y0 = this.y;
      this.facing = sign(land.x - x0) || -side;
      this.forcePose = 'jump';
      for (let e = 0; e < 0.3; e += W.dt) {
        const k = easeOut(Math.min(1, e / 0.3));
        this.x = lerp(x0, land.x, k); this.y = lerp(y0, land.y, k) - Math.sin(k * Math.PI) * 40 * u;
        yield;
      }
      const s = T.surfaceOf(wall.wid, land.x, 6);
      this.gravity = 1;
      if (s) { this.land(s, 300); W.fx.dust(this.x, this.y, 5, u); return true; }
      return false;
    } finally {
      this.gravity = 1; if (['pose', 'jump', 'crouch'].includes(this.forcePose)) this.forcePose = null;
    }
  }

  // Zu einer Fläche (Fensteroberkante) gelangen
  *goToSurface(target) {
    const T = this.world.terrain, u = this.u;
    for (let attempt = 0; attempt < 5; attempt++) {
      yield* this.waitGround();
      if (!this.ground) return false;
      const live = T.surfaceOf(target.wid, (target.x1 + target.x2) / 2, 30) || T.surfaces.find((s) => s.wid === target.wid);
      if (!live) return false;
      target = live;
      if (this.onSurface(target)) return true;
      const me = this.ground;
      const crossFloor = target.wid === 'floor' && me.wid === 'floor';
      const inset = crossFloor ? 70 * u : 26 * u;
      const landX = clamp(this.x, target.x1 + inset, target.x2 - inset);
      const launchX = clamp(landX, me.x1 + (crossFloor ? this.w / 2 + 6 : 8), me.x2 - (crossFloor ? this.w / 2 + 6 : 8));
      const dx = Math.abs(landX - launchX);
      const rise = this.y - target.y;
      if (dx < 320 * u && rise < this.jumpMax && rise > -900) {
        yield* this.walkTo(launchX, true, 6);
        yield* this.jumpTo(landX, target.y);
        continue;
      }
      if (this.wid === 'floor') {
        const walls = T.wallsOf(target.wid).filter((w) => w.x + w.side * 26 * u > me.x1 + 10 && w.x + w.side * 26 * u < me.x2 - 10);
        if (walls.length) {
          const wall = walls.sort((a, b) => Math.abs(a.x - this.x) - Math.abs(b.x - this.x))[0];
          const ok = yield* this.climbWall(wall);
          if (ok && this.wid === target.wid) return true;
          continue;
        }
        if (rise > 0 && dx < 500 * u) {
          yield* this.walkTo(launchX, true, 6);
          yield* this.leapTo(landX, target.y);
          continue;
        }
        return false;
      }
      yield* this.dropDown();
    }
    return this.onSurface(target);
  }

  // Steht die Figur auf dieser Fläche? (Böden mehrerer Monitore teilen sich die Kennung 'floor')
  onSurface(t) { return !!this.ground && this.wid === t.wid && (t.wid !== 'floor' || this.ground === t || this.ground.id === t.id); }

  // ======================================================== Monitore
  // Zu einem anderen Bildschirm laufen (springen, fallen, Schattensprung/Greifhaken)
  *roam() {
    const T = this.world.terrain, u = this.u;
    const here = T.screenAt(this.x, this.y - 10);
    const others = T.liveScreens().filter((sc) => sc !== here);
    if (!others.length) return;
    const dest = !here.home && chance(0.6) ? T.screens[0] : pick(others);
    if (chance(0.4)) this.say(dest.home ? 'roamHome' : 'roam');
    const tx = clamp(rnd(dest.x + dest.w * 0.15, dest.x + dest.w * 0.85), dest.fx1 + 40 * u, dest.fx2 - 40 * u);
    const wins = T.windowSurfaces().filter((s) => T.screenAt((s.x1 + s.x2) / 2, s.y) === dest && s.x2 - s.x1 > 110 * u);
    if (wins.length && this.world.settings.climbWindows && chance(0.35)) { yield* this.climbSomewhere(pick(wins)); return; }
    if (this.wid !== 'floor') yield* this.dropDown();
    const fl = T.floorAt(tx);
    for (let hop = 0; hop < 4 && this.ground && !this.onSurface(fl); hop++) {
      // Benachbarten Boden in Richtung Ziel ansteuern
      const dir = sign(tx - this.x);
      const next = T.floors().filter((f) => f !== this.ground && (dir > 0 ? f.x1 >= this.ground.x2 - 4 : f.x2 <= this.ground.x1 + 4))
        .sort((a, b) => Math.abs((a.x1 + a.x2) / 2 - this.x) - Math.abs((b.x1 + b.x2) / 2 - this.x))[0];
      if (!next) break;
      if (next.y > this.y + 4) yield* this.walkTo(dir > 0 ? next.x1 + 60 * u : next.x2 - 60 * u, true, 8);
      else yield* this.goToSurface(next);
      yield* this.waitGround();
    }
    if (this.onSurface(fl)) yield* this.walkTo(tx, chance(0.3));
    yield* this.wait(rnd(0.6, 1.6));
  }

  // Für Szenen, Erinnerungen und Kämpfe: zurück auf den Heimbildschirm (Schattensprung bzw. Greifhaken)
  *comeHome() {
    if (!this.warpHome()) return;
    yield* this.wait(0.15);
  }
  warpHome() {
    const W = this.world, T = W.terrain, u = this.u;
    if (this.absent || this.dragged || T.isHome(this.x, this.y - 20)) return false;
    const fromLeft = this.x < T.W / 2;
    W.fx.smokePuff(this.x, this.y - 30 * u, 0.6 * u, 0.8);
    Sound.play(this.name === 'raven' ? 'calib_tick' : 'slash', 0.35, 0.7);
    this.leaveGround();
    this.x = clamp(fromLeft ? T.floorX1 + 70 * u : T.floorX2 - 70 * u, 40, T.W - 40);
    this.y = T.floorY; this.vx = this.vy = 0;
    this.land(T.surfaces[0], 0);
    this.facing = fromLeft ? 1 : -1;
    W.fx.smokePuff(this.x, this.y - 30 * u, 0.6 * u, 0.8);
    return true;
  }

  // ======================================================== Kampf
  enemyList() { return this.world.enemies.filter((e) => !e.dead && e.team === 'enemy' && !e.noClamp); }
  pickTarget() {
    const list = this.enemyList();
    if (!list.length) return null;
    let best = null, bd = 1e9;
    for (const e of list) {
      let d = Math.abs(e.x - this.x) + Math.abs(e.y - this.y) * 0.7;
      if (e.flying && this.name === 'shadepi') d *= 1.4;
      if (e.boss) d *= 0.8;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  meleeHit(range, dmg, opts = {}) {
    const u = this.u;
    const box = { x: this.facing > 0 ? this.x - 10 * u : this.x - range, y: this.y - (opts.high || 95) * u, w: range + 10 * u, h: (opts.high || 95) * u + 10 };
    let n = 0;
    for (const e of this.world.enemies) {
      if (e.dead || e.team !== 'enemy') continue;
      if (rectsOverlap(box, e.bounds())) { damage(this.world, e, dmg, this, { dir: this.facing, knock: opts.knock ?? 240, up: opts.up, color: COLORS.redHot, stun: opts.stun }); n++; }
    }
    for (const it of this.world.items) if (!it.dead && rectsOverlap(box, it.bounds())) { it.hit(dmg, this, this.facing); n++; }
    if (n) { this.world.cinema.stop(opts.stop ?? 0.045); Sound.any(['hit', 'enemy_hurt_0'], 0.55); }
    return n;
  }

  *slash(heavy = false) {
    const W = this.world, u = this.u;
    yield* this.anim('attack', 0.13, { keep: true });
    Sound.play('slash', 0.7, rnd(0.9, 1.1));
    W.fx.slash(this.x + this.facing * 24 * u, this.y - 52 * u, this.facing, COLORS.red, u * (heavy ? 1.4 : 1));
    this.meleeHit(70 * u, heavy ? 7 : rndi(3, 4), { knock: heavy ? 420 : 200, up: heavy ? 240 : 0 });
    if (this.buffs.blade > 0) W.projectiles.push(new Projectile(W, { kind: 'wave', x: this.x + this.facing * 30 * u, y: this.y - 50 * u, vx: this.facing * 760 * u, vy: 0, team: 'hero', owner: this, dmg: 4, r: 26 * u, pierce: 3, life: 0.9, color: COLORS.red }));
    yield* this.wait(0.2);
    this.forcePose = null;
  }

  *kick() {
    const W = this.world, u = this.u;
    yield* this.anim('pose', 0.1, { row: 1, keep: true });
    this.poseRow = 2;
    this.vx = this.facing * 160 * u;
    Sound.play('drive_knock', 0.6, 1.2);
    this.meleeHit(74 * u, 5, { knock: 520, up: 260, stop: 0.07 });
    W.fx.ring(this.x + this.facing * 50 * u, this.y - 50 * u, COLORS.white, 26 * u, 0.2, 2);
    yield* this.wait(0.26);
    this.forcePose = null;
  }

  *chargeSlash() {
    const W = this.world, u = this.u;
    this.forcePose = 'pose'; this.poseRow = 0;
    Sound.play('legacy_aura', 0.3, 1.6);
    for (let e = 0; e < 0.55; e += W.dt) {
      if (chance(W.dt * 30)) {
        const a = rnd(0, Math.PI * 2);
        W.fx.add({ type: 'spark', x: this.x + Math.cos(a) * 60 * u, y: this.y - 60 * u + Math.sin(a) * 50 * u, vx: -Math.cos(a) * 200, vy: -Math.sin(a) * 200, g: 0, drag: 0.95, life: 0.3, color: COLORS.red, len: 7 });
      }
      yield;
    }
    this.forcePose = 'attack'; this.animT = this.attackDur * 0.3;
    W.cinema.shake(6, 0.25);
    Sound.play('slash', 0.9, 0.8);
    W.fx.slash(this.x + this.facing * 30 * u, this.y - 54 * u, this.facing, COLORS.red, 1.7 * u, { w: 10 });
    this.meleeHit(95 * u, 9, { knock: 560, up: 320, stop: 0.09 });
    yield* this.wait(0.3);
    this.forcePose = null;
  }

  *throwShuriken(t) {
    const W = this.world, u = this.u;
    this.facing = sign(t.x - this.x);
    yield* this.anim('attack', 0.1, { keep: true });
    const n = this.inventory.shuriken > 0 ? 3 : 1;
    if (n > 1) this.inventory.shuriken--;
    const ox = this.x + this.facing * 20 * u, oy = this.y - 60 * u;
    const base = Math.atan2(t.y - t.h / 2 - oy, t.x - ox);
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * 0.12;
      W.projectiles.push(new Projectile(W, { kind: 'shuriken', x: ox, y: oy, vx: Math.cos(a) * 860 * u, vy: Math.sin(a) * 860 * u, team: 'hero', owner: this, dmg: 2, r: 8 * u, life: 1.4, color: COLORS.white }));
    }
    Sound.play('slash', 0.35, 1.6);
    yield* this.wait(0.22);
    this.forcePose = null;
  }

  *jumpSlash(t) {
    const W = this.world, u = this.u;
    let struck = false;
    const tx = clamp(t.x - sign(t.x - this.x) * 10 * u, W.terrain.minX + 20, W.terrain.maxX - 20);
    const ty = Math.min(this.y, t.y + 40 * u);
    yield* this.jumpTo(tx, this.y, {
      arc: Math.max(40, (this.y - ty) / u),
      onAir: (e, T) => {
        if (!struck && this.vy > -200 && dist(this.x, this.y - 50 * u, t.x, t.y - t.h / 2) < 95 * u) {
          struck = true;
          this.facing = sign(t.x - this.x) || this.facing;
          this.forcePose = 'attack'; this.animT = this.attackDur * 0.35;
          Sound.play('slash', 0.8);
          W.fx.slash(this.x + this.facing * 20 * u, this.y - 54 * u, this.facing, COLORS.red, 1.2 * u, { a0: -2, a1: 1.4 });
          this.meleeHit(85 * u, 5, { knock: 300, up: 100, high: 130 });
        }
        if (!struck) { this.forcePose = 'pose'; this.poseRow = 1; }
      },
    });
    this.forcePose = null;
  }

  *shadowCut() {
    const W = this.world, u = this.u;
    const targets = this.enemyList().filter((e) => !e.flying && Math.abs(e.y - this.y) < 60 * u);
    if (targets.length < 2) return;
    const dir = sign(targets.reduce((s, e) => s + e.x, 0) / targets.length - this.x);
    const far = dir > 0 ? Math.max(...targets.map((e) => e.x)) + 90 * u : Math.min(...targets.map((e) => e.x)) - 90 * u;
    const endX = clamp(far, this.ground ? this.ground.x1 + 20 : 30, this.ground ? this.ground.x2 - 20 : W.terrain.W - 30);
    this.facing = dir;
    W.cinema.letterbox(2.6); W.cinema.slowmo(0.3, 1.4); W.cinema.focus(2);
    W.cinema.card('SCHATTENSCHNITT', 'SHADEPI · ERSTER KRIEGER DES ORDENS', COLORS.red, 1.8, { small: true, y: W.terrain.H * 0.22 });
    this.forcePose = 'pose'; this.poseRow = 0;
    Sound.play('legacy_aura', 0.5, 1.3);
    yield* this.wait(0.45);
    const x0 = this.x; let e = 0; const dur = 0.22;
    const passed = new Set();
    this.dashing = true; this.forcePose = 'run';
    this.invuln = 1.2;
    while (e < dur) {
      e += W.dt;
      const nx = lerp(x0, endX, easeIn(Math.min(1, e / dur)));
      for (const t of targets) if ((t.x - this.x) * dir >= 0 && (t.x - nx) * dir <= 0) passed.add(t);
      this.x = nx;
      const snap = { x: this.x, y: this.y, f: this.facing };
      W.fx.afterimage((ctx, col) => this.drawBody(ctx, snap.x, snap.y, { tint: col, tintAmt: 0.85, alpha: 0.7, pose: 'run', facing: snap.f }), 0.4, '#3a0008');
      yield;
    }
    this.dashing = false;
    W.fx.streak(x0, this.y - 50 * u, endX, this.y - 50 * u, COLORS.red, 0.6, 14 * u);
    this.forcePose = 'attack'; this.animT = this.attackDur * 0.85; this.attackDur = 1;
    yield* this.wait(0.5);
    Sound.play('slash', 1, 0.7); Sound.play('hit', 0.9);
    W.cinema.flash('#ff3150', 0.25); W.cinema.shake(9, 0.4);
    for (const t of passed) {
      W.fx.slash(t.x, t.y - t.h * 0.55, -dir, COLORS.red, 1.3 * u, { a0: -0.4, a1: 0.4, w: 9, life: 0.35 });
      damage(W, t, 12, this, { dir, knock: 380, up: 300, color: COLORS.redHot, stun: 0.8 });
    }
    yield* this.wait(0.3);
    this.forcePose = null;
  }

  *throwEmp(t) {
    const W = this.world, u = this.u;
    this.inventory.emp--;
    this.facing = sign(t.x - this.x);
    yield* this.anim('attack', 0.12, { keep: true });
    const T = 0.75, g = 1400;
    const ox = this.x + this.facing * 16 * u, oy = this.y - 70 * u;
    const ty = t.y - t.h / 2;
    W.projectiles.push(new Projectile(W, { kind: 'emp', x: ox, y: oy, vx: (t.x - ox) / T, vy: (ty - oy - 0.5 * g * T * T) / T, g, team: 'hero', owner: this, dmg: 0, r: 12, life: T + 0.05, color: COLORS.cyan }));
    this.say('fightStart');
    yield* this.wait(0.25);
    this.forcePose = null;
  }

  // Raven ------------------------------------------------------
  muzzle(crouch) {
    const S = this.S, f = this.facing;
    if (crouch) return { x: this.x + f * 50 * this.u, y: this.y - 62 * this.u };
    const m = f < 0 ? MUZZLE.left : MUZZLE.right;
    return { x: this.x + m[0] * S, y: this.y + m[1] * S };
  }

  *shoot(t, crouch = false) {
    const W = this.world, u = this.u;
    this.facing = sign(t.x - this.x) || this.facing;
    if (crouch) { this.forcePose = 'pose'; this.poseRow = 3; } else { this.forcePose = 'attack'; this.attackDur = 0.5; this.animT = 0.12; }
    yield* this.wait(0.07);
    const m = this.muzzle(crouch);
    let a = Math.atan2(t.y - t.h * 0.55 - m.y, t.x - m.x);
    const base = this.facing > 0 ? 0 : Math.PI;
    let d = Math.atan2(Math.sin(a - base), Math.cos(a - base));
    d = clamp(d, -1.1, 1.1); a = base + d;
    const big = this.buffs.overclock > 0;
    W.projectiles.push(new Projectile(W, { kind: 'bolt', big, x: m.x, y: m.y, vx: Math.cos(a) * 1050 * u, vy: Math.sin(a) * 1050 * u, team: 'hero', owner: this, dmg: big ? 3 : 2, r: (big ? 9 : 6) * u, life: 1.3, color: COLORS.cyan, knock: 120 }));
    W.fx.add({ type: 'strip', img: 'muzzle', x: m.x, y: m.y, life: 0.08, frames: 4, scale: 0.28 * u });
    W.fx.sparks(m.x, m.y, COLORS.cyan, 3, 160, { dir: a, spread: 0.4, g: 0 });
    Sound.play('pistol', 0.45, rnd(1.05, 1.2));
    yield* this.wait(big ? 0.09 : 0.24);
    this.forcePose = null;
  }

  *cast(targets, kind = 'lightning') {
    const W = this.world, u = this.u;
    if (!targets.length) return;
    this.facing = sign(targets[0].x - this.x) || this.facing;
    const dir = this.facing < 0 ? DIR.left : DIR.right;
    this.forcePose = 'cast'; this.castRow = 0; this.forceDir = dir;
    Sound.play('hack', 0.5, kind === 'hack' ? 0.9 : 1.2);
    for (let e = 0; e < 0.4; e += W.dt) {
      const p = castPalm(0, dir, this.x, this.y, this.S, false);
      if (chance(W.dt * 40)) W.fx.add({ type: 'pixel', x: p.x + rnd(-20, 20), y: p.y + rnd(-20, 20), vx: rnd(-20, 20), vy: rnd(-20, 20), g: 0, life: 0.3, color: COLORS.cyan, size: 2 });
      yield;
    }
    this.castRow = 1;
    const p = castPalm(1, dir, this.x, this.y, this.S, false);
    Sound.play('electric', 0.8);
    for (const t of targets) {
      if (t.dead) continue;
      const c = t.center();
      W.fx.lightning(p.x, p.y, c.x, c.y, COLORS.cyan, 0.3, 3);
      W.fx.lightning(p.x, p.y, c.x, c.y, COLORS.cyanHot, 0.22, 1.5);
      if (kind === 'hack' && t.hack) t.hack(this);
      else damage(W, t, kind === 'jam' ? 2 : 4, this, { knock: 100, color: COLORS.cyan, stun: kind === 'jam' ? 2.2 : 0.9 });
    }
    W.cinema.flash('#62e3ee', 0.08);
    yield* this.wait(0.3);
    this.castRow = 2;
    yield* this.wait(0.2);
    this.forcePose = null; this.forceDir = null;
  }

  // Kampfschleifen ---------------------------------------------
  *fight() {
    const W = this.world, u = this.u;
    if (W.enemies.some((e) => !e.dead && W.terrain.isHome(e.x, e.y - 10))) yield* this.comeHome();
    if (this.name === 'shadepi' ? chance(0.6) : chance(0.6)) this.say(pick(['fightStart', W.fightKind || 'fightStart']));
    let idle = 0;
    while (true) {
      const t = this.pickTarget();
      if (!t) { idle += W.dt; if (idle > 1.2) break; this.walkVx = 0; yield; continue; }
      idle = 0;
      if (!this.ground) { yield* this.waitGround(); continue; }
      if (this.inventory.emp > 0 && this.enemyList().length >= 2) { yield* this.throwEmp(t); continue; }
      if (this.name === 'shadepi') yield* this.fightStepShadepi(t);
      else yield* this.fightStepRaven(t);
      yield;
    }
    this.walkVx = 0;
    if (!this.world.hasEnemies()) {
      this.faceCam = true;
      yield* this.wait(0.4);
    }
  }

  *fightStepShadepi(t) {
    const W = this.world, u = this.u;
    const dx = t.x - this.x;
    if (this.specialCd <= 0 && this.enemyList().filter((e) => !e.flying && Math.abs(e.y - this.y) < 60 * u).length >= 3) {
      this.specialCd = rnd(14, 22);
      yield* this.shadowCut();
      return;
    }
    if (t.flying) {
      const rise = this.y - t.y;
      if (rise < this.jumpMax + 40 * u && rise > -40 * u && Math.abs(dx) < 260 * u && chance(0.6)) { yield* this.jumpSlash(t); return; }
      if (Math.abs(dx) > 420 * u) { this.facing = sign(dx); this.walkVx = sign(dx) * this.def.run * u; yield* this.wait(0.2); this.walkVx = 0; return; }
      yield* this.throwShuriken(t);
      yield* this.wait(rnd(0.15, 0.45));
      return;
    }
    // Bodengegner: auf dieselbe Fläche
    if (t.ground && this.wid !== t.wid) {
      if (t.y > this.y) {
        const tx = clamp(t.x - sign(dx) * 50 * u, W.terrain.minX + 20, W.terrain.maxX - 20);
        yield* this.jumpTo(tx, t.y, { onAir: () => { this.forcePose = this.vy > 0 ? 'pose' : 'jump'; this.poseRow = 1; } });
        if (dist(this.x, this.y, t.x, t.y) < 110 * u) { W.cinema.shake(5, 0.2); W.fx.dust(this.x, this.y, 8, u); this.meleeHit(90 * u, 4, { knock: 320, up: 200 }); }
        return;
      }
      yield* this.throwShuriken(t); return;
    }
    if (Math.abs(dx) > 62 * u) {
      this.facing = sign(dx);
      this.walkVx = sign(dx) * this.def.run * u;
      if (Math.abs(dx) > 200 * u && chance(0.02)) W.fx.speedLines(this.x, this.y, this.facing);
      yield;
      this.walkVx = 0;
      return;
    }
    this.walkVx = 0;
    this.facing = sign(dx) || this.facing;
    const r = rand();
    if (t.stun > 0.6 && t.maxHp >= 8 && chance(0.5)) yield* this.chargeSlash();
    else if (r < 0.55) { yield* this.slash(); if (!t.dead && chance(0.6)) yield* this.slash(); if (!t.dead && chance(0.35)) yield* this.kick(); }
    else if (r < 0.8) yield* this.kick();
    else yield* this.chargeSlash();
    yield* this.wait(rnd(0.1, 0.35));
  }

  *fightStepRaven(t) {
    const W = this.world, u = this.u;
    const dx = t.x - this.x;
    const ad = Math.abs(dx);
    this.castCd -= 0;
    // Nahkämpfer zu nah: wegspringen
    if (!t.flying && t.ground && t.wid === this.wid && ad < 110 * u && this.ground) {
      const s = this.ground;
      const away = -sign(dx);
      const tx = clamp(this.x + away * 190 * u, s.x1 + 20, s.x2 - 20);
      if (Math.abs(tx - this.x) > 60 * u) { yield* this.jumpTo(tx, this.y, { arc: 70, quick: true }); this.facing = sign(t.x - this.x); return; }
    }
    if (this.castCd <= 0) {
      const viruses = this.enemyList().filter((e) => e.kind === 'virus');
      const drones = this.enemyList().filter((e) => e.kind === 'drone' && !e.hacked);
      const heavy = this.enemyList().filter((e) => e.maxHp >= 10 && e.stun < 0.5);
      if (drones.length && chance(0.55)) { this.castCd = rnd(5, 8); this.say('drones'); yield* this.cast([drones.sort((a, b) => Math.abs(a.x - this.x) - Math.abs(b.x - this.x))[0]], 'hack'); return; }
      if (viruses.length >= 2) { this.castCd = rnd(4, 6); yield* this.cast(viruses.slice(0, 3), 'lightning'); return; }
      if (heavy.length) { this.castCd = rnd(5, 8); yield* this.cast([heavy[0]], 'jam'); return; }
      this.castCd = rnd(1, 2);
    }
    // Abstand halten
    const want = t.flying ? 160 * u : 250 * u;
    if (ad > want + 160 * u) { this.facing = sign(dx); this.walkVx = sign(dx) * this.def.run * u * 0.8; yield* this.wait(0.15); this.walkVx = 0; return; }
    if (!t.flying && ad < want - 90 * u && this.ground) {
      const s = this.ground; const back = this.x - sign(dx) * 60 * u;
      if (back > s.x1 + 10 && back < s.x2 - 10) { this.facing = -sign(dx); this.walkVx = -sign(dx) * this.def.walk * u * 1.4; yield* this.wait(0.2); this.walkVx = 0; }
    }
    const burst = this.buffs.overclock > 0 ? 5 : rndi(1, 3);
    const crouch = chance(0.3);
    for (let i = 0; i < burst && !t.dead; i++) yield* this.shoot(t, crouch);
    yield* this.wait(this.buffs.overclock > 0 ? 0.05 : rnd(0.15, 0.4));
  }

  // ======================================================== Freizeit
  think() {
    const W = this.world;
    if (W.hasEnemies() && W.settings.paused === false) { this.setTask('fight', this.fight(), 3); return; }
    if (!this.ground) return;
    this.thinkCd -= W.dt;
    if (this.thinkCd > 0) return;
    this.thinkCd = rnd(0.6, 2.4) * W.calmFactor;
    if (W.settings.paused) { if (chance(0.3)) this.setTask('nap', this.nap(), 0.5); return; }
    const T = W.terrain;
    const items = W.items.filter((i) => !i.dead && !i.dragged && i.ground && Math.abs(i.x - this.x) < 700);
    const pickups = items.filter((i) => i.pickup && (!i.forHero || i.forHero === this.name));
    const toys = items.filter((i) => i.toy);
    const wins = T.windowSurfaces().filter((s) => s.x2 - s.x1 > 110 * this.u);
    const onWin = this.wid !== 'floor';
    const raven = this.name === 'raven';
    const choice = weighted([
      ['wander', onWin ? 1.5 : 2.5],
      ['look', onWin ? 2 : 1.5],
      ['rest', onWin ? 4.5 : (raven ? 0.8 : 0.5)],
      ['climb', W.settings.climbWindows && wins.length ? (onWin ? 0.8 : 4.5) : 0],
      ['drop', onWin ? 0.5 : 0],
      ['pickup', pickups.length ? 6 : 0],
      ['toy', toys.length ? 3 : 0],
      ['nap', (onWin ? 0.7 : 0.25) * (isNight() ? 4 : 1)],
      ['hackWin', raven && onWin ? 0.8 : 0],
      ['roam', T.multi ? (T.isHome(this.x, this.y - 10) ? 1.8 : 0.9) : 0],
    ]);
    switch (choice) {
      case 'wander': this.setTask('wander', this.wander(), 0.5); break;
      case 'look': this.setTask('look', this.lookAround(), 0.5); break;
      case 'climb': this.setTask('climb', this.climbSomewhere(pick(wins)), 0.8); break;
      case 'drop': this.setTask('drop', this.dropDown(), 0.6); break;
      case 'pickup': this.setTask('pickup', this.fetch(pickups.sort((a, b) => Math.abs(a.x - this.x) - Math.abs(b.x - this.x))[0]), 1); break;
      case 'toy': this.setTask('toy', this.playWith(pick(toys)), 1); break;
      case 'nap': this.setTask('nap', this.nap(), 0.5); break;
      case 'rest': this.setTask('rest', raven || hasClimbArt(this.name) ? this.sit() : this.guard(), 0.5); break;
      case 'hackWin': this.setTask('hackWin', this.hackWindow(), 0.6); break;
      case 'roam': this.setTask('roam', this.roam(), 0.7); break;
    }
  }

  *wander() {
    const s = this.ground; if (!s) return;
    const x = clamp(this.x + rnd(-320, 320) * this.u, s.x1 + 20, s.x2 - 20);
    yield* this.walkTo(x, chance(0.12));
    if (chance(0.18)) this.say('idle');
    yield* this.wait(rnd(0.8, 2.5));
  }
  *lookAround() {
    this.faceCam = true;
    if (chance(0.25)) this.say('idle');
    yield* this.wait(rnd(1.5, 3.5));
    this.faceCam = false;
    this.facing = -this.facing;
    yield* this.wait(rnd(0.6, 1.5));
  }
  *climbSomewhere(s) {
    if (!s) return;
    const ok = yield* this.goToSurface(s);
    if (ok) {
      const win = this.world.terrain.byId.get(this.wid);
      if (win && win.title && chance(0.35)) this.say('windowTop', win.title.length > 28 ? win.title.slice(0, 26) + '…' : win.title);
      yield* this.wait(rnd(0.5, 1.5));
      yield* this.wander();
    }
  }
  // Raven setzt sich an die Kante (Beine baumeln vor dem Fenster)
  *sit() {
    const W = this.world;
    const s = this.ground; if (!s) return;
    // ein Stück von der Ecke weg
    if (this.x < s.x1 + 30 * this.u || this.x > s.x2 - 30 * this.u) yield* this.walkTo(clamp(this.x, s.x1 + 34 * this.u, s.x2 - 34 * this.u));
    this.forcePose = 'sit'; this.animT = 0;
    Sound.play('drive_knock', 0.15, 0.8);
    const dur = rnd(14, 34) / W.calmFactor * (this.wid !== 'floor' ? 1 : 0.6);
    if (chance(0.35)) {
      const win = W.terrain.byId.get(this.wid);
      if (win && win.title && chance(0.5)) this.say('windowTop', win.title.length > 28 ? win.title.slice(0, 26) + '…' : win.title);
      else this.say('idle');
    }
    this.sitFrame = 0;
    for (let e = 0; e < dur; e += W.dt) {
      if (chance(W.dt * 0.08)) this.facing = -this.facing;
      if (chance(W.dt * 0.2)) this.sitFrame = weighted([[0, 5], [1, 1], [2, 1], [3, 1.5], [4, 1], [5, 1], [6, isNight() ? 2 : 0.3]]);
      if (chance(W.dt * 0.03)) { this.say('idle'); if (hasClimbArt(this.name) && chance(0.5)) this.sitFrame = 7; }
      yield;
    }
    this.forcePose = null;
  }
  // Shadepi hält Wache
  *guard() {
    const W = this.world;
    const dur = rnd(12, 28) / W.calmFactor * (this.wid !== 'floor' ? 1 : 0.6);
    if (chance(0.3)) this.say('idle');
    for (let e = 0; e < dur; e += W.dt) {
      this.faceCam = Math.sin(e * 0.4) > -0.3;
      if (!this.faceCam && chance(W.dt * 0.3)) this.facing = -this.facing;
      if (chance(W.dt * 0.02)) this.say('idle');
      yield;
    }
    this.faceCam = false;
  }
  *nap() {
    if (this.name === 'raven') { yield* this.napLying(); return; }
    this.faceCam = false; this.forceDir = this.facing < 0 ? DIR.downLeft : DIR.downRight;
    if (chance(0.5)) this.say('sleepy');
    const W = this.world;
    for (let e = 0, z = 0; e < rnd(6, 12); e += W.dt) {
      z -= W.dt;
      if (z <= 0) { z = 1.1; W.fx.add({ type: 'text', layer: 'top', x: this.x + 14 * this.u, y: this.y - 92 * this.u, vx: 18, vy: -30, g: 0, life: 1.6, text: 'z', color: COLORS.muted, size: 16, stay: true }); }
      this.squash = 1 - 0.015 * (1 + Math.sin(e * 2));
      yield;
      if (!W.settings.paused && e > 4 && chance(W.dt * 0.2)) break;
    }
    this.squash = 1; this.forceDir = null;
  }
  *napLying() {
    const W = this.world;
    const s = this.ground; if (!s) return;
    if (this.x < s.x1 + 50 * this.u || this.x > s.x2 - 50 * this.u) yield* this.walkTo(clamp(this.x, s.x1 + 55 * this.u, s.x2 - 55 * this.u));
    if (chance(0.5)) this.say('sleepy');
    this.forcePose = 'lie';
    for (let e = 0, z = 0; e < rnd(10, 22); e += W.dt) {
      z -= W.dt;
      if (z <= 0) { z = 1.3; W.fx.add({ type: 'text', layer: 'top', x: this.x - this.facing * 30 * this.u, y: this.y - 40 * this.u, vx: 14, vy: -26, g: 0, life: 1.8, text: 'z', color: COLORS.muted, size: 16, stay: true }); }
      yield;
      if (!W.settings.paused && e > 6 && chance(W.dt * 0.1)) break;
    }
    this.forcePose = 'sit';
    yield* this.wait(0.8);
    this.forcePose = null;
  }
  *fetch(item) {
    if (!item || item.dead) return;
    if (item.wid !== this.wid && item.ground) {
      const s = this.world.terrain.surfaceOf(item.wid, item.x, 2) || this.world.terrain.surfaces[0];
      if (s.wid === 'floor' && this.wid !== 'floor') yield* this.dropDown();
      else if (s.wid !== this.wid) yield* this.goToSurface(s);
    }
    yield* this.walkTo(item.x, true, 10 * this.u);
    if (!item.dead && Math.abs(item.x - this.x) < 30 * this.u) item.collect(this);
  }
  *playWith(item) {
    if (!item || item.dead) return;
    const u = this.u;
    if (item.kind === 'barrel') {
      if (this.name === 'raven') {
        this.say('toy', 'barrel');
        const s = this.ground; if (!s) return;
        const away = clamp(item.x + sign(this.x - item.x || 1) * 260 * u, s.x1 + 20, s.x2 - 20);
        yield* this.walkTo(away, true);
        if (item.dead) return;
        yield* this.wait(0.4);
        yield* this.shoot(item);
        yield* this.wait(0.8);
        this.faceCam = true; yield* this.wait(1.2); this.faceCam = false;
      } else { this.say('toy', 'barrel'); yield* this.wait(1); }
      return;
    }
    if (item.wid !== this.wid) { if (this.wid !== 'floor' && item.wid === 'floor') yield* this.dropDown(); else return; }
    if (!item.seen) { item.seen = true; this.say('toy', item.def.kind || item.kind); }
    const side = sign(this.x - item.x) || 1;
    yield* this.walkTo(item.x + side * 38 * u, false, 6);
    if (item.dead) return;
    this.facing = sign(item.x - this.x) || this.facing;
    if (item.kind === 'crate' && this.name === 'shadepi') { for (let i = 0; i < 3 && !item.dead; i++) yield* (i === 2 ? this.kick() : this.slash()); return; }
    if ((item.kind === 'server' || item.kind === 'fusebox' || item.kind === 'vending') && this.name === 'raven') {
      yield* this.cast([item], 'hack');
      item.hacked && item.hacked(this);
      return;
    }
    if (item.kind === 'vending' && this.name === 'shadepi') { yield* this.kick(); return; }
    if (item.kind === 'fusebox' && this.name === 'shadepi') { this.say('toy', 'fusebox'); yield* this.wait(1); return; }
    // Ball / Holowürfel kicken
    if (this.name === 'shadepi') { yield* this.anim('pose', 0.12, { row: 2, keep: true }); }
    else { yield* this.anim('attack', 0.12, { keep: true }); }
    if (Math.abs(item.x - this.x) < 70 * u) item.kick(this.facing * rnd(380, 650) * u, -rnd(350, 650) * u, this);
    yield* this.wait(0.3);
    this.forcePose = null;
    yield* this.wait(rnd(0.3, 1));
  }
  *hackWindow() {
    const W = this.world, u = this.u;
    const win = W.terrain.byId.get(this.wid);
    if (!win) return;
    this.say('windowTop', win.title ? (win.title.length > 24 ? win.title.slice(0, 22) + '…' : win.title) : 'Fenster');
    this.forcePose = 'cast'; this.castRow = 0; this.forceDir = DIR.down;
    for (let e = 0; e < 2.4; e += W.dt) {
      if (chance(W.dt * 25)) W.fx.add({ type: 'text', x: this.x + rnd(-80, 80) * u, y: this.y + rnd(6, 26), vx: 0, vy: rnd(10, 40), g: 0, life: 0.9, text: pick(['0', '1', '#', '/', 'A', 'F']), color: COLORS.cyan, size: 12 });
      if (e > 0.6) this.castRow = 1;
      yield;
    }
    Sound.play('calib_accept', 0.4);
    this.forcePose = null; this.forceDir = null;
  }

  // Training mit Missgeschick ------------------------------------
  *training() {
    const W = this.world, u = this.u;
    yield* this.waitGround();
    const s = this.ground; if (!s) return;
    // etwas Platz suchen
    yield* this.walkTo(clamp(this.x, s.x1 + 90 * u, s.x2 - 90 * u));
    W.cinema.card('TRAINING', 'SHADEPI · FORM DES FALLENDEN BLATTS', COLORS.red, 2.2, { small: true, x: clamp(this.x, 220, W.terrain.W - 220), y: Math.max(60, this.y - 230 * u) });
    let holeDone = !W.settings.screenDamage;
    const reps = rndi(5, 8);
    for (let i = 0; i < reps; i++) {
      if (i % 2 === 0) this.say('training');
      if (chance(0.5)) this.facing = -this.facing;
      const m = rand();
      if (!holeDone && i >= 2 && chance(0.4)) { holeDone = true; yield* this.accidentHole(); continue; }
      if (m < 0.45) yield* this.slash();
      else if (m < 0.7) yield* this.kick();
      else if (m < 0.85) yield* this.chargeSlash();
      else {
        // Sprung mit Drehschlag
        const tx = clamp(this.x + this.facing * 120 * u, s.x1 + 30, s.x2 - 30);
        let did = false;
        yield* this.jumpTo(tx, this.y, { arc: 110, onAir: () => { if (!did && this.vy > -100) { did = true; this.forcePose = 'attack'; this.animT = 0.1; Sound.play('slash', 0.6); W.fx.slash(this.x, this.y - 50 * u, this.facing, COLORS.red, 1.3 * u, { a0: -3, a1: 2.5 }); } } });
      }
      yield* this.wait(rnd(0.3, 0.8));
    }
    this.faceCam = true;
    yield* this.wait(1.2);
    this.faceCam = false;
  }

  *accidentHole() {
    const W = this.world, u = this.u;
    const hx = clamp(this.x + this.facing * 58 * u, 50, W.terrain.W - 50), hy = this.y - 58 * u;
    // Ausholen Richtung Betrachter
    this.forcePose = 'pose'; this.poseRow = 0; this.forceDir = this.facing < 0 ? DIR.downLeft : DIR.downRight;
    yield* this.wait(0.35);
    this.forcePose = 'attack'; this.forceDir = this.facing < 0 ? DIR.downLeft : DIR.downRight; this.animT = 0.1; this.attackDur = 0.5;
    yield* this.wait(0.08);
    const hole = new ScreenHole(hx, hy, 30 * u);
    W.screen.push(hole);
    W.cinema.stop(0.12); W.cinema.shake(9, 0.35); W.cinema.flash('#ffffff', 0.22);
    Sound.play('prop_blast', 0.8); Sound.play('hit', 0.9, 0.7);
    W.fx.shards(hx, hy, 18); W.fx.sparks(hx, hy, COLORS.cyanHot, 14, 380);
    yield* this.wait(0.5);
    this.forcePose = null; this.forceDir = null;
    this.faceCam = true;
    yield* this.wait(0.5);
    this.say('oops', null, true);
    yield* this.wait(1.4);
    const p = this.partner;
    if (p && !p.ko && chance(0.7)) { p.say('holeReact', null, true); p.facing = sign(this.x - p.x); yield* this.wait(1.6); this.talk('Er stand im Weg.', true); yield* this.wait(1.2); }
    // Flicken
    this.faceCam = false;
    yield* this.walkTo(hx - this.facing * 34 * u, false, 4);
    this.facing = sign(hx - this.x) || this.facing;
    this.forceDir = this.facing < 0 ? DIR.upLeft : DIR.upRight;
    hole.state = 'taping';
    const strips = rndi(3, 4);
    for (let i = 0; i < strips; i++) {
      this.forcePose = i % 2 ? 'idle' : 'attack'; this.animT = 0.1; this.attackDur = 1.5;
      hole.addTape(rnd(-0.9, 0.9) + (i % 2 ? Math.PI / 2 : 0) * 0.5, hole.r * rnd(2.3, 2.8));
      Sound.play('drive_knock', 0.4, rnd(1.4, 1.8));
      yield* this.wait(0.55);
    }
    hole.state = 'patched';
    this.forcePose = null; this.forceDir = null;
    W.fx.label(hx, hy - hole.r - 14, 'GEFLICKT', COLORS.white, 16, 1.3);
    this.faceCam = true;
    this.say('tape', null, true);
    yield* this.wait(1.6);
    this.faceCam = false;
  }

  // Ravens Wartungsluke ---------------------------------------
  *hatchRepair() {
    const W = this.world, u = this.u;
    yield* this.waitGround();
    const s = this.ground; if (!s) return;
    const side = this.x > (s.x1 + s.x2) / 2 ? -1 : 1;
    yield* this.walkTo(clamp(this.x, s.x1 + 40 * u, s.x2 - 130 * u * (side > 0 ? 1 : 0) - 40 * u * (side < 0 ? 0 : 1)));
    const hw = 132 * u, hh = 96 * u;
    const hx = clamp(this.x + side * 92 * u, hw / 2 + 10, W.terrain.W - hw / 2 - 10);
    const hy = Math.max(hh / 2 + 10, this.y - 104 * u);
    const hatch = new Hatch(hx, hy, hw, hh);
    this.facing = side;
    this.say('hatchStart', null, true);
    yield* this.wait(1.4);
    W.screen.push(hatch);
    const dirUp = side < 0 ? DIR.upLeft : DIR.upRight;
    try {
      // Scannen
      this.forcePose = 'idle'; this.forceDir = dirUp;
      for (let e = 0; e < 1.1; e += W.dt) { hatch.scan = e / 1.1; if (chance(W.dt * 6)) Sound.play('calib_tick', 0.3); yield; }
      hatch.scan = 1;
      // Schrauben lösen
      this.forcePose = 'cast'; this.castRow = 0; this.forceDir = dirUp;
      for (let e = 0; e < 0.9; e += W.dt) { hatch.screws = 1 - e / 0.9; yield; }
      hatch.screws = 0;
      W.fx.pixels(hx, hy + hh * 0.4, '#9aa0a8', 4, 120, { g: 900, size: 3 });
      Sound.play('calib_lock', 0.5);
      W.bubbles.sayAt(hx, hy - hh / 2, 'ARToS', COLORS.amber, LINES.artos.hatch[0], 2.2);
      // Klappe öffnen
      this.forcePose = 'idle';
      Sound.play('prop_metal', 0.5);
      for (let e = 0; e < 0.7; e += W.dt) { hatch.open = easeOut(e / 0.7); yield; }
      hatch.open = 1;
      W.cinema.shake(2, 0.15);
      yield* this.wait(0.6);
      this.say('hatchWork', null, true);
      // Kabel neu verbinden
      const order = hatch.cables.map((c, i) => i).filter((i) => !hatch.cables[i].fixed);
      for (const i of order) {
        this.forcePose = 'cast'; this.castRow = 0; this.forceDir = dirUp;
        yield* this.wait(0.35);
        this.castRow = 1;
        const p = castPalm(1, dirUp, this.x, this.y, this.S, false);
        const port = hatch.port(1, hatch.cables[i].want);
        W.fx.lightning(p.x, p.y, port.x, port.y, COLORS.cyan, 0.25, 2);
        hatch.rewire(i);
        Sound.play('hack', 0.45, rnd(1, 1.3));
        yield* this.wait(0.45);
        W.fx.sparks(port.x, port.y, COLORS.cyan, 8, 200);
        Sound.play('calib_tick', 0.4);
        if (chance(0.22)) { this.forcePose = 'hit'; this.forceDir = null; W.fx.sparks(p.x, p.y, COLORS.amber, 10, 260); Sound.play('electric', 0.5); this.talk(pick(['Au!', 'Autsch! Heiß!', 'Hey, beiß nicht!']), true); yield* this.wait(0.7); }
        else if (chance(0.25)) this.say('hatchWork');
        this.castRow = 2;
        yield* this.wait(0.3);
      }
      Sound.play('calib_accept', 0.6);
      W.bubbles.sayAt(hx, hy - hh / 2, 'ARToS', COLORS.amber, LINES.artos.hatch[1], 2.6);
      W.fx.label(hx, hy - hh / 2 - 20, 'SIGNAL 100%', COLORS.cyan, 16, 1.5);
      yield* this.wait(1.2);
      // Schließen
      this.forcePose = 'idle';
      for (let e = 0; e < 0.6; e += W.dt) { hatch.open = 1 - easeIn(e / 0.6); yield; }
      hatch.open = 0;
      Sound.play('prop_metal', 0.5, 1.2);
      this.forcePose = 'cast'; this.castRow = 2;
      for (let e = 0; e < 0.6; e += W.dt) { hatch.screws = e / 0.6; yield; }
      hatch.screws = 1;
      this.forcePose = null; this.forceDir = null;
      this.faceCam = true;
      this.say('hatchDone', null, true);
      yield* this.wait(1.6);
      this.faceCam = false;
    } finally {
      hatch.done = true;
      this.forcePose = null; this.forceDir = null;
    }
  }

  // Zu oft angeklickt ------------------------------------------
  *annoyed() {
    const W = this.world, u = this.u, T = W.terrain;
    this.faceCam = true;
    if (this.name === 'shadepi') {
      this.talk(pick(['Genug.', 'Ich sagte: nicht stupsen.', 'Schatten lassen sich nicht anfassen.']), true);
      yield* this.wait(1.1);
      W.fx.smokePuff(this.x, this.y - 30 * u, 0.7 * u, 0.9);
      Sound.play('slash', 0.4, 0.6);
      const s = pick(T.allSurfaces().filter((q) => q.x2 - q.x1 > 80));
      this.alpha = 0;
      yield* this.wait(0.6);
      this.x = clamp(rnd(s.x1 + 30, s.x2 - 30), 30, T.W - 30); this.y = s.y; this.land(s, 0);
      W.fx.smokePuff(this.x, this.y - 30 * u, 0.7 * u, 0.9);
      this.alpha = 1;
      yield* this.wait(0.4);
      this.talk('Hier bin ich sicher.', true);
    } else {
      this.talk(pick(['Okay, jetzt reicht’s! Ich hack deinen Cursor!', 'Klick-Spam erkannt. Gegenmaßnahme!']), true);
      this.forcePose = 'cast'; this.forceDir = DIR.down; this.castRow = 0;
      yield* this.wait(0.6);
      this.castRow = 1;
      Sound.play('hack', 0.6);
      for (let e = 0; e < 3; e += W.dt) {
        const m = W.mouse;
        if (chance(W.dt * 8)) {
          const p = castPalm(1, DIR.down, this.x, this.y, this.S);
          W.fx.lightning(p.x, p.y, m.x, m.y, COLORS.cyan, 0.12, 1.5);
        }
        W.fx.add({ type: 'ring', x: m.x, y: m.y, life: 0.12, r0: 18, r1: 22, color: COLORS.cyan, w: 2 });
        yield;
      }
      this.forcePose = null; this.forceDir = null;
      this.talk('So. Cursor gesichert. Benimm dich.', true);
    }
    yield* this.wait(1.5);
    this.faceCam = false;
  }

  // Erinnerung überbringen ---------------------------------------
  *remind(rem, R) {
    yield* this.comeHome();
    const W = this.world, u = this.u;
    yield* this.waitGround(2);
    if (W.mouse.active && this.ground) {
      const s = this.ground;
      const tx = clamp(W.mouse.x + (this.name === 'raven' ? -70 : 70) * u, s.x1 + 20, s.x2 - 20);
      yield* this.walkTo(tx, true, 10, 3);
    }
    this.faceCam = true;
    if (R.deliverers && R.deliverers[1] === this) yield* this.wait(2.4);
    if (R.active === rem) this.talk(rem.line(this), true);
    let t = 0;
    while (R.active === rem) {
      t += W.dt;
      if (this.name === 'raven') {
        this.forcePose = 'cast'; this.forceDir = DIR.down; this.castRow = Math.floor(t * 1.5) % 2;
        if (chance(W.dt * 14)) { const p = castPalm(1, DIR.down, this.x, this.y, this.S); W.fx.add({ type: 'pixel', x: p.x + rnd(-14, 14), y: p.y + rnd(-14, 6), vx: 0, vy: -rnd(20, 60), g: 0, life: 0.6, color: COLORS.cyan, size: 2 }); }
      } else {
        this.forcePose = null;
        if (this.ground && t % 2.4 < W.dt) { this.vy = -430 * u; this.leaveGround(); W.fx.dust(this.x, this.y, 3, u); }
      }
      yield;
    }
    this.forcePose = null; this.forceDir = null; this.faceCam = false;
  }

  // Auftritt / Abgang --------------------------------------------
  *arrive(style) {
    const W = this.world, u = this.u, T = W.terrain;
    this.absent = false; this.ko = false; this.hp = Math.max(this.hp, this.maxHp * 0.7);
    const x = this.x;
    if (this.name === 'shadepi') {
      if (style === 'shadow') {
        this.y = T.floorY; this.land(T.surfaces[0], 0); this.alpha = 0;
        W.fx.smokePuff(x, this.y - 20 * u, 0.8 * u, 0.9); W.fx.smokePuff(x + 20, this.y - 40 * u, 0.6 * u, 0.8);
        Sound.play('legacy_aura', 0.4, 1.4);
        for (let e = 0; e < 0.8; e += W.dt) { this.alpha = e / 0.8; yield; }
        this.alpha = 1;
      } else {
        this.y = -40; this.leaveGround(); this.vy = 900; this.vx = 0;
        this.forcePose = 'pose'; this.poseRow = 1;
        yield* this.waitGround(4);
        W.cinema.shake(7, 0.3); W.fx.dust(this.x, this.y, 12, 1.4 * u); W.fx.ring(this.x, this.y - 4, COLORS.white, 70 * u, 0.3, 2);
        Sound.play('drive_touchdown', 0.6);
        this.forcePose = 'pose'; this.poseRow = 0;
        yield* this.wait(0.5);
        this.forcePose = null;
      }
    } else {
      // Abseilen vom oberen Bildschirmrand
      const s = T.below(x, 0);
      this.y = 0; this.leaveGround(); this.gravity = 0;
      this.grapple = { x, y: 0, tx: x, ty: 0, k: 1, rope: true };
      Sound.play('drive_shot', 0.5, 1.2);
      this.forcePose = 'jump';
      const dur = Math.max(0.6, (s.y) / 900);
      for (let e = 0; e < dur; e += W.dt) { this.y = lerp(0, s.y, easeInOut(e / dur)); this.grapple.x = this.x; this.grapple.y = this.y - 70 * u; yield; }
      this.grapple = null; this.gravity = 1;
      this.land(s, 200);
      this.forcePose = 'crouch'; yield* this.wait(0.25); this.forcePose = null;
      W.fx.dust(this.x, this.y, 6, u);
    }
    yield* this.wait(0.2);
  }

  *depart() {
    const W = this.world, u = this.u;
    this.faceCam = true;
    this.say('leave', null, true);
    yield* this.wait(1.6);
    this.faceCam = false;
    if (this.name === 'shadepi') {
      W.fx.smokePuff(this.x, this.y - 20 * u, 0.8 * u, 0.9); W.fx.smokePuff(this.x - 10, this.y - 50 * u, 0.6 * u, 0.8);
      Sound.play('slash', 0.3, 0.6);
      for (let e = 0; e < 0.5; e += W.dt) { this.alpha = 1 - e / 0.5; yield; }
    } else {
      Sound.play('hack', 0.5, 0.8);
      for (let e = 0; e < 0.8; e += W.dt) {
        this.alpha = 1 - e / 0.8;
        if (chance(W.dt * 50)) W.fx.add({ type: 'pixel', x: this.x + rnd(-16, 16) * u, y: this.y - rnd(0, 86) * u, vx: 0, vy: -rnd(20, 90), g: 0, life: 0.6, color: pick([COLORS.cyan, '#2a3fd0', '#ffffff']), size: 3 });
        yield;
      }
    }
    this.alpha = 0;
    this.absent = true;
    W.bubbles.clear(this);
  }

  // ======================================================== Reaktionen
  onHurt(amount) {
    this.hurtT = 0.18;
    if (chance(0.25)) this.say('hurt');
  }
  die() {
    // Helden sterben nicht – sie gehen kurz in die Knie und regenerieren.
    this.dead = false;
    this.ko = true; this.koT = 5;
    this.cancelTask();
    this.say('ko', null, true);
    this.world.cinema.slowmo(0.4, 0.6);
    this.invuln = 6;
  }
  revive() {
    this.ko = false; this.hp = Math.round(this.maxHp * 0.55);
    this.invuln = 1.5;
    this.world.fx.ring(this.x, this.y - 40 * this.u, this.name === 'shadepi' ? '#ffffff' : COLORS.cyan, 90 * this.u, 0.5, 4);
    Sound.play(this.name === 'shadepi' ? 'legacy_transfer' : 'calib_accept', 0.5);
    this.say('revive', null, true);
  }

  grab() {
    this.cancelTask();
    this.dragged = true;
    this.leaveGround();
    this.forcePose = null;
    this.swing = 0; this.swingV = 0; this.shakeMeter = 0;
    this.dragLineCd = 0.15;
    this.world.bubbles.clear(this);
    Sound.play('calib_error', 0.35, 1.3);
  }
  onDrag(dt, mvx, mvy, accel) {
    // Pendel am Kragen
    this.swingV += (-this.swing * 40 - this.swingV * 4 - mvx * 0.012) * dt;
    this.swing = clamp(this.swing + this.swingV * dt, -1.1, 1.1);
    this.shakeMeter = Math.max(0, this.shakeMeter - dt * 1.2) + Math.min(3, accel / 40000) * dt;
    this.dragLineCd -= dt;
    if (this.dragLineCd <= 0) {
      this.dragLineCd = rnd(1.8, 3);
      if (this.shakeMeter > 1.2) { this.say('shake', null, true); this.dizzy = 2.5; }
      else this.say('drag', null, true);
    }
    if (Math.abs(mvx) > 60) this.facing = -sign(mvx);
  }
  onWindowJolt(dx, dy) {
    if (this.dragged || this.ko || (this.task && this.taskPrio >= 4)) return false;
    this.cancelTask();
    this.leaveGround();
    this.vx = clamp(-dx * 9, -900, 900); this.vy = -Math.max(260, Math.abs(dy) * 6);
    this.afterThrow = true;
    this.say('jolt', null, true);
    Sound.play('calib_error', 0.35, 1.2);
    return true;
  }
  onRelease(vx, vy) {
    this.release(vx, vy);
    this.afterThrow = true;
    this.swing = 0;
  }
  onLand(impact, air) {
    const W = this.world;
    if (this.afterThrow) {
      this.afterThrow = false;
      this.spin = 0;
      this.thrown = false;
      W.fx.dust(this.x, this.y, impact > 1000 ? 12 : 5, this.u);
      if (impact > 1300) { W.cinema.shake(4, 0.2); Sound.play('drive_touchdown', 0.5); }
      this.setTask('recover', this.recover(impact), 2);
    } else if (impact > 700 && air > 0.25) {
      W.fx.dust(this.x, this.y, 4, this.u);
    }
  }
  *recover(impact) {
    this.forcePose = impact > 1300 ? 'hit' : 'crouch';
    yield* this.wait(impact > 1300 ? 0.6 : 0.2);
    this.forcePose = null;
    if (this.dizzy > 0) {
      this.say('dizzy', null, true);
      for (let e = 0; e < 2.2; e += this.world.dt) { this.squash = 1 + Math.sin(e * 12) * 0.02; yield; }
      this.squash = 1; this.dizzy = 0;
    }
    this.faceCam = true;
    this.say('thrown', null, true);
    yield* this.wait(2);
    this.faceCam = false;
  }
  poke() {
    if (this.dragged || this.ko || this.taskName === 'annoyed') return;
    const now = this.world.time;
    this.pokes = (this.pokes || []).filter((t) => now - t < 4);
    this.pokes.push(now);
    if (this.pokes.length >= 5 && (!this.task || this.taskPrio < 3)) { this.pokes = []; this.setTask('annoyed', this.annoyed(), 3); return; }
    this.faceCam = true;
    this.say('poke', null, true);
    this.flash = 0.06;
    if (this.ground && !this.task) {
      this.vy = -380 * this.u; this.leaveGround();
    }
    setTimeout(() => { if (!this.task) this.faceCam = false; }, 1600);
  }

  // ======================================================== Update
  update(dt) {
    const W = this.world;
    if (W.duel && W.duel.owns(this)) return;
    this.tickTimers(dt);
    if (this.absent) { if (this.task) this.runTask(); return; }
    for (const k in this.buffs) this.buffs[k] = Math.max(0, this.buffs[k] - dt);
    this.specialCd -= dt; this.castCd -= dt; this.hurtT -= dt;
    if (!W.hasEnemies() && !this.ko && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + dt * 3);
    if (this.dragged) { this.animT += dt; return; }
    if (this.ko) {
      this.koT -= dt; this.walkVx = 0;
      if (chance(dt * 12)) this.name === 'shadepi' ? W.fx.nanites(this, 2) : W.fx.add({ type: 'pixel', x: this.x + rnd(-14, 14), y: this.y - rnd(10, 70) * this.u, vx: 0, vy: -40, g: 0, life: 0.5, color: COLORS.cyan, size: 2 });
      if (this.koT <= 0) this.revive();
      this.physics(dt); this.animT += dt;
      return;
    }
    // Gegner da? Dann Freizeit unterbrechen (Training, Sitzen, Luke …)
    if (this.task && this.taskPrio < 3 && !W.settings.paused && this.enemyList().length) this.setTask('fight', this.fight(), 3);
    if (this.task) this.runTask();
    else if (!this.dragged) this.think();
    // Maus in der Nähe → hinschauen
    if (!this.task && this.ground && W.mouse.active && dist(W.mouse.x, W.mouse.y, this.x, this.y - 50) < 200) {
      this.mouseNear += dt; this.faceCam = this.mouseNear > 0.4;
      if (this.mouseNear > 4 && chance(dt * 0.3)) this.say('poke');
    } else if (this.mouseNear > 0) { this.mouseNear = 0; if (!this.task) this.faceCam = false; }
    this.physics(dt);
    // geworfen → trudeln und Gegner umhauen
    if (this.afterThrow && !this.ground) {
      this.spin += dt * clamp(this.vx / 140, -14, 14);
      const sp = Math.hypot(this.vx, this.vy);
      if (sp > 650) for (const e of W.enemies) if (!e.dead && e.team === 'enemy' && rectsOverlap(this.bounds(), e.bounds())) { damage(W, e, 6, this, { dir: sign(this.vx), knock: 500, up: 200, color: COLORS.white }); this.vx *= -0.4; Sound.play('hit', 0.8); W.cinema.stop(0.08); }
    }
    if (this.buffs.core > 0 && chance(dt * 20)) W.fx.nanites(this, 1);
    if (this.dashing && chance(dt * 30)) W.fx.speedLines(this.x, this.y, this.facing, 'rgba(255,49,80,0.5)');
    this.animT += dt;
  }
  runTask() {
    try {
      const r = this.task.next();
      if (r.done) { this.task = null; this.taskName = ''; this.taskPrio = 0; this.forcePose = null; this.forceDir = null; this.walkVx = 0; }
    } catch (e) {
      console.error('Aufgabe abgebrochen', this.taskName, e);
      this.cancelTask();
    }
  }

  currentPose() {
    if (this.dragged) return 'dragged';
    if (this.ko) return 'ko';
    if (this.hurtT > 0 && this.forcePose !== 'cast') return 'hit';
    if (this.afterThrow && !this.ground) return 'tumble';
    if (this.forcePose) return this.forcePose;
    if (!this.ground) return 'jump';
    const s = Math.abs(this.vx);
    if (s > 170 * this.u) return 'run';
    if (s > 12) return 'walk';
    return 'idle';
  }

  draw(ctx) {
    if (this.absent && this.alpha <= 0) return;
    const u = this.u;
    if (this.grapple) this.drawGrapple(ctx);
    if (!this.dragged) this.drawShadow(ctx, 20 * u);
    if (this.buffs.core > 0) {
      ctx.save(); ctx.globalAlpha = 0.25 + 0.1 * Math.sin(this.world.time * 8);
      const g = ctx.createRadialGradient(this.x, this.y - 45 * u, 5, this.x, this.y - 45 * u, 70 * u);
      g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(this.x - 80 * u, this.y - 130 * u, 160 * u, 150 * u); ctx.restore();
    }
    const opts = { flash: this.flash > 0 ? 0.8 : 0, alpha: this.alpha * (this.ko ? 0.9 : 1) };
    if (this.ko) { opts.tint = '#05070c'; opts.tintAmt = 0.35; }
    this.drawBody(ctx, this.x, this.y, opts);
    if (this.dizzy > 0 && !this.dragged) this.drawStars(ctx);
  }

  drawBody(ctx, x, y, o = {}) {
    const S = this.S, u = this.u;
    const pose = o.pose || this.currentPose();
    const f = o.facing ?? this.facing;
    const side = f < 0 ? DIR.left : DIR.right;
    const img = IMG[this.name];
    const opts = { flash: o.flash, alpha: o.alpha, tint: o.tint, tintAmt: o.tintAmt, sy: this.squash };
    const fd = this.forceDir;
    switch (pose) {
      case 'idle': {
        const dir = fd ?? (this.faceCam ? DIR.down : (f < 0 ? DIR.downLeft : DIR.downRight));
        drawAtlas(ctx, img, GROUP.idle, dir, Math.floor(this.animT * 3) % 8, x, y, S, opts);
        break;
      }
      case 'walk': case 'run': {
        const fps = pose === 'run' ? 15 : 9;
        drawAtlas(ctx, img, GROUP.walk, fd ?? side, Math.floor(this.animT * fps) % 8, x, y, S, opts);
        break;
      }
      case 'climb': {
        const side = this.climbing ? this.climbing.side : -f;
        const prof = IMG[this.name + '-climbside'];
        const back = IMG[this.name + '-climb'];
        const step = Math.floor(this.climbDist / (9 * u));
        if (prof) { const fr = (side < 0 ? 0 : 4) + (step % 4); drawRegion(ctx, prof, fr * 128, 0, 128, 160, 64, 152, x, y, S, opts); }
        else if (back) drawRegion(ctx, back, (step % 8) * 128, 0, 128, 160, 64, 152, x, y, S, opts);
        else drawAtlas(ctx, img, GROUP.walk, DIR.up, step % 8, x, y, S, opts);
        break;
      }
      case 'mantle': {
        const strip = IMG[this.name + '-mantle'];
        const k = clamp(this.mantleK || 0, 0, 7);
        if (strip) drawRegion(ctx, strip, k * 128, 0, 128, 160, 64, CLIMB_ART.mantleLedgeY[k], x, y, S, opts);
        else drawAtlas(ctx, img, GROUP.idle, DIR.up, 0, x, y, S, opts);
        break;
      }
      case 'attack': {
        const fr = Math.min(7, Math.floor((this.animT / this.attackDur) * 8));
        drawAtlas(ctx, img, GROUP.attack, fd ?? side, fr, x, y, S, opts);
        break;
      }
      case 'hit':
        drawAtlas(ctx, img, GROUP.hit, fd ?? side, 0, x, y, S, opts);
        break;
      case 'ko':
        if (this.world.duel && this.name === 'shadepi') { drawPose(ctx, 1, side, x, y, S, opts); break; }
        drawAtlas(ctx, img, GROUP.hit, DIR.down, 0, x, y + 6 * u, S, { ...opts, sy: 0.9 });
        break;
      case 'tumble':
        drawAtlas(ctx, img, GROUP.hit, side, 0, x, y, S, { ...opts, rot: this.spin, pivotY: 45 * u });
        break;
      case 'dragged':
        drawAtlas(ctx, img, GROUP.hit, DIR.down, 0, x, y, S, { ...opts, rot: this.swing, pivotY: 78 * u });
        break;
      case 'crouch':
        if (this.name === 'raven' && !this.dragged) drawPose(ctx, 3, side, x, y, S, opts);
        else drawAtlas(ctx, img, GROUP.idle, side, 0, x, y, S, { ...opts, sy: 0.88 * (this.squash || 1) });
        break;
      case 'jump':
        if (this.name === 'shadepi' && this.vy > -300) drawPose(ctx, 1, side, x, y, S, opts);
        else drawAtlas(ctx, img, GROUP.walk, side, this.vy < 0 ? 1 : 5, x, y, S, opts);
        break;
      case 'pose':
        drawPose(ctx, this.poseRow, fd ?? side, x, y, S, opts);
        break;
      case 'cast':
        if (this.name === 'raven') {
          const dir = fd ?? side;
          drawCast(ctx, this.castRow, dir, x, y, S, opts);
          const p = castPalm(this.castRow, dir, x, y, S);
          const r = (this.castRow === 1 ? 7 : this.castRow === 0 ? 3 + Math.min(4, this.animT * 10) : 3) * this.u;
          ctx.save(); ctx.globalAlpha = (o.alpha ?? 1) * (0.7 + 0.3 * Math.sin(this.world.time * 30));
          ctx.shadowColor = COLORS.cyan; ctx.shadowBlur = 16; ctx.fillStyle = COLORS.cyanHot;
          ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        } else drawPose(ctx, 0, side, x, y, S, opts);
        break;
      case 'sit': {
        const ledge = IMG[this.name + '-ledge'];
        if (ledge) { const fr = this.sitFrame || 0; drawRegion(ctx, ledge, fr * 128, 0, 128, 160, 64, CLIMB_ART.ledgeSeatY, x, y, S, opts); }
        else if (!drawRest(ctx, 'raven-sit', x, y, S, { ...opts, flip: f < 0 })) drawAtlas(ctx, img, GROUP.idle, DIR.down, 0, x, y, S, opts);
        break;
      }
      case 'lie':
        if (!drawRest(ctx, 'raven-lie', x, y, S, { ...opts, flip: f < 0 })) drawAtlas(ctx, img, GROUP.idle, DIR.down, 0, x, y, S, opts);
        break;
      default:
        drawAtlas(ctx, img, GROUP.idle, side, 0, x, y, S, opts);
    }
  }

  drawGrapple(ctx) {
    const g = this.grapple;
    const ex = g.rope ? g.tx : lerp(g.x, g.tx, g.k), ey = g.rope ? g.ty : lerp(g.y, g.ty, g.k);
    ctx.save();
    ctx.strokeStyle = COLORS.cyan; ctx.lineWidth = 1.6; ctx.shadowColor = COLORS.cyan; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.moveTo(g.x, g.y); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.fillStyle = '#c8fbff'; ctx.fillRect(ex - 3, ey - 3, 6, 6);
    ctx.restore();
  }

  drawStars(ctx) {
    const u = this.u, t = this.world.time;
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const a = t * 4 + (i * Math.PI * 2) / 3;
      const x = this.x + Math.cos(a) * 20 * u, y = this.y - 98 * u + Math.sin(a) * 5 * u;
      ctx.fillStyle = i % 2 ? COLORS.amber : COLORS.cyan; ctx.font = '14px ShadepiPixel'; ctx.textAlign = 'center';
      ctx.fillText('✦', x, y);
    }
    ctx.restore();
  }
}
