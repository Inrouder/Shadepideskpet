// Fensterscanner für Windows über direkte Windows-API-Aufrufe (koffi, ohne PowerShell).
// Liefert alle sichtbaren Hauptfenster von oben nach unten (Z-Reihenfolge) in physischen Pixeln.
// Läuft auch ohne Electron (node main/winscan-native.js), damit der Build ihn testen kann.

function createNativeScanner(ownPid) {
  if (process.platform !== 'win32') throw new Error('nur unter Windows');
  const koffi = require('koffi');
  const user32 = koffi.load('user32.dll');
  const dwm = koffi.load('dwmapi.dll');
  const RECT = koffi.struct('DESKPET_RECT', { left: 'int32_t', top: 'int32_t', right: 'int32_t', bottom: 'int32_t' });

  const GetTopWindow = user32.func('intptr_t __stdcall GetTopWindow(intptr_t hWnd)');
  const GetWindow = user32.func('intptr_t __stdcall GetWindow(intptr_t hWnd, uint32_t cmd)');
  const IsWindowVisible = user32.func('int __stdcall IsWindowVisible(intptr_t hWnd)');
  const IsIconic = user32.func('int __stdcall IsIconic(intptr_t hWnd)');
  const IsZoomed = user32.func('int __stdcall IsZoomed(intptr_t hWnd)');
  const GetWindowLongW = user32.func('int32_t __stdcall GetWindowLongW(intptr_t hWnd, int nIndex)');
  const GetWindowThreadProcessId = user32.func('uint32_t __stdcall GetWindowThreadProcessId(intptr_t hWnd, _Out_ uint32_t *pid)');
  const GetWindowTextLengthW = user32.func('int __stdcall GetWindowTextLengthW(intptr_t hWnd)');
  const GetWindowTextW = user32.func('int __stdcall GetWindowTextW(intptr_t hWnd, _Out_ uint8_t *buf, int max)');
  const GetClassNameW = user32.func('int __stdcall GetClassNameW(intptr_t hWnd, _Out_ uint8_t *buf, int max)');
  const GetWindowRect = user32.func('int __stdcall GetWindowRect(intptr_t hWnd, _Out_ DESKPET_RECT *rect)');
  const GetForegroundWindow = user32.func('intptr_t __stdcall GetForegroundWindow()');
  const DwmRect = dwm.func('int32_t __stdcall DwmGetWindowAttribute(intptr_t hWnd, uint32_t attr, _Out_ DESKPET_RECT *rect, uint32_t size)');
  const DwmInt = dwm.func('int32_t __stdcall DwmGetWindowAttribute(intptr_t hWnd, uint32_t attr, _Out_ int32_t *value, uint32_t size)');

  const SKIP = new Set(['Progman', 'WorkerW', 'Shell_TrayWnd', 'Shell_SecondaryTrayWnd', 'Windows.UI.Core.CoreWindow', 'NotifyIconOverflowWindow',
    'TopLevelWindowForOverflowXamlIsland', 'XamlExplorerHostIslandWindow', 'ForegroundStaging', 'MultitaskingViewFrame', 'Windows.Internal.Shell.TabProxyWindow',
    'EdgeUiInputTopWndClass', 'NativeHWNDHost', 'Chrome_SystemMessageWindow', 'tooltips_class32', 'SysShadow']);
  const textBuf = Buffer.alloc(512);
  const GW_HWNDNEXT = 2;

  function text(fn, h) {
    const n = fn(h, textBuf, 255);
    return n > 0 ? textBuf.toString('utf16le', 0, n * 2) : '';
  }

  return function scan() {
    const out = [];
    const fg = Number(GetForegroundWindow());
    let h = GetTopWindow(0);
    let guard = 0;
    while (h && guard++ < 4000) {
      const cur = h;
      h = GetWindow(cur, GW_HWNDNEXT);
      if (!IsWindowVisible(cur) || IsIconic(cur)) continue;
      const ex = GetWindowLongW(cur, -20);
      if (ex & 0x80) continue;          // WS_EX_TOOLWINDOW
      if (ex & 0x08000000) continue;    // WS_EX_NOACTIVATE
      if (ex & 0x20) continue;          // WS_EX_TRANSPARENT (Klick-Durchlass-Overlays)
      const pid = [0];
      GetWindowThreadProcessId(cur, pid);
      if (pid[0] === ownPid) continue;
      const cloaked = [0];
      if (DwmInt(cur, 14, cloaked, 4) === 0 && cloaked[0] !== 0) continue;
      const cls = text(GetClassNameW, cur);
      if (SKIP.has(cls)) continue;
      if (GetWindowTextLengthW(cur) === 0) continue;
      const r = {};
      if (DwmRect(cur, 9, r, 16) !== 0 && !GetWindowRect(cur, r)) continue;
      const w = r.right - r.left, hh = r.bottom - r.top;
      if (w < 120 || hh < 60) continue;
      let title = text(GetWindowTextW, cur);
      if (title.length > 60) title = title.slice(0, 60);
      out.push({ id: Number(cur), x: r.left, y: r.top, w, h: hh, max: IsZoomed(cur) ? 1 : 0, t: title, c: cls, top: ex & 0x8 ? 1 : 0 });
    }
    return { fg, w: out };
  };
}

module.exports = { createNativeScanner };

// Selbsttest: node main/winscan-native.js
if (require.main === module) {
  const scan = createNativeScanner(process.pid);
  const t0 = process.hrtime.bigint();
  const res = scan();
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  console.log(JSON.stringify(res, null, 1));
  console.log(`${res.w.length} Fenster in ${ms.toFixed(2)} ms`);
}
