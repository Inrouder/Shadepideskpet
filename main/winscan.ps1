# Shadepi Deskpet - Fensterscanner fuer Windows.
# Gibt regelmaessig eine JSON-Zeile mit allen sichtbaren Fenstern (oberstes zuerst) aus.
# Wird von main/windows.js per -EncodedCommand gestartet; __OWNPID__ wird ersetzt.
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class DeskpetScan {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  public delegate bool EnumProc(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc cb, IntPtr p);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] static extern bool IsZoomed(IntPtr h);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowTextLength(IntPtr h);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr h, int i);
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] static extern IntPtr GetAncestor(IntPtr h, uint flags);
  [DllImport("user32.dll")] static extern IntPtr SetProcessDpiAwarenessContext(IntPtr v);
  [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h, int a, out RECT r, int s);
  [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h, int a, out int v, int s);
  public static void Init() { try { SetProcessDpiAwarenessContext(new IntPtr(-4)); } catch {} }
  static readonly HashSet<string> Skip = new HashSet<string> { "Progman", "WorkerW", "Shell_TrayWnd", "Shell_SecondaryTrayWnd", "Windows.UI.Core.CoreWindow", "NotifyIconOverflowWindow", "TopLevelWindowForOverflowXamlIsland", "XamlExplorerHostIslandWindow" };
  static string Esc(string s) {
    var b = new StringBuilder();
    foreach (var c in s) {
      if (c == '"' || c == '\\') { b.Append('\\'); b.Append(c); }
      else if (c < 32) b.Append(' ');
      else b.Append(c);
    }
    return b.ToString();
  }
  public static string Scan(uint own) {
    var sb = new StringBuilder();
    var fg = GetForegroundWindow();
    sb.Append("{\"fg\":").Append(fg.ToInt64()).Append(",\"w\":[");
    bool first = true;
    EnumWindows((h, p) => {
      if (!IsWindowVisible(h) || IsIconic(h)) return true;
      if (GetAncestor(h, 2) != h) return true;
      uint pid; GetWindowThreadProcessId(h, out pid);
      if (pid == own) return true;
      int ex = GetWindowLong(h, -20);
      if ((ex & 0x80) != 0) return true;           // WS_EX_TOOLWINDOW
      if ((ex & 0x08000000) != 0) return true;     // WS_EX_NOACTIVATE
      int cloaked; if (DwmGetWindowAttribute(h, 14, out cloaked, 4) == 0 && cloaked != 0) return true;
      var cls = new StringBuilder(128); GetClassName(h, cls, 128);
      if (Skip.Contains(cls.ToString())) return true;
      int len = GetWindowTextLength(h); if (len == 0) return true;
      var title = new StringBuilder(len + 1); GetWindowText(h, title, len + 1);
      RECT r; if (DwmGetWindowAttribute(h, 9, out r, 16) != 0) GetWindowRect(h, out r);
      if (r.R - r.L < 120 || r.B - r.T < 60) return true;
      if (!first) sb.Append(',');
      first = false;
      sb.Append("{\"id\":").Append(h.ToInt64())
        .Append(",\"x\":").Append(r.L).Append(",\"y\":").Append(r.T)
        .Append(",\"w\":").Append(r.R - r.L).Append(",\"h\":").Append(r.B - r.T)
        .Append(",\"max\":").Append(IsZoomed(h) ? 1 : 0)
        .Append(",\"t\":\"").Append(Esc(title.ToString().Length > 60 ? title.ToString().Substring(0, 60) : title.ToString())).Append("\"}");
      return true;
    }, IntPtr.Zero);
    sb.Append("]}");
    return sb.ToString();
  }
}
'@
[DeskpetScan]::Init()
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$own = [uint32]__OWNPID__
$last = ''
$quiet = 0
while ($true) {
  $line = [DeskpetScan]::Scan($own)
  $quiet++
  if ($quiet -ge 20 -and -not (Get-Process -Id $own -ErrorAction SilentlyContinue)) { exit }
  if ($line -ne $last -or $quiet -ge 20) {
    [Console]::Out.WriteLine($line)
    [Console]::Out.Flush()
    $last = $line
    $quiet = 0
  }
  Start-Sleep -Milliseconds 120
}
