$ErrorActionPreference = 'Stop'
$companionRoot = $PSScriptRoot
$port = 19347

$listener = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -First 1
if ($listener) {
    if ($listener.LocalAddress -ne '127.0.0.1') { throw 'GPT助手端口没有限定在本机，请先关闭占用该端口的程序。' }
    $owner = Get-CimInstance Win32_Process -Filter ('ProcessId = ' + $listener.OwningProcess)
    if ($owner.Name -ne 'ChatGPT.exe' -or $owner.CommandLine -notmatch '--remote-debugging-port=19347') {
        throw '端口 19347 已被其他程序占用，请先关闭占用程序。'
    }
} else {
    $running = Get-Process -Name ChatGPT -ErrorAction SilentlyContinue
    if ($running) {
        throw 'GPT/Codex 已经运行。请先完全退出 Beta 和正常版（包括后台进程），再重新双击“打开GPT助手.cmd”。'
    }

    $package = Get-AppxPackage -Name OpenAI.Codex | Select-Object -First 1
    if (-not $package) { throw '未找到正常版 ChatGPT（OpenAI.Codex），请先安装或修复正常版。' }
    $clientExe = Join-Path $package.InstallLocation 'app\ChatGPT.exe'
    if (-not (Test-Path -LiteralPath $clientExe)) { throw '正常版 ChatGPT 的启动文件不存在，请修复应用安装。' }

    $clientProcess = Start-Process -FilePath $clientExe -ArgumentList '--remote-debugging-address=127.0.0.1',('--remote-debugging-port=' + $port) -WindowStyle Normal -PassThru
    $clientProcess.Id | Set-Content -LiteralPath (Join-Path $companionRoot 'manual-client-pid.txt')
}

$deadline = (Get-Date).AddSeconds(60)
$pageReady = $false
do {
    try {
        $targets = Invoke-RestMethod -Uri ('http://127.0.0.1:' + $port + '/json/list') -TimeoutSec 1
        $pageReady = @($targets | Where-Object { $_.type -eq 'page' -and $_.url -eq 'app://-/index.html' }).Count -gt 0
    } catch { $pageReady = $false }
    if (-not $pageReady) { Start-Sleep -Milliseconds 400 }
} while (-not $pageReady -and (Get-Date) -lt $deadline)

if (-not $pageReady) { throw '正常版 ChatGPT 尚未准备好。请关闭它后重新运行启动器。' }

Push-Location $companionRoot
try {
    & node (Join-Path $companionRoot 'inject.cjs') --port=19347 --state-file=branch-state.json
    if ($LASTEXITCODE -ne 0) { throw 'GPT助手连接失败，请查看上面的错误提示。' }
} finally {
    Pop-Location
}