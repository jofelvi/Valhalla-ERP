# ===========================================================================
#  Identificar que impresora es cual (ticket rotulado por conector)
#  ---------------------------------------------------------------------------
#  Manda a CADA impresora conectada un ticket con su puerto en letra grande.
#  Alguien recoge los papeles en el local y asi se sabe que nombre corresponde
#  a que maquina fisica.
#
#  OJO: no usar "cmd /c print" ni fiarse de que la cola se vacie. Los puertos
#  muertos se tragan el trabajo en silencio y el driver descarta el texto plano.
#  Lo unico que saca papel de verdad son los bytes ESC/POS crudos (esto).
# ===========================================================================

. (Join-Path $PSScriptRoot 'caja-config.ps1')

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class RawPrintId {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public struct DI { [MarshalAs(UnmanagedType.LPWStr)] public string n;
    [MarshalAs(UnmanagedType.LPWStr)] public string o; [MarshalAs(UnmanagedType.LPWStr)] public string t; }
  [DllImport("winspool.Drv", CharSet=CharSet.Unicode, SetLastError=true)]
  public static extern bool OpenPrinter(string s, out IntPtr h, IntPtr p);
  [DllImport("winspool.Drv", SetLastError=true)] public static extern bool ClosePrinter(IntPtr h);
  [DllImport("winspool.Drv", CharSet=CharSet.Unicode, SetLastError=true)]
  public static extern bool StartDocPrinter(IntPtr h, int l, ref DI d);
  [DllImport("winspool.Drv", SetLastError=true)] public static extern bool EndDocPrinter(IntPtr h);
  [DllImport("winspool.Drv", SetLastError=true)] public static extern bool StartPagePrinter(IntPtr h);
  [DllImport("winspool.Drv", SetLastError=true)] public static extern bool EndPagePrinter(IntPtr h);
  [DllImport("winspool.Drv", SetLastError=true)]
  public static extern bool WritePrinter(IntPtr h, IntPtr b, int c, out int w);
  public static string Send(string pr, byte[] by) {
    IntPtr h;
    if(!OpenPrinter(pr, out h, IntPtr.Zero)) return "NO ABRE err=" + Marshal.GetLastWin32Error();
    DI d = new DI(); d.n = "identificacion"; d.t = "RAW";
    if(!StartDocPrinter(h, 1, ref d)) { ClosePrinter(h); return "NO INICIA err=" + Marshal.GetLastWin32Error(); }
    StartPagePrinter(h);
    IntPtr p = Marshal.AllocCoTaskMem(by.Length); Marshal.Copy(by, 0, p, by.Length);
    int w; bool ok = WritePrinter(h, p, by.Length, out w);
    Marshal.FreeCoTaskMem(p); EndPagePrinter(h); EndDocPrinter(h); ClosePrinter(h);
    return ok ? ("OK " + w + " bytes") : ("NO ESCRIBE err=" + Marshal.GetLastWin32Error());
  }
}
"@

$cfg = Get-CajaConfig
$patron = if ($cfg['PATRON_IMPRESORAS']) { $cfg['PATRON_IMPRESORAS'] } else { '*' }
$impresoras = Get-Printer | Where-Object { $_.Name -like $patron -and $_.Name -notlike '*SIN-USO*' }
if (-not $impresoras) { Write-Output 'No hay impresoras instaladas que coincidan con PATRON_IMPRESORAS.'; return }

Write-Output 'Mandando un ticket rotulado a cada impresora...'
Write-Output ''
foreach ($i in $impresoras) {
  $ESC = [char]27; $GS = [char]29
  $t  = "$ESC@" + "$ESC" + 'a' + [char]1 + "$ESC" + '!' + [char]56
  $t += "`n" + $i.PortName + "`n"
  $t += "$ESC" + '!' + [char]0
  $t += "--------------------------------`n"
  $t += 'nombre: ' + $i.Name + "`n"
  $t += "De CUAL maquina salio`n este papel?`n"
  $t += "--------------------------------`n`n`n`n"
  $t += "$GS" + 'V' + [char]66 + [char]0
  $b = [System.Text.Encoding]::GetEncoding(437).GetBytes($t)
  Write-Output ('   {0,-20} {1,-8} -> {2}' -f $i.Name, $i.PortName, [RawPrintId]::Send($i.Name, $b))
  Start-Sleep 2
}
Write-Output ''
Write-Output 'Recoge los papeles y anota que puerto salio de que maquina.'
Write-Output 'Si el mapa cambio, actualiza MAPA_PUERTOS en caja.env.'
