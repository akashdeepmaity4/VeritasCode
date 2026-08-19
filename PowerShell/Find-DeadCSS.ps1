# Find dead CSS classes: selectors in style.css with no reference in HTML or JS.
$css = Get-Content -Raw "d:\projects\VeritasCode\static\css\style.css"
$html = (Get-Content -Raw "d:\projects\VeritasCode\templates\index.html") + (Get-Content -Raw "d:\projects\VeritasCode\templates\apiform.html")
$js   = Get-Content -Raw "d:\projects\VeritasCode\static\js\main.js"
$haystack = $html + "`n" + $js

# Extract class names from CSS selectors like .foo (not inside var() or comments).
$matches = [regex]::Matches($css, '\.([a-zA-Z][a-zA-Z0-9_-]*)')
$classes = $matches | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique

foreach ($c in $classes) {
  # A class is "used" if it appears as an HTML class attribute value, or in JS
  # (className assignment / classList / querySelector). We search for the bare
  # token surrounded by non-word chars to avoid partial matches.
  $pattern = '(?<![\w-])' + [regex]::Escape($c) + '(?![\w-])'
  if (-not ($haystack -match $pattern)) {
    Write-Output "DEAD: .$c"
  }
}
