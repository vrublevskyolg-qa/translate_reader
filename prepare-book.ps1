# Готує книжку до читання в браузері з перекладом.
# Джерело: .chm файл або папка з HTML-сторінками (наприклад, розпакований EPUB).
#
#   powershell -ExecutionPolicy Bypass -File prepare-book.ps1 "C:\Books\book.chm"
#   powershell -ExecutionPolicy Bypass -File prepare-book.ps1 "C:\Books\book.chm" -Out "C:\Books\book_reader"
param(
  [Parameter(Mandatory = $true)][string]$Source,
  [string]$Out
)
$ErrorActionPreference = 'Stop'

$Source = (Resolve-Path -LiteralPath $Source).Path
if (-not $Out) {
  $Out = Join-Path (Split-Path $Source) ([IO.Path]::GetFileNameWithoutExtension($Source) + '_reader')
}
New-Item -ItemType Directory -Force -Path $Out | Out-Null
$Out = (Resolve-Path -LiteralPath $Out).Path

# ---------- 1. Розпакування ----------
if (Test-Path -LiteralPath $Source -PathType Leaf) {
  # hh.exe погано працює з пробілами й спецсимволами в шляхах — розпаковуємо в тимчасову папку
  $tmp = Join-Path $env:TEMP ('book_' + [guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $tmp | Out-Null
  Copy-Item -LiteralPath $Source -Destination (Join-Path $tmp 'book.chm')
  Start-Process hh.exe -ArgumentList '-decompile', 'out', 'book.chm' -WorkingDirectory $tmp -Wait
  if (-not (Test-Path (Join-Path $tmp 'out'))) { throw 'Не вдалося розпакувати CHM (hh.exe нічого не створив).' }
  Copy-Item -Path (Join-Path $tmp 'out\*') -Destination $Out -Recurse -Force
  Remove-Item -Recurse -Force $tmp
} else {
  Copy-Item -Path (Join-Path $Source '*') -Destination $Out -Recurse -Force
}

# ---------- 2. Файли рідера ----------
$assets = Join-Path $Out 'reader'
New-Item -ItemType Directory -Force -Path $assets | Out-Null
Copy-Item (Join-Path $PSScriptRoot 'reader\translate.js'), (Join-Path $PSScriptRoot 'reader\reader.css') $assets -Force
Copy-Item (Join-Path $PSScriptRoot 'reader\phone-server.bat') $Out -Force

# ---------- 3. Підключення рідера до кожної сторінки ----------
# Latin-1 читає й пише байти без змін, тож кодування сторінки не псується (ми додаємо лише ASCII).
$latin = [Text.Encoding]::GetEncoding(28591)
$pages = Get-ChildItem -LiteralPath $Out -Recurse -File |
  Where-Object { $_.Extension -in '.htm', '.html', '.xhtml' -and $_.DirectoryName -ne $assets }
$n = 0
foreach ($p in $pages) {
  $c = [IO.File]::ReadAllText($p.FullName, $latin)
  if ($c -match 'reader/translate\.js') { continue }
  $depth = @($p.DirectoryName.Substring($Out.Length).Split('\') | Where-Object { $_ }).Count
  $rel = ('../' * $depth) + 'reader/'
  $head = '<meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" type="text/css" href="' + $rel + 'reader.css">'
  $script = '<script src="' + $rel + 'translate.js" charset="utf-8"></script>'
  if ($c -match '(?i)</head>') { $c = ([regex]'(?i)</head>').Replace($c, "$head</head>", 1) } else { $c = $head + $c }
  $i = $c.ToLower().LastIndexOf('</body>')
  if ($i -ge 0) { $c = $c.Insert($i, $script) } else { $c += $script }
  [IO.File]::WriteAllText($p.FullName, $c, $latin)
  $n++
}

# ---------- 4. Стартова сторінка ----------
$first = $null
$hhc = Get-ChildItem -LiteralPath $Out -Filter *.hhc | Select-Object -First 1
if ($hhc) {
  $m = [regex]::Match([IO.File]::ReadAllText($hhc.FullName, $latin), '(?i)name="Local"\s+value="([^"]+)"')
  if ($m.Success) { $first = $m.Groups[1].Value -replace '\\', '/' }
}
if (-not $first) {
  $f = $pages | Sort-Object FullName | Select-Object -First 1
  if ($f) { $first = $f.FullName.Substring($Out.Length + 1) -replace '\\', '/' }
}
$startName = if (Test-Path (Join-Path $Out 'index.html')) { 'start.html' } else { 'index.html' }
if ($first) {
  $html = '<!doctype html><meta charset="utf-8"><title>Book</title><meta http-equiv="refresh" content="0; url=' + $first + '"><a href="' + $first + '">Open the book</a>'
  [IO.File]::WriteAllText((Join-Path $Out $startName), $html, (New-Object Text.UTF8Encoding $false))
}

Write-Host ""
Write-Host "Готово: підключено рідер до $n сторінок."
Write-Host "Відкрийте: $(Join-Path $Out $startName)"
Write-Host "Для телефона запустіть: $(Join-Path $Out 'phone-server.bat')"
