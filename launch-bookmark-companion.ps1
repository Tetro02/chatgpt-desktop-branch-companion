$ErrorActionPreference='Stop'
$taskRoot=$PSScriptRoot
$ready=$false
try {
    $targets=Invoke-RestMethod -Uri 'http://127.0.0.1:19347/json/list' -TimeoutSec 2
    $ready=@($targets | Where-Object { $_.type -eq 'page' -and $_.url -eq 'app://-/index.html' }).Count -gt 0
} catch { $ready=$false }
if ($ready) {
    & node (Join-Path $taskRoot 'handoff.cjs')
    if ($LASTEXITCODE -ne 0) { throw 'State handoff failed; connection was stopped to preserve your records.' }
    & node (Join-Path $taskRoot 'inject.cjs')
    if ($LASTEXITCODE -ne 0) { throw 'The bookmark companion could not connect. See the preceding message.' }
} else {
    & (Join-Path $taskRoot 'launch-branch-companion.ps1')
}
