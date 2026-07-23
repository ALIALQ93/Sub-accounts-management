# Builds setup_demo_restaurant.sql = full setup_all + restaurant demo seed.
# Usage: powershell -File database/build_setup_demo_restaurant.ps1
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path

& (Join-Path $here 'build_setup_all.ps1')

$setupAll = Join-Path $here 'setup_all.sql'
$demo = Join-Path $here 'demo_restaurant.sql'
$out = Join-Path $here 'setup_demo_restaurant.sql'

if (-not (Test-Path $setupAll)) { throw "Missing $setupAll" }
if (-not (Test-Path $demo)) { throw "Missing $demo" }

$header = @"

-- =============================================================================
-- BEGIN demo_restaurant.sql (restaurant demo seed for client demos)
-- =============================================================================

"@

$content = (Get-Content -LiteralPath $setupAll -Raw -Encoding UTF8) + $header + (Get-Content -LiteralPath $demo -Raw -Encoding UTF8) + "`n"
[System.IO.File]::WriteAllText($out, $content, (New-Object System.Text.UTF8Encoding $true))
$len = (Get-Item $out).Length
Write-Host "Wrote $out ($len bytes)"
