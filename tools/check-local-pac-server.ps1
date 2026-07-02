$ErrorActionPreference = 'Stop'

$url = 'http://127.0.0.1:8765/proxy.pac'

try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 5
    Write-Output "PAC server OK: HTTP $($response.StatusCode)"
    Write-Output $url
} catch {
    Write-Output "PAC server check failed: $($_.Exception.Message)"
    exit 1
}
