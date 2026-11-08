// Update-Funktion.
// - Installierte Version (Setup.exe): electron-updater lädt neue Versionen von den
//   GitHub-Releases im Hintergrund und installiert sie beim Neustart.
// - Portable EXE: Versionsvergleich über die GitHub-API, Raven meldet den Download.
const { app, net, shell } = require('electron');

const OWNER = 'Inrouder';
const REPO = 'Shadepideskpet';
const RELEASES = `https://github.com/${OWNER}/${REPO}/releases/latest`;

function newer(a, b) {
  const pa = String(a).replace(/^v/, '').split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  const pb = String(b).replace(/^v/, '').split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < 3; i++) { if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0); }
  return false;
}

class Updater {
  constructor(send, log) {
    this.send = send; this.log = log;
    this.portable = !!process.env.PORTABLE_EXECUTABLE_FILE;
    this.state = { state: 'idle', current: app.getVersion() };
    this.auto = null;
    this.downloadUrl = RELEASES;
    if (!app.isPackaged || this.portable || process.platform !== 'win32') return;
    try {
      const { autoUpdater } = require('electron-updater');
      autoUpdater.autoDownload = true;
      autoUpdater.autoInstallOnAppQuit = true;
      autoUpdater.logger = { info: () => {}, warn: (m) => log('Update: ' + m), error: (m) => log('Update-Fehler: ' + m), debug: () => {} };
      autoUpdater.on('checking-for-update', () => this.set({ state: 'checking' }));
      autoUpdater.on('update-not-available', () => this.set({ state: 'none' }));
      autoUpdater.on('update-available', (i) => this.set({ state: 'available', version: i.version }));
      autoUpdater.on('download-progress', (p) => this.set({ state: 'downloading', percent: Math.round(p.percent || 0), version: this.state.version }));
      autoUpdater.on('update-downloaded', (i) => this.set({ state: 'ready', version: i.version }));
      autoUpdater.on('error', (e) => this.set({ state: 'error', error: String(e && e.message || e).slice(0, 200) }));
      this.auto = autoUpdater;
    } catch (e) {
      log('electron-updater nicht verfügbar: ' + e.message);
    }
  }

  set(patch) {
    this.state = { ...this.state, ...patch, current: app.getVersion(), portable: this.portable, installable: !!this.auto };
    this.send('update', this.state);
  }

  async check(manual = false) {
    this.manual = manual;
    if (this.auto) {
      try { await this.auto.checkForUpdates(); } catch (e) { this.set({ state: 'error', error: String(e.message || e) }); }
      return;
    }
    // Portable oder Entwicklung: nur nachsehen und melden
    this.set({ state: 'checking' });
    try {
      const res = await net.fetch(`https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Shadepi-Deskpet' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const rel = await res.json();
      const version = String(rel.tag_name || '').replace(/^v/, '');
      const asset = (rel.assets || []).find((a) => /portable\.exe$/i.test(a.name));
      this.downloadUrl = (asset && asset.browser_download_url) || rel.html_url || RELEASES;
      if (version && newer(version, app.getVersion())) this.set({ state: 'available', version, url: this.downloadUrl });
      else this.set({ state: 'none' });
    } catch (e) {
      this.set({ state: 'error', error: String(e.message || e) });
    }
  }

  install() {
    if (this.auto && this.state.state === 'ready') { setImmediate(() => this.auto.quitAndInstall(false, true)); return; }
    shell.openExternal(this.state.url || this.downloadUrl);
  }

  start() {
    setTimeout(() => this.check(false), 25000);
    setInterval(() => this.check(false), 6 * 3600 * 1000);
  }
}

module.exports = { Updater, newer };
