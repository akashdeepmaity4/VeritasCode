$css = Get-Content -Raw "d:\projects\VeritasCode\static\css\style.css"
$html = (Get-Content -Raw "d:\projects\VeritasCode\templates\index.html") + (Get-Content -Raw "d:\projects\VeritasCode\templates\apiform.html")
$js   = Get-Content -Raw "d:\projects\VeritasCode\static\js\main.js"
$haystack = $html + "`n" + $js

$matches = [regex]::Matches($css, '\.([a-zA-Z][a-zA-Z0-9_-]*)')
$classes = $matches | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique

foreach ($c in $classes) {
  $pattern = '(?<![\w-])' + [regex]::Escape($c) + '(?![\w-])'
  if (-not ($haystack -match $pattern)) {
    Write-Output "DEAD: .$c"
  }
}