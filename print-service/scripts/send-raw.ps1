param(
    [Parameter(Mandatory=$true)]
    [string]$PrinterName,

    [Parameter(Mandatory=$true)]
    [string]$FilePath
)

# send-raw.ps1 - Send raw bytes to a printer using Windows winspool.Drv API
# Usage: powershell -File send-raw.ps1 -PrinterName "POS-58" -FilePath "C:\temp\receipt.bin"

$ErrorActionPreference = "Stop"

Add-Type -TypeDefinition @"
using System;
using System.IO;
using System.Runtime.InteropServices;

public class RawPrinter
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct DOCINFOW
    {
        [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPWStr)] public string pDatatype;
    }

    [DllImport("winspool.Drv", EntryPoint = "OpenPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In] ref DOCINFOW di);

    [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

    public static bool SendRawData(string printerName, byte[] data)
    {
        IntPtr hPrinter = IntPtr.Zero;

        if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero))
            throw new Exception("Cannot open printer: " + printerName + " (Error: " + Marshal.GetLastWin32Error() + ")");

        try
        {
            DOCINFOW di = new DOCINFOW();
            di.pDocName = "POS Receipt";
            di.pDatatype = "RAW";

            if (!StartDocPrinter(hPrinter, 1, ref di))
                throw new Exception("StartDocPrinter failed (Error: " + Marshal.GetLastWin32Error() + ")");

            try
            {
                if (!StartPagePrinter(hPrinter))
                    throw new Exception("StartPagePrinter failed (Error: " + Marshal.GetLastWin32Error() + ")");

                try
                {
                    IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(data.Length);
                    try
                    {
                        Marshal.Copy(data, 0, pUnmanagedBytes, data.Length);
                        int written;
                        if (!WritePrinter(hPrinter, pUnmanagedBytes, data.Length, out written))
                            throw new Exception("WritePrinter failed (Error: " + Marshal.GetLastWin32Error() + ")");

                        return true;
                    }
                    finally
                    {
                        Marshal.FreeCoTaskMem(pUnmanagedBytes);
                    }
                }
                finally
                {
                    EndPagePrinter(hPrinter);
                }
            }
            finally
            {
                EndDocPrinter(hPrinter);
            }
        }
        finally
        {
            ClosePrinter(hPrinter);
        }
    }
}
"@

# ── Logs verbosos para diagnosticar fallos ──
$ts = { (Get-Date).ToString("yyyy-MM-dd HH:mm:ss.fff") }

Write-Output "[$(&$ts)] [PS] Iniciando send-raw.ps1"
Write-Output "[$(&$ts)] [PS]   PrinterName : $PrinterName"
Write-Output "[$(&$ts)] [PS]   FilePath    : $FilePath"

# Verificar que el archivo temporal existe
if (-not (Test-Path $FilePath)) {
    Write-Error "[$(&$ts)] [PS] ERROR: archivo temporal no existe: $FilePath"
    exit 1
}

$fileSize = (Get-Item $FilePath).Length
Write-Output "[$(&$ts)] [PS]   FileSize    : $fileSize bytes"

# Verificar que la impresora existe en Windows
Write-Output "[$(&$ts)] [PS] Buscando impresora '$PrinterName' en Windows..."
$printerExists = Get-Printer -Name $PrinterName -ErrorAction SilentlyContinue
if (-not $printerExists) {
    $allPrinters = (Get-Printer -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name) -join ", "
    Write-Error "[$(&$ts)] [PS] ERROR: impresora '$PrinterName' NO encontrada en Windows."
    Write-Error "[$(&$ts)] [PS]   Impresoras instaladas: $allPrinters"
    Write-Error "[$(&$ts)] [PS]   Solución: instala la impresora desde Panel de Control → Dispositivos e Impresoras"
    exit 1
}
Write-Output "[$(&$ts)] [PS]   Estado impresora: $($printerExists.PrinterStatus)"
Write-Output "[$(&$ts)] [PS]   Puerto           : $($printerExists.PortName)"

# Leer bytes y enviar
Write-Output "[$(&$ts)] [PS] Leyendo archivo y enviando via winspool..."
try {
    $bytes = [System.IO.File]::ReadAllBytes($FilePath)
    Write-Output "[$(&$ts)] [PS]   Bytes leídos: $($bytes.Length)"
    [RawPrinter]::SendRawData($PrinterName, $bytes)
    Write-Output "[$(&$ts)] [PS] OK: $($bytes.Length) bytes enviados a '$PrinterName'"
} catch {
    Write-Error "[$(&$ts)] [PS] ERROR en SendRawData: $_"
    exit 1
}
