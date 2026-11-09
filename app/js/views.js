// Weitere Monitore: Für jeden zusätzlichen Bildschirm öffnet das Overlay ein eigenes,
// transparentes Fenster (window.open). Die Welt bleibt eine einzige – sie wird nur in
// jedes Fenster mit dessen Versatz gezeichnet, und Mausereignisse werden in
// Weltkoordinaten (relativ zum Heimbildschirm) zurückgerechnet.
'use strict';

class Views {
  constructor(world, input) {
    this.world = world; this.input = input;
    this.map = new Map();
    this.enabled = true;
    world.views = this;
    window.addEventListener('beforeunload', () => this.closeAll());
  }

  get list() { return [...this.map.values()]; }

  sync() {
    const T = this.world.terrain;
    const want = this.enabled ? T.screens.filter((sc) => !sc.home) : [];
    for (const [id, v] of this.map) {
      if (v.win.closed || !want.some((sc) => sc.id === id)) { try { v.win.close(); } catch (_) {} this.map.delete(id); }
    }
    for (const sc of want) {
      let v = this.map.get(sc.id);
      if (!v) { v = this.open(sc); if (!v) continue; this.map.set(sc.id, v); }
      v.sc = sc;
      this.fit(v);
    }
  }

  open(sc) {
    let win = null;
    try { win = window.open('about:blank', `screen-${sc.id}`, `left=${Math.round(sc.x)},top=${Math.round(sc.y)},width=${Math.round(sc.w)},height=${Math.round(sc.h)}`); } catch (_) {}
    if (!win) return null;
    let doc;
    try { doc = win.document; } catch (e) { console.error('Monitorfenster nicht erreichbar: ' + e.message); try { win.close(); } catch (_) {} return null; }
    doc.title = 'Shadepi Deskpet';
    const base = new URL('.', location.href).href;
    const st = doc.createElement('style');
    st.textContent = `
      @font-face { font-family: 'ShadepiPixel'; src: url('${base}assets/fonts/ShadepiPixel.ttf') format('truetype'); }
      @font-face { font-family: 'Silkscreen'; src: url('${base}assets/fonts/Silkscreen-Regular.ttf') format('truetype'); }
      html, body { margin: 0; padding: 0; overflow: hidden; background: transparent; user-select: none; }
      canvas { position: fixed; left: 0; top: 0; width: 100vw; height: 100vh; display: block; }`;
    doc.head.appendChild(st);
    try { doc.fonts.load('20px ShadepiPixel'); doc.fonts.load('10px Silkscreen'); } catch (_) {}
    const canvas = doc.createElement('canvas');
    doc.body.appendChild(canvas);
    const v = { id: sc.id, win, doc, canvas, ctx: canvas.getContext('2d'), sc, dpr: 1 };
    const conv = (e) => ({ clientX: e.clientX + v.sc.x, clientY: e.clientY + v.sc.y, button: e.button, preventDefault: () => e.preventDefault(), view: v });
    win.addEventListener('mousemove', (e) => this.input.onMove(conv(e)));
    win.addEventListener('mousedown', (e) => this.input.down(conv(e)));
    win.addEventListener('mouseup', (e) => this.input.up(conv(e)));
    win.addEventListener('contextmenu', (e) => e.preventDefault());
    win.addEventListener('keydown', (e) => window.dispatchEvent(new KeyboardEvent(e.type, e)));
    return v;
  }

  fit(v) {
    const dpr = v.win.devicePixelRatio || 1;
    const w = Math.round(v.sc.w * dpr), h = Math.round(v.sc.h * dpr);
    if (v.canvas.width !== w || v.canvas.height !== h || v.dpr !== dpr) { v.canvas.width = w; v.canvas.height = h; v.dpr = dpr; }
  }

  draw() {
    const W = this.world, T = W.terrain;
    for (const v of this.map.values()) {
      if (v.win.closed) continue;
      this.fit(v);
      if (T.blocked.has(v.id) || W.gaming) { v.ctx.setTransform(1, 0, 0, 1, 0, 0); v.ctx.clearRect(0, 0, v.canvas.width, v.canvas.height); continue; }
      W.render(v.ctx, { x: v.sc.x, y: v.sc.y, w: v.sc.w, h: v.sc.h, dpr: v.dpr, home: false, sc: v.sc });
    }
  }

  closeAll() { for (const v of this.map.values()) { try { v.win.close(); } catch (_) {} } this.map.clear(); }
}
