// Regie: wer ist auf dem Bildschirm, wann kommt Besuch, wann gibt es
// Kämpfe, Training, Reparaturen – alles vollautomatisch.
'use strict';

const EVENT_LABELS = {
  drohnen: 'Drohnenpatrouille', schwarm: 'Drohnenschwarm', viren: 'Virusausbruch', gang: 'Cyberpunk-Gang', bots: 'Kampfbots',
  ice: 'Boss: ICE-Wächter', jackal: 'Boss: Chrome Jackal', training: 'Shadepi trainiert', luke: 'Raven repariert Kabel',
  besuch: 'Partner kommt vorbei', sparring: 'Sparring', plaudern: 'Plaudern', ball: 'Ballspiel', wechsel: 'Schichtwechsel',
};

function timeGreeting() {
  const h = new Date().getHours();
  return h < 5 || h >= 22 ? 'night' : h < 11 ? 'morning' : h < 17 ? 'day' : 'evening';
}
function isNight() { const h = new Date().getHours(); return h >= 23 || h < 6; }

class Director {
  constructor(world) {
    this.world = world;
    this.next = 25;
    this.visit = null;      // { hero, until, forFight }
    this.swapAt = rnd(480, 900);
    this.duoCd = 20;
    this.fightActive = false;
    this.chatCd = rnd(60, 120);
    this.lastEvent = null;
    this.main = null;
    this.scripts = [];      // laufende Abläufe der Regie (Generatoren)
  }

  get S() { return this.world.settings; }

  // -------------------------------------------------- Besetzung
  setup() {
    const W = this.world, T = W.terrain;
    const sh = new Hero(W, 'shadepi', T.W * 0.62, T.floorY);
    const ra = new Hero(W, 'raven', T.W * 0.45, T.floorY);
    for (const h of [sh, ra]) { h.land(T.surfaces[0], 0); h.absent = true; h.alpha = 0; }
    W.heroes = [ra, sh];
    // Auftritt beim Start
    W.cinema.letterbox(2.6);
    W.cinema.card('SHADEPI', 'ECHOS IN NEON · DESKTOP-WACHE', COLORS.red, 2.8);
    setTimeout(() => this.applyMode(false), 900);
  }

  wantedPresence() {
    const m = this.S.mode;
    if (m === 'beide') return ['shadepi', 'raven'];
    if (m === 'shadepi' || m === 'raven') return [m];
    return [this.main || pick(['shadepi', 'raven'])];
  }

  applyMode(initial = false) {
    const W = this.world;
    const want = this.wantedPresence();
    if (this.S.mode !== 'wechselnd' && this.S.mode !== 'beide') this.main = this.S.mode;
    if (this.S.mode === 'wechselnd' && !this.main) this.main = want[0];
    if (this.S.mode === 'beide') this.main = this.main || 'shadepi';
    for (const h of W.heroes) {
      const should = want.includes(h.name) || (this.visit && this.visit.hero === h);
      if (should && h.absent) this.bringIn(h, initial ? 'quiet' : null);
      else if (!should && !h.absent) this.sendAway(h);
    }
    if (this.S.mode === 'beide') this.visit = null;
  }

  bringIn(h, style) {
    const W = this.world, T = W.terrain;
    h.absent = false; h.ko = false; h.alpha = 1;
    h.x = clamp(W.mouse.active && style === 'cursor' ? W.mouse.x : rnd(T.W * 0.2, T.W * 0.8), 60, T.W - 60);
    h.y = T.floorY;
    if (style === 'quiet') { h.land(T.surfaces[0], 0); h.alpha = 0; h.setTask('arrive', (function* () { for (let e = 0; e < 0.8; e += W.dt) { h.alpha = e / 0.8; yield; } h.alpha = 1; h.say(timeGreeting()); })(), 5); return; }
    h.setTask('arrive', (function* () {
      yield* h.arrive(style || (h.name === 'shadepi' ? pick(['drop', 'shadow']) : 'rope'));
      if (W.hasEnemies()) h.say('join', null, true); else h.say('arrive', null, true);
    })(), 5);
  }

  sendAway(h) {
    if (h.absent) return;
    h.setTask('depart', h.depart(), 5);
  }

  partnerOf(name) { return this.world.hero(name === 'shadepi' ? 'raven' : 'shadepi'); }

  startVisit(forFight = false) {
    if (this.S.mode === 'beide') return false;
    const main = this.world.presentHeroes()[0];
    if (!main) return false;
    const p = this.partnerOf(main.name);
    if (!p.absent) return false;
    this.visit = { hero: p, until: this.world.time + (forFight ? 9999 : rnd(70, 160)), forFight };
    this.bringIn(p);
    return true;
  }

  endVisit() {
    if (!this.visit) return;
    const h = this.visit.hero;
    this.visit = null;
    if (this.S.mode !== 'beide' && !this.wantedPresence().includes(h.name)) this.sendAway(h);
  }

  swapMain() {
    if (this.S.mode !== 'wechselnd') return;
    const cur = this.world.hero(this.main);
    const next = this.partnerOf(this.main);
    this.main = next.name;
    if (this.visit && this.visit.hero === next) this.visit = null;
    if (next.absent) this.bringIn(next);
    if (!cur.absent) {
      const W = this.world;
      this.run((function* () {
        let e = 0; while (e < 2.5) { e += W.dt; yield; }
        cur.talk(cur.name === 'shadepi' ? 'Deine Schicht, Raven.' : 'Du bist dran, Hutmann.', true);
        e = 0; while (e < 2.2) { e += W.dt; yield; }
        cur.setTask('depart', cur.depart(), 5);
      })());
    }
  }

  // -------------------------------------------------- Ereignisse
  run(gen) { this.scripts.push(gen); }

  pickEvent() {
    const W = this.world;
    const present = W.presentHeroes().map((h) => h.name);
    const both = present.length === 2;
    const hasSh = present.includes('shadepi'), hasRa = present.includes('raven');
    const chaos = this.S.activity === 'chaos';
    return weighted([
      ['drohnen', 2.2], ['schwarm', chaos ? 1.4 : 0.7], ['viren', 1.6], ['gang', 1.6], ['bots', 1],
      ['ice', chaos ? 0.5 : 0.18], ['jackal', chaos ? 0.5 : 0.18],
      ['training', hasSh ? 2.2 : 0], ['luke', hasRa ? 2.2 : 0],
      ['besuch', !both && this.S.mode !== 'beide' ? 1.6 : 0],
      ['sparring', both ? 1.2 : 0], ['plaudern', both ? 1.4 : 0], ['ball', both ? 0.8 : 0],
      ['wechsel', this.S.mode === 'wechselnd' && !both ? 0.6 : 0],
    ].filter(([id]) => id !== this.lastEvent || chance(0.2)));
  }

  startEvent(id) {
    const W = this.world, T = W.terrain;
    this.lastEvent = id;
    const present = W.presentHeroes();
    const sh = W.hero('shadepi'), ra = W.hero('raven');
    switch (id) {
      case 'drohnen': this.startFight('drones', 'DROHNENPATROUILLE', 'MILITECH-KENNUNG VERWISCHT', () => { for (let i = 0; i < rndi(2, 3); i++) setTimeout(() => W.spawnEnemy('drone'), i * 700); }); break;
      case 'schwarm': this.startFight('drones', 'DROHNENSCHWARM', 'LUFTRAUM KOMPROMITTIERT', () => { for (let i = 0; i < rndi(6, 8); i++) setTimeout(() => W.spawnEnemy('drone'), i * 450 + (i > 3 ? 2500 : 0)); }, 0.55); break;
      case 'viren': this.startFight('viruses', 'VIRUSAUSBRUCH', 'FREMDCODE IM SPEICHER', () => this.virusTear(rndi(4, 6), chance(0.6))); break;
      case 'gang': this.startFight('gang', 'ÜBERFALL', 'STRASSENGANG IM ANMARSCH', () => {
        const side = chance(0.5) ? -1 : 1; const n = rndi(2, 4);
        for (let i = 0; i < n; i++) setTimeout(() => { const e = W.spawnEnemy(i === n - 1 && chance(0.5) ? 'shooter' : 'punk', { side: chance(0.75) ? side : -side }); if (i === 0 && e) setTimeout(() => e.talk(pick(LINES.enemy.punk), true), 900); }, i * 600);
      }); break;
      case 'bots': this.startFight('bots', 'KAMPFBOTS', 'SCHWERE EINHEITEN · LUFTABWURF', () => { for (let i = 0; i < rndi(2, 3); i++) setTimeout(() => W.spawnEnemy('bot'), i * 800); }, 0.45); break;
      case 'ice': this.startFight('boss', 'ICE-WÄCHTER', 'SCHWARZES ICE · SYSTEMSPERRE', () => {
        const tear = new GlitchTear(T.W / 2, T.floorY * 0.35, 240 * W.u); W.screen.push(tear);
        Sound.play('calib_alarm', 0.6);
        setTimeout(() => { const e = W.spawnEnemy('ice', { x: T.W / 2, y: T.floorY * 0.35 + 85 * W.u }); if (e) { e.flash = 0.3; } W.cinema.shake(10, 0.6); }, 1200);
        setTimeout(() => (tear.closing = true), 3500);
      }, 0.85, true); break;
      case 'jackal': this.startFight('boss', 'CHROME JACKAL', 'GANG-TECH · KOPFGELDJÄGER', () => {
        const e = W.spawnEnemy('jackal', { side: 1 });
        if (e) setTimeout(() => e.talk(pick(LINES.enemy.jackal), true), 1300);
        setTimeout(() => W.spawnEnemy('punk', { side: -1 }), 1800);
        setTimeout(() => W.spawnEnemy('punk', { side: 1 }), 2600);
      }, 0.85, true); break;
      case 'training': if (sh && !sh.absent && !sh.setTask('training', sh.training(), 2)) this.queued = id; break;
      case 'luke': if (ra && !ra.absent && !ra.setTask('hatch', ra.hatchRepair(), 2)) this.queued = id; break;
      case 'besuch': this.startVisit(false); break;
      case 'wechsel': this.swapMain(); break;
      case 'sparring': if (present.length === 2) this.run(this.sparring()); break;
      case 'plaudern': if (present.length === 2) this.run(this.chat()); break;
      case 'ball': if (present.length === 2) this.run(this.ballGame()); break;
      case 'alles-weg': W.clearAll(); break;
    }
  }

  startFight(kind, title, sub, spawn, joinChance = 0.3, boss = false) {
    const W = this.world;
    if (!W.presentHeroes().length) this.applyMode();
    W.fightKind = kind;
    if (!this.fightActive) { W.stats.kills = 0; W.stats.hits = 0; W.stats.fightStart = W.time; }
    this.fightActive = true;
    this.fightGraceUntil = W.time + (boss ? 5 : 4);
    W.cinema.letterbox(boss ? 3.4 : 2.4);
    W.cinema.card(title, sub, boss ? COLORS.magenta : COLORS.warn, boss ? 3 : 2.2);
    W.cinema.focus(boss ? 3 : 1.5);
    Sound.play('calib_alarm', 0.45);
    Sound.setMusic(boss ? 'Boss' : 'Fight');
    if (chance(0.5)) W.bubbles.sayAt(W.terrain.W / 2, W.terrain.H * 0.3 + 120, 'ARToS', COLORS.amber, pick(LINES.artos.alarm), 2);
    setTimeout(spawn, boss ? 1200 : 700);
    for (const h of W.presentHeroes()) {
      if (['training', 'hatch', 'wander', 'look', 'nap', 'rest', 'climb', 'toy', 'pickup', 'hackWin', 'drop', 'spar', 'chat', 'ball'].includes(h.taskName) || !h.task) {
        setTimeout(() => { if (!h.ko && !h.absent) { h.setTask('fight', h.fight(), 3); h.say(kind === 'drones' ? 'drones' : kind === 'viruses' ? 'viruses' : kind === 'gang' ? 'gang' : kind === 'bots' ? 'bots' : 'boss', null, true); } }, rnd(300, 900));
      }
    }
    // Manchmal kommt der Partner zur Hilfe
    if (this.S.mode !== 'beide' && W.presentHeroes().length === 1 && chance(joinChance)) {
      setTimeout(() => this.startVisit(true), rnd(3500, 7000));
    }
  }

  virusTear(n, big) {
    const W = this.world, T = W.terrain, u = W.u;
    const x = rnd(T.W * 0.15, T.W * 0.85), y = rnd(T.floorY * 0.2, T.floorY * 0.55);
    const tear = new GlitchTear(x, y, 130 * u);
    W.screen.push(tear);
    Sound.play('calib_error', 0.6, 0.7);
    for (let i = 0; i < n; i++) setTimeout(() => { const v = W.spawnEnemy('virus', { x, y }); if (v) { v.vx = rnd(-300, 300); v.vy = rnd(-200, 200); } }, 500 + i * 350);
    if (big) setTimeout(() => W.spawnEnemy('bigvirus', { x, y }), 500 + n * 350);
    setTimeout(() => (tear.closing = true), 900 + n * 350 + 600);
  }

  // -------------------------------------------------- Duo-Abläufe
  free(h) { return h && !h.ko && !h.absent && !h.dragged && (!h.task || h.taskPrio < 1.5); }
  *both(seconds) { let e = 0; while (e < seconds) { e += this.world.dt; yield; } }

  *chat() {
    const W = this.world;
    const ra = W.hero('raven'), sh = W.hero('shadepi');
    if (!this.free(ra) || !this.free(sh)) return;
    const same = ra.wid === sh.wid;
    const ex = pick(LINES.duo);
    const tasks = [ra, sh].map((h) => { const t = { done: false }; h.setTask('chat', (function* () { while (!t.done) { h.walkVx = 0; yield; } })(), 1.5); return t; });
    // aufeinander zugehen
    const mid = (ra.x + sh.x) / 2;
    const order = ra.x < sh.x ? [ra, sh] : [sh, ra];
    const gap = 70 * W.u;
    for (let e = 0; e < 4 && same; e += W.dt) {
      let ok = true;
      order.forEach((h, i) => { const tx = mid + (i ? gap : -gap); const dx = tx - h.x; if (Math.abs(dx) > 6) { ok = false; h.facing = sign(dx); h.walkVx = sign(dx) * h.def.walk * W.u; } else h.walkVx = 0; });
      if (ok) break;
      yield;
    }
    order[0].facing = 1; order[1].facing = -1;
    for (const h of order) h.walkVx = 0;
    if (!same) { ra.faceCam = sh.faceCam = false; ra.facing = sign(sh.x - ra.x); sh.facing = -ra.facing; }
    for (const [who, text] of ex) {
      const h = W.hero(who);
      h.talk(text, true);
      yield* this.both(clamp(1.6 + text.length * 0.05, 2, 4));
    }
    tasks.forEach((t) => (t.done = true));
  }

  *sparring() {
    const W = this.world, u = W.u, T = W.terrain;
    const ra = W.hero('raven'), sh = W.hero('shadepi');
    if (!this.free(ra) || !this.free(sh)) return;
    ra.cancelTask(); sh.cancelTask();
    const hold = (h) => { const t = { done: false }; h.setTask('spar', (function* () { while (!t.done) yield; })(), 1.5); return t; };
    // beide auf den Boden
    for (const h of [ra, sh]) if (h.wid !== 'floor') { h.setTask('drop', h.dropDown(), 1.5); }
    for (let e = 0; e < 5 && (ra.wid !== 'floor' || sh.wid !== 'floor' || ra.task || sh.task); e += W.dt) yield;
    if (ra.wid !== 'floor' || sh.wid !== 'floor') return;
    const cx = clamp((ra.x + sh.x) / 2, 200 * u, T.W - 200 * u);
    const tr = hold(ra), ts = hold(sh);
    const posR = cx - 150 * u, posS = cx + 150 * u;
    for (let e = 0; e < 5; e += W.dt) {
      let ok = true;
      for (const [h, x] of [[ra, posR], [sh, posS]]) { const dx = x - h.x; if (Math.abs(dx) > 6) { ok = false; h.facing = sign(dx); h.walkVx = sign(dx) * h.def.run * u * 0.6; } else h.walkVx = 0; }
      if (ok) break;
      yield;
    }
    ra.walkVx = sh.walkVx = 0; ra.facing = 1; sh.facing = -1;
    ra.talk('Na, Hutmann? Revanche?', true); yield* this.both(1.8);
    sh.talk('Wie du willst.', true); yield* this.both(1.2);
    W.cinema.letterbox(2); W.cinema.card('SPARRING', 'RAVEN GEGEN SHADEPI · NUR TRAINING', COLORS.cyan, 1.8, { small: true });
    const rounds = rndi(3, 5);
    for (let r = 0; r < rounds; r++) {
      // Raven schießt einen Übungsimpuls
      ra.forcePose = 'attack'; ra.attackDur = 0.4; ra.animT = 0.12;
      const m = ra.muzzle(false);
      Sound.play('pistol', 0.35, 1.3);
      const bolt = { kind: 'bolt', x: m.x, y: m.y, vx: 900 * u, vy: 0, t: 0, dead: false, update(dt) { this.x += this.vx * dt; this.t += dt; if (this.x < -50 || this.x > T.W + 50) this.dead = true; }, draw: Projectile.prototype.draw };
      W.projectiles.push(bolt);
      yield* this.both(0.2); ra.forcePose = null;
      // Shadepi pariert
      while (!bolt.dead && bolt.x < sh.x - 60 * u) yield;
      sh.forcePose = 'attack'; sh.attackDur = 0.3; sh.animT = 0.08;
      Sound.play('slash', 0.7); W.fx.slash(sh.x - 24 * u, sh.y - 55 * u, -1, COLORS.red, u);
      W.fx.sparks(bolt.x, bolt.y, COLORS.cyanHot, 10, 300); W.cinema.stop(0.06);
      bolt.vx = -bolt.vx * 1.15; bolt.vy = rnd(-40, -10);
      yield* this.both(0.12); sh.forcePose = null;
      // Raven weicht aus
      while (!bolt.dead && bolt.x > ra.x + 120 * u) yield;
      if (chance(0.75)) {
        ra.forcePose = 'jump'; ra.leaveGround(); ra.vy = -820 * u; ra.vx = 0; ra.afterThrow = false;
        Sound.play('drive_roll', 0.3, 1.6);
        for (let e = 0; e < 0.2; e += W.dt) yield;
        ra.forcePose = null;
        for (let e = 0; e < 1.5 && !ra.ground; e += W.dt) yield;
      } else {
        ra.forcePose = 'hit'; W.fx.sparks(ra.x, ra.y - 50 * u, COLORS.cyan, 8, 200); ra.talk(pick(['Au! Okay, Punkt für dich.', 'Hey! Zu schnell!']), true);
        for (let e = 0; e < 0.6; e += W.dt) yield;
        ra.forcePose = null;
      }
      yield* this.both(rnd(0.5, 1));
    }
    // Schattensprung hinter Raven
    sh.forcePose = null;
    W.fx.smokePuff(sh.x, sh.y - 30 * u, 0.6 * u, 0.9);
    sh.x = clamp(ra.x - 46 * u, 30, T.W - 30); sh.facing = 1;
    W.fx.smokePuff(sh.x, sh.y - 30 * u, 0.6 * u, 0.9);
    Sound.play('slash', 0.3, 0.6);
    yield* this.both(0.5);
    ra.facing = -1;
    ra.talk('Schummler.', true); yield* this.both(1.6);
    sh.talk('Training.', true); yield* this.both(1.6);
    tr.done = ts.done = true;
  }

  *ballGame() {
    const W = this.world, T = W.terrain;
    const ra = W.hero('raven');
    const x = clamp(ra.x + rnd(-120, 120), 80, T.W - 80);
    W.spawnItem('ball', x, 60);
    ra.talk('Fang!', true);
    yield* this.both(1);
  }

  *duoStrike(target) {
    const W = this.world, u = W.u;
    const ra = W.hero('raven'), sh = W.hero('shadepi');
    const tR = { done: false }, tS = { done: false };
    ra.setTask('duo', (function* () { yield* ra.cast([target], 'jam'); while (!tR.done) yield; })(), 4);
    ra.talk('Jetzt, Hutmann!', true);
    sh.setTask('duo', (function* () { while (!tS.done) yield; })(), 4);
    yield* this.both(0.75);
    if (target.dead) { tR.done = tS.done = true; return; }
    W.cinema.letterbox(2.6); W.cinema.slowmo(0.35, 1.3); W.cinema.focus(2);
    W.cinema.card('DOPPELSCHLAG', 'RAVEN STÖRT · SHADEPI VOLLENDET', COLORS.white, 1.8, { small: true, y: W.terrain.H * 0.22 });
    tS.done = true;
    sh.cancelTask();
    sh.setTask('duo2', (function* () {
      const side = sign(sh.x - target.x) || 1;
      const tx = clamp(target.x + side * 50 * u, 30, W.terrain.W - 30);
      if (target.flying || Math.abs(target.y - sh.y) > 20) yield* sh.leapTo(tx, sh.wid === 'floor' ? sh.y : W.terrain.floorY);
      else yield* sh.walkTo(tx, true, 8);
      sh.facing = -side;
      yield* sh.chargeSlash();
      if (!target.dead) damage(W, target, 10, sh, { dir: -side, knock: 400, up: 300, color: COLORS.white });
    })(), 4);
    yield* this.both(0.5);
    tR.done = true;
  }

  // Nach einem Spiel wieder da
  afterGame(g) {
    const W = this.world;
    const hs = W.presentHeroes().filter((h) => !h.ko);
    if (!hs.length) return;
    const h = pick(hs);
    const m = g.minutes || 0;
    const name = g.name && g.name !== 'Vollbild-Spiel' ? g.name : '';
    const lines = h.name === 'raven'
      ? [name ? `Na, wie war ${name}? Gewonnen?` : 'Na, gewonnen?', 'Willkommen zurück! Mir war sooo langweilig.', m >= 60 ? `Über ${Math.floor(m / 60)} Stunde${m >= 120 ? 'n' : ''} gezockt! Respekt.` : 'Endlich! Ich hab die Stellung gehalten.']
      : [name ? `Wie war die Schlacht in ${name}?` : 'Wie war die Schlacht?', 'Du bist zurück. Gut.', m >= 60 ? 'Lange gekämpft. Mach eine Pause.' : 'Ich habe gewacht, während du gespielt hast.'];
    W.cinema.card('WILLKOMMEN ZURÜCK', (name ? name.toUpperCase() + ' · ' : '') + (m ? `${m} MIN GESPIELT` : 'SPIEL BEENDET'), COLORS.cyan, 2.4, { small: true });
    h.faceCam = true;
    h.talk(pick(lines), true);
    setTimeout(() => { if (!h.task) h.faceCam = false; }, 2500);
    const p = hs.find((x) => x !== h);
    if (p) setTimeout(() => p.talk(p.name === 'raven' ? 'Und? Erzähl!' : '…Willkommen zurück.', true), 2600);
  }

  // -------------------------------------------------- Takt
  update(dt) {
    const W = this.world;
    // Skripte
    this.scripts = this.scripts.filter((g) => { try { return !g.next().done; } catch (e) { console.error(e); return false; } });
    if (W.hidden) return;
    const fighting = W.hasEnemies();
    if (this.queued && !fighting) { const q = this.queued; this.queued = null; this.queueTries = (this.queueTries || 0) + 1; if (this.queueTries < 40) setTimeout(() => this.startEvent(q), 250); else this.queueTries = 0; }
    else if (!this.queued) this.queueTries = 0;
    if (this.fightActive && !fighting && W.time > (this.fightGraceUntil || 0)) {
      this.fightActive = false; W.fightKind = null;
      Sound.setMusic(null);
      setTimeout(() => { const h = pick(W.presentHeroes().filter((x) => !x.ko)); if (h) h.say('victory', null, true); }, 900);
      if (this.visit && this.visit.forFight) this.visit.until = W.time + rnd(8, 16);
      this.next = Math.max(this.next, rnd(25, 45) * W.calmFactor);
    }
    if (fighting && !this.fightActive) { this.fightActive = true; this.fightGraceUntil = W.time + 2; W.fightKind = W.fightKind || 'custom'; Sound.setMusic(W.enemies.some((e) => e.boss && !e.dead) ? 'Boss' : 'Fight'); }
    // Wenn beide/alle Helden k.o. sind und kein Partner da: Hilfe rufen
    if (fighting && W.presentHeroes().every((h) => h.ko) && this.S.mode !== 'beide' && !this.visit) this.startVisit(true);
    // Doppelschlag
    this.duoCd -= dt;
    if (fighting && this.duoCd <= 0 && W.presentHeroes().length === 2) {
      const heavy = W.enemies.find((e) => !e.dead && e.team === 'enemy' && e.maxHp >= 12 && !e.noClamp);
      const ready = W.presentHeroes().every((h) => !h.ko && h.taskName === 'fight' && h.ground);
      if (heavy && ready) { this.duoCd = rnd(18, 30); this.run(this.duoStrike(heavy)); }
      else this.duoCd = 3;
    }
    // Besuch beenden
    if (this.visit && W.time > this.visit.until && !fighting && !this.visit.hero.task) this.endVisit();
    if (this.S.paused) return;
    // Schichtwechsel
    if (this.S.mode === 'wechselnd') { this.swapAt -= dt; if (this.swapAt <= 0 && !fighting && !this.visit) { this.swapAt = rnd(480, 900); this.swapMain(); } }
    // Nächstes Ereignis
    if (!fighting) {
      this.next -= dt;
      const busy = W.presentHeroes().some((h) => ['training', 'hatch', 'spar', 'chat', 'arrive', 'depart', 'duo'].includes(h.taskName));
      if (this.next <= 0 && !busy) {
        const range = { ruhig: [140, 280], normal: [55, 120], chaos: [16, 40] }[this.S.activity] || [55, 120];
        this.next = rnd(range[0], range[1]);
        const ev = this.pickEvent();
        if (ev) this.startEvent(ev);
      }
    }
  }
}
