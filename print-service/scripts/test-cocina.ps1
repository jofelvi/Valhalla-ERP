# Test directo a POS-COCINA sin pasar por el servicio
# Ejecutar: powershell -ExecutionPolicy Bypass -File test-cocina.ps1

Add-Type -TypeDefinition @"
using System;
using System.IO;
using System.Runtime.InteropServices;

public class RawPrinter {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct DOCINFOW {
        [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPWStr)] public string pDatatype;
    }
    [DllImport("winspool.Drv", EntryPoint="OpenPrinterW",    SetLastError=true, CharSet=CharSet.Unicode)] public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);
    [DllImport("winspool.Drv", EntryPoint="ClosePrinter",    SetLastError=true)] public static extern bool ClosePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint="StartDocPrinterW",SetLastError=true, CharSet=CharSet.Unicode)] public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In] ref DOCINFOW di);
    [DllImport("winspool.Drv", EntryPoint="EndDocPrinter",   SetLastError=true)] public static extern bool EndDocPrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint="StartPagePrinter",SetLastError=true)] public static extern bool StartPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint="EndPagePrinter",  SetLastError=true)] public static extern bool EndPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint="WritePrinter",    SetLastError=true)] public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

    public static bool Send(string printerName, byte[] data) {
        IntPtr hPrinter;
        if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero))
            throw new Exception("No se pudo abrir impresora: " + printerName + " (error " + Marshal.GetLastWin32Error() + ")");
        try {
            DOCINFOW di = new DOCINFOW { pDocName = "Test", pDatatype = "RAW" };
            StartDocPrinter(hPrinter, 1, ref di);
            StartPagePrinter(hPrinter);
            IntPtr ptr = Marshal.AllocCoTaskMem(data.Length);
            Marshal.Copy(data, 0, ptr, data.Length);
            int written;
            WritePrinter(hPrinter, ptr, data.Length, out written);
            Marshal.FreeCoTaskMem(ptr);
            EndPagePrinter(hPrinter);
            EndDocPrinter(hPrinter);
            return true;
        } finally { ClosePrinter(hPrinter); }
    }
}
"@

function Build-TestTicket {
    $ESC = [byte]0x1B
    $LF  = [byte]0x0A
    $GS  = [byte]0x1D

    $bytes = New-Object System.Collections.Generic.List[byte]

    # Init
    $bytes.AddRange([byte[]]@($ESC, 0x40))
    # Centrado
    $bytes.AddRange([byte[]]@($ESC, 0x61, 0x01))
    # Doble tamanio
    $bytes.AddRange([byte[]]@($ESC, 0x21, 0x30))
    $bytes.AddRange([System.Text.Encoding]::ASCII.GetBytes("COCINA`n"))
    # Tamanio normal
    $bytes.AddRange([byte[]]@($ESC, 0x21, 0x00))
    $bytes.AddRange([System.Text.Encoding]::ASCII.GetBytes("----------------------------`n"))
    # Bold ON
    $bytes.AddRange([byte[]]@($ESC, 0x45, 0x01))
    $bytes.AddRange([System.Text.Encoding]::ASCII.GetBytes("2x Prueba de impresion`n"))
    # Bold OFF
    $bytes.AddRange([byte[]]@($ESC, 0x45, 0x00))
    $bytes.AddRange([System.Text.Encoding]::ASCII.GetBytes("   Si ves esto, funciona!`n"))
    $bytes.AddRange([System.Text.Encoding]::ASCII.GetBytes("----------------------------`n"))
    $bytes.AddRange([System.Text.Encoding]::ASCII.GetBytes((Get-Date -Format "dd/MM/yyyy  HH:mm") + "`n"))
    # Feed + corte parcial
    $bytes.AddRange([byte[]]@($ESC, 0x64, 0x04))
    $bytes.AddRange([byte[]]@($GS, 0x56, 0x01))

    return $bytes.ToArray()
}

$printerName = "POS-COCINA"

Write-Host ""
Write-Host "Enviando ticket de prueba directo a '$printerName'..." -ForegroundColor Yellow

try {
    $data = Build-TestTicket
    [RawPrinter]::Send($printerName, $data) | Out-Null
    Write-Host "ENVIADO ($($data.Length) bytes). Revisa la impresora." -ForegroundColor Green
} catch {
    Write-Host "ERROR: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Impresoras disponibles:" -ForegroundColor Yellow
    Get-Printer | Select-Object Name, PrinterStatus | Format-Table -AutoSize
}

Write-Host ""
Read-Host "Presiona Enter para salir"
