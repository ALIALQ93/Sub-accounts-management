# Builds setup_demo_restaurant.sql = demo header + full setup_all + restaurant seed.
# Usage: powershell -File database/build_setup_demo_restaurant.ps1
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$utf8Bom = New-Object System.Text.UTF8Encoding $true

& (Join-Path $here 'build_setup_all.ps1')

$demoHeaderPath = Join-Path $here 'setup_demo_restaurant_header.sql'
$setupAll = Join-Path $here 'setup_all.sql'
$demo = Join-Path $here 'demo_restaurant.sql'
$out = Join-Path $here 'setup_demo_restaurant.sql'

foreach ($path in @($demoHeaderPath, $setupAll, $demo)) {
    if (-not (Test-Path $path)) { throw "Missing $path" }
}

$separator = @"

-- =============================================================================
-- BEGIN demo_restaurant.sql (restaurant demo seed for client demos)
-- =============================================================================

"@

$content =
    [System.IO.File]::ReadAllText($demoHeaderPath, $utf8Bom) +
    "`n" +
    [System.IO.File]::ReadAllText($setupAll, $utf8Bom) +
    $separator +
    [System.IO.File]::ReadAllText($demo, $utf8Bom) +
    "`n"

[System.IO.File]::WriteAllText($out, $content, $utf8Bom)
$len = (Get-Item $out).Length
Write-Host "Wrote $out ($len bytes)"
