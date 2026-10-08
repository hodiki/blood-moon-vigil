# Client-machine check. GPU not required. Writes incoming\client-env.json
$ErrorActionPreference = 'Continue'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $here 'lib\find-node.ps1')

$os = Get-CimInstance Win32_OperatingSystem
$ipv4 = @(Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -ne '127.0.0.1' -and $_.PrefixOrigin -ne 'WellKnown' } |
    Select-Object InterfaceAlias, IPAddress, PrefixLength, AddressState)
$gw = @(Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue |
    Select-Object InterfaceAlias, NextHop, RouteMetric)
$netProfile = @(Get-NetConnectionProfile |
    Select-Object Name, InterfaceAlias, NetworkCategory, IPv4Connectivity)
$mac = @(Get-NetAdapter | Where-Object { $_.Status -eq 'Up' } |
    Select-Object Name, MacAddress, LinkSpeed)
$neighbors = @(Get-NetNeighbor -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -like '192.168.101.*' -and $_.State -ne 'Unreachable' -and $_.IPAddress -ne '192.168.101.255' } |
    Select-Object IPAddress, LinkLayerAddress, State)
$node = Get-ComfyLanNode
$nodeVer = $null
if ($node) {
    $nodeVer = (& $node --version 2>$null | Select-Object -First 1)
}
$listen8188 = @(Get-NetTCPConnection -LocalPort 8188 -ErrorAction SilentlyContinue |
    Select-Object LocalAddress, State, OwningProcess)

$gwHop = $gw | Select-Object -First 1 -ExpandProperty NextHop
$gwPing = $null
if ($gwHop) {
    $p = Test-Connection -ComputerName $gwHop -Count 2 -ErrorAction SilentlyContinue
    if ($p) {
        $gwPing = [pscustomobject]@{
            target = $gwHop
            ok     = $true
            ms     = @($p | ForEach-Object { $_.ResponseTime })
        }
    } else {
        $gwPing = [pscustomobject]@{ target = $gwHop; ok = $false }
    }
}

$repo = Split-Path -Parent (Split-Path -Parent $here)
$refs = @(
    'assets\frames\player.png',
    'assets\frames\player-walk-a.png',
    'assets\ui-menu\preview\locked\combat-64\player-idle-64-v9.png'
) | ForEach-Object {
    $full = Join-Path $repo $_
    [pscustomobject]@{ path = $_; exists = (Test-Path $full) }
}

$snapshot = [ordered]@{
    schema         = 'comfy-lan-client-env/v1'
    generated_at   = (Get-Date).ToString('yyyy-MM-ddTHH:mm:ssK')
    host           = @{
        hostname = $env:COMPUTERNAME
        os       = ('{0} {1}' -f $os.Caption, $os.Version)
    }
    lan            = @{
        ipv4         = $ipv4
        gateway      = $gw
        gateway_ping = $gwPing
        profile      = $netProfile
        mac          = $mac
        neighbors    = $neighbors
    }
    tools          = @{
        node_path      = $node
        node_version   = $nodeVer
        curl           = (Get-Command curl.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source)
        python_path    = (Get-Command python -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source)
        python_note    = 'WindowsApps stub is not usable'
        mcp_user       = (Test-Path (Join-Path $env:USERPROFILE '.cursor\mcp.json'))
        mcp_workspace  = (Test-Path (Join-Path $repo '.cursor\mcp.json'))
        local_8188     = $listen8188
    }
    refs           = $refs
    expected_allow = @{
        client_hostname = 'Hodiki'
        client_ip       = '192.168.101.82'
        client_mac      = '7C-21-4A-DD-A9-EB'
    }
}

$incoming = Join-Path $here 'incoming'
New-Item -ItemType Directory -Force -Path $incoming | Out-Null
$out = Join-Path $incoming 'client-env.json'
$snapshot | ConvertTo-Json -Depth 8 | Set-Content -Path $out -Encoding UTF8

Write-Output "host      $($snapshot.host.hostname)"
Write-Output "ipv4      $(($ipv4 | ForEach-Object { '{0} {1}/{2}' -f $_.InterfaceAlias, $_.IPAddress, $_.PrefixLength }) -join '; ')"
Write-Output "gateway   $($gwPing.target) ok=$($gwPing.ok)"
Write-Output "profile   $(($netProfile | ForEach-Object { '{0} {1}' -f $_.InterfaceAlias, $_.NetworkCategory }) -join '; ')"
Write-Output "node      $node $nodeVer"
Write-Output "mcp       user=$($snapshot.tools.mcp_user) workspace=$($snapshot.tools.mcp_workspace)"
Write-Output "8188      $(if ($listen8188.Count) { 'listening' } else { 'none' })"
Write-Output "neighbors $(($neighbors | ForEach-Object { '{0} {1}' -f $_.IPAddress, $_.State }) -join '; ')"
Write-Output "refs      $(($refs | ForEach-Object { '{0}={1}' -f $_.path, $_.exists }) -join '; ')"
Write-Output "wrote     $out"
