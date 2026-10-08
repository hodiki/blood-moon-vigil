# Probe SVD weights, POST /free, then Queue Vf1 I2V.
# Does not write assets/frames/. Park only via run-job.mjs.
param(
    [int]$TimeoutSec = 900
)
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $here 'lib\find-node.ps1')
$base = 'http://192.168.101.200:8188'
$stamp = 'd:\code\vampire-survivors-like\assets\ui-menu\preview\locked\review-identity-vf1\12-idle-blo-passed-stamp.png'
$wf = Join-Path $here 'workflows\svd-vf1-i2v.json'
$slots = Join-Path $here 'workflows\svd-vf1-i2v.slots.json'

if (-not (Test-Path -LiteralPath $stamp)) { throw "missing stamp: $stamp" }
if (-not (Test-Path -LiteralPath $wf)) { throw "missing workflow: $wf" }

$oi = Invoke-RestMethod -Uri ($base + '/object_info/ImageOnlyCheckpointLoader') -TimeoutSec 15
$ckpt = @($oi.ImageOnlyCheckpointLoader.input.required.ckpt_name[0])
$hit = @($ckpt | Where-Object { $_ -match '(?i)svd_xt' })
if ($hit.Count -lt 1) {
    Write-Output 'NO_SVD'
    Write-Output ('HAVE=' + ($ckpt -join ','))
    Write-Output 'Put svd_xt.safetensors or svd_xt_1_1.safetensors in D:\ComfyUI\models\checkpoints\ then reply B 好了.'
    exit 2
}

$ckptName = [string]$hit[0]
Write-Output ('SVD_CKPT=' + $ckptName)

$live = Join-Path $here 'workflows\svd-vf1-i2v.live.json'
$raw = Get-Content -LiteralPath $wf -Raw -Encoding UTF8
$raw = $raw -replace '"ckpt_name":\s*"svd_xt\.safetensors"', ('"ckpt_name": "' + $ckptName + '"')
$utf8 = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($live, $raw, $utf8)

Invoke-RestMethod -Method Post -Uri ($base + '/free') -ContentType 'application/json' -Body '{"unload_models":true,"free_memory":true}' | Out-Null
Write-Output 'POST /free ok'

& (Join-Path $here 'run-job.ps1') queue -Workflow $live -Slots $slots -Ref $stamp -TimeoutSec $TimeoutSec
exit $LASTEXITCODE
