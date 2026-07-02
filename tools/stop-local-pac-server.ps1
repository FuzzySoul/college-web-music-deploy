$ErrorActionPreference = 'Stop'

$pidFile = 'C:\proxy\pac-server.pid'

if (-not (Test-Path $pidFile)) {
    Write-Output 'PAC server is not running.'
    exit 0
}

$serverPid = (Get-Content $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1).Trim()
if (-not $serverPid) {
    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
    Write-Output 'PID file was empty and has been removed.'
    exit 0
}

$process = Get-Process -Id $serverPid -ErrorAction SilentlyContinue
if ($process) {
    Stop-Process -Id $serverPid -Force
}

Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
Write-Output "PAC server stopped. PID: $serverPid"
