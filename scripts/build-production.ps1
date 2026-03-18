param(
    [string]$PythonExe = "python",
    [switch]$SkipFrontendInstall,
    [switch]$SkipBackendInstall
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$frontendDir = Join-Path $repoRoot "frontend"
$backendDir = Join-Path $repoRoot "backend"
$venvDir = Join-Path $backendDir ".venv"
$venvPython = Join-Path $venvDir "Scripts\\python.exe"

function Invoke-ExternalCommand {
    param(
        [string]$FilePath,
        [string[]]$Arguments,
        [string]$FailureMessage
    )

    & $FilePath @Arguments

    if ($LASTEXITCODE -ne 0) {
        throw $FailureMessage
    }
}

Write-Host "Preparing FEMATA Ripoti production build..."

if (-not (Test-Path $venvPython)) {
    Write-Host "Creating backend virtual environment..."
    Invoke-ExternalCommand -FilePath $PythonExe -Arguments @("-m", "venv", $venvDir) -FailureMessage "Failed to create the backend virtual environment."
}

if (-not (Test-Path $venvPython)) {
    throw "Backend virtual environment was not created successfully."
}

if (-not $SkipBackendInstall) {
    & $venvPython -m pip --version | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "pip was not available in the virtual environment. Bootstrapping pip..."
        Invoke-ExternalCommand -FilePath $venvPython -Arguments @("-m", "ensurepip", "--upgrade") -FailureMessage "Failed to bootstrap pip in the backend virtual environment."
    }

    Write-Host "Installing backend dependencies..."
    Invoke-ExternalCommand -FilePath $venvPython -Arguments @("-m", "pip", "install", "--upgrade", "pip") -FailureMessage "Failed to upgrade pip."
    Invoke-ExternalCommand -FilePath $venvPython -Arguments @("-m", "pip", "install", "-r", (Join-Path $backendDir "requirements.txt")) -FailureMessage "Failed to install backend dependencies."
}

Push-Location $frontendDir
try {
    if (-not $SkipFrontendInstall) {
        Write-Host "Installing frontend dependencies..."
        Invoke-ExternalCommand -FilePath "npm.cmd" -Arguments @("ci") -FailureMessage "Failed to install frontend dependencies."
    }

    Write-Host "Building frontend assets..."
    Invoke-ExternalCommand -FilePath "npm.cmd" -Arguments @("run", "build") -FailureMessage "Failed to build the frontend production assets."
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "Production build complete."
Write-Host "Start the app with:"
Write-Host "powershell -ExecutionPolicy Bypass -File .\\scripts\\start-production.ps1"
