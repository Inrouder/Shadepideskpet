// Schmale, sichere Brücke zwischen Overlay-Seite und Hauptprozess.
const { contextBridge, ipcRenderer } = require('electron');

const listeners = {};
for (const ch of ['layout', 'settings', 'windows', 'open-menu', 'event', 'scanner']) {
  ipcRenderer.on(ch, (_e, data) => (listeners[ch] || []).forEach((fn) => fn(data)));
}

contextBridge.exposeInMainWorld('deskpet', {
  platform: process.platform,
  on: (ch, fn) => { (listeners[ch] = listeners[ch] || []).push(fn); },
  setIgnore: (ignore) => ipcRenderer.send('set-ignore', !!ignore),
  setSetting: (key, value) => ipcRenderer.send('set-setting', { key, value }),
  cursor: () => ipcRenderer.sendSync('get-cursor'),
  autostart: (on) => ipcRenderer.send('autostart', on),
  hide: () => ipcRenderer.send('hide'),
  quit: () => ipcRenderer.send('quit'),
  log: (msg) => ipcRenderer.send('log', msg),
  openLog: () => ipcRenderer.send('open-log'),
});
