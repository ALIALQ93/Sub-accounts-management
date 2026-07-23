# Regenerates setup_all.sql from base schema + all functional patches.
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path

$patchFiles = @(
    'patch_branches.sql',
    'patch_materials_minimal.sql',
    'patch_company_inventory.sql',
    'patch_journal_dimensions.sql',
    'patch_invoices.sql',
    'patch_invoice_seeds.sql',
    'patch_invoice_reservation_discount.sql',
    'patch_invoice_discount_rounding.sql',
    'patch_settlement_foundation.sql',
    'patch_post_invoice.sql',
    'patch_invoice_multiple_references.sql',
    'patch_invoice_reference_close.sql',
    'patch_opening_entry.sql',
    'patch_trial_balance_opening.sql',
    'patch_accounting_periods.sql',
    'patch_period_enforcement.sql',
    'patch_inventory_reports.sql',
    'patch_inventory_phase2.sql',
    'patch_inventory_phase3.sql',
    'patch_inventory_phase4.sql',
    'patch_inventory_phase5.sql',
    'patch_inventory_phase6.sql',
    'patch_inventory_phase7.sql',
    'patch_audit_fixes.sql',
    'patch_voucher_allocation_cap.sql',
    'patch_voucher_line_cc_optional.sql',
    'patch_reverse_voucher_rpc.sql',
    'patch_voucher_atomic_ops.sql',
    'patch_reverse_invoice_settlement.sql',
    'patch_audit_remaining.sql',
    'patch_materials_item_card.sql',
    'patch_materials_tracking.sql',
    'patch_invoice_line_adjustments.sql',
    'patch_expiry_from_invoice.sql',
    'patch_invoice_pattern_tracking.sql',
    'patch_outbound_stock_check.sql',
    'patch_outbound_lot_stock.sql',
    'patch_inventory_cost_dimensions.sql',
    'patch_invoice_pricing_cost.sql',
    'patch_audit_governance_security.sql',
    'patch_revoke_anon_table_access.sql',
    'patch_create_material_with_base_unit.sql',
    'patch_materials_card_v2.sql',
    'patch_pos_points.sql',
    'patch_materials_warehouses_audit_fix.sql',
    'patch_invoice_material_require_base_unit.sql',
    'patch_invoices_audit_fix.sql'
)

$out = Join-Path $here 'setup_all.sql'
$sb = New-Object System.Text.StringBuilder

$headerPath = Join-Path $here 'setup_all_header.sql'
$footerPath = Join-Path $here 'setup_all_footer.sql'
[void]$sb.Append((Get-Content -LiteralPath $headerPath -Raw -Encoding UTF8))

foreach ($name in @('00_reset.sql', '01_schema.sql', '02_rls.sql')) {
    $path = Join-Path $here $name
    if (-not (Test-Path $path)) { throw "Missing $path" }
    [void]$sb.Append((Get-Content -LiteralPath $path -Raw -Encoding UTF8))
    [void]$sb.Append("`n")
}

foreach ($name in $patchFiles) {
    $path = Join-Path $here $name
    if (-not (Test-Path $path)) { throw "Missing patch $path" }
    [void]$sb.Append("-- =============================================================================`n")
    [void]$sb.Append("-- BEGIN $name`n")
    [void]$sb.Append("-- =============================================================================`n")
    [void]$sb.Append((Get-Content -LiteralPath $path -Raw -Encoding UTF8))
    [void]$sb.Append("`n")
}

$storagePath = Join-Path $here '06_storage.sql'
if (-not (Test-Path $storagePath)) { throw "Missing $storagePath" }
[void]$sb.Append((Get-Content -LiteralPath $storagePath -Raw -Encoding UTF8))
[void]$sb.Append((Get-Content -LiteralPath $footerPath -Raw -Encoding UTF8))

[System.IO.File]::WriteAllText($out, $sb.ToString(), (New-Object System.Text.UTF8Encoding $true))
Write-Host "Wrote $out ($((Get-Item $out).Length) bytes)"
