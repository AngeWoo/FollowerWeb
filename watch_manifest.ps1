# Background watcher: monitors DOC\notice, DOC\calendar, DOC\download and auto-updates DOC\manifest.json
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$manifestPath = Join-Path $root 'DOC\manifest.json'
$utf8NoBom = New-Object System.Text.UTF8Encoding $false

function Get-ManifestJson {
  $out = [ordered]@{}
  foreach ($sec in 'notice','calendar','download') {
    $dir = Join-Path $root "DOC\$sec"
    if ($sec -eq 'calendar' -and -not (Test-Path -LiteralPath $dir)) {
      $alt = Join-Path $root "DOC\calender"
      if (Test-Path -LiteralPath $alt) { $dir = $alt }
    }
    $items = @()
    if (Test-Path -LiteralPath $dir) {
      $items = @(Get-ChildItem -LiteralPath $dir -File -ErrorAction SilentlyContinue |
        Where-Object { $_.Extension -match '^\.(pdf|docx?)$' -and -not $_.Name.StartsWith('.') } |
        Sort-Object Name |
        ForEach-Object {
          [pscustomobject]@{
            name = $_.BaseName
            file = $_.Name
            ext  = $_.Extension.TrimStart('.').ToLower()
            size = [int64]$_.Length
            date = $_.LastWriteTime.ToString('yyyy-MM-dd')
          }
        })
    }
    $out[$sec] = $items
  }
  return ($out | ConvertTo-Json -Depth 4 -Compress)
}

$lastJson = ''
if (Test-Path -LiteralPath $manifestPath) {
  try { $lastJson = [IO.File]::ReadAllText($manifestPath, $utf8NoBom) } catch {}
}

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host " Watching DOC\ (notice, calendar, download)..." -ForegroundColor Cyan
Write-Host " Any added/removed/renamed files will update DOC\manifest.json automatically." -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

$firstRun = $true
while ($true) {
  try {
    $currentJson = Get-ManifestJson
    if ($firstRun -or ($currentJson -ne $lastJson)) {
      $tmpPath = "$manifestPath.tmp"
      [IO.File]::WriteAllText($tmpPath, $currentJson, $utf8NoBom)
      Move-Item -LiteralPath $tmpPath -Destination $manifestPath -Force
      $lastJson = $currentJson
      $firstRun = $false
      $ts = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
      Write-Host "[$ts] Updated DOC\manifest.json" -ForegroundColor Green
    }
  } catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Yellow
  }
  Start-Sleep -Seconds 2
}
