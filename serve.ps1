$port = if ($env:PORT) { [int]$env:PORT } else { 3000 }
$root  = "C:\Users\garci\OneDrive\Desktop\Claude Code"
$prefix = "http://localhost:$port/"

$mimeTypes = @{
  '.html'='text/html; charset=utf-8'; '.css'='text/css; charset=utf-8'
  '.js'='application/javascript; charset=utf-8'; '.json'='application/json; charset=utf-8'
  '.png'='image/png'; '.jpg'='image/jpeg'; '.svg'='image/svg+xml'; '.ico'='image/x-icon'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
$listener.Start()
[Console]::Out.WriteLine("Listening on $prefix")
[Console]::Out.Flush()

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  try {
    $localPath = $ctx.Request.Url.LocalPath.TrimStart('/').Replace('/', '\')
    if ($localPath -eq '' -or $localPath -eq '\') { $localPath = 'index.html' }
    $filePath = Join-Path $root $localPath
    if (!(Test-Path $filePath) -or (Get-Item $filePath).PSIsContainer) {
      $filePath = Join-Path $root 'index.html'
    }
    $ext  = [System.IO.Path]::GetExtension($filePath).ToLower()
    $mime = if ($mimeTypes[$ext]) { $mimeTypes[$ext] } else { 'application/octet-stream' }
    $ctx.Response.ContentType = $mime
    $bytes = [System.IO.File]::ReadAllBytes($filePath)
    $ctx.Response.ContentLength64 = $bytes.Length
    $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  } catch {
    $ctx.Response.StatusCode = 404
    $msg = [System.Text.Encoding]::UTF8.GetBytes('404 Not Found')
    $ctx.Response.OutputStream.Write($msg, 0, $msg.Length)
  } finally {
    $ctx.Response.OutputStream.Close()
  }
}
