// Maus: Klick-Durchlass steuern, Figuren/Gegner/Gegenstände packen, werfen,
// anstupsen; Rechtsklick öffnet das Menü.
'use strict';

class Input {
  constructor(world, ui, bridge) {
    this.world = world; this.ui = ui; this.bridge = bridge;
    this.ignoring = true;
    this.drag = null; this.pending = null;
    this.hist = [];
    this.lastV = { x: 0, y: 0 };
    this.lastEvent = 0; this.pollT = 0; this.missed = 0; this.rearmedAt = 0;
    window.addEventListener('mousemove', (e) => { this.lastEvent = performance.now(); this.missed = 0; this.move(e.clientX, e.clientY); });
    window.addEventListener('mousedown', (e) => this.down(e));
    window.addEventListener('mouseup', (e) => this.up(e));
    window.addEventListener('contextmenu', (e) => { e.preventDefault(); });
    window.addEventListener('mouseleave', () => { this.world.mouse.active = false; });
    window.addEventListener('blur', () => { if (this.drag) this.finishDrag(); });
  }

  entityAt(x, y) {
    const W = this.world;
    for (const h of [...W.heroes].reverse()) if (!h.absent && h.alpha > 0.3 && h.hitTest(x, y)) return h;
    for (const e of [...W.enemies].reverse()) if (!e.dead && !e.noClamp && e.hitTest(x, y)) return e;
    for (const i of [...W.items].reverse()) if (!i.dead && i.state !== 'broken' && i.hitTest(x, y)) return i;
    return null;
  }

  setIgnore(ignore) {
    if (ignore === this.ignoring) return;
    this.ignoring = ignore;
    if (this.bridge) this.bridge.setIgnore(ignore);
  }

  refreshHover(x, y) {
    // Dojo: Overlay fängt die Maus komplett (Klicks = Angriffe)
    if (this.world.duel) { this.setIgnore(false); document.body.style.cursor = this.world.duel.player && !this.world.duel.inMenu ? 'crosshair' : ''; return null; }
    const overUi = this.ui.isOver(x, y);
    const ent = overUi ? null : this.entityAt(x, y);
    const capture = !!(this.drag || this.pending || overUi || ent);
    this.setIgnore(!capture);
    document.body.style.cursor = this.drag ? 'grabbing' : ent ? 'grab' : '';
    return ent;
  }

  move(x, y) {
    const W = this.world;
    W.mouse.x = x; W.mouse.y = y; W.mouse.active = true;
    const now = performance.now();
    this.hist.push({ x, y, t: now });
    while (this.hist.length && now - this.hist[0].t > 120) this.hist.shift();
    if (this.pending && !this.drag && Math.hypot(x - this.pending.x, y - this.pending.y) > 6) this.startDrag();
    if (this.drag) this.placeDragged(x, y);
    this.refreshHover(x, y);
  }

  down(e) {
    const x = e.clientX, y = e.clientY;
    if (this.world.duel) { if (!this.ui.isOver(x, y)) { e.preventDefault(); this.world.duel.mouse(e.button, true); } return; }
    if (this.ui.isOver(x, y)) return;
    const ent = this.entityAt(x, y);
    if (e.button === 2) {
      this.ui.open(x, y, ent);
      return;
    }
    if (e.button !== 0 || !ent) return;
    this.pending = { ent, x, y, ox: ent.x - x, oy: ent.y - y, t: performance.now() };
    this.setIgnore(false);
  }

  startDrag() {
    const p = this.pending;
    const ent = p.ent;
    if (ent.dead) { this.pending = null; return; }
    this.drag = p;
    if (ent instanceof Hero) ent.grab();
    else {
      ent.dragged = true;
      if (ent.leaveGround) ent.leaveGround();
      ent.vx = ent.vy = 0;
      if (ent instanceof Enemy && chance(0.5)) ent.talk(pick(['Hey! Lass los!', 'Was zum…?!', 'Wer ist das?!']), true);
    }
  }

  placeDragged(x, y) {
    const d = this.drag, ent = d.ent, u = this.world.u;
    if (ent instanceof Hero) { ent.x = x; ent.y = y + 80 * u; }
    else { ent.x = x + d.ox; ent.y = y + d.oy; }
  }

  velocity() {
    const h = this.hist;
    if (h.length < 2) return { x: 0, y: 0 };
    const a = h[0], b = h[h.length - 1];
    const dt = Math.max(16, b.t - a.t) / 1000;
    return { x: (b.x - a.x) / dt, y: (b.y - a.y) / dt };
  }

  up(e) {
    if (this.world.duel) { this.world.duel.mouse(e.button, false); return; }
    if (e.button !== 0) return;
    if (this.drag) { this.finishDrag(); return; }
    if (this.pending) {
      const ent = this.pending.ent;
      this.pending = null;
      this.click(ent, e.clientX, e.clientY);
    }
    this.refreshHover(e.clientX, e.clientY);
  }

  finishDrag() {
    const ent = this.drag.ent;
    const v = this.velocity();
    this.drag = null; this.pending = null;
    if (ent instanceof Hero) ent.onRelease(v.x * 0.9, v.y * 0.9);
    else ent.release(v.x * 0.9, v.y * 0.9);
  }

  click(ent, x, y) {
    const W = this.world;
    if (ent instanceof Hero) { ent.poke(); return; }
    if (ent instanceof Enemy) {
      damage(W, ent, 1, null, { dir: sign(ent.x - x), knock: 140, color: COLORS.white });
      W.fx.ring(x, y, COLORS.white, 24, 0.2, 2);
      Sound.play('hit', 0.5, 1.3);
      return;
    }
    if (ent instanceof Item) {
      if (ent.pickup) { const h = W.presentHeroes().filter((h) => !h.ko).sort((a, b) => Math.abs(a.x - ent.x) - Math.abs(b.x - ent.x))[0]; if (h && !h.task) h.setTask('pickup', h.fetch(ent), 1.2); return; }
      ent.kick(sign(ent.x - x || 1) * 420 * W.u, -420 * W.u, null);
    }
  }

  // Hauptprozess hat den Klick-Durchlass neu eingerichtet: Zustand angleichen
  reset(cursor) {
    this.ignoring = true;
    if (this.drag) this.finishDrag();
    this.pending = null;
    if (cursor) { this.world.mouse.x = cursor.x; this.world.mouse.y = cursor.y; }
    this.refreshHover(this.world.mouse.x, this.world.mouse.y);
    if (this.bridge && this.bridge.log) this.bridge.log('mouse-reset ok');
  }

  // Sicherheitsnetz: Kommen keine Mausbewegungen mehr an (Windows hat die Weiterleitung
  // verworfen), fragt das Overlay die Mausposition selbst ab. So bleiben Menü und Figuren
  // bedienbar, und die Weiterleitung wird beim Hauptprozess neu angefordert.
  pollCursor(dt) {
    if (!this.bridge || !this.bridge.cursor || this.drag) return;
    this.pollT -= dt;
    if (this.pollT > 0) return;
    this.pollT = 0.12;
    const now = performance.now();
    if (now - this.lastEvent < 300) return;
    let c = null;
    try { c = this.bridge.cursor(); } catch (_) { return; }
    if (!c || (Math.abs(c.x - this.world.mouse.x) < 2 && Math.abs(c.y - this.world.mouse.y) < 2)) return;
    const inside = c.x >= 0 && c.y >= 0 && c.x < innerWidth && c.y < innerHeight;
    this.move(c.x, c.y);
    if (!inside) return;
    // Maus bewegt sich über dem Overlay, aber kein Ereignis kam an → Weiterleitung tot
    if (this.ignoring && ++this.missed >= 4 && now - this.rearmedAt > 5000 && this.bridge.rearmMouse) {
      this.rearmedAt = now; this.missed = 0;
      this.bridge.rearmMouse('keine Mausbewegungen mehr');
    }
  }

  update(dt) {
    this.pollCursor(dt);
    if (!this.drag) return;
    const ent = this.drag.ent;
    if (ent.dead) { this.drag = null; return; }
    const v = this.velocity();
    const ax = (v.x - this.lastV.x) / Math.max(dt, 0.001);
    const ay = (v.y - this.lastV.y) / Math.max(dt, 0.001);
    this.lastV = v;
    if (ent instanceof Hero) ent.onDrag(dt, v.x, v.y, Math.hypot(ax, ay));
  }
}
