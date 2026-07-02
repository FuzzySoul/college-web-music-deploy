$ErrorActionPreference = 'Stop'

$proxyDir = 'C:\proxy'
$pacFile = Join-Path $proxyDir 'proxy.pac'
$pidFile = Join-Path $proxyDir 'pac-server.pid'
$stdoutLogFile = Join-Path $proxyDir 'pac-server.stdout.log'
$stderrLogFile = Join-Path $proxyDir 'pac-server.stderr.log'
$port = 8765

if (-not (Test-Path $pacFile)) {
    throw "PAC file not found: $pacFile"
}

if (Test-Path $pidFile) {
    $existingPid = (Get-Content $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1).Trim()
    if ($existingPid) {
        $existingProcess = Get-Process -Id $existingPid -ErrorAction SilentlyContinue
        if ($existingProcess) {
            try {
                $existingResponse = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$port/proxy.pac" -TimeoutSec 3
                if ($existingResponse.StatusCode -eq 200) {
                    Write-Output "PAC server is already running. PID: $existingPid"
                    Write-Output "PAC URL: http://127.0.0.1:$port/proxy.pac"
                    exit 0
                }
            } catch {
            }
        }
    }
    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
}

$pythonCommands = @('py', 'python')
$pythonExe = $null

foreach ($candidate in $pythonCommands) {
    try {
        $null = & $candidate --version 2>$null
        if ($LASTEXITCODE -eq 0) {
            $pythonExe = $candidate
            break
        }
    } catch {
    }
}

if (-not $pythonExe) {
    throw 'Python launcher not found.'
}

$process = Start-Process -FilePath $pythonExe `
    -ArgumentList @('-m', 'http.server', $port, '--bind', '127.0.0.1') `
    -WorkingDirectory $proxyDir `
    -WindowStyle Hidden `
    -RedirectStandardOutput $stdoutLogFile `
    -RedirectStandardError $stderrLogFile `
    -PassThru

Set-Content -Path $pidFile -Value $process.Id -Encoding ASCII
Start-Sleep -Seconds 2

try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$port/proxy.pac" -TimeoutSec 5
    if ($response.StatusCode -ne 200) {
        throw "HTTP $($response.StatusCode)"
    }
} catch {
    if (Get-Process -Id $process.Id -ErrorAction SilentlyContinue) {
        Stop-Process -Id $process.Id -Force
    }
    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
    throw "PAC server failed to start: $($_.Exception.Message)"
}

Write-Output "PAC server started"
Write-Output "PID: $($process.Id)"
Write-Output "PAC URL: http://127.0.0.1:$port/proxy.pac"
