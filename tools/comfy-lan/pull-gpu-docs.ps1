# Pull HodikiX env-docs + handshake via /userdata. Never hit /docs.
param(
    [string]$Url = 'http://192.168.101.200:8188',
    [string]$Dest
)
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $Dest) {
    $Dest = Join-Path $here 'incoming\gpu-docs'
}
$Url = $Url.TrimEnd('/')
New-Item -ItemType Directory -Force -Path $Dest | Out-Null

function Pull-Userdata([string]$rel, [string]$name) {
    $destFile = Join-Path $Dest $name
    & curl.exe -sS -o $destFile -- "$Url$rel"
    if ($LASTEXITCODE -ne 0) { throw "curl failed $rel" }
    Write-Output "OK $name $((Get-Item -LiteralPath $destFile).Length)"
}

Pull-Userdata '/system_stats' 'system_stats.json'
Pull-Userdata '/userdata?dir=env-docs&full_info=true' 'env-docs-list.json'
Pull-Userdata '/userdata?dir=workflows&full_info=true' 'workflows-list.json'
Pull-Userdata '/userdata/comfy-lan-handshake.json' 'comfy-lan-handshake.json'
Pull-Userdata '/userdata/env-docs%2F%E7%8E%AF%E5%A2%83%E8%AF%B4%E6%98%8E.md' '环境说明.md'
Pull-Userdata '/userdata/env-docs%2F%E5%B1%80%E5%9F%9F%E7%BD%91%E9%80%9A%E4%BF%A1%E7%BB%B4%E6%8A%A4%E8%AE%B0%E5%BD%95.md' '局域网通信维护记录.md'
Pull-Userdata '/userdata/env-docs%2F%E4%BB%BB%E5%8A%A1%E6%B8%85%E5%8D%95.md' '任务清单.md'
Pull-Userdata '/userdata/env-docs%2F%E7%BB%B4%E6%8A%A4%E6%9B%B4%E6%96%B0%E6%97%A5%E5%BF%97.md' '维护更新日志.md'
Pull-Userdata '/userdata/env-docs%2F%E5%B7%A5%E4%BD%9C%E8%A7%84%E8%8C%83-GPU%E7%94%9F%E5%9B%BE%E7%8E%AF%E5%A2%83.md' '工作规范-GPU生图环境.md'
Pull-Userdata '/userdata/env-docs%2F%E6%8F%90%E7%A4%BA%E8%AF%8D%E9%A2%84%E8%AE%BE.txt' '提示词预设.txt'

Pull-Userdata '/userdata/env-docs%2Fkrea2-turbo-eval.md' 'krea2-turbo-eval.md'

$rawHs = Join-Path $here 'incoming\handshake.gpu.json'
$workHs = Join-Path $here 'incoming\handshake.json'
Copy-Item -Force (Join-Path $Dest 'comfy-lan-handshake.json') $rawHs
Copy-Item -Force $rawHs $workHs
Write-Output 'copied GPU handshake -> incoming\handshake.gpu.json and incoming\handshake.json'
Write-Output 'Chinese keys in GPU JSON may mojibake; use /userdata?dir= for real filenames.'
