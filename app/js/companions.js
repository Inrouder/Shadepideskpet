// Begleiter aus ShadepiRPG (v0.53/v0.61): Ravens Drohne und Shadepis Nanitenschwarm.
// Sie erscheinen im Kampf (und ab und zu einfach so), helfen mit kleinen Treffern
// und verschwinden danach wieder.
'use strict';

class Companions {
  constructor(world) {
    this.world = world;
    this.drone = { on: 0, x: 0, y: 0, vx: 0, vy: 0, cd: 1.2, fireT: 0, t: 0, owner: null, idleT: 0 };
    this.swarm = { on: 0, t: 0, cd: 2.5, parts: [] };
    for (let i = 0; i < 8; i++) this.swarm.parts.push({ a: (i / 8) * Math.PI * 2, r: 1, kind: i % 4, red: i >= 4, x: 0, y: 0, shot: null });
    this.idleCd = rnd(40, 90);
  }

  get enabled() { return this.world.settings.companions !== false && !this.world.duel; }

  // Kurzer Auftritt ohne Kampf
  showOff(who) {
    if (who === 'raven') { this.drone.idleT = 7; this.say('raven', pick(['Drohne, Rundflug!', 'Kleiner Kontrollflug. Alles sauber?', 'Meine Drohne braucht Auslauf.'])); }
    else { this.swarm.idleT = 6; this.say('shadepi', pick(['Naniten. Formation.', 'Der Schwarm braucht Übung.', 'Bleibt nah bei mir.'])); }
  }
  say(name, text) { const h = this.world.hero(name); if (h && !h.absent) h.talk(text); }

  update(dt) {
    const W = this.world;
    const ra = W.hero('raven'), sh = W.hero('shadepi');
    if (this.enabled && (W.hasEnemies() || (this.idleCd -= dt) <= 0)) {
      if (!W.hasEnemies()) { this.idleCd = rnd(60, 140); const c = [ra, sh].filter((h) => h && !h.absent && !h.ko && !h.task); if (c.length) this.showOff(pick(c).name); }
    }
    this.updateDrone(dt, ra);
    this.updateSwarm(dt, sh);
  }

  nearestEnemy(x, y, range) {
    let best = null, bd = range;
    for (const e of this.world.enemies) {
      if (e.dead || e.team !== 'enemy' || e.spar) continue;
      const d = dist(x, y, e.x, e.y - e.h / 2);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  // ---------------------------------------------------------------- Drohne
  updateDrone(dt, ra) {
    const W = this.world, u = W.u, d = this.drone;
    const want = this.enabled && ra && !ra.absent && !ra.ko && (W.hasEnemies() || d.idleT > 0);
    d.idleT -= dt;
    if (want && d.on === 0) { d.x = ra.x - ra.facing * 400 * u; d.y = ra.y - 260 * u; Sound.play('calib_tick', 0.25, 1.8); }
    d.on = clamp(d.on + (want ? dt * 2 : -dt * 1.5), 0, 1);
    if (d.on <= 0 || !ra) return;
    d.t += dt; d.fireT -= dt; d.cd -= dt;
    // Schwebeposition hinter Ravens Schulter, beim Wegfliegen nach oben hinaus
    const tx = want ? ra.x - ra.facing * 46 * u : ra.x - ra.facing * 300 * u;
    const ty = want ? ra.y - 128 * u + Math.sin(d.t * 3) * 6 * u : ra.y - 360 * u;
    d.vx += ((tx - d.x) * 6 - d.vx * 3.2) * dt;
    d.vy += ((ty - d.y) * 6 - d.vy * 3.2) * dt;
    d.x += d.vx * dt; d.y += d.vy * dt;
    if (want && W.hasEnemies() && d.cd <= 0) {
      const t = this.nearestEnemy(d.x, d.y, 620 * u);
      if (t) {
        d.cd = rnd(1.1, 1.8); d.fireT = 0.25;
        const c = t.center();
        const ox = d.x, oy = d.y + 10 * u;
        const a = Math.atan2(c.y - oy, c.x - ox);
        W.projectiles.push(new Projectile(W, { kind: 'bolt', x: ox, y: oy, vx: Math.cos(a) * 980 * u, vy: Math.sin(a) * 980 * u, team: 'hero', owner: ra, dmg: 1, r: 5 * u, life: 1.2, color: COLORS.cyan, knock: 60 }));
        Sound.play('pistol', 0.25, 1.6);
      }
    }
  }

  // ---------------------------------------------------------------- Naniten
  updateSwarm(dt, sh) {
    const W = this.world, u = W.u, sw = this.swarm;
    sw.idleT = (sw.idleT || 0) - dt;
    const want = this.enabled && sh && !sh.absent && !sh.ko && (W.hasEnemies() || sw.idleT > 0);
    if (want && sw.on === 0) Sound.play('legacy_aura', 0.2, 1.8);
    sw.on = clamp(sw.on + (want ? dt * 1.6 : -dt * 1.2), 0, 1);
    if (sw.on <= 0 || !sh) return;
    sw.t += dt; sw.cd -= dt;
    const cx = sh.x, cy = sh.y - 58 * u;
    for (const p of sw.parts) {
      if (p.shot) {
        // Angriff: zum Ziel und zurück
        const s = p.shot;
        s.t += dt;
        const c = s.target.dead ? { x: s.tx, y: s.ty } : s.target.center();
        s.tx = c.x; s.ty = c.y;
        const k = s.t / 0.28;
        if (k < 1) { p.x = lerp(s.x0, c.x, easeIn(k)); p.y = lerp(s.y0, c.y, easeIn(k)); }
        else if (!s.hit) { s.hit = true; if (!s.target.dead) damage(W, s.target, 1, sh, { knock: 50, color: COLORS.red, stun: 0.15, sparks: false }); W.fx.sparks(c.x, c.y, p.red ? COLORS.red : COLORS.white, 5, 220); }
        else if (k < 2) { p.x = lerp(c.x, cx, easeOut(k - 1)); p.y = lerp(c.y, cy, easeOut(k - 1)); }
        else p.shot = null;
        continue;
      }
      p.a += dt * (1.6 + (p.red ? 0.5 : 0));
      const rx = (54 + (p.red ? 10 : 0)) * u * sw.on, ry = rx * 0.55;
      p.x = cx + Math.cos(p.a) * rx; p.y = cy + Math.sin(p.a) * ry;
    }
    if (want && W.hasEnemies() && sw.cd <= 0) {
      const t = this.nearestEnemy(cx, cy, 420 * u);
      const p = sw.parts.find((q) => !q.shot);
      if (t && p) { sw.cd = rnd(0.5, 1.1); p.shot = { target: t, t: 0, x0: p.x, y0: p.y, tx: t.x, ty: t.y }; }
    }
  }

  draw(ctx) {
    const W = this.world, u = W.u;
    const d = this.drone, sw = this.swarm;
    if (sw.on > 0 && IMG.nanites) {
      const sh = W.hero('shadepi');
      for (const p of sw.parts) {
        const behind = !p.shot && Math.sin(p.a) < 0;
        if (behind && sh && !sh.absent) continue; // hinter Shadepi: wird im Vordergrund nicht gezeigt
        const size = 13 * u;
        ctx.save(); ctx.globalAlpha = sw.on;
        ctx.shadowColor = p.red ? COLORS.red : '#ffffff'; ctx.shadowBlur = 8;
        ctx.translate(p.x, p.y); ctx.rotate(sw.t * 4 + p.a);
        ctx.drawImage(IMG.nanites, p.kind * 32, p.red ? 32 : 0, 32, 32, -size / 2, -size / 2, size, size);
        ctx.restore();
      }
    }
    if (d.on > 0 && IMG.cdrone) {
      const size = 52 * u;
      const firing = d.fireT > 0;
      const fr = firing ? Math.min(3, Math.floor((0.25 - d.fireT) / 0.0625)) : Math.floor(d.t * 24) % 4;
      ctx.save(); ctx.globalAlpha = d.on;
      ctx.translate(d.x, d.y); ctx.rotate(clamp(d.vx / 900, -0.35, 0.35));
      if (d.vx < -20 || (W.hero('raven') && W.hero('raven').facing < 0 && Math.abs(d.vx) < 20)) ctx.scale(-1, 1);
      ctx.drawImage(IMG.cdrone, fr * 80, firing ? 80 : 0, 80, 80, -size / 2, -size / 2, size, size);
      ctx.restore();
      // Lichtkegel nach unten
      ctx.save(); ctx.globalAlpha = 0.08 * d.on;
      ctx.fillStyle = COLORS.cyan; ctx.beginPath(); ctx.moveTo(d.x - 6 * u, d.y + 8 * u); ctx.lineTo(d.x + 6 * u, d.y + 8 * u); ctx.lineTo(d.x + 34 * u, d.y + 110 * u); ctx.lineTo(d.x - 34 * u, d.y + 110 * u); ctx.fill();
      ctx.restore();
    }
  }
}
