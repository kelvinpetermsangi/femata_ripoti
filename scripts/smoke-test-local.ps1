param(
    [int]$Port = 8012
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$backendDir = Join-Path $repoRoot "backend"
$pythonExe = Join-Path $backendDir ".venv\Scripts\python.exe"

if (-not (Test-Path $pythonExe)) {
    throw "Backend virtual environment is missing. Run scripts\\build-production.ps1 first."
}

$proc = Start-Process -FilePath $pythonExe -ArgumentList "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", $Port -WorkingDirectory $backendDir -PassThru

try {
    $deadline = (Get-Date).AddSeconds(30)
    while ((Get-Date) -lt $deadline) {
        try {
            Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:$Port/health" | Out-Null
            break
        } catch {
            Start-Sleep -Seconds 1
        }
    }

    $results = @()
    foreach ($route in @("/", "/report", "/track", "/chat", "/admin/login")) {
        $response = Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:$Port$route"
        $results += [pscustomobject]@{
            Route = $route
            Status = $response.StatusCode
        }
    }

    $aiResponse = Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:$Port/api/ai-chat/guidance" `
        -Method POST `
        -ContentType "application/json" `
        -Body '{"message":"How do I file a complaint anonymously?","language":"en","history":[],"context":{"topic":"register complaints"},"client_timezone":"Africa/Dar_es_Salaam","client_time_iso":"2026-03-18T09:00:00Z"}'

    Write-Host "Route checks:"
    $results | Format-Table -AutoSize
    Write-Host ""
    Write-Host "AI guidance endpoint:"
    Write-Host $aiResponse.Content
} finally {
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
}
