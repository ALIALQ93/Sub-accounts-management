# Voucher Workflow (Implementation Step)

## 1) Header Setup

User creates voucher header with:

- `voucher_type`: `receipt` | `payment` | `settlement`
- `settlement_mode`: `account` | `invoice`
- Date + description
- Optional party reference (`customer_id` or `vendor_id`)

## 2) Build Voucher Lines

User adds debit/credit lines by account selection only.

Rules:

- Use active, postable (leaf) accounts only
- Keep totals balanced before posting
- Parent accounts are never selectable in line entry

## 3) Optional Allocation Step

Only for `settlement_mode = invoice`:

- User selects open target movements
- Adds one or more allocations in `voucher_allocations`
- Allocation totals should match intended closing amount

## 4) Approval

Voucher status becomes `approved` after review.

## 5) Post

When posting:

- Validate debit = credit
- Validate non-empty lines
- Validate allocation rows exist for invoice mode
- Generate and link journal entry automatically
- Lock voucher/lines/allocations from further edits

## 6) Reversal

If correction is needed:

- No direct edit on posted voucher
- Use reversal action to create opposite movement

## UI Notes (from DESIGN.md direction)

- RTL-first layout
- Dense data table for lines with sticky headers
- Monospace numeric columns for amounts
- Status chips for `draft`, `approved`, `posted`, `cancelled`
