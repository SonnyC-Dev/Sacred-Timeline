<#
Minimal static file server, localhost only. Stand-in for `python -m http.server`
on machines without Python.

    powershell -ExecutionPolicy Bypass -File serve.ps1 [-Root .] [-Port 8000]
#>
param([string]$Root = ".", [int]$Port = 8000)
$ErrorActionPreference = "Stop"
$Root = (Resolve-Path $Root).Path
$types = @{ ".html" = "text/html; charset=utf-8"; ".css" = "text/css; charset=utf-8"; ".js" = "text/javascript; charset=utf-8";
            ".json" = "application/json; charset=utf-8"; ".jpg" = "image/jpeg"; ".jpeg" = "image/jpeg"; ".png" = "image/png";
            ".webp" = "image/webp"; ".svg" = "image/svg+xml"; ".ico" = "image/x-icon"; ".webmanifest" = "application/manifest+json" }
$l = New-Object System.Net.HttpListener
$l.Prefixes.Add("http://localhost:$Port/")
$l.Start()
Write-Host "Serving $Root at http://localhost:$Port/"
while ($l.IsListening) {
  $ctx = $l.GetContext(); $res = $ctx.Response
  try {
    $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
    if ($rel -eq "") { $rel = "index.html" }
    $path = [IO.Path]::GetFullPath((Join-Path $Root $rel))
    if (-not $path.StartsWith($Root, [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path $path -PathType Leaf)) {
      $res.StatusCode = 404; $bytes = [Text.Encoding]::UTF8.GetBytes("not found")
    } else {
      $ext = [IO.Path]::GetExtension($path).ToLower()
      $res.ContentType = $(if ($types[$ext]) { $types[$ext] } else { "application/octet-stream" })
      $res.Headers.Add("Cache-Control", "no-store")
      $bytes = [IO.File]::ReadAllBytes($path)
    }
    Write-Host ("{0} {1} {2}" -f $res.StatusCode, $ctx.Request.HttpMethod, $ctx.Request.Url.AbsolutePath)
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
  } catch { Write-Host "error: $_" } finally { $res.Close() }
}
