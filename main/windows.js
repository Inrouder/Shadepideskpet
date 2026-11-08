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
    if (process.platform !== 'win32') return false;
    const script = fs.readFileSync(path.join(__dirname, 'winscan.ps1'), 'utf8').replace('__OWNPID__', String(process.pid));
    const encoded = Buffer.from(script, 'utf16le').toString('base64');
    this.proc = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
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
        setTimeout(() => this.start(), 2000 * this.restarts);
      }
    });
    return true;
  }

  stop() {
    this.stopped = true;
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
