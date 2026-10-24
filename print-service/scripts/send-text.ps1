# Imprime un archivo de texto con el driver normal de Windows (impresoras laser o de tinta).
# Lo usa el modo texto del print-service (TEXT_PRINTERS): ver src/printer/textoPlano.ts.
param(
  [Parameter(Mandatory = $true)][string]$PrinterName,
  [Parameter(Mandatory = $true)][string]$FilePath
)
$ErrorActionPreference = 'Stop'
if (-not (Get-Printer -Name $PrinterName -ErrorAction SilentlyContinue)) {
  throw "Impresora no encontrada: $PrinterName"
}
Get-Content -LiteralPath $FilePath -Encoding UTF8 | Out-Printer -Name $PrinterName
Write-Output "OK texto -> $PrinterName"
