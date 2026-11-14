<#
Split mcu-tracker.html into an editable project. PowerShell port of split.py,
for machines without Python. Same inputs, same outputs.

    powershell -ExecutionPolicy Bypass -File split.ps1 mcu-tracker.html src

The JSON is never parsed and re-serialised: it is handled as text, so every
value (runtimes, counts, chronology, escapes) comes out exactly as it went in.
Only whitespace changes, to make it readable (same layout as Python's indent=1).
#>
param([Parameter(Mandatory)][string]$Src, [Parameter(Mandatory)][string]$Out)
$ErrorActionPreference = "Stop"
$utf8 = New-Object System.Text.UTF8Encoding $false
$Src = (Resolve-Path $Src).Path
New-Item -ItemType Directory -Force (Join-Path $Out "data"), (Join-Path $Out "assets\posters") | Out-Null
$Out = (Resolve-Path $Out).Path
function W($rel, $text) { [IO.File]::WriteAllText((Join-Path $Out $rel), $text, $utf8) }

# Pretty-print JSON text without parsing it: indent 1, ": " after keys.
function Format-JsonText([string]$s) {
  $sb = New-Object System.Text.StringBuilder
  $depth = 0; $inStr = $false; $esc = $false
  for ($i = 0; $i -lt $s.Length; $i++) {
    $ch = $s[$i]
    if ($inStr) {
      [void]$sb.Append($ch)
      if ($esc) { $esc = $false } elseif ($ch -eq '\') { $esc = $true } elseif ($ch -eq '"') { $inStr = $false }
      continue
    }
    switch ($ch) {
      '"' { $inStr = $true; [void]$sb.Append($ch) }
      { $_ -eq '{' -or $_ -eq '[' } {
        $next = $s[$i + 1]
        if (($ch -eq '{' -and $next -eq '}') -or ($ch -eq '[' -and $next -eq ']')) { [void]$sb.Append($ch).Append($next); $i++ }
        else { $depth++; [void]$sb.Append($ch).Append("`n").Append(' ' * $depth) }
      }
      { $_ -eq '}' -or $_ -eq ']' } { $depth--; [void]$sb.Append("`n").Append(' ' * $depth).Append($ch) }
      ',' { [void]$sb.Append(",`n").Append(' ' * $depth) }
      ':' { [void]$sb.Append(': ') }
      { [char]::IsWhiteSpace($_) } { }
      default { [void]$sb.Append($ch) }
    }
  }
  $sb.ToString()
}

$html = [IO.File]::ReadAllText($Src, $utf8)
$S = [Text.RegularExpressions.RegexOptions]::Singleline

function Get-Block($name, $decl) {
  $m = [regex]::Match($html, "/\* ==== BEGIN $name ==== \*/\s*$decl\s*(.*?);\s*/\* ==== END $name ==== \*/", $S)
  if (-not $m.Success) { throw "missing data block: $name" }
  $m
}
$titlesM = Get-Block "TITLES" "const DATA ="
$artM = Get-Block "ARTWORK" "const BUILTIN_ART="

# Posters come out as real files. Every entry in the original is {"p":"data:...", ...},
# keyed by title id; the poster file is named after that id.
$script:saved = 0
$posterRx = [regex]'"([^"]+)":\{"p":"data:image/([a-z]+);base64,([^"]*)"'
$art = $posterRx.Replace($artM.Groups[1].Value, {
  param($m)
  $key = $m.Groups[1].Value; $kind = $m.Groups[2].Value
  $name = "$key." + $(if ($kind -eq "jpeg") { "jpg" } else { $kind })
  [IO.File]::WriteAllBytes((Join-Path $Out "assets\posters\$name"), [Convert]::FromBase64String($m.Groups[3].Value))
  $script:saved++
  "`"$key`":{`"p`":`"assets/posters/$name`""
})
if ($art -match 'data:image/') { throw "a poster was not in the expected shape; nothing should be left embedded" }

$css = [regex]::Match($html, "<style>(.*?)</style>", $S)
$jsAll = [regex]::Matches($html, "<script>(.*?)</script>", $S)
$js = $jsAll[$jsAll.Count - 1].Groups[1].Value

W "data\titles.json" (Format-JsonText $titlesM.Groups[1].Value)
W "data\artwork.json" (Format-JsonText $art)
W "styles.css" ($css.Groups[1].Value.Trim() + "`n")
# the data markers sit inside the script, so strip them there, not in the page
$jsOut = $js.Replace($titlesM.Value, "/*TITLES*/").Replace($artM.Value, "/*ARTWORK*/")
W "app.js" ($jsOut.Trim() + "`n")

$page = $html.Replace($css.Value, '<link rel="stylesheet" href="styles.css">')
$page = $page.Replace("<script>" + $js + "</script>", '<script src="app.js"></script>')
if (-not $page.Contains('<script src="app.js">')) { throw "could not detach the script" }
W "index.html" $page

$count = ([regex]::Matches($titlesM.Groups[1].Value, '"id":')).Count
"split into $Out"
"  titles: $count   posters written: $($script:saved)"
"  app.js expects the data to be injected; use build.ps1 to produce a runnable file."
