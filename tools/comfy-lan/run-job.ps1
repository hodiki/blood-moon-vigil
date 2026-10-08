# Locate node and forward to run-job.mjs
param(
    [Parameter(Position = 0)]
    [ValidateSet('ping', 'queue')]
    [string]$Command = 'ping',
    [string]$Workflow,
    [string]$Slots,
    [string]$Idle,
    [string]$WalkA,
    [string]$Ref,
    [string]$Pose,
    [string]$Drive,
    [string]$Char,
    [string]$Url,
    [int]$TimeoutSec = 300
)
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $here 'lib\find-node.ps1')
$node = Get-ComfyLanNode
if (-not $node) {
    throw 'node not found. PATH empty; expected Workbuddy 22.22.2.'
}
$js = Join-Path $here 'run-job.mjs'
$nodeArgs = @($js, $Command)
if ($Url) { $nodeArgs += @('--url', $Url) }
if ($Workflow) { $nodeArgs += @('--workflow', $Workflow) }
if ($Slots) { $nodeArgs += @('--slots', $Slots) }
if ($Idle) { $nodeArgs += @('--idle', $Idle) }
if ($WalkA) { $nodeArgs += @('--walk-a', $WalkA) }
if ($Ref) { $nodeArgs += @('--ref', $Ref) }
if ($Pose) { $nodeArgs += @('--pose', $Pose) }
if ($Drive) { $nodeArgs += @('--drive', $Drive) }
if ($Char) { $nodeArgs += @('--char', $Char) }
if ($TimeoutSec) { $nodeArgs += @('--timeout', "$TimeoutSec") }
& $node @nodeArgs
exit $LASTEXITCODE
