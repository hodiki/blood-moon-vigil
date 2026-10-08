# Read incoming\handshake.json (or -Url) and GET /system_stats. No subnet scan.
param(
    [string]$Url,
    [int]$TimeoutSec = 5
)
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$handshakePath = Join-Path $here 'incoming\handshake.json'

function Get-LanIPv4 {
    @(Get-NetIPAddress -AddressFamily IPv4 |
        Where-Object { $_.IPAddress -ne '127.0.0.1' -and $_.PrefixOrigin -ne 'WellKnown' } |
        Select-Object -ExpandProperty IPAddress)
}

$handshake = $null
if (-not $Url) {
    if (-not (Test-Path $handshakePath)) {
        throw "Missing incoming\handshake.json and no -Url. Copy GPU handshake to:`n$handshakePath"
    }
    $handshake = Get-Content -Raw -Encoding UTF8 $handshakePath | ConvertFrom-Json
    if ($handshake.schema -ne 'comfy-lan-handshake/v1') {
        throw "handshake.schema must be comfy-lan-handshake/v1, got '$($handshake.schema)'"
    }
    $Url = [string]$handshake.gpu.url
}

$Url = $Url.TrimEnd('/')
$statsUrl = "$Url/system_stats"
Write-Output "GET $statsUrl"

try {
    $resp = Invoke-WebRequest -Uri $statsUrl -TimeoutSec $TimeoutSec -UseBasicParsing
} catch {
    throw "Unreachable $statsUrl`n$($_.Exception.Message)`nCheck: GPU --listen, firewall allows this host, handshake IP still valid."
}

$body = $null
try { $body = $resp.Content | ConvertFrom-Json } catch { $body = $resp.Content }

$myIps = Get-LanIPv4
$allowIp = $null
if ($handshake) { $allowIp = [string]$handshake.allow.client_ip }
$ipMatch = -not $allowIp -or ($myIps -contains $allowIp)

$ping = [ordered]@{
    schema         = 'comfy-lan-ping/v1'
    at             = (Get-Date).ToString('yyyy-MM-ddTHH:mm:ssK')
    url            = $statsUrl
    status         = [int]$resp.StatusCode
    ok             = ($resp.StatusCode -eq 200)
    client_ips     = @($myIps)
    allow_ip       = $allowIp
    allow_ip_match = $ipMatch
    system_stats   = $body
}

$out = Join-Path $here 'incoming\last-ping.json'
$ping | ConvertTo-Json -Depth 8 | Set-Content -Path $out -Encoding UTF8

Write-Output "status    $($resp.StatusCode)"
Write-Output "client_ip $($myIps -join ', ')"
if ($allowIp) {
    if ($ipMatch) { Write-Output "allow     $allowIp match" }
    else { Write-Warning "This host IP is no longer handshake allow.client_ip=$allowIp. Update GPU firewall or re-handshake." }
}
Write-Output "wrote     $out"
if ($resp.StatusCode -ne 200) { exit 1 }
