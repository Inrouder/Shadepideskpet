// Kino-Regie: Letterbox-Balken, Titelkarten, Zeitlupe, Kamerawackeln,
// Blitze, Treffer-Stopp und Vignette. Alles abschaltbar über "Kino-Effekte".
'use strict';

class Cinema {
  constructor(world) {
    this.world = world;
    this.bars = 0; this.barsTarget = 0; this.barsUntil = 0;
    this.timeScale = 1; this.slowUntil = 0; this.slowScale = 1;
    this.hitstop = 0;
    this.shakeAmp = 0; this.shakeT = 0; this.ox = 0; this.oy = 0;
    this.flashColor = '#fff'; this.flashA = 0;
    this.vignette = 0; this.vignetteTarget = 0;
    this.cards = [];
    this.clock = 0;
  }
  get on() { return this.world.settings.cinematic; }

  letterbox(seconds = 3) { if (!this.on) return; this.barsTarget = 1; this.barsUntil = Math.max(this.barsUntil, this.clock + seconds); }
  slowmo(scale = 0.3, seconds = 0.8) { if (!this.on) return; this.slowScale = scale; this.slowUntil = this.clock + seconds; }
  shake(amp = 6, seconds = 0.3) { if (!this.on) amp *= 0.25; this.shakeAmp = Math.max(this.shakeAmp, amp); this.shakeT = Math.max(this.shakeT, seconds); }
  flash(color = '#ffffff', a = 0.25) { if (!this.on) a *= 0.3; this.flashColor = color; this.flashA = Math.max(this.flashA, a); }
  stop(seconds = 0.06) { if (this.on) this.hitstop = Math.max(this.hitstop, seconds); }
  focus(seconds = 2) { if (this.on) { this.vignetteTarget = 1; setTimeout(() => (this.vignetteTarget = 0), seconds * 1000); } }

  // Titelkarte: groß, mit Glitch-Einblendung
  card(title, sub = '', color = COLORS.cyan, seconds = 2.6, opts = {}) {
    if (!this.on && !opts.always) return;
    this.cards.push({ title, sub, color, t: 0, life: seconds, x: opts.x, y: opts.y, small: opts.small });
  }

  // Liefert die skalierte Zeit für die Spielwelt
  step(realDt) {
    this.clock += realDt;
    if (this.hitstop > 0) { this.hitstop -= realDt; return 0; }
    if (this.clock < this.slowUntil) this.timeScale = approach(this.timeScale, this.slowScale, realDt * 6);
    else this.timeScale = approach(this.timeScale, 1, realDt * 2.5);
    if (this.clock > this.barsUntil) this.barsTarget = 0;
    this.bars = approach(this.bars, this.barsTarget, realDt * 2.2);
    this.vignette = approach(this.vignette, this.vignetteTarget, realDt * 2);
    this.flashA = Math.max(0, this.flashA - realDt * 2.5);
    if (this.shakeT > 0) {
      this.shakeT -= realDt;
      this.ox = rnd(-1, 1) * this.shakeAmp; this.oy = rnd(-1, 1) * this.shakeAmp;
      this.shakeAmp *= Math.pow(0.02, realDt);
    } else { this.ox = this.oy = 0; this.shakeAmp = 0; }
    for (const c of this.cards) c.t += realDt;
    this.cards = this.cards.filter((c) => c.t < c.life);
    return realDt * this.timeScale;
  }

  drawOverlay(ctx, W, H) {
    if (this.vignette > 0.01) {
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(3,5,10,${0.55 * this.vignette})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    if (this.flashA > 0.01) { ctx.save(); ctx.globalAlpha = this.flashA; ctx.fillStyle = this.flashColor; ctx.fillRect(0, 0, W, H); ctx.restore(); }
    if (this.bars > 0.01) {
      const bh = Math.round(H * 0.075 * easeInOut(this.bars));
      ctx.fillStyle = 'rgba(2,3,6,0.92)';
      ctx.fillRect(0, 0, W, bh); ctx.fillRect(0, H - bh, W, bh);
      ctx.fillStyle = 'rgba(98,227,238,0.35)'; ctx.fillRect(0, bh - 1, W, 1); ctx.fillRect(0, H - bh, W, 1);
    }
    for (const c of this.cards) this.drawCard(ctx, c, W, H);
  }

  drawCard(ctx, c, W, H) {
    const inT = Math.min(1, c.t / 0.35), outT = Math.min(1, (c.life - c.t) / 0.4);
    const a = Math.min(inT, outT);
    const cx = c.x ?? W / 2, cy = c.y ?? H * 0.3;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const size = c.small ? 30 : 56;
    ctx.font = `${size}px ShadepiPixel, monospace`;
    const tw = ctx.measureText(c.title).width;
    // Band hinter dem Titel
    const bw = (tw + 140) * easeOut(inT);
    const band = ctx.createLinearGradient(cx - bw / 2, 0, cx + bw / 2, 0);
    band.addColorStop(0, 'rgba(7,10,18,0)'); band.addColorStop(0.2, 'rgba(7,10,18,0.85)'); band.addColorStop(0.8, 'rgba(7,10,18,0.85)'); band.addColorStop(1, 'rgba(7,10,18,0)');
    ctx.fillStyle = band; ctx.fillRect(cx - bw / 2, cy - size * 0.75, bw, size * (c.sub ? 2.05 : 1.5));
    ctx.fillStyle = c.color; ctx.fillRect(cx - bw / 2 + 40, cy - size * 0.75, bw - 80, 2);
    // Glitch-Versatz beim Einblenden
    const jitter = inT < 1 ? (1 - inT) * 14 : (Math.random() < 0.03 ? 4 : 0);
    ctx.globalAlpha = a * 0.6;
    ctx.fillStyle = '#ff3150'; ctx.fillText(c.title, cx - jitter, cy);
    ctx.fillStyle = '#62e3ee'; ctx.fillText(c.title, cx + jitter, cy);
    ctx.globalAlpha = a;
    ctx.shadowColor = c.color; ctx.shadowBlur = 18;
    ctx.fillStyle = '#f4f0e4'; ctx.fillText(c.title, cx, cy);
    ctx.shadowBlur = 0;
    if (c.sub) {
      ctx.font = `${c.small ? 11 : 14}px Silkscreen, monospace`;
      ctx.fillStyle = c.color;
      const shown = c.sub.slice(0, Math.floor(c.t * 40));
      ctx.fillText(shown, cx, cy + size * 0.85);
    }
    ctx.restore();
  }
}
