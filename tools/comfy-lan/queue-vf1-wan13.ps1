# Probe Wan 1.3B, POST /free, Queue Vf1 I2V (start image + text).
param(
    [int]$TimeoutSec = 1800,
    [ValidateSet('a', 'b')]
    [string]$Gun = 'a'
)
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $here 'lib\find-node.ps1')
$base = 'http://192.168.101.200:8188'
$stamp = 'd:\code\vampire-survivors-like\assets\ui-menu\preview\locked\review-identity-vf1\12-idle-blo-passed-stamp.png'
$wfName = if ($Gun -eq 'b') { 'wan21-vf1-i2v-1.3b-b.json' } else { 'wan21-vf1-i2v-1.3b.json' }
$wf = Join-Path $here ('workflows\' + $wfName)
$slots = Join-Path $here 'workflows\wan21-vf1-i2v-1.3b.slots.json'

if (-not (Test-Path -LiteralPath $stamp)) { throw "missing stamp: $stamp" }

$u = Invoke-RestMethod -Uri ($base + '/object_info/UNETLoader') -TimeoutSec 15
$unets = @($u.UNETLoader.input.required.unet_name[0])
$hit = @($unets | Where-Object { $_ -match '(?i)wan2\.1_t2v_1\.3B' })
if ($hit.Count -lt 1) {
    Write-Output 'NO_WAN13'
    Write-Output ('HAVE=' + ($unets -join ','))
    Write-Output 'Put wan2.1_t2v_1.3B_fp16.safetensors in D:\ComfyUI\models\diffusion_models\ then reply C 好了.'
    exit 2
}
$unetName = [string]$hit[0]
Write-Output ('WAN_UNET=' + $unetName)

$c = Invoke-RestMethod -Uri ($base + '/object_info/CLIPLoader') -TimeoutSec 15
$clips = @($c.CLIPLoader.input.required.clip_name[0])
$clipHit = @($clips | Where-Object { $_ -match '(?i)umt5' })
if ($clipHit.Count -lt 1) {
    Write-Output 'NO_UMT5'
    Write-Output ('HAVE_CLIP=' + ($clips -join ','))
    exit 2
}

$v = Invoke-RestMethod -Uri ($base + '/object_info/VAELoader') -TimeoutSec 15
$vaes = @($v.VAELoader.input.required.vae_name[0])
$vaeHit = @($vaes | Where-Object { $_ -match '(?i)wan_2\.1_vae' })
if ($vaeHit.Count -lt 1) {
    Write-Output 'NO_WAN_VAE'
    Write-Output ('HAVE_VAE=' + ($vaes -join ','))
    exit 2
}

$cv = Invoke-RestMethod -Uri ($base + '/object_info/CLIPVisionLoader') -TimeoutSec 15
$cvs = @($cv.CLIPVisionLoader.input.required.clip_name[0])
$cvHit = @($cvs | Where-Object { $_ -match '(?i)^clip_vision_h' })
if ($cvHit.Count -lt 1) {
    $cvHit = @($cvs | Where-Object { $_ -match '(?i)ViT-H-14' })
}
if ($cvHit.Count -lt 1) {
    Write-Output 'NO_CLIP_VISION'
    Write-Output ('HAVE_CV=' + ($cvs -join ','))
    exit 2
}

$live = Join-Path $here ('workflows\wan21-vf1-i2v-1.3b-' + $Gun + '.live.json')
$raw = Get-Content -LiteralPath $wf -Raw -Encoding UTF8
$raw = $raw -replace '"unet_name":\s*"wan2\.1_t2v_1\.3B_fp16\.safetensors"', ('"unet_name": "' + $unetName + '"')
$raw = $raw -replace '"clip_name":\s*"umt5_xxl_fp8_e4m3fn_scaled\.safetensors"', ('"clip_name": "' + [string]$clipHit[0] + '"')
$raw = $raw -replace '"vae_name":\s*"wan_2\.1_vae\.safetensors"', ('"vae_name": "' + [string]$vaeHit[0] + '"')
$raw = $raw -replace '"clip_name":\s*"clip_vision_h\.safetensors"', ('"clip_name": "' + [string]$cvHit[0] + '"')
$utf8 = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($live, $raw, $utf8)

Invoke-RestMethod -Method Post -Uri ($base + '/free') -ContentType 'application/json' -Body '{"unload_models":true,"free_memory":true}' | Out-Null
Write-Output 'POST /free ok'

& (Join-Path $here 'run-job.ps1') queue -Workflow $live -Slots $slots -Ref $stamp -TimeoutSec $TimeoutSec
exit $LASTEXITCODE
