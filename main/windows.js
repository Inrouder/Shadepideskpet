// Liest unter Windows laufend die Fensterpositionen, damit die Figuren an
// echten Fenstern hochklettern und auf ihren Titelleisten stehen können.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { screen } = require('electron');

class WindowScanner {
  constructor(onUpdate) {
    this.onUpdate = onUpdate;
    this.proc = null;
    this.buffer = '';
    this.stopped = false;
    this.restarts = 0;
    this.lastRaw = null;
  }

  start() {
    if (process.platform !== 'win32') { this.method = 'none'; return false; }
    // 1. Direkt über die Windows-API (schnell, ohne PowerShell)
    try {
      const { createNativeScanner } = require('./winscan-native');
      const scan = createNativeScanner(process.pid);
      scan();
      this.method = 'native';
      let last = '', quiet = 0;
      this.timer = setInterval(() => {
        try {
          const raw = scan();
          const key = JSON.stringify(raw);
          if (key !== last || ++quiet > 20) { last = key; quiet = 0; this.lastRaw = raw; this.onUpdate(raw); }
        } catch (e) { this.error = String(e && e.message || e); }
      }, 140);
      return true;
    } catch (e) {
      this.error = 'native: ' + String(e && e.message || e);
    }
    // 2. Rückfall: PowerShell-Helfer
    this.method = 'powershell';
    return this.startPowerShell();
  }

  startPowerShell() {
    const script = fs.readFileSync(path.join(__dirname, 'winscan.ps1'), 'utf8').replaceAll('__OWNPID__', String(process.pid));
    const encoded = Buffer.from(script, 'utf16le').toString('base64');
    this.proc = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    this.proc.on('error', (e) => { this.error = 'powershell: ' + e.message; this.method = 'none'; });
    this.proc.stdout.setEncoding('utf8');
    this.proc.stdout.on('data', (chunk) => {
      this.buffer += chunk;
      let nl;
      while ((nl = this.buffer.indexOf('\n')) >= 0) {
        const line = this.buffer.slice(0, nl).trim();
        this.buffer = this.buffer.slice(nl + 1);
        if (line.startsWith('{')) {
          try { this.lastRaw = JSON.parse(line); this.onUpdate(this.lastRaw); } catch (_) { /* unvollständige Zeile */ }
        }
      }
    });
    this.proc.stderr.on('data', () => {});
    this.proc.on('exit', () => {
      this.proc = null;
      if (!this.stopped && this.restarts < 5) {
        this.restarts++;
        setTimeout(() => this.startPowerShell(), 2000 * this.restarts);
      }
    });
    return true;
  }

  status() {
    const raw = this.lastRaw;
    return { method: this.method || 'none', error: this.error || '', windows: raw ? raw.w.length : 0 };
  }

  stop() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    if (this.proc) { try { this.proc.kill(); } catch (_) {} }
  }
}

// Rohdaten (physische Pixel) -> DIP relativ zum Overlay-Bildschirm.
// Fensterliste in Overlay-Koordinaten umrechnen: relativ zur linken oberen Ecke des
// Heimbildschirms (DIP). displays = alle Bildschirme, auf denen Figuren laufen dürfen.
function toOverlaySpace(raw, display, displays = [display]) {
  const b = display.bounds;
  const out = [];
  let fullscreen = false;
  const fullscreenScreens = [];
  const rel = displays.map((d) => ({ id: String(d.id), x: d.bounds.x - b.x, y: d.bounds.y - b.y, w: d.bounds.width, h: d.bounds.height, home: d.id === display.id }));
  const coversScreen = (win, sc) => win.x <= sc.x + 1 && win.y <= sc.y + 1 && win.x + win.w >= sc.x + sc.w - 1 && win.y + win.h >= sc.y + sc.h - 1;
  raw.w.forEach((w, z) => {
    let r = { x: w.x, y: w.y, width: w.w, height: w.h };
    try { if (screen.screenToDipRect) r = screen.screenToDipRect(null, r); } catch (_) {}
    const win = { id: String(w.id), x: r.x - b.x, y: r.y - b.y, w: r.width, h: r.height, z, max: !!w.max, title: w.t || '' };
    const isFg = String(w.id) === String(raw.fg);
    const covered = rel.filter((sc) => coversScreen(win, sc));
    // Unsichtbare Vollbild-Overlays anderer Programme (immer im Vordergrund, nicht aktiv) würden alles verdecken
    if (covered.length && w.top && !isFg) return;
    if (isFg) {
      win.fg = true;
      for (const sc of covered) { if (sc.home) fullscreen = true; else fullscreenScreens.push(sc.id); }
    }
    // Nur Fenster, die einen der Bildschirme berühren.
    if (rel.some((sc) => win.x + win.w > sc.x && win.y + win.h > sc.y && win.x < sc.x + sc.w && win.y < sc.y + sc.h)) out.push(win);
  });
  return { windows: out, fullscreen, fullscreenScreens };
}

module.exports = { WindowScanner, toOverlaySpace };
