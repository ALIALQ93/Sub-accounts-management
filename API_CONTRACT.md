# Accounting API Contract (Draft v1)

This contract defines the next implementation step before running DB scripts on Supabase.
It is designed around account-based vouchers with optional invoice settlement allocations.

## General

- Base path: `/api/v1`
- All dates: `YYYY-MM-DD`
- Money fields: decimal with 2 fraction digits
- Voucher status flow: `draft -> approved -> posted`
- Posted voucher is immutable; use reversal flow

## Accounts

### `GET /accounts/tree`

Returns account hierarchy for selection UI.

### `POST /accounts`

Create account node.

Request body:

```json
{
  "code": "110101",
  "name_ar": "الصندوق",
  "parent_id": "uuid-or-null",
  "is_postable": true,
  "is_active": true
}
```

### `PATCH /accounts/:id`

Update account metadata (`name_ar`, `is_active`, etc.).

### `DELETE /accounts/:id`

Delete only if account has no children and no journal usage.

## Vouchers

### `GET /vouchers`

Query params:

- `status`
- `voucher_type` (`receipt`, `payment`, `settlement`)
- `settlement_mode` (`account`, `invoice`)
- `date_from`, `date_to`
- `q` (voucher number or description)

### `POST /vouchers`

Create voucher header only.

```json
{
  "voucher_no": "RCP-2026-0001",
  "voucher_type": "receipt",
  "settlement_mode": "account",
  "voucher_date": "2026-07-01",
  "description": "قبض نقدي",
  "customer_id": null,
  "vendor_id": null
}
```

### `GET /vouchers/:id`

Returns header + lines + allocations + generated journal reference (if posted).

### `PATCH /vouchers/:id`

Allowed only before posting:

- `description`
- `voucher_date`
- `status` (`draft`, `approved`)
- party references (`customer_id`, `vendor_id`)

### `DELETE /vouchers/:id`

Allowed only when not posted.

## Voucher Lines

### `POST /vouchers/:id/lines`

```json
{
  "account_id": "uuid",
  "side": "debit",
  "amount": 600.0,
  "line_description": "تحصيل جزئي"
}
```

### `PATCH /vouchers/:id/lines/:lineId`

Allowed only when voucher is not posted.

### `DELETE /vouchers/:id/lines/:lineId`

Allowed only when voucher is not posted.

## Voucher Allocations (Invoice Mode)

### `POST /vouchers/:id/allocations`

Only valid when voucher `settlement_mode = invoice`.

```json
{
  "target_journal_line_id": "uuid",
  "applied_amount": 500.0,
  "note": "اغلاق حركة فاتورة جزئي"
}
```

### `PATCH /vouchers/:id/allocations/:allocationId`

Allowed only before posting.

### `DELETE /vouchers/:id/allocations/:allocationId`

Allowed only before posting.

## Posting & Reversal

### `POST /vouchers/:id/post`

Behavior:

- Validates voucher balance from voucher lines
- Requires at least one allocation when `settlement_mode = invoice`
- Creates `journal_entries` + `journal_entry_lines`
- Sets voucher `status = posted`
- Links generated journal (`journal_entry_id`)

Response:

```json
{
  "voucher_id": "uuid",
  "status": "posted",
  "journal_entry_id": "uuid",
  "journal_entry_no": "JE-RCP-2026-0001"
}
```

### `POST /vouchers/:id/reverse`

Creates reversing voucher/journal and marks original as reversed (or linked).

## Journals

### `GET /journals`

Filter by date range, source type, and status.

### `GET /journals/:id`

Returns entry header + lines.

## Common Error Codes

- `ACCOUNT_HAS_CHILDREN`
- `ACCOUNT_USED_IN_JOURNALS`
- `ACCOUNT_NOT_POSTABLE`
- `ACCOUNT_INACTIVE`
- `VOUCHER_UNBALANCED`
- `VOUCHER_EMPTY`
- `VOUCHER_ALREADY_POSTED`
- `VOUCHER_ALLOCATIONS_REQUIRED`
- `VOUCHER_INVOICE_MODE_INVALID`
- `PARTY_REFERENCE_INVALID`
