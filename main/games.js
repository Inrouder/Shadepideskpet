// Spielerkennung (Windows): Solange ein Spiel läuft, legt sich das Maskottchen schlafen.
// Erkennt Spiele an ihrem Installationsordner (Steam, Epic, GOG, Ubisoft, EA, Xbox, Rockstar …),
// an selbst eingetragenen Programmen und an echten Vollbild-Spielen (Direct3D-Vollbild).
// Selbsttest ohne Electron: node main/games.js

const GAME_DIRS = [
  '\\steamapps\\common\\', '\\epic games\\', '\\gog galaxy\\games\\', '\\gog games\\', '\\ubisoft game launcher\\games\\',
  '\\ea games\\', '\\xboxgames\\', '\\rockstar games\\', '\\riot games\\', '\\origin games\\', '\\amazon games\\library\\',
  '\\battle.net games\\', '\\itch\\apps\\',
];
// Eigener Spieleordner direkt auf einem Laufwerk oder unter Programme, z. B. D:\Games\…
const GAMES_ROOT = /^[a-z]:\\(program files( \(x86\))?\\)?(games|spiele)\\/;
// Launcher, Hilfsprogramme und Dauerläufer, die selbst keine Spiele sind
const NOT_GAME_DIRS = [
  '\\steamworks shared\\', '\\wallpaper_engine\\', '\\lossless scaling\\', '\\steamvr\\', '\\epic games\\launcher\\', '\\epic online services\\',
  '\\rockstar games\\launcher\\', '\\rockstar games\\social club\\', '\\riot games\\riot client\\', '\\riot vanguard\\', '\\common\\redist\\', '\\_commonredist\\',
  '\\directx\\', '\\vcredist', '\\easyanticheat', '\\battleye',
];
const NOT_GAME_EXE = new Set([
  'steam.exe', 'steamwebhelper.exe', 'steamservice.exe', 'gameoverlayui.exe', 'epicgameslauncher.exe', 'epicwebhelper.exe', 'galaxyclient.exe',
  'galaxyclient helper.exe', 'upc.exe', 'ubisoftconnect.exe', 'eadesktop.exe', 'eabackgroundservice.exe', 'battle.net.exe', 'agent.exe',
  'riotclientservices.exe', 'riotclientux.exe', 'crashreportclient.exe', 'unitycrashhandler64.exe', 'unitycrashhandler32.exe', 'ue4prereqsetup_x64.exe',
  'vc_redist.x64.exe', 'dxsetup.exe', 'easyanticheat.exe', 'easyanticheat_eos.exe', 'beservice.exe', 'wallpaper32.exe', 'wallpaper64.exe',
  'webwallpaper32.exe', 'shadepi deskpet.exe', 'explorer.exe',
]);
// Eigene Spiele, die überall liegen können
const BUILTIN_GAME_NAMES = ['shadepirpg', 'shadepi-echos-in-neon'];

function createGameDetector() {
  if (process.platform !== 'win32') throw new Error('nur unter Windows');
  const koffi = require('koffi');
  const kernel32 = koffi.load('kernel32.dll');
  const shell32 = koffi.load('shell32.dll');
  const EnumProcesses = kernel32.func('int __stdcall K32EnumProcesses(void *pids, uint32_t cb, _Out_ uint32_t *needed)');
  const OpenProcess = kernel32.func('intptr_t __stdcall OpenProcess(uint32_t access, int inherit, uint32_t pid)');
  const QueryName = kernel32.func('int __stdcall QueryFullProcessImageNameW(intptr_t h, uint32_t flags, void *buf, _Inout_ uint32_t *size)');
  const CloseHandle = kernel32.func('int __stdcall CloseHandle(intptr_t h)');
  const NotifyState = shell32.func('int32_t __stdcall SHQueryUserNotificationState(_Out_ int32_t *state)');

  const pidBuf = Buffer.alloc(4 * 4096);
  const nameBuf = Buffer.alloc(2 * 1024);
  const cache = new Map(); // pid -> Pfad ('' = kein Zugriff)

  function processes() {
    const needed = [0];
    if (!EnumProcesses(pidBuf, pidBuf.length, needed)) return [];
    const n = needed[0] / 4;
    const seen = new Set();
    const out = [];
    for (let i = 0; i < n; i++) {
      const pid = pidBuf.readUInt32LE(i * 4);
      if (!pid || pid === process.pid) continue;
      seen.add(pid);
      let p = cache.get(pid);
      if (p === undefined) {
        p = '';
        const h = OpenProcess(0x1000, 0, pid); // PROCESS_QUERY_LIMITED_INFORMATION
        if (h) {
          const size = [1024];
          if (QueryName(h, 0, nameBuf, size)) p = nameBuf.toString('utf16le', 0, size[0] * 2);
          CloseHandle(h);
        }
        cache.set(pid, p);
      }
      if (p) out.push({ pid, path: p });
    }
    for (const pid of cache.keys()) if (!seen.has(pid)) cache.delete(pid);
    return out;
  }

  function fullscreenState() {
    const st = [0];
    // 2 = Vollbildanwendung, 3 = Direct3D-Vollbild, 4 = Präsentationsmodus
    return NotifyState(st) === 0 ? st[0] : 0;
  }

  /**
   * @param {{own: string[], ignore: string[]}} lists  Exe-Namen in Kleinbuchstaben
   * @returns {{game: null|{name:string, exe:string, reason:string}, running: string[]}}
   */
  return function detect(lists = { own: [], ignore: [] }) {
    const own = new Set((lists.own || []).map((s) => s.toLowerCase()));
    const ignore = new Set((lists.ignore || []).map((s) => s.toLowerCase()));
    const procs = processes();
    let game = null;
    const names = new Set();
    for (const { path } of procs) {
      const low = path.toLowerCase();
      const exe = low.slice(low.lastIndexOf('\\') + 1);
      names.add(exe);
      if (game || ignore.has(exe) || NOT_GAME_EXE.has(exe)) continue;
      if (own.has(exe)) { game = { exe, name: prettyName(path), reason: 'eigene Liste' }; continue; }
      if (BUILTIN_GAME_NAMES.some((g) => exe.startsWith(g))) { game = { exe, name: 'ShadepiRPG', reason: 'ShadepiRPG' }; continue; }
      if ((GAME_DIRS.some((d) => low.includes(d)) || GAMES_ROOT.test(low)) && !NOT_GAME_DIRS.some((d) => low.includes(d))) {
        game = { exe, name: prettyName(path), reason: 'Spielordner' };
      }
    }
    if (!game) {
      const fs = fullscreenState();
      if (fs === 3) game = { exe: '', name: 'Vollbild-Spiel', reason: 'Direct3D-Vollbild' };
    }
    return { game, running: [...names], procs };
  };
}

function prettyName(path) {
  const parts = path.split('\\');
  const exe = parts[parts.length - 1].replace(/\.exe$/i, '');
  // Bei Steam/Epic etc. ist der Ordner unterhalb von "common"/"Epic Games" meist der schönere Name
  const low = parts.map((p) => p.toLowerCase());
  for (const key of ['common', 'epic games', 'games', 'spiele', 'xboxgames', 'rockstar games', 'ea games', 'riot games']) {
    const i = low.lastIndexOf(key);
    if (i >= 0 && i + 1 < parts.length - 1) return parts[i + 1];
  }
  return exe;
}

module.exports = { createGameDetector, prettyName };

if (require.main === module) {
  const detect = createGameDetector();
  const t0 = process.hrtime.bigint();
  const res = detect({ own: [], ignore: [] });
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  console.log('Spiel:', res.game, `· ${res.running.length} Programme in ${ms.toFixed(1)} ms`);
  const t1 = process.hrtime.bigint();
  detect({ own: [], ignore: [] });
  console.log(`zweiter Durchlauf (mit Cache): ${(Number(process.hrtime.bigint() - t1) / 1e6).toFixed(1)} ms`);
  console.log(res.running.slice(0, 15).join(', '));
}
