// Systemwerte für Ravens Systembericht.
// CPU-Last und Arbeitsspeicher: Node (os); Netzwerk: Windows-API GetIfTable (koffi);
// GPU: nvidia-smi (falls vorhanden) + Windows-Leistungsindikatoren; Temperaturen: Thermalzone
// bzw. LibreHardwareMonitor/OpenHardwareMonitor (über sensors.ps1, ohne Adminrechte).
// Selbsttest: node main/sensors.js
const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawn, execFile } = require('child_process');

class Sensors {
  constructor(onData, log = () => {}) {
    this.onData = onData; this.log = log;
    this.data = { cpu: {}, gpu: {}, ram: {}, net: {}, ts: 0 };
    this.prevCpu = null; this.prevNet = null;
    this.nvidia = process.platform === 'win32';
    this.timers = [];
    this.ps = null;
  }

  // ------------------------------------------------ CPU / RAM
  cpuLoad() {
    const t = os.cpus().reduce((a, c) => { const s = c.times; a.idle += s.idle; a.total += s.user + s.nice + s.sys + s.idle + s.irq; return a; }, { idle: 0, total: 0 });
    let load = null;
    if (this.prevCpu) {
      const dt = t.total - this.prevCpu.total, di = t.idle - this.prevCpu.idle;
      if (dt > 0) load = Math.round(100 * (1 - di / dt));
    }
    this.prevCpu = t;
    return load;
  }

  // ------------------------------------------------ Netzwerk (Windows)
  initNet() {
    if (process.platform !== 'win32') return;
    try {
      const koffi = require('koffi');
      const iph = koffi.load('iphlpapi.dll');
      this.GetIfTable = iph.func('uint32_t __stdcall GetIfTable(void *table, _Inout_ uint32_t *size, int order)');
      this.netBuf = Buffer.alloc(64 * 1024);
    } catch (e) { this.log('Netzwerkwerte nicht verfügbar: ' + e.message); }
  }
  netSample() {
    if (!this.GetIfTable) return null;
    const size = [this.netBuf.length];
    let r = this.GetIfTable(this.netBuf, size, 0);
    if (r === 122) { this.netBuf = Buffer.alloc(size[0] + 4096); size[0] = this.netBuf.length; r = this.GetIfTable(this.netBuf, size, 0); }
    if (r !== 0) return null;
    const n = this.netBuf.readUInt32LE(0);
    const ROW = 860, out = {};
    for (let i = 0; i < n; i++) {
      const o = 4 + i * ROW;
      if (o + ROW > this.netBuf.length) break;
      const type = this.netBuf.readUInt32LE(o + 516);
      const oper = this.netBuf.readUInt32LE(o + 544);
      if (type === 24 || oper < 4) continue; // Loopback / nicht verbunden
      const idx = this.netBuf.readUInt32LE(o + 512);
      out[idx] = { rx: this.netBuf.readUInt32LE(o + 552), tx: this.netBuf.readUInt32LE(o + 576) };
    }
    return out;
  }
  netRate() {
    const now = Date.now(), cur = this.netSample();
    if (!cur) return null;
    let best = null;
    if (this.prevNet) {
      const dt = (now - this.prevNet.t) / 1000;
      for (const k in cur) {
        const p = this.prevNet.v[k];
        if (!p || dt <= 0) continue;
        const rx = ((cur[k].rx - p.rx + 4294967296) % 4294967296) / dt;
        const tx = ((cur[k].tx - p.tx + 4294967296) % 4294967296) / dt;
        // Die Schnittstelle mit dem meisten Verkehr zählt (virtuelle Adapter doppeln sonst)
        if (!best || rx + tx > best.down + best.up) best = { down: rx, up: tx };
      }
    }
    this.prevNet = { t: now, v: cur };
    return best;
  }

  // ------------------------------------------------ GPU (NVIDIA)
  pollNvidia() {
    if (!this.nvidia || this.paused) return;
    execFile('nvidia-smi', ['--query-gpu=name,temperature.gpu,utilization.gpu,memory.used,memory.total', '--format=csv,noheader,nounits'], { windowsHide: true, timeout: 4000 }, (err, out) => {
      if (err) { if (err.code === 'ENOENT') this.nvidia = false; return; }
      const [name, temp, load, mu, mt] = String(out).split('\n')[0].split(',').map((s) => s.trim());
      Object.assign(this.data.gpu, { name, temp: +temp, load: +load, memUsed: +mu, memTotal: +mt, src: 'nvidia-smi' });
    });
  }

  // ------------------------------------------------ Temperaturen (PowerShell-Fühler)
  startProbe() {
    if (process.platform !== 'win32') return;
    try {
      const script = fs.readFileSync(path.join(__dirname, 'sensors.ps1'), 'utf8').replace('__OWNPID__', String(process.pid)).replace('__LOOPS__', '0');
      this.ps = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
      let buf = '';
      this.ps.stdout.setEncoding('utf8');
      this.ps.stdout.on('data', (c) => {
        buf += c;
        let nl;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim().replace(/^﻿/, ''); buf = buf.slice(nl + 1);
          if (!line.startsWith('{')) continue;
          try {
            const o = JSON.parse(line);
            if (o.cpuTemp) { this.data.cpu.temp = o.cpuTemp; this.data.cpu.tempSrc = o.src; }
            else if (o.zone) { this.data.cpu.temp = o.zone; this.data.cpu.tempSrc = 'zone'; }
            if (o.gpuTemp && this.data.gpu.src !== 'nvidia-smi') this.data.gpu.temp = o.gpuTemp;
            if (o.gpuLoad != null && this.data.gpu.src !== 'nvidia-smi') this.data.gpu.load = o.gpuLoad;
            if (o.gpuName && !this.data.gpu.name) this.data.gpu.name = o.gpuName;
          } catch (_) {}
        }
      });
      this.ps.on('error', (e) => this.log('Fühler: ' + e.message));
    } catch (e) { this.log('Fühler nicht startbar: ' + e.message); }
  }

  sample() {
    if (this.paused) return;
    const d = this.data;
    const load = this.cpuLoad();
    if (load != null) d.cpu.load = load;
    d.cpu.name = d.cpu.name || (os.cpus()[0] || {}).model;
    d.cpu.cores = os.cpus().length;
    d.ram = { used: os.totalmem() - os.freemem(), total: os.totalmem() };
    const net = this.netRate();
    if (net) d.net = net;
    d.uptime = os.uptime();
    d.ts = Date.now();
    this.onData(d);
  }

  start() {
    this.initNet();
    this.cpuLoad(); this.netRate();
    this.startProbe();
    this.pollNvidia();
    this.timers.push(setInterval(() => this.sample(), 3000));
    this.timers.push(setInterval(() => this.pollNvidia(), 10000));
  }
  stop() {
    this.timers.forEach(clearInterval);
    if (this.ps) try { this.ps.kill(); } catch (_) {}
  }
}

module.exports = { Sensors };

if (require.main === module) {
  const s = new Sensors(() => {}, console.log);
  s.initNet(); s.cpuLoad(); s.netRate(); s.pollNvidia();
  setTimeout(() => {
    s.sample();
    console.log(JSON.stringify(s.data, null, 1));
    // Fühlerskript einmal direkt laufen lassen
    if (process.platform === 'win32') {
      const script = fs.readFileSync(path.join(__dirname, 'sensors.ps1'), 'utf8').replace('__OWNPID__', String(process.pid)).replace('__LOOPS__', '1');
      execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { timeout: 60000 }, (err, out) => {
        console.log('Fühler:', err ? err.message : String(out).trim());
        process.exit(0);
      });
    } else process.exit(0);
  }, 1500);
}
