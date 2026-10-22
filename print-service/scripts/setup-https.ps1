# Print Service - Generar certificado HTTPS para el print service
# Ejecutar como Administrador

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Print Service - Configurar HTTPS en Print Service" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

$certsDir = Join-Path $PSScriptRoot "..\certs"
if (-not (Test-Path $certsDir)) {
    New-Item -ItemType Directory -Path $certsDir | Out-Null
}

$pfxPath = Join-Path $certsDir "print-service.pfx"
$passphrase = "print-service"

Write-Host "Generando certificado autofirmado para 127.0.0.1 / localhost..." -ForegroundColor Yellow

# Eliminar certificados viejos de Print Service
Get-ChildItem Cert:\LocalMachine\Root | Where-Object { $_.Subject -like "*Print Service*" } | Remove-Item -ErrorAction SilentlyContinue
Get-ChildItem Cert:\LocalMachine\My  | Where-Object { $_.Subject -like "*Print Service*" } | Remove-Item -ErrorAction SilentlyContinue

# Crear certificado nuevo (valido 10 anos)
$cert = New-SelfSignedCertificate `
    -Subject "CN=Print Service" `
    -DnsName @("localhost", "127.0.0.1") `
    -IPAddress @("127.0.0.1") `
    -CertStoreLocation "Cert:\LocalMachine\My" `
    -NotAfter (Get-Date).AddYears(10) `
    -KeyUsage DigitalSignature, DataEncipherment, KeyEncipherment `
    -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.1")

if (-not $cert) {
    Write-Host "ERROR: No se pudo crear el certificado." -ForegroundColor Red
    Read-Host "Presiona Enter para salir"
    exit 1
}

Write-Host "Certificado creado: $($cert.Thumbprint)" -ForegroundColor Green

# Instalar en Root para que el navegador lo confie automaticamente
$store = New-Object System.Security.Cryptography.X509Certificates.X509Store("Root", "LocalMachine")
$store.Open("ReadWrite")
$store.Add($cert)
$store.Close()
Write-Host "Certificado instalado como confiable en Windows." -ForegroundColor Green

# Exportar a PFX
$pwd = ConvertTo-SecureString -String $passphrase -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $pwd | Out-Null
Write-Host "Certificado exportado a: $pfxPath" -ForegroundColor Green

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  LISTO. Ahora reinicia start.bat para activar HTTPS." -ForegroundColor Green
Write-Host "  El servicio estara disponible en:" -ForegroundColor White
Write-Host "    https://127.0.0.1:6441" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "IMPORTANTE: Abre Chrome, ve a https://127.0.0.1:6441/status" -ForegroundColor Yellow
Write-Host "y acepta el certificado (Avanzado > Continuar) UNA SOLA VEZ." -ForegroundColor Yellow
Write-Host ""
Read-Host "Presiona Enter para salir"
