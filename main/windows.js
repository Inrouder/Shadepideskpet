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
    const script = fs.readFileSync(path.join(__dirname, 'winscan.ps1'), 'utf8').replace('__OWNPID__', String(process.pid));
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
function toOverlaySpace(raw, display) {
  const b = display.bounds;
  const out = [];
  let fullscreen = false;
  raw.w.forEach((w, z) => {
    let r = { x: w.x, y: w.y, width: w.w, height: w.h };
    try { if (screen.screenToDipRect) r = screen.screenToDipRect(null, r); } catch (_) {}
    const win = { id: String(w.id), x: r.x - b.x, y: r.y - b.y, w: r.width, h: r.height, z, max: !!w.max, title: w.t || '' };
    const covers = win.x <= 1 && win.y <= 1 && win.w >= b.width - 2 && win.h >= b.height - 2;
    // Unsichtbare Vollbild-Overlays anderer Programme (immer im Vordergrund, nicht aktiv) würden alles verdecken
    if (covers && w.top && String(w.id) !== String(raw.fg)) return;
    if (String(w.id) === String(raw.fg)) {
      win.fg = true;
      if (win.x <= 1 && win.y <= 1 && win.w >= b.width - 2 && win.h >= b.height - 2) fullscreen = true;
    }
    // Nur Fenster, die diesen Bildschirm berühren.
    if (win.x + win.w > 0 && win.y + win.h > 0 && win.x < b.width && win.y < b.height) out.push(win);
  });
  return { windows: out, fullscreen };
}

module.exports = { WindowScanner, toOverlaySpace };
