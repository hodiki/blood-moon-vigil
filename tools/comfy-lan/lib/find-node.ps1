# Prefer PATH node; else Workbuddy pin.
function Get-ComfyLanNode {
    $cmd = Get-Command node -ErrorAction SilentlyContinue
    if ($cmd -and $cmd.Source -notmatch 'WindowsApps') {
        return $cmd.Source
    }
    $wbRoot = Join-Path $env:USERPROFILE '.workbuddy\binaries\node\versions'
    $pinned = Join-Path $wbRoot '22.22.2-2\node.exe'
    if (Test-Path $pinned) { return $pinned }
    if (Test-Path $wbRoot) {
        $hit = Get-ChildItem $wbRoot -Directory -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -notmatch 'deleting' } |
            ForEach-Object { Join-Path $_.FullName 'node.exe' } |
            Where-Object { Test-Path $_ } |
            Select-Object -First 1
        if ($hit) { return $hit }
    }
    return $null
}
