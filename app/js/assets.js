// Laden von Grafiken/Klängen und Zeichnen von Atlasbildern.
'use strict';

const MANIFEST = window.PET_MANIFEST || {};
// Echte Kletter-/Kantenbilder (tools/compile_climb.py) – nur vorhanden, wenn erzeugt
const CLIMB_ART = window.PET_CLIMB_ART || { heroes: [], mantleLedgeY: [], ledgeSeatY: 92, climbHandY: 42 };
const hasClimbArt = (name) => (CLIMB_ART.heroes || []).includes(name) && !!IMG[name + '-climb'];
const IMG = {};
const IMAGE_FILES = {
  shadepi: 'heroes/shadepi.png', raven: 'heroes/raven.png', poses: 'heroes/combat-poses.png', 'raven-sit': 'heroes/raven-sit.png', 'raven-lie': 'heroes/raven-lie.png',
  'punk-1': 'enemies/punk-1.png', 'punk-2': 'enemies/punk-2.png', 'punk-3': 'enemies/punk-3.png', 'punk-4': 'enemies/punk-4.png',
  'shooter-visor': 'enemies/shooter-visor.png', 'shooter-violet': 'enemies/shooter-violet.png', jackal: 'enemies/jackal.png',
  bot: 'enemies/bot.png', virus: 'enemies/virus.png', ice: 'enemies/ice.png', drone: 'enemies/drone.png',
  bullet: 'fx/bullet.png', muzzle: 'fx/muzzle.png', lightning: 'fx/lightning.png', fire: 'fx/fire.png', smoke: 'fx/smoke.png', explosion: 'fx/explosion.png',
  brothers: 'enemies/brothers.png', frame: 'ui/frame.png', header: 'ui/header.png', icon: 'ui/icon.png',
};
for (const n of ['crate', 'barrel', 'server', 'holocube', 'vending', 'fusebox']) {
  for (const s of ['intact', 'damaged', 'broken']) IMAGE_FILES[`${n}-${s}`] = `props/${n}-${s}.png`;
}

for (const n of CLIMB_ART.heroes || []) for (const k of ['climb', 'mantle', 'ledge', 'climbside']) IMAGE_FILES[`${n}-${k}`] = `heroes/${n}-${k}.png`;

function loadImages() {
  return Promise.all(Object.entries(IMAGE_FILES).map(([k, f]) => new Promise((res) => {
    const im = new Image();
    im.onload = () => { IMG[k] = im; res(); };
    im.onerror = () => { console.warn('Bild fehlt', f); res(); };
    im.src = 'assets/' + f;
  })));
}

// ---------------------------------------------------------------- Klang
const Sound = {
  volume: 0.55,
  pools: {},
  last: {},
  music: null,
  musicName: null,
  musicWanted: null,
  musicEnabled: false,
  init() {
    for (const s of MANIFEST.sounds || []) {
      this.pools[s] = [0, 1, 2].map(() => { const a = new Audio('assets/audio/' + s + '.wav'); a.preload = 'auto'; return a; });
    }
  },
  play(name, vol = 1, rate = 1) {
    if (this.volume <= 0.001) return;
    const pool = this.pools[name];
    if (!pool) return;
    const now = performance.now();
    if (this.last[name] && now - this.last[name] < 45) return;
    this.last[name] = now;
    const a = pool.find((x) => x.paused || x.ended) || pool[0];
    try {
      a.currentTime = 0;
      a.volume = clamp(this.volume * vol, 0, 1);
      a.playbackRate = rate;
      a.play().catch(() => {});
    } catch (_) {}
  },
  any(names, vol, rate) { this.play(pick(names), vol, rate); },
  setMusic(name) {
    this.musicWanted = this.musicEnabled ? name : null;
  },
  update(dt) {
    // weiches Überblenden der Kampfmusik
    const want = this.musicWanted;
    if (this.music && this.musicName !== want) {
      this.music.volume = Math.max(0, this.music.volume - dt * 0.6);
      if (this.music.volume <= 0.01) { this.music.pause(); this.music = null; this.musicName = null; }
    } else if (!this.music && want) {
      this.music = new Audio('assets/music/' + want + '.mp3');
      this.music.loop = true;
      this.music.volume = 0;
      this.musicName = want;
      this.music.play().catch(() => {});
    } else if (this.music && want) {
      this.music.volume = Math.min(this.volume * 0.45, this.music.volume + dt * 0.4);
    }
  },
};

// ---------------------------------------------------------------- Zeichnen
const _tmp = document.createElement('canvas');
const _tctx = _tmp.getContext('2d');

/**
 * Zeichnet einen Bildausschnitt mit Ankerpunkt (Füße) an x/y.
 * opts: flip, alpha, flash (0..1 weiß), tint ('#rrggbb'), tintAmt, rot, pivotY (Abstand über Ankerpunkt), sx/sy Zusatzskalierung
 */
function drawRegion(ctx, img, rx, ry, rw, rh, ax, ay, x, y, scale, opts = {}) {
  if (!img) return;
  const flip = opts.flip ? -1 : 1;
  const sxs = (opts.sx || 1), sys = (opts.sy || 1);
  ctx.save();
  ctx.translate(x, y);
  if (opts.rot) {
    const py = opts.pivotY || 0;
    ctx.translate(0, -py);
    ctx.rotate(opts.rot);
    ctx.translate(0, py);
  }
  ctx.scale(scale * flip * sxs, scale * sys);
  if (opts.alpha !== undefined) ctx.globalAlpha *= opts.alpha;
  let src = img, sx = rx, sy = ry;
  const tint = opts.flash > 0 ? '#ffffff' : opts.tint;
  const amt = opts.flash > 0 ? opts.flash : (opts.tintAmt === undefined ? 0.6 : opts.tintAmt);
  if (tint && amt > 0) {
    if (_tmp.width < rw || _tmp.height < rh) { _tmp.width = Math.max(_tmp.width, rw); _tmp.height = Math.max(_tmp.height, rh); }
    _tctx.globalCompositeOperation = 'source-over';
    _tctx.clearRect(0, 0, rw, rh);
    _tctx.globalAlpha = 1;
    _tctx.drawImage(img, rx, ry, rw, rh, 0, 0, rw, rh);
    _tctx.globalCompositeOperation = 'source-atop';
    _tctx.globalAlpha = amt;
    _tctx.fillStyle = tint;
    _tctx.fillRect(0, 0, rw, rh);
    _tctx.globalAlpha = 1;
    _tctx.globalCompositeOperation = 'source-over';
    src = _tmp; sx = 0; sy = 0;
  }
  ctx.drawImage(src, sx, sy, rw, rh, -ax, -ay, rw, rh);
  ctx.restore();
}

// Heldenatlas: 8 Spalten (Animationsbild) × 32 Zeilen (Gruppe*8 + Richtung), 128×160, Füße bei (64,152).
const DIR = { down: 0, left: 1, right: 2, up: 3, upLeft: 4, upRight: 5, downLeft: 6, downRight: 7 };
const GROUP = { idle: 0, walk: 1, attack: 2, hit: 3 };
function drawAtlas(ctx, img, group, dir, frame, x, y, scale, opts) {
  const row = group * 8 + dir;
  drawRegion(ctx, img, (frame & 7) * 128, row * 160, 128, 160, 64, 152, x, y, scale, opts);
}

// Sonderposen: Zeile 0 Aufladen, 1 Knie, 2 Tritt (Shadepi), 3 Hocke (Raven). Zelle 192×256.
function drawPose(ctx, row, dir, x, y, scale, opts) {
  const a = (MANIFEST.combatPoses || [])[row * 8 + dir] || { x: 96, y: 250 };
  drawRegion(ctx, IMG.poses, dir * 192, row * 256, 192, 256, a.x, a.y, x, y, scale * 0.5, opts);
}

// Ravens Zauber/Hack: dieselben Atlasbilder wie ihr Angriff (keine fremde Figurengrafik).
// Zeile 0 Aufbau, 1 Auslösen, 2 Nachhall -> Angriffsbild 1, 3, 6.
const CAST_FRAMES = [1, 3, 6];
// Mündung/Hand im 128×160-Angriffsbild je Richtung (aus player.gd), Fußpunkt (64,152)
const MUZZLE_POINTS = [[64, 71], [24, 57], [105, 58], [62, 36], [26, 46], [100, 46], [34, 65], [99, 64]];
function drawCast(ctx, row, dir, x, y, scale, opts) {
  drawAtlas(ctx, IMG.raven, GROUP.attack, dir, CAST_FRAMES[row] || 3, x, y, scale, opts);
}
function castPalm(row, dir, x, y, scale) {
  const p = MUZZLE_POINTS[dir] || MUZZLE_POINTS[0];
  return { x: x + (p[0] - 64) * scale, y: y + (p[1] - 152) * scale };
}

// Ruheposen (Raven sitzend/liegend), Anker = Sitz- bzw. Auflagepunkt
function drawRest(ctx, name, x, y, scale, opts) {
  const img = IMG[name], r = (MANIFEST.rest || {})[name];
  if (!img || !r) return false;
  drawRegion(ctx, img, 0, 0, img.width, img.height, r.anchor[0], r.anchor[1], x, y, scale * r.scale, opts);
  return true;
}

// Kampfbot aus der Erinnerung „Angriff": Regionen/Anker aus actors.json.
function drawBot(ctx, set, dir, x, y, scale, opts) {
  const list = (MANIFEST.bot || {})[set];
  if (!list) return;
  const p = list[dir] || list[0];
  const [rx, ry, rw, rh] = p.region;
  drawRegion(ctx, IMG.bot, rx, ry, rw, rh, p.anchor[0], p.anchor[1], x, y, scale * 2 * p.scale, opts);
}

// Streifen mit 4 gleich breiten Bildern (fire/smoke/explosion: 192×128, bullet/muzzle/lightning: 192×48)
function drawStrip(ctx, img, frame, frames, x, y, scale, opts = {}) {
  if (!img) return;
  const fw = img.width / frames, fh = img.height;
  drawRegion(ctx, img, Math.floor(frame) * fw, 0, fw, fh, fw / 2, opts.anchorBottom ? fh : fh / 2, x, y, scale, opts);
}

// Neun-Teile-Rahmen aus dem Pixel-UI (frame.png 64×64)
function nineSlice(ctx, img, x, y, w, h, m, s = 1) {
  if (!img) return;
  const W = img.width, H = img.height;
  const [l, t, r, b] = m;
  const L = l * s, T = t * s, R = r * s, B = b * s;
  const iw = Math.max(0, w - L - R), ih = Math.max(0, h - T - B);
  const parts = [
    [0, 0, l, t, x, y, L, T], [l, 0, W - l - r, t, x + L, y, iw, T], [W - r, 0, r, t, x + L + iw, y, R, T],
    [0, t, l, H - t - b, x, y + T, L, ih], [l, t, W - l - r, H - t - b, x + L, y + T, iw, ih], [W - r, t, r, H - t - b, x + L + iw, y + T, R, ih],
    [0, H - b, l, b, x, y + T + ih, L, B], [l, H - b, W - l - r, b, x + L, y + T + ih, iw, B], [W - r, H - b, r, b, x + L + iw, y + T + ih, R, B],
  ];
  for (const p of parts) if (p[6] > 0 && p[7] > 0) ctx.drawImage(img, p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7]);
}
