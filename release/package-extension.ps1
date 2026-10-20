param([string]$OutputName = 'daynest-0.1.0-candidate.zip')
$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$distRoot = Join-Path $projectRoot 'dist'
$releaseRoot = $PSScriptRoot
$zipPath = Join-Path $releaseRoot $OutputName
if ([System.IO.Path]::GetFileName($OutputName) -ne $OutputName -or -not $OutputName.EndsWith('.zip')) { throw 'Choose a ZIP filename without a directory.' }
if (Test-Path -LiteralPath $zipPath) { throw 'This package exists. Choose a new OutputName to preserve the prior candidate.' }
Push-Location $projectRoot
try {
  & node scripts/verify-build.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Build verification failed.' }
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [System.IO.Compression.ZipFile]::CreateFromDirectory($distRoot, $zipPath, [System.IO.Compression.CompressionLevel]::Optimal, $false)
  $archive = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
  try {
    if (-not ($archive.Entries.FullName -contains 'manifest.json')) { throw 'Manifest is not at the ZIP root.' }
    $files = @(Get-ChildItem -LiteralPath $distRoot -File -Recurse)
    $entries = @($archive.Entries | Where-Object { $_.Name })
    if ($files.Count -ne $entries.Count) { throw 'ZIP file count differs from the verified build.' }
    foreach ($entry in $entries) {
      if ($entry.FullName -match '(^|/)\.git(/|$)|(^|/)node_modules(/|$)|(^|/)src(/|$)|\.map$') { throw "Unexpected development file: $($entry.FullName)" }
      $stream = $entry.Open()
      try { $zipHash = [Convert]::ToHexString([System.Security.Cryptography.SHA256]::HashData($stream)) } finally { $stream.Dispose() }
      $sourceHash = (Get-FileHash -LiteralPath (Join-Path $distRoot $entry.FullName) -Algorithm SHA256).Hash
      if ($zipHash -ne $sourceHash) { throw "Archive mismatch: $($entry.FullName)" }
    }
    $details = [ordered]@{ name = $OutputName; version = (Get-Content -LiteralPath (Join-Path $distRoot 'manifest.json') -Raw | ConvertFrom-Json).version; files = $entries.Count; bytes = (Get-Item -LiteralPath $zipPath).Length; sha256 = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash; manifestAtRoot = $true; allFileHashesMatch = $true; releaseStatus = 'Candidate; external beta and manual release gates remain open' }
    $details | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $releaseRoot ($OutputName + '.json'))
    "$($details.sha256)  $OutputName" | Set-Content -LiteralPath (Join-Path $releaseRoot ($OutputName + '.sha256'))
    $details | ConvertTo-Json
  } finally { $archive.Dispose() }
} finally { Pop-Location }
