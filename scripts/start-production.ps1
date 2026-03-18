param(
    [string]$BindHost = "0.0.0.0",
    [int]$Port = 8000,
    [switch]$EnableSecureAdminCookie
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$backendDir = Join-Path $repoRoot "backend"
$frontendIndex = Join-Path $repoRoot "frontend\\dist\\index.html"
$venvPython = Join-Path $backendDir ".venv\\Scripts\\python.exe"

if (-not (Test-Path $venvPython)) {
    throw "Backend virtual environment not found. Run .\\scripts\\build-production.ps1 first."
}

if (-not (Test-Path $frontendIndex)) {
    throw "Frontend production build not found. Run .\\scripts\\build-production.ps1 first."
}

if ($EnableSecureAdminCookie) {
    $env:FEMATA_ADMIN_COOKIE_SECURE = "1"
}

Write-Host "Starting FEMATA Ripoti on http://$BindHost`:$Port"

Push-Location $backendDir
try {
    & $venvPython -m uvicorn main:app --host $BindHost --port $Port
}
finally {
    Pop-Location
}
