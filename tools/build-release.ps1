param(
    [string]$OutputDirectory,
    [string]$WorkDirectory
)
$ErrorActionPreference='Stop'
$repoRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if (-not $OutputDirectory) { $OutputDirectory=Join-Path $repoRoot '..\releases' }
$outputRoot=[IO.Path]::GetFullPath($OutputDirectory)
$dirty=@(& git -C $repoRoot status --porcelain)
if ($LASTEXITCODE -ne 0 -or $dirty.Count) { throw 'Build a release only from a clean committed repository.' }
$commitId=(& git -C $repoRoot rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Cannot resolve the release commit.' }
$package=Get-Content -LiteralPath (Join-Path $repoRoot 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$releaseVersion=$package.version
if ($releaseVersion -notmatch '^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$') { throw 'Invalid release version.' }
if (-not $WorkDirectory) { $WorkDirectory=Join-Path ([IO.Path]::GetTempPath()) ('gpt-assistant-release-'+[guid]::NewGuid().ToString('N')) }
$stageRoot=[IO.Path]::GetFullPath($WorkDirectory)
if (Test-Path -LiteralPath $stageRoot) { throw 'The staging directory must be new.' }
$bundleName='gpt-assistant-v'+$releaseVersion
$bundleRoot=Join-Path $stageRoot $bundleName
$appRoot=Join-Path $bundleRoot 'app'
New-Item -ItemType Directory -Path $appRoot,$outputRoot -Force | Out-Null
$zipName=$bundleName+'-windows.zip'
$zipPath=Join-Path $outputRoot $zipName
$checksumPath=Join-Path $outputRoot ($bundleName+'-SHA256SUMS.txt')
if ((Test-Path -LiteralPath $zipPath) -or (Test-Path -LiteralPath $checksumPath)) { throw 'Release outputs already exist; refusing to overwrite them.' }
$runtimeFiles=@(
    'assistant.config.cjs','bookmark-store.cjs','bookmarks.js','cdp.cjs',
    'companion.js','handoff.cjs','inject.cjs',
    'launch-gpt-assistant.ps1','start-client.ps1'
)
foreach ($name in $runtimeFiles) {
    Copy-Item -LiteralPath (Join-Path $repoRoot $name) -Destination (Join-Path $appRoot $name)
}
$runtimePackage=[ordered]@{name=$package.name;version=$releaseVersion;private=$true;license=$package.license;engines=$package.engines;description=$package.description}
[IO.File]::WriteAllText((Join-Path $appRoot 'package.json'),($runtimePackage | ConvertTo-Json -Depth 5),[Text.UTF8Encoding]::new($false))
$entry=@('@echo off','setlocal','title GPT Assistant','powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0app\launch-gpt-assistant.ps1"','if errorlevel 1 pause','') -join [Environment]::NewLine
[IO.File]::WriteAllText((Join-Path $bundleRoot '打开GPT助手.cmd'),$entry,[Text.Encoding]::ASCII)
$intro=[IO.File]::ReadAllText((Join-Path $repoRoot 'docs\发布包说明.md')).Replace('{{VERSION}}',$releaseVersion)
[IO.File]::WriteAllText((Join-Path $bundleRoot '功能简介与使用说明.md'),$intro,[Text.UTF8Encoding]::new($false))
Copy-Item -LiteralPath (Join-Path $repoRoot 'LICENSE') -Destination (Join-Path $bundleRoot 'LICENSE')
$manifest=[ordered]@{name='GPT助手';version=$releaseVersion;commit=$commitId;files=@()}
foreach ($name in @($runtimeFiles+'package.json')) {
    $manifest.files+=@{path='app/'+$name;sha256=(Get-FileHash -LiteralPath (Join-Path $appRoot $name) -Algorithm SHA256).Hash.ToLowerInvariant()}
}
[IO.File]::WriteAllText((Join-Path $appRoot 'release.json'),($manifest | ConvertTo-Json -Depth 5),[Text.UTF8Encoding]::new($false))
Add-Type -AssemblyName System.IO.Compression.FileSystem
[IO.Compression.ZipFile]::CreateFromDirectory($stageRoot,$zipPath,[IO.Compression.CompressionLevel]::Optimal,$false)
$checksum=(Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
[IO.File]::WriteAllText($checksumPath,($checksum+'  '+$zipName+[char]10),[Text.Encoding]::ASCII)
Write-Output ('Release: '+$zipPath)
Write-Output ('Commit: '+$commitId)
Write-Output ('SHA256: '+$checksum)
