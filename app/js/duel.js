// Dojo-Modus: Trainingskampf gegen Shadepi mit einem seiner vier Ordensbrüder.
// Steuerung: Tastatur (WASD), Maus, Controller. Shadepi kommentiert – mal spöttisch, mal lobend.
'use strict';

const BROTHERS = {
  oni: {
    name: 'Oni', title: 'Oni-Krieger', weapon: 'Katana', color: '#ff3150', hp: 110, speed: 255, jump: 700, w: 36,
    stats: { Tempo: 4, Kraft: 4, Reichweite: 3, Ausdauer: 3 },
    light: { dmg: 6, range: 100, startup: 0.11, active: 0.1, recover: 0.17, knock: 180, sound: 'slash' },
    heavy: { dmg: 13, range: 112, startup: 0.3, active: 0.12, recover: 0.3, knock: 420, up: 260, sound: 'slash' },
    special: { name: 'Oni-Wirbel', desc: 'Drei Wirbelhiebe nach vorn und hinten' },
  },
  robot: {
    name: 'Roboterkopf', title: 'Roboterkopf-Krieger', weapon: 'Kampfstab', color: '#62e3ee', hp: 120, speed: 220, jump: 660, w: 38,
    stats: { Tempo: 3, Kraft: 4, Reichweite: 5, Ausdauer: 4 },
    light: { dmg: 6, range: 128, startup: 0.14, active: 0.11, recover: 0.2, knock: 220, sound: 'drive_knock' },
    heavy: { dmg: 14, range: 142, startup: 0.34, active: 0.12, recover: 0.32, knock: 520, up: 200, sound: 'drive_knock' },
    special: { name: 'Stabsturm', desc: 'Sprung nach vorn mit Bodenschlag-Schockwelle' },
  },
  ly: {
    name: 'Ly', title: 'Weißer Ordenskrieger', weapon: 'Weiße Lichtklinge', color: '#f4f0e4', hp: 95, speed: 300, jump: 740, w: 34,
    stats: { Tempo: 5, Kraft: 3, Reichweite: 3, Ausdauer: 2 },
    light: { dmg: 5, range: 100, startup: 0.08, active: 0.09, recover: 0.13, knock: 150, sound: 'slash' },
    heavy: { dmg: 11, range: 110, startup: 0.24, active: 0.11, recover: 0.25, knock: 380, up: 220, sound: 'slash' },
    special: { name: 'Weißer Schatten', desc: 'Teleport hinter den Gegner und Schlag' },
  },
  heavy: {
    name: 'MG-Krieger', title: 'Schwerer MG-Krieger', weapon: 'Schweres MG', color: '#ffb43a', hp: 150, speed: 170, jump: 560, w: 44, armor: 0.6,
    stats: { Tempo: 2, Kraft: 5, Reichweite: 5, Ausdauer: 5 },
    light: { gun: 3, dmg: 3, startup: 0.08, active: 0.24, recover: 0.16, sound: 'drive_shot' },
    heavy: { dmg: 12, range: 92, startup: 0.22, active: 0.2, recover: 0.35, knock: 560, up: 160, dash: 520, sound: 'drive_knock' },
    special: { name: 'Sperrfeuer', desc: 'Langer Feuerstoß mit 14 Schuss' },
  },
};

const DUEL_LEVELS = {
  leicht: { label: 'Leicht', react: 0.6, aggro: 0.35, block: 0.15, dmg: 0.6, hp: 120, tips: true },
  mittel: { label: 'Mittel', react: 0.32, aggro: 0.62, block: 0.4, dmg: 1.05, hp: 165 },
  schwer: { label: 'Schwer', react: 0.16, aggro: 0.85, block: 0.6, dmg: 1.3, hp: 200, shadow: true },
};

const SH_TALK = {
  start: ['Zeig mir, was der Orden dir beigebracht hat.', 'Training. Ich halte mich zurück. Ein bisschen.', 'Verbeug dich. Dann fang an.'],
  oni: ['Oni. Deine Maske macht mir keine Angst.', 'Zeig mir den Zorn des Oni. Falls du ihn findest.'],
  robot: ['Dein Stab ist länger als deine Geduld.', 'Bruder Roboterkopf. Diesmal ohne Kabelsalat?'],
  ly: ['Ly. Weiß wie immer. Mal sehen, ob du sauber bleibst.', 'Du kämpfst wie ich. Fast.'],
  heavy: ['Ein MG im Training? Mutig. Oder feige.', 'Zieh den Kopf ein, Bruder. Ich komme trotzdem.'],
  whiff: ['Du triffst die Luft. Sie hat Angst.', 'Das war ein Angriff? Ich dachte, du winkst.', 'Erst zielen, dann schlagen. In dieser Reihenfolge.', 'Die Fliege hinter mir lacht.'],
  hitYou: ['Zu langsam.', 'Deckung, Bruder.', 'Das war die Lektion von gestern.', 'Schläfst du?', 'Für dich. Gern geschehen.'],
  hitYouHard: ['Spür den Boden. Er ist dein Lehrer.', 'Steh auf. Wir sind nicht fertig.', 'Das tat dir mehr weh als mir.'],
  jumpy: ['Du bist kein Frosch.', 'Oben gibt es keine Deckung.', 'Hüpfen ist kein Kampfstil.'],
  dashy: ['Weglaufen ist auch eine Technik. Eine schlechte.', 'Du kannst rennen. Die Klinge auch.'],
  idle: ['Meditierst du? Ich warte.', 'Hast du einen Plan oder einen Mittagsschlaf?', 'Ich werde nicht jünger.'],
  blocked: ['Vorhersehbar.', 'Pariert. Wieder.', 'Ich sehe deine Schultern, bevor du schlägst.'],
  bullets: ['Kugeln? Im Dojo?', 'Zurück zum Absender.', 'Laut. Aber nicht schnell genug.'],
  combo3: ['Nicht schlecht!', 'So ist es richtig.', 'Gut. Weiter so.'],
  combo5: ['Der Orden wäre stolz.', 'Das… war gut. Sag es keinem.'],
  parry: ['Saubere Parade!', 'Gut gelesen.', 'Genau so. Der Meister hätte genickt.'],
  special: ['Eindrucksvoll.', 'Diese Technik… der Meister hätte gelächelt.'],
  lowMe: ['Hm. Du lernst.', 'Jetzt wird es ernst.', 'Genug gespielt.'],
  lowYou: ['Steh fest. Ein Krieger fällt nicht.', 'Atme. Dann weiter.'],
  roundMe: ['Runde für mich. Konzentrier dich.', 'Noch einmal. Diesmal richtig.'],
  roundYou: ['Gut gekämpft. Diese Runde gehört dir.', 'Glückstreffer. Vielleicht.'],
  winMe: ['Training beendet. Morgen wieder. Gleiche Zeit.', 'Du warst nah dran. Ungefähr so nah wie der Mond.', 'Gutes Training, Bruder. Du wirst besser.'],
  winYou: ['…Gut gekämpft, Bruder. Der Orden lebt in dir.', 'Du hast mich besiegt. Erzähl es Raven nicht.'],
  timeout: ['Die Zeit ist um. Die Lektion nicht.'],
  tipsPad: ['Tipp: RB halten zum Blocken.', 'Tipp: Kurz vor meinem Schlag blocken – Perfekte Parade.', 'Tipp: B zum Ausweichen.', 'Tipp: Volle Energie? LB für die Spezialtechnik.', 'Tipp: Y für den schweren Angriff.'],
  tips: ['Tipp: S halten zum Blocken.', 'Tipp: Kurz vor meinem Schlag blocken – Perfekte Parade.', 'Tipp: Shift zum Ausweichen.', 'Tipp: Volle Energie? E für die Spezialtechnik.', 'Tipp: Rechtsklick für den schweren Angriff.'],
};
const RA_TALK = {
  start: ['Los, Hutmann!', 'Ich wette fünf Eddies auf den Neuen!', 'Popcorn? Hat jemand Popcorn?'],
  shHit: ['Uh, das gibt einen Kratzer!', 'Ha! Getroffen!', 'Hutmann, Deckung!'],
  youKo: ['Autsch. Aber stylisch gefallen.', 'Das sah teuer aus.'],
  winMe: ['Mein Held.', 'War doch klar.'],
  winYou: ['Hutmann… du hast verloren?! Das speichere ich.', 'Screenshot gemacht. Für immer.'],
};

function drawBrother(ctx, who, state, idx, x, y, S, opts = {}) {
  const set = ((MANIFEST.warriors || {})[who] || {})[state];
  const e = set && set[String(idx)];
  if (!e || !IMG.brothers) return;
  const [rx, ry, rw, rh] = e.region;
  drawRegion(ctx, IMG.brothers, rx, ry, rw, rh, e.anchor[0], e.anchor[1], x, y, S * 2 * e.scale, opts);
}

// ---------------------------------------------------------------- Spielerfigur
class Brother extends Entity {
  constructor(world, who, x, y) {
    super(world, x, y);
    this.who = who; this.def = BROTHERS[who];
    this.team = 'player';
    this.maxHp = this.hp = this.def.hp;
    const u = world.u;
    this.w = this.def.w * u; this.h = 88 * u;
    this.state = 'idle'; this.stateT = 0; this.move = null; this.hitSet = new Set();
    this.energy = 0; this.blockT = 0; this.hurtT = 0; this.dashT = 0; this.koT = 0;
    this.animT = 0; this.edgeStop = false; this.ko = false;
    this.displayName = this.def.name; this.voiceColor = this.def.color;
  }
  get u() { return this.world.u; }
  get S() { return this.world.scale; }
  canAct() { return !this.ko && this.hurtT <= 0 && !this.move && this.dashT <= 0; }
  onLand(impact) { if (impact > 900) this.world.fx.dust(this.x, this.y, 4, this.u); }
  bounds() { return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h }; }

  draw(ctx) {
    const S = this.S, f = this.facing, x = this.x, y = this.y;
    this.drawShadow(ctx, 22 * this.u);
    const side = f < 0 ? 1 : 2;
    const o = { flash: this.flash > 0 ? 0.8 : 0 };
    if (this.dashT > 0) { o.tint = this.def.color; o.tintAmt = 0.25; }
    if (this.ko) { const k = this.koT; drawBrother(ctx, this.who, 'combat', k < 0.25 ? 4 : k < 0.6 ? 5 : k < 0.9 ? 6 : 7, x, y, S, { ...o, flip: f < 0 }); return; }
    if (this.hurtT > 0) { drawBrother(ctx, this.who, 'combat', 4, x, y, S, { ...o, flip: f < 0 }); return; }
    if (this.move) { drawBrother(ctx, this.who, 'combat', this.move.frame, x, y, S, { ...o, flip: f < 0 }); return; }
    if (this.blockT > 0 || this.state === 'win') { drawBrother(ctx, this.who, 'combat', 0, x, y, S, { ...o, flip: f < 0 }); if (this.blockT > 0) this.drawGuard(ctx); return; }
    if (!this.ground) { drawBrother(ctx, this.who, 'run_a', side, x, y, S, o); return; }
    if (Math.abs(this.vx) > 20) { drawBrother(ctx, this.who, Math.floor(this.animT * 8) % 2 ? 'run_a' : 'run_b', side, x, y, S, o); return; }
    drawBrother(ctx, this.who, 'idle', side, x, y, S, o);
  }
  drawGuard(ctx) {
    const u = this.u;
    ctx.save(); ctx.globalAlpha = 0.35 + 0.15 * Math.sin(this.world.time * 20);
    ctx.strokeStyle = COLORS.cyan; ctx.lineWidth = 2; ctx.shadowColor = COLORS.cyan; ctx.shadowBlur = 10;
    const f = this.facing; ctx.beginPath(); ctx.arc(this.x + f * 18 * u, this.y - 50 * u, 34 * u, f > 0 ? -1.2 : Math.PI - 1.2, f > 0 ? 1.2 : Math.PI + 1.2); ctx.stroke();
    ctx.restore();
  }
}

// ---------------------------------------------------------------- Kampf
class Duel {
  constructor(world, ui) {
    this.world = world; this.ui = ui;
    this.who = 'oni'; this.level = 'mittel';
    this.L = DUEL_LEVELS[this.level];
    this.round = 0; this.wins = { you: 0, me: 0 }; this.phase = 'select'; this.phaseT = 0;
    this.player = null;
    this.keys = {}; this.prevPad = []; this.prevAx = [0, 0]; this.mouseBtn = {}; this.edges = {};
    this.projectiles = [];
    this.stats = { hits: 0, taken: 0, parries: 0, maxCombo: 0, dmg: 0, specials: 0 };
    this.combo = 0; this.comboT = 0; this.whiffs = 0; this.jumps = []; this.dashes = []; this.idleT = 0;
    this.talkCd = 0; this.lastLine = ''; this.paused = false; this.over = false;
    this.ai = { cd: 1.2, intent: null };
    this.onKey = (e) => this.key(e);
    this.onBlur = () => { this.keys = {}; this.mouseBtn = {}; if (this.phase === 'fight' && !this.paused) this.ui.togglePause(true); };
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKey);
    window.addEventListener('blur', this.onBlur);
  }

  // Shadepi gehört während des Kampfes dem Dojo (keine eigene KI/Physik)
  owns(h) { return !!this.player && h.name === 'shadepi'; }
  get inMenu() { return this.phase === 'select' || this.phase === 'result' || this.paused; }

  setup(who, level) {
    this.who = who; this.level = level; this.L = DUEL_LEVELS[level];
    this.paused = false;
    this.begin();
  }

  get u() { return this.world.u; }
  get sh() { return this.world.hero('shadepi'); }
  get ra() { const r = this.world.hero('raven'); return r && !r.absent ? r : null; }

  // -------------------------------------------- Start / Runden
  begin() {
    const W = this.world, T = W.terrain;
    W.clearAll();
    for (const h of W.heroes) if (!h.absent) h.cancelTask();
    const sh = this.sh;
    if (sh.taskName !== 'duel') sh.cancelTask();
    sh.absent = false; sh.alpha = 1; sh.ko = false; sh.dragged = false; sh.afterThrow = false; sh.climbing = null; sh.gravity = 1;
    this.player = new Brother(W, this.who, T.W * 0.3, T.floorY);
    this.player.land(T.surfaces[0], 0);
    this.round = 0; this.wins = { you: 0, me: 0 }; this.matchOver = false;
    this.stats = { hits: 0, taken: 0, parries: 0, maxCombo: 0, dmg: 0, specials: 0 };
    this.combo = 0; this.lowMeSaid = this.lowYouSaid = false;
    Sound.setMusic('Fight');
    this.nextRound();
  }

  nextRound() {
    const W = this.world, T = W.terrain, sh = this.sh, p = this.player, u = this.u;
    this.round++;
    p.hp = p.maxHp; p.ko = false; p.koT = 0; p.move = null; p.hurtT = 0; p.blockT = 0; p.state = 'idle'; p.energy = Math.min(p.energy, 50);
    p.x = clamp(T.W * 0.5 - 220 * u, 60, T.W - 60); p.y = T.floorY; p.land(T.surfaces[0], 0); p.vx = 0; p.facing = 1;
    sh.maxHp = this.L.hp; sh.hp = sh.maxHp; sh.ko = false; sh.forcePose = null; sh.hurtT = 0;
    sh.x = clamp(T.W * 0.5 + 220 * u, 60, T.W - 60); sh.y = T.floorY; sh.land(T.surfaces[0], 0); sh.walkVx = 0; sh.facing = -1; sh.faceCam = false;
    this.projectiles = [];
    this.timer = 75; this.phase = 'intro'; this.phaseT = 0; this.ai.cd = 1.4;
    W.cinema.letterbox(2.2);
    W.cinema.card(`RUNDE ${this.round}`, `${BROTHERS[this.who].title.toUpperCase()} GEGEN SHADEPI · ${this.L.label.toUpperCase()}`, BROTHERS[this.who].color, 1.9, { always: true });
    Sound.play('calib_lock', 0.6);
    if (this.round === 1) setTimeout(() => this.say(pick([...SH_TALK.start, ...SH_TALK[this.who]]), true), 500);
  }

  endRound(winner, reason) {
    if (this.phase !== 'fight') return;
    const W = this.world;
    this.phase = 'roundEnd'; this.phaseT = 0;
    this.wins[winner]++;
    W.cinema.slowmo(0.2, 1.2); W.cinema.letterbox(3); W.cinema.flash('#ffffff', 0.3);
    W.cinema.card(reason === 'time' ? 'ZEIT!' : 'K.O.', winner === 'you' ? `${BROTHERS[this.who].name.toUpperCase()} GEWINNT DIE RUNDE` : 'SHADEPI GEWINNT DIE RUNDE', winner === 'you' ? BROTHERS[this.who].color : COLORS.red, 2.2, { always: true });
    Sound.play('drive_explosion', 0.4, 0.8);
    const matchOver = this.wins[winner] >= 2;
    setTimeout(() => {
      if (reason === 'time') this.say(pick(SH_TALK.timeout), true);
      else this.say(pick(winner === 'me' ? (matchOver ? SH_TALK.winMe : SH_TALK.roundMe) : (matchOver ? SH_TALK.winYou : SH_TALK.roundYou)), true);
      if (this.ra && chance(0.8)) setTimeout(() => this.ra && this.ra.talk(pick(winner === 'me' ? (matchOver ? RA_TALK.winMe : RA_TALK.youKo) : (matchOver ? RA_TALK.winYou : RA_TALK.shHit)), true), 1600);
    }, 900);
    if (winner === 'you') this.player.state = 'win';
    this.matchOver = matchOver;
  }

  finish() {
    const W = this.world;
    this.phase = 'result';
    const won = this.wins.you > this.wins.me;
    const rec = { ...(W.settings.dojo || {}) };
    rec.wins = (rec.wins || 0) + (won ? 1 : 0); rec.losses = (rec.losses || 0) + (won ? 0 : 1);
    rec[this.who] = (rec[this.who] || 0) + (won ? 1 : 0);
    if (W.api) W.api.set('dojo', rec); else W.settings.dojo = rec;
    Sound.setMusic(null);
    this.ui.showResult(won, this.stats, rec);
  }

  stop() {
    const W = this.world;
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKey);
    window.removeEventListener('blur', this.onBlur);
    this.player = null; this.projectiles = [];
    const sh = this.sh;
    if (sh.taskName === 'duel') sh.cancelTask();
    sh.ko = false; sh.hp = sh.def.hp; sh.maxHp = sh.def.hp; sh.forcePose = null;
    if (this.ra && this.ra.taskName === 'watch') this.ra.cancelTask();
    Sound.setMusic(null);
    W.duel = null;
    W.director.next = Math.max(W.director.next, 40);
    W.director.applyMode();
  }

  backToSelect() {
    this.player = null; this.projectiles = []; this.phase = 'select'; this.paused = false;
    const sh = this.sh;
    sh.ko = false; sh.hp = sh.maxHp = sh.def.hp; sh.forcePose = null; sh.hurtT = 0;
    sh.setTask('duel', this.wait(sh), 10);
    Sound.setMusic(null);
  }

  // Shadepi wartet im Dojo, Arme verschränkt (Wache-Pose)
  *wait(sh) {
    const W = this.world;
    while (true) {
      sh.walkVx = 0; sh.faceCam = true; sh.forcePose = null;
      yield;
    }
  }

  // -------------------------------------------- Eingabe
  key(e) {
    if (e.target && e.target.tagName === 'INPUT') return;
    const down = e.type === 'keydown';
    const k = e.code;
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'KeyJ', 'KeyK', 'KeyL', 'KeyE', 'KeyI', 'KeyQ', 'Escape', 'Enter', 'Tab'].includes(k)) e.preventDefault();
    if (down && !this.keys[k]) this.edges[k] = true;
    this.keys[k] = down;
  }
  mouse(button, down) {
    if (down && !this.mouseBtn[button]) this.edges['Mouse' + button] = true;
    this.mouseBtn[button] = down;
  }
  readInput() {
    const k = this.keys, e = this.edges;
    const inp = {
      left: k.KeyA || k.ArrowLeft, right: k.KeyD || k.ArrowRight, block: k.KeyS || k.ArrowDown,
      jump: e.KeyW || e.Space || e.ArrowUp, light: e.KeyJ || e.Mouse0, heavy: e.KeyK || e.Mouse2,
      dash: e.ShiftLeft || e.ShiftRight || e.KeyL, special: e.KeyE || e.KeyI || e.KeyQ, pause: e.Escape,
      // Menüs
      navL: e.KeyA || e.ArrowLeft, navR: e.KeyD || e.ArrowRight, navU: e.KeyW || e.ArrowUp, navD: e.KeyS || e.ArrowDown,
      confirm: e.Enter || e.Space, back: e.Escape,
    };
    // Controller (Standard-Belegung, z. B. Xbox/PlayStation über den Browser)
    let pads = [];
    try { pads = navigator.getGamepads ? [...navigator.getGamepads()].filter((p) => p && p.connected !== false) : []; } catch (_) {}
    const gp = pads[0];
    if (gp) {
      const cur = gp.buttons.map((b) => !!(b && (b.pressed || b.value > 0.5)));
      const prev = this.prevPad;
      const b = (i) => !!cur[i];
      const edge = (i) => !!cur[i] && !prev[i];
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      const pax = this.prevAx[0], pay = this.prevAx[1];
      inp.left = inp.left || ax < -0.4 || b(14); inp.right = inp.right || ax > 0.4 || b(15);
      inp.block = inp.block || b(5) || b(7) || b(13) || ay > 0.65;
      inp.jump = inp.jump || edge(0) || edge(12) || (ay < -0.75 && pay >= -0.75);
      inp.light = inp.light || edge(2);
      inp.heavy = inp.heavy || edge(3);
      inp.dash = inp.dash || edge(1);
      inp.special = inp.special || edge(4) || edge(6);
      inp.pause = inp.pause || edge(9);
      inp.navL = inp.navL || edge(14) || (ax < -0.5 && pax >= -0.5);
      inp.navR = inp.navR || edge(15) || (ax > 0.5 && pax <= 0.5);
      inp.navU = inp.navU || edge(12) || (ay < -0.5 && pay >= -0.5);
      inp.navD = inp.navD || edge(13) || (ay > 0.5 && pay <= 0.5);
      inp.confirm = inp.confirm || edge(0) || edge(9);
      inp.back = inp.back || edge(1) || edge(8);
      this.prevPad = cur; this.prevAx = [ax, ay];
      if (this.padConnected !== gp.id) { this.padConnected = gp.id; this.ui.onPad(gp.id); }
    } else if (this.padConnected) { this.padConnected = null; this.ui.onPad(null); }
    this.edges = {};
    return inp;
  }

  // -------------------------------------------- Takt
  update(dt) {
    this.talkCd -= dt;
    const inp = this.readInput();
    const ra = this.ra;
    if (ra && !ra.task && !ra.ko && !ra.dragged && this.player) ra.setTask('watch', this.watch(ra), 9);
    if (this.inMenu) { this.ui.handleInput(inp); if (this.paused || !this.player || inp.pause) return; }
    if (this.phase === 'fight' && inp.pause) { this.ui.togglePause(); return; }
    if (!this.player) return;
    this.phaseT += dt;
    const p = this.player, sh = this.sh, W = this.world;
    if (this.phase === 'intro') {
      if (this.phaseT > 1.8) { this.phase = 'fight'; this.phaseT = 0; W.cinema.card('LOS!', '', COLORS.amber, 0.9, { always: true, small: true }); Sound.play('calib_alarm', 0.5, 1.3); if (ra && this.round === 1) ra.talk(pick(RA_TALK.start), true); }
    } else if (this.phase === 'fight') {
      this.timer -= dt;
      if (this.timer <= 0) this.endRound(p.hp / p.maxHp >= sh.hp / sh.maxHp ? 'you' : 'me', 'time');
      this.playerControl(inp, dt);
      this.shadepiAI(dt);
    } else if (this.phase === 'roundEnd') {
      if (this.phaseT > 3.6) { if (this.matchOver) this.finish(); else this.nextRound(); }
    }
    this.updateFighter(p, dt);
    this.updateShadepi(dt);
    this.updateProjectiles(dt);
    this.separate();
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.combo = 0; }
  }

  // Im Dojo zählt nur der Boden – keine Fensterplattformen zum Ausweichen
  floorPhysics(ent, dt) {
    const T = this.world.terrain, orig = T.landing;
    T.landing = () => null;
    try { ent.physics(dt); } finally { T.landing = orig; }
    if (ent.ground && ent.wid !== 'floor') ent.land(T.surfaces[0], 0);
  }
  // -------------------------------------------- Spielerfigur
  playerControl(inp, dt) {
    const p = this.player, sh = this.sh, u = this.u, d = p.def;
    if (p.ko) return;
    const any = inp.left || inp.right || inp.jump || inp.light || inp.heavy || inp.dash || inp.special || inp.block;
    this.idleT = any ? 0 : this.idleT + dt;
    if (this.idleT > 7) { this.idleT = -6; this.say(pick(SH_TALK.idle)); }
    if (!p.move && p.dashT <= 0 && p.hurtT <= 0) p.facing = sign(sh.x - p.x) || p.facing;
    p.blockT = inp.block && p.canAct() && p.ground ? (p.blockT > 0 ? p.blockT + dt : dt) : 0;
    if (p.blockT > 0) { p.walkVx = 0; this.buffer = null; return; }
    // Eingabepuffer: kurz zu früh gedrückt zählt trotzdem (fühlt sich wie ein echtes Kampfspiel an)
    const now = this.world.time;
    for (const k of ['dash', 'special', 'heavy', 'light', 'jump']) if (inp[k]) this.buffer = { k, t: now };
    if (this.buffer && now - this.buffer.t > 0.3) this.buffer = null;
    if (!p.canAct()) { if (!p.move) p.walkVx = 0; return; }
    if (this.buffer) { inp = { ...inp, [this.buffer.k]: true }; this.buffer = null; }
    const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    p.walkVx = dir * d.speed * u;
    if (p.ground) p.vx = p.walkVx; else p.vx += (dir * d.speed * u - p.vx) * Math.min(1, dt * 6);
    if (inp.jump && p.ground) {
      p.vy = -d.jump * u; p.leaveGround(); Sound.play('calib_tick', 0.3, 1.6); this.world.fx.dust(p.x, p.y, 4, u);
      const now = this.world.time; this.jumps = this.jumps.filter((t) => now - t < 3); this.jumps.push(now);
      if (this.jumps.length >= 5) { this.jumps = []; this.say(pick(SH_TALK.jumpy)); }
    }
    if (inp.dash) {
      p.dashT = 0.22; p.invuln = 0.22; p.vx = (dir || p.facing) * 820 * u; p.walkVx = p.vx;
      Sound.play('slash', 0.3, 0.7); this.world.fx.speedLines(p.x, p.y, sign(p.vx), 'rgba(255,255,255,0.5)');
      const now = this.world.time; this.dashes = this.dashes.filter((t) => now - t < 4); this.dashes.push(now);
      if (this.dashes.length >= 4) { this.dashes = []; this.say(pick(SH_TALK.dashy)); }
    } else if (inp.special && p.energy >= 100) { p.energy = 0; this.stats.specials++; this.startSpecial(p); }
    else if (inp.special) { this.world.fx.label(p.x, p.y - 150 * u, 'ENERGIE FEHLT', COLORS.muted, 13, 0.6); }
    else if (inp.heavy) this.startMove(p, 'heavy');
    else if (inp.light) this.startMove(p, 'light');
  }

  startMove(p, kind) {
    const m = p.def[kind];
    p.move = { kind, def: m, t: 0, frame: 1, hit: false, hitSet: new Set(), shots: 0 };
    p.walkVx = 0;
    if (kind === 'heavy') { Sound.play('legacy_aura', 0.25, 1.7); }
  }

  startSpecial(p) {
    const W = this.world, u = this.u;
    W.cinema.letterbox(1.6); W.cinema.slowmo(0.45, 0.6);
    W.cinema.card(p.def.special.name.toUpperCase(), p.def.title.toUpperCase(), p.def.color, 1.4, { always: true, small: true, y: W.terrain.H * 0.22 });
    Sound.play('legacy_aura', 0.5, 1.2);
    p.move = { kind: 'special', t: 0, frame: 1, hitSet: new Set(), hits: 0, shots: 0, phase: 0 };
    if (p.who === 'ly') {
      // Weißer Schatten: hinter Shadepi auftauchen
      const sh = this.sh;
      W.fx.smokePuff(p.x, p.y - 40 * u, 0.6 * u, 0.8);
      p.x = clamp(sh.x + sh.facing * -1 * 60 * u, 30, W.terrain.W - 30);
      if (Math.abs(p.x - sh.x) < 40 * u) p.x = clamp(sh.x - p.facing * 60 * u, 30, W.terrain.W - 30);
      p.facing = sign(sh.x - p.x) || 1;
      W.fx.smokePuff(p.x, p.y - 40 * u, 0.6 * u, 0.8);
      W.fx.add({ type: 'ring', x: p.x, y: p.y - 40 * u, life: 0.4, r0: 6, r1: 60 * u, color: '#ffffff', w: 3 });
    }
    if (p.who === 'robot') { p.vy = -620 * u; p.leaveGround(); p.vx = clamp((this.sh.x - p.x) * 1.5, -460 * u, 460 * u); p.walkVx = p.vx; }
  }

  updateFighter(p, dt) {
    const W = this.world, u = this.u, sh = this.sh;
    p.tickTimers(dt);
    p.animT += dt;
    if (p.hurtT > 0) p.hurtT -= dt;
    if (p.dashT > 0) {
      p.dashT -= dt; p.walkVx = p.vx * 0.9;
      if (chance(dt * 40)) { const s = { x: p.x, y: p.y, f: p.facing }; W.fx.afterimage((ctx, col) => drawBrother(ctx, p.who, 'run_a', s.f < 0 ? 1 : 2, s.x, s.y, p.S, { tint: col, tintAmt: 0.7 }), 0.25, p.def.color); }
      if (p.dashT <= 0) p.walkVx = 0;
    }
    if (p.ko) { p.koT += dt; p.walkVx = 0; }
    const m = p.move;
    if (m) {
      m.t += dt;
      if (m.kind === 'special') this.updateSpecial(p, m, dt);
      else {
        const d = m.def;
        if (m.t < d.startup) m.frame = 1;
        else if (m.t < d.startup + d.active) {
          m.frame = 2;
          if (d.gun) { // MG-Feuerstoß
            const n = Math.floor((m.t - d.startup) / (d.active / d.gun));
            while (m.shots <= n && m.shots < d.gun) { m.shots++; this.fire(p, 3, 0.05); }
            m.frame = Math.floor(m.t * 30) % 2 ? 2 : 3;
          } else if (!m.hit) {
            m.hit = true;
            if (d.dash) { p.vx = p.facing * d.dash * u; p.walkVx = p.vx * 0.5; }
            Sound.play(d.sound, 0.6, m.kind === 'heavy' ? 0.85 : rnd(1, 1.2));
            W.fx.slash(p.x + p.facing * 26 * u, p.y - 52 * u, p.facing, p.def.color === '#f4f0e4' ? '#ff6b80' : p.def.color, u * (m.kind === 'heavy' ? 1.3 : 1));
            const landed = this.meleeCheck(p, sh, d.range * u, d.dmg, d, m.kind);
            if (!landed) { this.whiffs++; if (this.whiffs >= 4) { this.whiffs = 0; this.say(pick(SH_TALK.whiff)); } }
          }
        } else if (m.t < d.startup + d.active + d.recover) m.frame = 3;
        else { p.move = null; p.walkVx = 0; }
      }
    }
    this.floorPhysics(p, dt);
  }

  updateSpecial(p, m, dt) {
    const W = this.world, u = this.u, sh = this.sh;
    const end = () => { p.move = null; p.walkVx = 0; };
    if (p.who === 'oni') {
      // drei Wirbel, Richtung wechselt
      const k = Math.floor(m.t / 0.22);
      m.frame = [1, 2, 3][Math.floor(m.t / 0.07) % 3];
      p.facing = k % 2 ? -sign(sh.x - p.x) || 1 : sign(sh.x - p.x) || 1;
      if (k > m.phase && k <= 3) { m.phase = k; m.hitSet = new Set(); Sound.play('slash', 0.7, 0.9 + k * 0.1); W.fx.slash(p.x, p.y - 50 * u, p.facing, COLORS.red, 1.5 * u, { a0: -3, a1: 3 }); }
      if (m.phase >= 1 && Math.abs(sh.x - p.x) < 110 * u && Math.abs(sh.y - p.y) < 80 * u && !m.hitSet.has(m.phase)) { m.hitSet.add(m.phase); this.hitShadepi(p, 7, { knock: 260, up: 120, special: true }); }
      if (m.t > 0.9) end();
    } else if (p.who === 'robot') {
      m.frame = p.ground && m.t > 0.15 ? 2 : 1;
      if (p.ground && m.t > 0.15 && !m.slam) {
        m.slam = true;
        W.cinema.shake(9, 0.35); W.fx.add({ type: 'shockwave', x: p.x + p.facing * 30 * u, y: p.y, r: 190 * u, life: 0.5, color: COLORS.cyan }); W.fx.dust(p.x, p.y, 14, 1.4 * u);
        Sound.play('drive_explosion', 0.45, 1.4);
        if (Math.abs(sh.x - p.x) < 170 * u && sh.ground) this.hitShadepi(p, 15, { knock: 420, up: 420, special: true });
      }
      if (m.slam && m.t > 0.6) end();
      if (m.t > 2) end();
    } else if (p.who === 'ly') {
      m.frame = m.t < 0.12 ? 1 : m.t < 0.3 ? 2 : 3;
      if (m.t > 0.12 && !m.hitSet.has(1)) {
        m.hitSet.add(1);
        Sound.play('slash', 0.9, 1.3);
        W.fx.slash(p.x + p.facing * 26 * u, p.y - 52 * u, p.facing, '#ffffff', 1.6 * u, { w: 9 });
        if (Math.abs(sh.x - p.x) < 120 * u && Math.abs(sh.y - p.y) < 80 * u) this.hitShadepi(p, 13, { knock: 380, up: 220, special: true, unblockable: true });
      }
      if (m.t > 0.55) end();
    } else if (p.who === 'heavy') {
      m.frame = Math.floor(m.t * 30) % 2 ? 2 : 3;
      p.walkVx = -p.facing * 30 * u;
      const n = Math.floor(m.t / 0.11);
      while (m.shots <= n && m.shots < 14) { m.shots++; this.fire(p, 3, 0.1); }
      if (m.t > 1.7) end();
    }
  }

  fire(p, dmg, spread) {
    const W = this.world, u = this.u;
    const ox = p.x + p.facing * 58 * u, oy = p.y - 46 * u;
    const a = (p.facing > 0 ? 0 : Math.PI) + rnd(-spread, spread);
    this.projectiles.push({ x: ox, y: oy, vx: Math.cos(a) * 980 * u, vy: Math.sin(a) * 980 * u, from: 'you', dmg, kind: 'bullet', t: 0 });
    W.fx.add({ type: 'strip', img: 'muzzle', x: ox, y: oy, life: 0.07, frames: 4, scale: 0.32 * u });
    Sound.play('drive_shot', 0.35, rnd(0.9, 1.2));
    W.cinema.shake(1.5, 0.05);
  }

  meleeCheck(p, sh, range, dmg, d, kind) {
    const u = this.u;
    const box = { x: p.facing > 0 ? p.x - 10 * u : p.x - range, y: p.y - 100 * u, w: range + 10 * u, h: 100 * u };
    if (!rectsOverlap(box, sh.bounds())) return false;
    this.hitShadepi(p, dmg, { knock: d.knock, up: d.up, heavy: kind === 'heavy' });
    return true;
  }

  hitShadepi(p, dmg, o = {}) {
    const W = this.world, sh = this.sh, u = this.u;
    if (sh.ko || this.phase !== 'fight') return;
    const dir = sign(sh.x - p.x) || 1;
    // Shadepi pariert
    if (this.ai.blocking && !o.unblockable && sign(p.x - sh.x) === sh.facing) {
      W.fx.sparks(sh.x + sh.facing * 20 * u, sh.y - 55 * u, COLORS.redHot, 12, 320); W.fx.label(sh.x, sh.y - 110 * u, 'PARIERT', COLORS.red, 15, 0.8);
      Sound.play('hit', 0.6, 1.5); W.cinema.stop(0.05);
      p.vx = -dir * 260 * u; p.hurtT = o.heavy ? 0.35 : 0.15; p.move = null;
      this.combo = 0;
      if (chance(0.45)) this.say(pick(SH_TALK.blocked));
      return;
    }
    sh.hp -= dmg; sh.flash = 0.12;
    if (o.bullet) {
      // Kugeln lassen ihn nur zucken – kein Dauer-Betäuben per MG
      sh.vx += dir * 40 * u;
      if (!this.ai.move || chance(0.25)) { sh.hurtT = Math.max(sh.hurtT, 0.07); this.ai.stun = Math.max(this.ai.stun || 0, 0.05); }
    } else {
      sh.hurtT = o.heavy || o.special ? 0.4 : 0.22;
      sh.vx = dir * (o.knock || 200) * u * 0.8;
      if (o.up) { sh.vy = -o.up * u; sh.leaveGround(); }
      this.ai.stun = Math.max(this.ai.stun || 0, sh.hurtT);
      this.ai.move = null; sh.forcePose = null; this.ai.blocking = false;
    }
    W.fx.number(sh.x, sh.y - 90 * u, dmg, COLORS.white, dmg >= 10);
    W.fx.sparks(sh.x, sh.y - 55 * u, p.def.color, 10, 320);
    Sound.any(['hit', 'enemy_hurt_0'], 0.7);
    W.cinema.stop(o.heavy || o.special ? 0.09 : 0.045); if (o.heavy || o.special) W.cinema.shake(5, 0.2);
    p.energy = Math.min(100, p.energy + dmg * 2.2);
    this.stats.hits++; this.stats.dmg += dmg; this.whiffs = 0;
    if (o.bullet) { this.bulletHits = (this.bulletHits || 0) + 1; if (this.bulletHits % 4) { this.checkKo(); return; } }
    this.combo++; this.comboT = 1.3;
    this.stats.maxCombo = Math.max(this.stats.maxCombo, this.combo);
    if (this.combo === 3) this.say(pick(SH_TALK.combo3));
    else if (this.combo === 5) this.say(pick(SH_TALK.combo5), true);
    else if (o.special) this.say(pick(SH_TALK.special));
    if (this.ra && chance(0.12)) this.ra.talk(pick(RA_TALK.shHit), true);
    if (sh.hp <= sh.maxHp * 0.3 && !this.lowMeSaid) { this.lowMeSaid = true; this.say(pick(SH_TALK.lowMe), true); }
    this.checkKo();
  }
  checkKo() {
    const sh = this.sh;
    if (sh.hp <= 0 && !sh.ko) { sh.hp = 0; sh.ko = true; sh.hurtT = 0; this.ai.move = null; this.ai.blocking = false; this.endRound('you', 'ko'); }
  }

  hitPlayer(dmg, o = {}) {
    const W = this.world, p = this.player, sh = this.sh, u = this.u;
    if (p.ko || p.invuln > 0 || this.phase !== 'fight') return 'miss';
    const dir = sign(p.x - (o.fromX ?? sh.x)) || 1;
    dmg = Math.round(dmg * this.L.dmg * (p.def.armor && !o.heavy ? p.def.armor + 0.4 : 1));
    if (p.blockT > 0 && sign((o.fromX ?? sh.x) - p.x) === p.facing && !o.unblockable) {
      if (p.blockT < 0.18) {
        // Perfekte Parade
        this.stats.parries++;
        W.fx.sparks(p.x + p.facing * 22 * u, p.y - 55 * u, COLORS.cyanHot, 18, 420);
        W.fx.label(p.x, p.y - 112 * u, 'PERFEKTE PARADE', COLORS.cyan, 16, 0.9);
        Sound.play('calib_lock', 0.7, 1.4); W.cinema.stop(0.1); W.cinema.flash('#62e3ee', 0.12);
        this.ai.stun = 0.7; this.ai.move = null; sh.forcePose = 'hit'; sh.hurtT = 0.6;
        p.energy = Math.min(100, p.energy + 25);
        this.say(pick(SH_TALK.parry), true);
        return 'parry';
      }
      const chip = Math.max(1, Math.round(dmg * 0.15));
      p.hp -= chip; p.vx = dir * 220 * u;
      W.fx.sparks(p.x + p.facing * 22 * u, p.y - 55 * u, COLORS.cyan, 8, 260);
      Sound.play('hit', 0.5, 1.6);
      p.energy = Math.min(100, p.energy + 6);
      this.stats.parries += 0; return 'block';
    }
    p.hp -= dmg; p.flash = 0.12; p.hurtT = o.heavy ? 0.5 : 0.28; p.move = null; p.blockT = 0;
    p.vx = dir * (o.knock || 200) * u * (p.def.armor ? 0.6 : 1); p.walkVx = 0;
    if (o.up) { p.vy = -o.up * u * (p.def.armor ? 0.6 : 1); p.leaveGround(); }
    W.fx.number(p.x, p.y - 90 * u, dmg, COLORS.warn, dmg >= 10);
    W.fx.sparks(p.x, p.y - 55 * u, COLORS.redHot, 10, 320);
    Sound.play('hit', 0.7, 0.9); W.cinema.stop(o.heavy ? 0.08 : 0.04); if (o.heavy) W.cinema.shake(5, 0.2);
    p.energy = Math.min(100, p.energy + dmg * 1.2);
    this.stats.taken += dmg; this.combo = 0;
    if (o.heavy && chance(0.5)) this.say(pick(SH_TALK.hitYouHard)); else if (chance(0.3)) this.say(pick(SH_TALK.hitYou));
    if (p.hp <= p.maxHp * 0.25 && !this.lowYouSaid) { this.lowYouSaid = true; this.say(pick(SH_TALK.lowYou), true); }
    if (p.hp <= 0) { p.hp = 0; p.ko = true; p.koT = 0; this.endRound('me', 'ko'); if (this.ra && chance(0.6)) setTimeout(() => this.ra && this.ra.talk(pick(RA_TALK.youKo), true), 700); }
    return 'hit';
  }

  // -------------------------------------------- Shadepi (Trainings-KI)
  updateShadepi(dt) {
    const sh = this.sh, W = this.world;
    sh.tickTimers(dt);
    sh.animT += dt;
    if (sh.hurtT > 0) sh.hurtT -= dt;
    sh.buffs.core = 0;
    if (sh.ko) { sh.walkVx = 0; }
    this.floorPhysics(sh, dt);
  }

  shadepiAI(dt) {
    const W = this.world, sh = this.sh, p = this.player, u = this.u, L = this.L, ai = this.ai;
    if (sh.ko) return;
    if (ai.stun > 0) { ai.stun -= dt; sh.walkVx = 0; return; }
    if (ai.move) { this.runAiMove(dt); return; }
    sh.facing = sign(p.x - sh.x) || sh.facing;
    ai.cd -= dt;
    const dx = p.x - sh.x, ad = Math.abs(dx);
    // auf Angriffe reagieren: blocken
    if (p.move && p.move.kind !== 'special' && ad < 150 * u && !ai.reacted) {
      ai.reacted = true;
      if (chance(L.block)) { this.aiStart('block', { dur: 0.5 }); return; }
    }
    if (!p.move) ai.reacted = false;
    // Kugeln abwehren
    if (this.projectiles.some((b) => b.from === 'you' && Math.abs(b.x - sh.x) < 160 * u && sign(b.vx) === -sh.facing) && chance(L.block * 0.6 * dt * 30)) { this.aiStart('deflect', { dur: 0.45 }); return; }
    // Tipps im leichten Modus
    if (L.tips && chance(dt * 0.04)) { this.say(pick(this.padConnected ? SH_TALK.tipsPad : SH_TALK.tips)); ai.cd = Math.max(ai.cd, 1.2); }
    if (ai.cd > 0) {
      // Abstand halten, leicht pendeln
      if (!ai.wantT || W.time > ai.wantT) { ai.want = rnd(80, 125); ai.wantT = W.time + rnd(0.6, 1.4); }
      const want = ai.want * u;
      const step = ad > want + 40 * u ? 1 : ad < want - 40 * u ? -0.6 : 0;
      sh.walkVx = sign(dx) * step * sh.def.walk * u * 1.3;
      return;
    }
    ai.cd = rnd(0.35, 1.1) * (1.6 - L.aggro) + L.react * 0.6;
    if (!p.ground && p.y < sh.y - 60 * u && ad < 260 * u && chance(0.6)) { this.aiStart('jumpslash'); return; }
    if (ad > 320 * u) { this.aiStart(chance(0.5) ? 'shuriken' : 'approach'); return; }
    if (L.shadow && chance(0.12)) { this.aiStart('shadow'); return; }
    if (ad < 95 * u) { this.aiStart(weighted([['combo', 4], ['kick', 2], ['charge', 1.2 * L.aggro], ['block', 1]])); return; }
    this.aiStart(weighted([['approach', 3], ['charge', 1], ['shuriken', 1], ['jumpslash', 0.6]]));
  }

  aiStart(kind, o = {}) {
    this.ai.move = { kind, t: 0, step: 0, ...o };
  }

  runAiMove(dt) {
    const W = this.world, sh = this.sh, p = this.player, u = this.u, ai = this.ai, m = ai.move, L = this.L;
    m.t += dt;
    const done = () => { ai.move = null; sh.forcePose = null; sh.walkVx = 0; ai.blocking = false; };
    const dx = p.x - sh.x;
    switch (m.kind) {
      case 'approach':
        sh.facing = sign(dx) || sh.facing;
        sh.walkVx = sign(dx) * sh.def.run * u * 0.85;
        if (Math.abs(dx) < 90 * u || m.t > 1.2) { done(); ai.cd = L.react * 0.5; }
        break;
      case 'block': case 'deflect':
        ai.blocking = true; sh.walkVx = 0; sh.facing = sign(dx) || sh.facing;
        sh.forcePose = 'pose'; sh.poseRow = 0;
        // Kugeln zurückschlagen
        for (const b of this.projectiles) if (b.from === 'you' && Math.abs(b.x - sh.x) < 60 * u && Math.abs(b.y - (sh.y - 50 * u)) < 60 * u) {
          b.vx = -b.vx; b.vy = rnd(-120, 60); b.from = 'me'; b.dmg = 2;
          W.fx.sparks(b.x, b.y, COLORS.redHot, 6, 240); Sound.play('slash', 0.4, 1.6);
          if (!m.said) { m.said = true; this.say(pick(SH_TALK.bullets)); }
        }
        if (m.t > (m.dur || 0.5)) done();
        break;
      case 'combo': {
        sh.walkVx = 0;
        const hits = L.aggro > 0.6 ? 3 : 2;
        const per = 0.36;
        const i = Math.floor(m.t / per);
        if (i >= hits) { done(); break; }
        sh.forcePose = 'attack'; sh.attackDur = per; sh.animT = m.t - i * per;
        if (m.step <= i && m.t - i * per > 0.13) {
          m.step = i + 1;
          sh.facing = sign(dx) || sh.facing;
          Sound.play('slash', 0.6, rnd(0.9, 1.1));
          W.fx.slash(sh.x + sh.facing * 24 * u, sh.y - 52 * u, sh.facing, COLORS.red, u);
          if (this.inReach(78)) this.hitPlayer(6, { knock: 180 });
        }
        break;
      }
      case 'kick':
        sh.walkVx = 0; sh.forcePose = 'pose'; sh.poseRow = m.t < 0.12 ? 1 : 2;
        if (!m.hit && m.t > 0.14) { m.hit = true; sh.vx = sh.facing * 160 * u; Sound.play('drive_knock', 0.6, 1.2); if (this.inReach(80)) this.hitPlayer(8, { knock: 460, up: 240, heavy: true }); }
        if (m.t > 0.45) done();
        break;
      case 'charge':
        sh.walkVx = 0;
        if (m.t < 0.6) {
          sh.forcePose = 'pose'; sh.poseRow = 0;
          if (chance(dt * 30)) { const a = rnd(0, 6.28); W.fx.add({ type: 'spark', x: sh.x + Math.cos(a) * 60 * u, y: sh.y - 60 * u + Math.sin(a) * 50 * u, vx: -Math.cos(a) * 200, vy: -Math.sin(a) * 200, g: 0, drag: 0.95, life: 0.3, color: COLORS.red, len: 7 }); }
        } else if (!m.hit) {
          m.hit = true; sh.facing = sign(dx) || sh.facing;
          sh.forcePose = 'attack'; sh.attackDur = 0.4; sh.animT = 0.12;
          sh.vx = sh.facing * 300 * u;
          Sound.play('slash', 0.9, 0.8); W.cinema.shake(5, 0.2);
          W.fx.slash(sh.x + sh.facing * 30 * u, sh.y - 54 * u, sh.facing, COLORS.red, 1.6 * u, { w: 10 });
          if (this.inReach(110)) this.hitPlayer(13, { knock: 520, up: 300, heavy: true });
        } else if (m.t > 1.0) done();
        break;
      case 'shuriken':
        sh.walkVx = 0; sh.forcePose = 'attack'; sh.attackDur = 0.4; sh.animT = Math.min(0.2, m.t);
        if (!m.hit && m.t > 0.12) {
          m.hit = true;
          const n = L.aggro > 0.5 ? 3 : 1;
          for (let i = 0; i < n; i++) {
            const a = Math.atan2(p.y - 50 * u - (sh.y - 60 * u), dx) + (i - (n - 1) / 2) * 0.12;
            this.projectiles.push({ x: sh.x + sh.facing * 20 * u, y: sh.y - 60 * u, vx: Math.cos(a) * 760 * u, vy: Math.sin(a) * 760 * u, from: 'me', dmg: 4, kind: 'shuriken', t: 0, rot: 0 });
          }
          Sound.play('slash', 0.35, 1.6);
        }
        if (m.t > 0.45) done();
        break;
      case 'jumpslash':
        if (m.step === 0) { m.step = 1; sh.facing = sign(dx) || sh.facing; sh.vy = -Math.min(1000, Math.sqrt(2 * GRAVITY * Math.max(80 * u, sh.y - p.y + 60 * u))); sh.vx = dx * 1.4; sh.leaveGround(); sh.forcePose = 'jump'; }
        if (!sh.ground) {
          sh.forcePose = sh.vy > -150 ? 'pose' : 'jump'; sh.poseRow = 1;
          if (!m.hit && sh.vy > -250 && dist(sh.x, sh.y - 50 * u, p.x, p.y - 50 * u) < 100 * u) {
            m.hit = true; sh.forcePose = 'attack'; sh.attackDur = 0.35; sh.animT = 0.12;
            Sound.play('slash', 0.8); W.fx.slash(sh.x + sh.facing * 20 * u, sh.y - 54 * u, sh.facing, COLORS.red, 1.2 * u, { a0: -2, a1: 1.4 });
            this.hitPlayer(9, { knock: 320, up: 120 });
          }
        } else if (m.t > 0.2) done();
        if (m.t > 2) done();
        break;
      case 'shadow':
        if (m.step === 0) {
          m.step = 1; W.fx.smokePuff(sh.x, sh.y - 30 * u, 0.6 * u, 0.9); Sound.play('slash', 0.4, 0.6);
          sh.x = clamp(p.x - p.facing * 70 * u, 30, W.terrain.W - 30); sh.facing = sign(p.x - sh.x) || 1;
          W.fx.smokePuff(sh.x, sh.y - 30 * u, 0.6 * u, 0.9);
        }
        sh.forcePose = 'attack'; sh.attackDur = 0.4; sh.animT = Math.min(0.39, m.t);
        if (!m.hit && m.t > 0.18) { m.hit = true; Sound.play('slash', 0.8, 1.1); W.fx.slash(sh.x + sh.facing * 24 * u, sh.y - 52 * u, sh.facing, COLORS.red, 1.2 * u); if (this.inReach(85)) this.hitPlayer(9, { knock: 300 }); }
        if (m.t > 0.55) done();
        break;
      default: done();
    }
  }

  inReach(range) {
    const sh = this.sh, p = this.player, u = this.u;
    const box = { x: sh.facing > 0 ? sh.x - 10 * u : sh.x - range * u, y: sh.y - 100 * u, w: range * u + 10 * u, h: 100 * u };
    return rectsOverlap(box, p.bounds());
  }

  updateProjectiles(dt) {
    const W = this.world, u = this.u, p = this.player, sh = this.sh;
    for (const b of this.projectiles) {
      b.t += dt; b.x += b.vx * dt; b.y += b.vy * dt; if (b.kind === 'shuriken') b.rot = (b.rot || 0) + dt * 20;
      if (b.t > 2 || b.x < -50 || b.x > W.terrain.W + 50) b.dead = true;
      if (b.dead) continue;
      if (b.from === 'you' && !sh.ko && pointIn(b.x, b.y, sh.bounds())) {
        b.dead = true;
        if (this.ai.blocking) { W.fx.sparks(b.x, b.y, COLORS.redHot, 5, 200); continue; }
        this.hitShadepi(p, b.dmg, { bullet: true });
      } else if (b.from === 'me' && !p.ko && pointIn(b.x, b.y, p.bounds())) {
        b.dead = true;
        this.hitPlayer(b.dmg, { knock: 140, fromX: b.x - b.vx * 0.05 });
      }
    }
    this.projectiles = this.projectiles.filter((b) => !b.dead);
  }

  separate() {
    const p = this.player, sh = this.sh, u = this.u;
    if (p.ko || sh.ko || !p.ground || !sh.ground || p.wid !== sh.wid) return;
    const min = 34 * u, d = p.x - sh.x;
    if (Math.abs(d) < min) { const push = (min - Math.abs(d)) / 2; const s = sign(d) || 1; p.x += s * push; sh.x -= s * push; }
  }

  say(text, force) {
    if (!text || (!force && this.talkCd > 0) || text === this.lastLine) return;
    this.talkCd = 3.2; this.lastLine = text;
    this.sh.talk(text, true);
  }

  *watch(ra) {
    // Raven schaut zu – auf einem Fenster, sonst am Rand
    const W = this.world, T = W.terrain, u = this.u;
    const tops = T.surfaces.filter((s) => s.wid !== 'floor' && s.x2 - s.x1 > 120 && s.y > 160);
    if (tops.length && W.settings.climbWindows && chance(0.7)) yield* ra.goToSurface(pick(tops));
    else yield* ra.walkTo(T.W - 80 * u, true);
    ra.walkVx = 0;
    ra.forcePose = 'sit';
    while (true) {
      ra.facing = sign(this.sh.x - ra.x) || ra.facing;
      if (chance(W.dt * 0.4)) W.fx.hearts(ra.x, ra.y - 70 * u, 1, 0.5);
      yield;
    }
  }

  // -------------------------------------------- Kampfanzeige
  // Desktop leicht abdunkeln + Dojo-Boden: zeigt, dass Maus und Tastatur gerade dem Kampf gehören
  drawBackdrop(ctx) {
    const T = this.world.terrain, k = this.dim = approach(this.dim || 0, 1, this.world.dt * 2);
    ctx.save();
    ctx.globalAlpha = k;
    ctx.fillStyle = 'rgba(3,5,10,0.42)'; ctx.fillRect(0, 0, T.W, T.H);
    const g = ctx.createLinearGradient(0, T.floorY - 140, 0, T.floorY);
    g.addColorStop(0, 'rgba(255,49,80,0)'); g.addColorStop(1, 'rgba(255,49,80,0.10)');
    ctx.fillStyle = g; ctx.fillRect(0, T.floorY - 140, T.W, 140);
    ctx.fillStyle = 'rgba(255,49,80,0.55)'; ctx.fillRect(0, T.floorY - 1, T.W, 2);
    ctx.restore();
  }

  drawWorld(ctx) {
    const sh = this.sh, u = this.u;
    if (this.player && this.ai.blocking && !sh.ko) {
      ctx.save(); ctx.globalAlpha = 0.4 + 0.15 * Math.sin(this.world.time * 20);
      ctx.strokeStyle = COLORS.red; ctx.lineWidth = 2; ctx.shadowColor = COLORS.red; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(sh.x + sh.facing * 18 * u, sh.y - 50 * u, 34 * u, sh.facing > 0 ? -1.2 : Math.PI - 1.2, sh.facing > 0 ? 1.2 : Math.PI + 1.2); ctx.stroke();
      ctx.restore();
    }
    this.drawProjectiles(ctx);
  }

  drawProjectiles(ctx) {
    const u = this.u;
    for (const b of this.projectiles) {
      ctx.save(); ctx.translate(b.x, b.y);
      if (b.kind === 'shuriken') {
        ctx.rotate(b.rot); ctx.fillStyle = '#c9ccd3'; ctx.beginPath();
        for (let i = 0; i < 8; i++) { const r = i % 2 ? 3 : 10; const a = (i / 8) * Math.PI * 2; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
        ctx.closePath(); ctx.fill(); ctx.fillStyle = COLORS.red; ctx.fillRect(-1.5, -1.5, 3, 3);
      } else {
        ctx.rotate(Math.atan2(b.vy, b.vx));
        ctx.shadowColor = b.from === 'me' ? COLORS.red : COLORS.amber; ctx.shadowBlur = 10;
        ctx.fillStyle = b.from === 'me' ? COLORS.redHot : '#ffd27a'; ctx.fillRect(-12 * u, -2, 18 * u, 4);
      }
      ctx.restore();
    }
  }

  drawHud(ctx) {
    if (!this.player || this.phase === 'select') return;
    const W = this.world, T = W.terrain, p = this.player, sh = this.sh, d = p.def;
    const top = 18 + W.cinema.bars * T.H * 0.075;
    const bw = Math.min(420, T.W * 0.3);
    ctx.save();
    const bar = (x, y, w, frac, color, flip, label, sub, wins) => {
      ctx.fillStyle = 'rgba(7,10,18,0.88)'; ctx.fillRect(x - 6, y - 22, w + 12, 50);
      ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.strokeRect(x - 6, y - 22, w + 12, 50);
      ctx.font = '20px ShadepiPixel, monospace'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff'; ctx.textAlign = flip ? 'right' : 'left';
      ctx.fillText(label, flip ? x + w : x, y - 9);
      ctx.font = '8px Silkscreen, monospace'; ctx.fillStyle = COLORS.muted;
      ctx.fillText(sub, flip ? x + w : x, y + 20);
      ctx.fillStyle = '#2a1018'; ctx.fillRect(x, y + 2, w, 10);
      const fw = w * clamp(frac, 0, 1);
      ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 8;
      ctx.fillRect(flip ? x + w - fw : x, y + 2, fw, 10);
      ctx.shadowBlur = 0;
      for (let i = 0; i < 2; i++) {
        const cx = flip ? x + 8 + i * 16 : x + w - 8 - i * 16;
        ctx.fillStyle = i < wins ? COLORS.amber : '#2a3342'; ctx.beginPath(); ctx.arc(cx, y - 9, 5, 0, 7); ctx.fill();
      }
    };
    bar(24, top + 22, bw, p.hp / p.maxHp, d.color === '#f4f0e4' ? '#e9e2cf' : d.color, false, d.name.toUpperCase(), d.weapon.toUpperCase(), this.wins.you);
    // Energie für die Spezialtechnik
    const ey = top + 56, ew = bw * 0.6;
    ctx.fillStyle = 'rgba(7,10,18,0.88)'; ctx.fillRect(18, ey - 4, ew + 12, 13);
    ctx.fillStyle = '#0d1b24'; ctx.fillRect(24, ey, ew, 5);
    ctx.fillStyle = p.energy >= 100 ? (Math.sin(W.time * 12) > 0 ? '#ffffff' : COLORS.cyan) : COLORS.cyan; ctx.fillRect(24, ey, ew * (p.energy / 100), 5);
    ctx.font = '8px Silkscreen, monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = p.energy >= 100 ? COLORS.cyan : COLORS.muted;
    ctx.fillText(p.energy >= 100 ? `${d.special.name.toUpperCase()} BEREIT · ${this.padConnected ? 'LB' : 'E'}` : 'ENERGIE', 24 + ew + 14, ey + 3);
    bar(T.W - 24 - bw, top + 22, bw, sh.hp / sh.maxHp, COLORS.red, true, 'SHADEPI', `TRAINING · ${this.L.label.toUpperCase()}`, this.wins.me);
    // Zeit
    ctx.textAlign = 'center'; ctx.font = '34px ShadepiPixel, monospace'; ctx.fillStyle = this.timer < 10 ? COLORS.warn : '#fff';
    ctx.fillText(String(Math.max(0, Math.ceil(this.timer))), T.W / 2, top + 22);
    ctx.font = '8px Silkscreen, monospace'; ctx.fillStyle = COLORS.muted; ctx.fillText(`RUNDE ${this.round}`, T.W / 2, top + 44);
    // Kombo
    if (this.combo >= 2) {
      ctx.font = '26px ShadepiPixel, monospace'; ctx.fillStyle = COLORS.amber; ctx.shadowColor = COLORS.amber; ctx.shadowBlur = 10;
      ctx.fillText(`${this.combo} TREFFER`, p.x, p.y - 140 * W.u);
    }
    ctx.shadowBlur = 0;
    // Steuerungshinweis
    if (this.round === 1 && this.phase !== 'result' && (this.phase === 'intro' || this.phaseT < 6)) {
      ctx.font = '9px Silkscreen, monospace'; ctx.fillStyle = 'rgba(217,243,247,0.8)';
      ctx.fillText(this.padConnected ? 'STICK LAUFEN · A SPRINGEN · X ANGRIFF · Y SCHWER · B AUSWEICHEN · RB BLOCK · LB SPEZIAL · START PAUSE'
        : 'A/D LAUFEN · W/LEER SPRINGEN · LINKSKLICK/J ANGRIFF · RECHTSKLICK/K SCHWER · S BLOCK · SHIFT AUSWEICHEN · E SPEZIAL · ESC PAUSE', T.W / 2, T.floorY - 14);
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------- Dojo-Oberfläche
// Auswahl der Ordensbrüder, Pause, Ergebnis. Bedienbar mit Maus, Tastatur und Controller.
const DOJO_ORDER = ['oni', 'robot', 'ly', 'heavy'];
const DOJO_LEVELS = ['leicht', 'mittel', 'schwer'];

class Dojo {
  constructor(world, bridge, input) {
    this.world = world; this.bridge = bridge; this.input = input;
    this.root = document.getElementById('ui');
    this.el = null; this.duel = null;
    this.sel = 0; this.lvl = 1; this.focus = 0; this.view = null;
    const last = world.settings.dojo || {};
    if (last.last && DOJO_ORDER.includes(last.last)) this.sel = DOJO_ORDER.indexOf(last.last);
    if (last.level && DOJO_LEVELS.includes(last.level)) this.lvl = DOJO_LEVELS.indexOf(last.level);
  }

  get active() { return !!this.duel; }

  open() {
    const W = this.world;
    if (this.duel) return;
    if (W.gaming) return;
    if (W.ui && W.ui.isOpen) W.ui.close();
    W.director.scripts = [];
    W.clearAll();
    for (const h of W.heroes) if (!h.absent && !h.dragged) h.cancelTask();
    const sh = W.hero('shadepi'), T = W.terrain, u = W.u;
    if (sh.absent || sh.alpha < 1) {
      sh.absent = false; sh.alpha = 1; sh.ko = false;
      sh.x = T.W * 0.5 + 200 * u; sh.y = T.floorY; sh.land(T.surfaces[0], 0);
      W.fx.smokePuff(sh.x, sh.y - 30 * u, 0.8 * u, 0.9);
      Sound.play('legacy_aura', 0.4, 1.4);
    }
    if (!sh.ground) { sh.y = T.floorY; sh.land(T.surfaces[0], 0); }
    if (sh.dragged) { sh.dragged = false; }
    // Raven kommt gern zum Zuschauen vorbei
    const ra = W.hero('raven');
    if (ra && ra.absent && chance(0.65)) W.director.bringIn(ra);
    this.setZoom(clamp(1.12 / W.settings.size, 1, 1.7));
    this.duel = new Duel(W, this);
    W.duel = this.duel;
    sh.setTask('duel', this.duel.wait(sh), 10);
    sh.talk(pick(['Training? Gut. Wähl deinen Bruder.', 'Ins Dojo. Wer von euch traut sich?', 'Der Orden ruft. Wer kämpft?']), true);
    if (this.bridge) this.bridge.setFocusable(true);
    this.input.setIgnore(false);
    try { window.focus(); } catch (_) {}
    this.build();
    this.showSelect();
    Sound.play('calib_accept', 0.5);
  }

  close() {
    if (!this.duel) return;
    this.duel.stop();
    this.duel = null;
    this.setZoom(1);
    if (this.el) { this.el.remove(); this.el = null; }
    if (this.bridge) this.bridge.setFocusable(false);
    document.body.style.cursor = '';
    this.input.refreshHover(this.world.mouse.x, this.world.mouse.y);
    Sound.play('calib_tick', 0.4, 0.8);
  }

  setZoom(z) {
    const W = this.world;
    W.zoom = z;
    for (const h of W.heroes) { h.resize(); if (h.ground && h.wid === 'floor') h.y = W.terrain.floorY; }
  }

  build() {
    if (this.el) this.el.remove();
    const el = document.createElement('div');
    el.id = 'dojo';
    el.innerHTML = '<div class="dojo-panel panel interactive"></div>';
    this.root.appendChild(el);
    this.el = el;
    this.panel = el.querySelector('.dojo-panel');
  }

  setView(name, html) {
    this.view = name;
    this.panel.className = `dojo-panel panel interactive dojo-${name}`;
    this.panel.innerHTML = html;
    this.el.classList.remove('hidden');
    this.buttons = [...this.panel.querySelectorAll('[data-nav]')];
    this.focus = clamp(this.focus, 0, Math.max(0, this.buttons.length - 1));
    this.paintFocus();
  }
  hide() { if (this.el) this.el.classList.add('hidden'); this.view = null; }

  paintFocus() {
    (this.buttons || []).forEach((b, i) => b.classList.toggle('focus', i === this.focus));
  }

  // ---------------------------------------- Auswahl
  showSelect() {
    const W = this.world, rec = W.settings.dojo || {};
    const cards = DOJO_ORDER.map((id, i) => {
      const d = BROTHERS[id];
      const stats = Object.entries(d.stats).map(([k, v]) => `<div class="st"><span>${k}</span><i>${'<b></b>'.repeat(v)}${'<b class="off"></b>'.repeat(5 - v)}</i></div>`).join('');
      return `<button class="bro" data-bro="${i}" style="--c:${d.color}">
        <canvas width="120" height="132" data-por="${id}"></canvas>
        <div class="nm">${d.name}</div><div class="wp">${d.weapon.toUpperCase()}</div>
        <div class="stats">${stats}</div>
        <div class="sp"><em>SPEZIAL</em> ${d.special.name}<small>${d.special.desc}</small></div>
        ${rec[id] ? `<div class="won">${rec[id]}× GESIEGT</div>` : ''}
      </button>`;
    }).join('');
    const lv = DOJO_LEVELS.map((l, i) => `<button class="lvl${i === this.lvl ? ' on' : ''}" data-lvl="${i}">${DUEL_LEVELS[l].label.toUpperCase()}</button>`).join('');
    this.focus = 0;
    this.setView('select', `
      <div class="dj-head"><div><div class="title">DOJO DES ORDENS</div><div class="sys">TRAINING GEGEN SHADEPI · WÄHLE EINEN SEINER ORDENSBRÜDER</div></div><button class="close" data-close title="Dojo verlassen">✕</button></div>
      <div class="bros">${cards}</div>
      <div class="dj-row"><span class="lbl">SCHWIERIGKEIT</span><div class="lvls">${lv}</div><span class="rec">SIEGE ${rec.wins || 0} · NIEDERLAGEN ${rec.losses || 0}</span></div>
      <div class="dj-actions"><button class="act go" data-nav="start">KÄMPFEN</button><button class="act" data-nav="leave">ZURÜCK</button></div>
      <div class="dj-keys">${this.keysHint()}</div>`);
    this.panel.querySelectorAll('.bro').forEach((b) => {
      b.addEventListener('click', () => { const i = +b.dataset.bro; if (i === this.sel) this.start(); else { this.sel = i; this.paintSelect(); Sound.play('calib_tick', 0.4, 1.2); } });
      b.addEventListener('mouseenter', () => { this.sel = +b.dataset.bro; this.paintSelect(); });
    });
    this.panel.querySelectorAll('.lvl').forEach((b) => b.addEventListener('click', () => { this.lvl = +b.dataset.lvl; this.paintSelect(); Sound.play('calib_tick', 0.4, 1.4); }));
    this.panel.querySelector('[data-close]').addEventListener('click', () => this.close());
    this.panel.querySelector('[data-nav=start]').addEventListener('click', () => this.start());
    this.panel.querySelector('[data-nav=leave]').addEventListener('click', () => this.close());
    this.panel.querySelectorAll('canvas[data-por]').forEach((c) => this.portrait(c, c.dataset.por));
    this.paintSelect();
  }

  keysHint() {
    return this.duel && this.duel.padConnected
      ? '<b>CONTROLLER</b> STICK/STEUERKREUZ LAUFEN · A SPRINGEN · X ANGRIFF · Y SCHWER · B AUSWEICHEN · RB/RT BLOCK · LB/LT SPEZIAL · START PAUSE'
      : '<b>TASTATUR</b> A/D LAUFEN · W/LEERTASTE SPRINGEN · LINKSKLICK/J ANGRIFF · RECHTSKLICK/K SCHWER · S BLOCK · SHIFT AUSWEICHEN · E SPEZIAL · ESC PAUSE · <b>CONTROLLER</b> WIRD UNTERSTÜTZT';
  }
  onPad() { const k = this.panel && this.panel.querySelector('.dj-keys'); if (k) k.innerHTML = this.keysHint(); }

  paintSelect() {
    if (this.view !== 'select') return;
    this.panel.querySelectorAll('.bro').forEach((b, i) => b.classList.toggle('on', i === this.sel));
    this.panel.querySelectorAll('.lvl').forEach((b, i) => b.classList.toggle('on', i === this.lvl));
  }

  portrait(canvas, who) {
    const set = ((MANIFEST.warriors || {})[who] || {}).idle;
    const e = set && set['0'];
    if (!e || !IMG.brothers) return;
    const ctx = canvas.getContext('2d');
    const [rx, ry, rw, rh] = e.region;
    const sc = Math.min((canvas.height - 10) / rh, (canvas.width - 8) / rw);
    const g = ctx.createRadialGradient(60, 80, 4, 60, 80, 70);
    g.addColorStop(0, 'rgba(255,255,255,0.10)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(60, canvas.height - 6, 30, 5, 0, 0, 7); ctx.fill();
    drawRegion(ctx, IMG.brothers, rx, ry, rw, rh, e.anchor[0], e.anchor[1], 60, canvas.height - 6, sc);
  }

  start() {
    const who = DOJO_ORDER[this.sel], level = DOJO_LEVELS[this.lvl];
    const W = this.world;
    const rec = { ...(W.settings.dojo || {}), last: who, level };
    if (W.api) W.api.set('dojo', rec); else W.settings.dojo = rec;
    this.hide();
    Sound.play('calib_accept', 0.6, 1.2);
    this.duel.setup(who, level);
  }

  // ---------------------------------------- Pause
  togglePause(force) {
    const d = this.duel;
    if (!d || d.phase === 'select' || d.phase === 'result') return;
    if (d.paused && !force) { d.paused = false; this.hide(); Sound.play('calib_tick', 0.4, 1.2); return; }
    d.paused = true;
    this.focus = 0;
    this.setView('pause', `
      <div class="dj-big">PAUSE</div>
      <div class="dj-sub">RUNDE ${d.round} · ${BROTHERS[d.who].name.toUpperCase()} ${d.wins.you} : ${d.wins.me} SHADEPI</div>
      <div class="dj-menu"><button class="act" data-nav="resume">WEITER</button><button class="act" data-nav="select">KRIEGER WECHSELN</button><button class="act warn" data-nav="leave">DOJO VERLASSEN</button></div>
      <div class="dj-keys">${this.keysHint()}</div>`);
    this.wireNav();
    Sound.play('calib_tick', 0.4, 0.9);
  }

  wireNav() {
    this.buttons.forEach((b, i) => {
      b.addEventListener('click', () => this.activate(b.dataset.nav));
      b.addEventListener('mouseenter', () => { this.focus = i; this.paintFocus(); });
    });
  }

  activate(what) {
    const d = this.duel;
    if (!d) return;
    if (what === 'resume') { d.paused = false; this.hide(); }
    else if (what === 'select') { d.backToSelect(); this.showSelect(); }
    else if (what === 'leave') {
      if (d.player && d.phase !== 'result') d.sh.talk(pick(['Schon müde? Morgen wieder.', 'Aufgeben ist auch eine Lektion.', 'Dann eben ein andermal.']), true);
      this.close();
    } else if (what === 'again') { d.paused = false; this.hide(); d.setup(d.who, d.level); }
    else if (what === 'start') this.start();
  }

  // ---------------------------------------- Ergebnis
  showResult(won, st, rec) {
    const d = this.duel;
    const grade = this.grade(won, st);
    const verdict = {
      S: 'Meisterhaft. Ich sag es nur einmal.', A: 'Stark. Der Orden wäre stolz.', B: 'Ordentlich. Da geht noch mehr.',
      C: 'Mehr Training. Viel mehr.', D: 'Hast du die Augen zu gehabt?',
    }[grade];
    this.focus = 0;
    this.setView('result', `
      <div class="dj-big ${won ? 'win' : 'lose'}">${won ? 'SIEG' : 'NIEDERLAGE'}</div>
      <div class="dj-sub">${BROTHERS[d.who].title.toUpperCase()} ${d.wins.you} : ${d.wins.me} SHADEPI · ${d.L.label.toUpperCase()}</div>
      <div class="dj-res">
        <div class="grade g${grade}">${grade}</div>
        <div class="rows">
          <div><span>TREFFER</span><b>${st.hits}</b></div><div><span>SCHADEN</span><b>${st.dmg}</b></div>
          <div><span>BESTE KOMBO</span><b>${st.maxCombo}</b></div><div><span>PERFEKTE PARADEN</span><b>${st.parries}</b></div>
          <div><span>SPEZIALTECHNIKEN</span><b>${st.specials}</b></div><div><span>EINGESTECKT</span><b>${st.taken}</b></div>
        </div>
      </div>
      <div class="dj-quote"><span>SHADEPI:</span> „${verdict}“</div>
      <div class="dj-menu"><button class="act go" data-nav="again">REVANCHE</button><button class="act" data-nav="select">KRIEGER WECHSELN</button><button class="act warn" data-nav="leave">BEENDEN</button></div>
      <div class="dj-sub small">GESAMT: ${rec.wins || 0} SIEGE · ${rec.losses || 0} NIEDERLAGEN</div>`);
    this.wireNav();
    Sound.play(won ? 'calib_accept' : 'calib_error', 0.6);
    setTimeout(() => { if (this.duel === d && d.phase === 'result') d.sh.talk(verdict, true); }, 600);
  }

  grade(won, st) {
    let p = st.hits * 2 + st.maxCombo * 3 + st.parries * 6 + st.specials * 3 - st.taken * 0.35 + (won ? 25 : 0);
    return p >= 85 ? 'S' : p >= 60 ? 'A' : p >= 38 ? 'B' : p >= 18 ? 'C' : 'D';
  }

  // ---------------------------------------- Tastatur/Controller in Menüs
  handleInput(inp) {
    if (this.view === 'select') {
      if (inp.navL) { this.sel = (this.sel + 3) % 4; this.paintSelect(); Sound.play('calib_tick', 0.35, 1.2); }
      if (inp.navR) { this.sel = (this.sel + 1) % 4; this.paintSelect(); Sound.play('calib_tick', 0.35, 1.2); }
      if (inp.navU) { this.lvl = Math.max(0, this.lvl - 1); this.paintSelect(); Sound.play('calib_tick', 0.35, 1.4); }
      if (inp.navD) { this.lvl = Math.min(2, this.lvl + 1); this.paintSelect(); Sound.play('calib_tick', 0.35, 1.4); }
      if (inp.confirm) this.start();
      else if (inp.back) this.close();
      return;
    }
    if (this.view === 'pause' || this.view === 'result') {
      const n = this.buttons.length;
      if (inp.navL || inp.navU) { this.focus = (this.focus + n - 1) % n; this.paintFocus(); Sound.play('calib_tick', 0.3, 1.2); }
      if (inp.navR || inp.navD) { this.focus = (this.focus + 1) % n; this.paintFocus(); Sound.play('calib_tick', 0.3, 1.2); }
      if (inp.confirm) this.activate(this.buttons[this.focus].dataset.nav);
      else if (inp.back && this.view === 'pause') this.activate('resume');
      else if (inp.back) this.activate('leave');
    }
  }

  update(dt) {
    if (this.duel) this.duel.update(dt);
  }
}
