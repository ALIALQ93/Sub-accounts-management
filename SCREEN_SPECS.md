# Screen Specs (Voucher Module)

This document defines the implementation-ready UI specifications for:

1. Voucher Form Screen (`receipt` / `payment` / `settlement`)
2. Voucher Allocation Screen (`invoice` settlement mode)

It follows business rules from:

- `ACCOUNTING_RULES.md`
- `API_CONTRACT.md`
- `VOUCHER_WORKFLOW.md`
- `DESIGN.md` (RTL-first visual direction)

---

## 1) Voucher Form Screen

## Screen Purpose

Create, edit, review, and post account-based vouchers with optional party references and voucher lines.

## Route

- Create: `/vouchers/new`
- Edit/View: `/vouchers/:id`

## Layout (RTL)

- Right sidebar: Voucher header and quick totals
- Main area: Voucher lines table
- Bottom action bar: Save / Approve / Post / Reverse / Cancel

## Header Section Fields

- `voucher_no` (text, required, unique, read-only after creation if auto-number enabled)
- `voucher_type` (select, required):
  - `receipt`
  - `payment`
  - `settlement`
- `settlement_mode` (select, required):
  - `account` (default)
  - `invoice`
- `voucher_date` (date, required)
- `status` (chip, read-only): `draft` | `approved` | `posted` | `cancelled`
- `description` (textarea, optional)
- `customer_id` (optional searchable select)
- `vendor_id` (optional searchable select)

## Header Business Rules

- Only one of `customer_id` or `vendor_id` can be set.
- `invoice` mode is allowed only for `receipt` and `payment`.
- If voucher is `posted`, all header fields become read-only.
- In `account` mode, party reference is optional metadata.

## Lines Table

Columns:

- Row number
- Account code
- Account name
- Side (`debit` / `credit`)
- Amount
- Line description
- Actions (edit/delete row)

Toolbar actions:

- Add line
- Duplicate selected line
- Remove selected line

Footer summary:

- Total debit
- Total credit
- Difference indicator (must be 0.00 before posting)

## Lines Validation

- Account must be active and postable (leaf only).
- Amount must be `> 0`.
- Side must be exactly one value (`debit` or `credit`).
- Voucher cannot be posted with zero lines.
- Voucher cannot be posted unless `total_debit = total_credit`.

## Action Buttons by Status

- `draft`:
  - Save Draft
  - Approve
  - Delete
- `approved`:
  - Save
  - Back to Draft
  - Post
- `posted`:
  - Reverse
  - Print
  - View Journal
- `cancelled`:
  - View only

## Posting Preconditions (UI + API)

Before calling `POST /vouchers/:id/post`, UI must check:

- Header required fields are complete
- At least one voucher line exists
- Voucher totals are balanced
- If `settlement_mode = invoice`, at least one allocation exists

## API Integration (Form Screen)

- Load:
  - `GET /vouchers/:id`
  - `GET /accounts/tree`
- Save header:
  - `POST /vouchers` (new)
  - `PATCH /vouchers/:id` (existing)
- Manage lines:
  - `POST /vouchers/:id/lines`
  - `PATCH /vouchers/:id/lines/:lineId`
  - `DELETE /vouchers/:id/lines/:lineId`
- Post:
  - `POST /vouchers/:id/post`
- Reverse:
  - `POST /vouchers/:id/reverse`

## Error Messages (Voucher Form)

- `ACCOUNT_NOT_POSTABLE`: "لا يمكن استخدام حساب اب. اختر حسابا فرعيا نهائيا."
- `ACCOUNT_INACTIVE`: "الحساب غير نشط ولا يمكن الترحيل عليه."
- `VOUCHER_EMPTY`: "لا يمكن ترحيل سند بدون اسطر."
- `VOUCHER_UNBALANCED`: "السند غير متوازن. يجب ان يتساوى المدين مع الدائن."
- `VOUCHER_ALREADY_POSTED`: "السند مرحل مسبقا ولا يمكن تعديله."
- `VOUCHER_INVOICE_MODE_INVALID`: "وضع اغلاق الحركات متاح لسند قبض او دفع فقط."

---

## 2) Voucher Allocation Screen

## Screen Purpose

Manage invoice/open-item allocations for vouchers in `invoice` settlement mode.

## Route

- Embedded tab inside voucher form: `/vouchers/:id?tab=allocations`
- Optional dedicated route: `/vouchers/:id/allocations`

## Visibility Rules

- Shown only when:
  - `settlement_mode = invoice`
  - `voucher_type in (receipt, payment)`

## Screen Sections

1. Left panel: open movements list (filterable)
2. Right panel: selected allocations for current voucher
3. Bottom totals: allocation total vs closing amount target

## Open Movements Grid (Source)

Columns:

- Movement reference
- Date
- Account
- Party (optional)
- Original amount
- Closed amount
- Open amount
- Currency
- Select action

Filters:

- Date range
- Account
- Party
- Open amount min/max
- Search by reference

## Allocations Grid (Target)

Columns:

- Target movement reference
- Applied amount (editable)
- Remaining open after allocation (computed)
- Note
- Remove action

## Allocation Validation

- `applied_amount > 0`
- `applied_amount <= open_amount` for target movement
- No duplicate allocation row for same target unless explicitly merged by UI behavior
- Posted voucher blocks add/edit/delete allocations
- Allocation rows required before posting in invoice mode

## API Integration (Allocation Screen)

- List current allocations:
  - `GET /vouchers/:id`
- Add allocation:
  - `POST /vouchers/:id/allocations`
- Edit allocation:
  - `PATCH /vouchers/:id/allocations/:allocationId`
- Delete allocation:
  - `DELETE /vouchers/:id/allocations/:allocationId`

## Error Messages (Allocation Screen)

- `VOUCHER_ALLOCATIONS_REQUIRED`: "يجب اضافة سطر تخصيص واحد على الاقل قبل الترحيل."
- `PARTY_REFERENCE_INVALID`: "الطرف المحدد غير صالح او غير نشط."
- Generic open-item error: "قيمة التخصيص تتجاوز الرصيد المفتوح للحركة."

---

## UX and Interaction Notes

- Use dense data tables with sticky headers for lines and allocations.
- Numeric amount cells should use monospaced font for alignment.
- Status should always appear as clear chips (`draft`, `approved`, `posted`, `cancelled`).
- In posted state, show lock banner: "هذا السند مرحل. التعديل غير متاح. استخدم العكس."
- Keep primary actions in RTL order with highest priority on the right.

## Frontend State Model (Suggested)

- `voucherHeader`
- `voucherLines[]`
- `voucherAllocations[]`
- `uiTotals { debit, credit, difference, allocationTotal }`
- `uiFlags { isReadOnly, canApprove, canPost, canReverse }`
- `apiErrors[]`

## Acceptance Checklist

- User can create balanced voucher and post successfully.
- User cannot post unbalanced voucher.
- User cannot post empty voucher.
- User cannot use non-postable account in lines.
- User can post invoice-mode voucher only after adding allocations.
- Posted voucher is read-only and supports reverse action.
