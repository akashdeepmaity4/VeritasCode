# Powershell script to test Monaco CDN

$Version = '0.45.0'
$Bases = @(
  "https://cdn.jsdelivr.net/npm/monaco-editor@$Version/min/vs",
  "https://unpkg.com/monaco-editor@$Version/min/vs",
  "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/$Version/min/vs"
)

$Chain = @(
  'loader.js',
  'editor/editor.main.js',
  'editor/editor.main.nls.js',
  'base/worker/workerMain.js'
)

$allOk = $true
foreach ($base in $Bases) {
  Write-Output "---- $base ----"
  foreach ($file in $Chain) {
    $url = "$base/$file"
    try {
      $resp = Invoke-WebRequest -Uri $url -Method Head -UseBasicParsing -TimeoutSec 10
      Write-Output ("  OK   {0}  {1}" -f $resp.StatusCode, $file)
    } catch {
      Write-Output ("  ERR  {0}  {1}" -f $_.Exception.Message, $file)
      $allOk = $false
    }
  }
}
Write-Output ("ALL_OK={0}" -f $allOk)
if (-not $allOk) { exit 1 }