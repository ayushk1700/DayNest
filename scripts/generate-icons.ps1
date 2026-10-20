Add-Type -AssemblyName System.Drawing
$iconDirectory = Join-Path $PSScriptRoot '../public/icons'
$source = [System.Drawing.Bitmap]::new((Join-Path $iconDirectory 'daynest-sunflower.png'))
try {
  foreach ($size in @(16, 32, 48, 128)) {
    $bitmap = [System.Drawing.Bitmap]::new($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
      $graphics.Clear([System.Drawing.Color]::Transparent)
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
      $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
      $graphics.DrawImage($source, [System.Drawing.Rectangle]::new(0, 0, $size, $size), 0, 0, $source.Width, $source.Height, [System.Drawing.GraphicsUnit]::Pixel)
      $bitmap.Save((Join-Path $iconDirectory "icon-$size.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
      $graphics.Dispose()
      $bitmap.Dispose()
    }
  }
  Copy-Item -LiteralPath (Join-Path $iconDirectory 'icon-32.png') -Destination (Join-Path $iconDirectory 'daynest-favicon.png') -Force
  # Embed the tab icon to avoid resolving an image against edge://newtab.
  $iconData = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes((Join-Path $iconDirectory 'daynest-favicon.png')))
  $htmlPath = Join-Path $PSScriptRoot '../index.html'
  $html = [System.IO.File]::ReadAllText($htmlPath)
  $html = [regex]::Replace($html, '(<link rel="icon"[^>]*href=")[^"]*(")', ('${1}data:image/png;base64,' + $iconData + '${2}'))
  [System.IO.File]::WriteAllText($htmlPath, $html)
} finally {
  $source.Dispose()
}
