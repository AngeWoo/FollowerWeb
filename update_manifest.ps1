# Run on the web server: scans DOC\notice, DOC\calendar, DOC\download and writes DOC\manifest.json
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$out = [ordered]@{}
foreach ($sec in 'notice','calendar','download') {
  $dir = Join-Path $root "DOC\$sec"
  if ($sec -eq 'calendar' -and -not (Test-Path -LiteralPath $dir)) {
    $alt = Join-Path $root "DOC\calender"
    if (Test-Path -LiteralPath $alt) { $dir = $alt }
  }
  $items = @()
  if (Test-Path -LiteralPath $dir) {
    $items = @(Get-ChildItem -LiteralPath $dir -File |
      Where-Object { $_.Extension -match '^\.(pdf|docx?)$' -and -not $_.Name.StartsWith('.') } |
      ForEach-Object {
        [pscustomobject]@{ name = $_.BaseName; file = $_.Name; ext = $_.Extension.TrimStart('.').ToLower();
                           size = [int64]$_.Length; date = $_.LastWriteTime.ToString('yyyy-MM-dd') } })
  }
  $out[$sec] = $items
}
$json = $out | ConvertTo-Json -Depth 4
[IO.File]::WriteAllText((Join-Path $root 'DOC\manifest.json'), $json, (New-Object System.Text.UTF8Encoding $false))
Write-Host "Done: DOC\manifest.json"
foreach ($k in $out.Keys) { Write-Host ("  {0}: {1} file(s)" -f $k, @($out[$k]).Count) }
