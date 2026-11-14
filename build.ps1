<#
Rebuild the single portable file from the split project. PowerShell port of
build.py, for machines without Python.

    powershell -ExecutionPolicy Bypass -File build.ps1 src mcu-tracker.build.html

Inlines the stylesheet, the code and both data blocks, and folds every poster
back in as base64 so the result needs no server. JSON is compacted as text,
never parsed, so values come back exactly as written.
#>
param([Parameter(Mandatory)][string]$Src, [Parameter(Mandatory)][string]$Out)
$ErrorActionPreference = "Stop"
$utf8 = New-Object System.Text.UTF8Encoding $false
$Src = (Resolve-Path $Src).Path
function Read-Src($rel) { [IO.File]::ReadAllText((Join-Path $Src $rel), $utf8) }
$MIME = @{ ".jpg" = "image/jpeg"; ".jpeg" = "image/jpeg"; ".png" = "image/png"; ".webp" = "image/webp" }

# Remove whitespace outside strings: the same output as json.dumps(separators=(",",":")).
function Compress-JsonText([string]$s) {
  $sb = New-Object System.Text.StringBuilder
  $inStr = $false; $esc = $false
  foreach ($ch in $s.ToCharArray()) {
    if ($inStr) {
      if ($esc) { $esc = $false } elseif ($ch -eq '\') { $esc = $true } elseif ($ch -eq '"') { $inStr = $false }
      [void]$sb.Append($ch)
    } elseif ($ch -eq '"') { $inStr = $true; [void]$sb.Append($ch) }
    elseif (-not [char]::IsWhiteSpace($ch)) { [void]$sb.Append($ch) }
  }
  $sb.ToString()
}

$page = Read-Src "index.html"
$css = Read-Src "styles.css"
$js = Read-Src "app.js"
$titles = Compress-JsonText (Read-Src "data\titles.json")
$art = Compress-JsonText (Read-Src "data\artwork.json")

# Fold posters back in. Only "p" values that are local paths are touched;
# data: and http(s) values are left exactly as they are.
$script:folded = 0
$art = ([regex]'"p":"([^"]*)"').Replace($art, {
  param($m)
  $p = $m.Groups[1].Value
  if (-not $p -or $p -match '^(data:|http)') { return $m.Value }
  $path = Join-Path $Src $p
  if (-not (Test-Path $path)) { Write-Host "  missing poster, left as a path: $p"; return $m.Value }
  $mime = $MIME[[IO.Path]::GetExtension($path).ToLower()]; if (-not $mime) { $mime = "image/jpeg" }
  $script:folded++
  "`"p`":`"data:$mime;base64," + [Convert]::ToBase64String([IO.File]::ReadAllBytes($path)) + '"'
})

foreach ($j in $titles, $art) { if ($j.Contains("</script")) { throw "data contains a closing script tag; refusing to build" } }

$page = $page.Replace('<link rel="stylesheet" href="styles.css">', "<style>`n" + $css.Trim() + "`n</style>")
$js = $js.Replace("/*TITLES*/", "/* ==== BEGIN TITLES ==== */`nconst DATA = $titles;`n/* ==== END TITLES ==== */")
$js = $js.Replace("/*ARTWORK*/", "/* ==== BEGIN ARTWORK ==== */`nconst BUILTIN_ART=$art;`n/* ==== END ARTWORK ==== */")
$page = $page.Replace('<script src="app.js"></script>', "<script>`n" + $js.Trim() + "`n</script>")

$outPath = [IO.Path]::GetFullPath((Join-Path (Get-Location) $Out))
[IO.File]::WriteAllText($outPath, $page, $utf8)
"built {0}  ({1:N2} MB, {2} posters inlined)" -f $Out, ($page.Length / 1MB), $script:folded
