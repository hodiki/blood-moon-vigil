# Probe SVD, POST /free, Queue Vf1 I2V gun B (1024x576, motion 35).
param(
    [int]$TimeoutSec = 1200
)
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $here 'lib\find-node.ps1')
$base = 'http://192.168.101.200:8188'
$stamp = 'd:\code\vampire-survivors-like\assets\ui-menu\preview\locked\review-identity-vf1\37-i2v-b-ref-1024x576.png'
$wf = Join-Path $here 'workflows\svd-vf1-i2v-b.json'
$slots = Join-Path $here 'workflows\svd-vf1-i2v-b.slots.json'

if (-not (Test-Path -LiteralPath $stamp)) { throw "missing landscape ref: $stamp" }

$oi = Invoke-RestMethod -Uri ($base + '/object_info/ImageOnlyCheckpointLoader') -TimeoutSec 15
$ckpt = @($oi.ImageOnlyCheckpointLoader.input.required.ckpt_name[0])
$hit = @($ckpt | Where-Object { $_ -match '(?i)svd_xt' })
if ($hit.Count -lt 1) {
    Write-Output 'NO_SVD'
    exit 2
}
$ckptName = [string]$hit[0]
Write-Output ('SVD_CKPT=' + $ckptName)

$live = Join-Path $here 'workflows\svd-vf1-i2v-b.live.json'
$raw = Get-Content -LiteralPath $wf -Raw -Encoding UTF8
$raw = $raw -replace '"ckpt_name":\s*"svd_xt\.safetensors"', ('"ckpt_name": "' + $ckptName + '"')
$utf8 = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($live, $raw, $utf8)

Invoke-RestMethod -Method Post -Uri ($base + '/free') -ContentType 'application/json' -Body '{"unload_models":true,"free_memory":true}' | Out-Null
Write-Output 'POST /free ok'

& (Join-Path $here 'run-job.ps1') queue -Workflow $live -Slots $slots -Ref $stamp -TimeoutSec $TimeoutSec
exit $LASTEXITCODE
