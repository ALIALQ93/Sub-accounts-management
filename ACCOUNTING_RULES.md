# Accounting Chart Business Rules

This document defines the enforced rules for the chart of accounts and auto-generated journal postings.

## Account Tree Rules

- The chart starts with 7 root accounts:
  - `1` الموجودات
  - `2` الالتزامات
  - `3` حقوق الملكية
  - `4` المبيعات
  - `5` المشتريات
  - `6` المصاريف
  - `7` الايرادات
- User can add sub-accounts under any root or branch account.
- Parent accounts must be non-postable (`is_postable = false`).
- Leaf accounts can be postable (`is_postable = true`).
- Journal entries are allowed only on postable accounts.
- Circular hierarchy is forbidden (account cannot become parent/child of itself by loop).

## Deletion and Archiving Rules

- Account deletion is blocked when account has child accounts.
- Account deletion is blocked when account is used in any journal line.
- Recommended operational behavior is deactivation (`is_active = false`) instead of hard delete.

## Journal Rules

- Journals are generated automatically from vouchers (`receipt`, `payment`, `settlement`).
- Voucher lines are the source of truth for the generated journal lines.
- Journal line must use exactly one side: debit or credit.
- Journal can be posted only if total debit equals total credit.
- Empty journal cannot be posted.
- Inactive accounts cannot receive journal lines.

## Recommended API/Workflow Behavior

- Voucher goes through statuses: `draft -> approved -> posted`.
- On `posted`, system creates journal entry and lines automatically.
- Posted voucher/accounting record should be reversed, not edited directly.
- Posted voucher and posted voucher lines are locked (no update/delete).
- Voucher is linked one-to-one with generated journal entry (`journal_entry_id`).

## Parties (Customers/Vendors) Rules

- Voucher can be created directly by accounts without mandatory customer/vendor.
- Customer/vendor reference is optional metadata, except in invoice settlement mode.
- At most one party reference is allowed (`customer` or `vendor`, not both).
- Customer is linked to a receivable account (postable + active).
- Vendor is linked to a payable account (postable + active).

## Invoice Settlement Rules

- Vouchers have `settlement_mode`:
  - `account`: normal account-based voucher posting.
  - `invoice`: movement closing mode (open-item style).
- `invoice` mode is allowed only for voucher types `receipt` and `payment`.
- `invoice` mode requires at least one allocation row in `voucher_allocations`.
- Allocation rows are locked once voucher is posted.
