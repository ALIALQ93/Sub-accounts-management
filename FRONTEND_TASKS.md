# Frontend Tasks Backlog (Voucher Module)

This backlog translates `SCREEN_SPECS.md` and `API_CONTRACT.md` into executable frontend work items.

## Scope

- Voucher Form screen
- Voucher Allocation screen
- Shared UI components and API services
- State, validation, and posting workflow

## Suggested Stack

- React + TypeScript
- React Query (or equivalent) for API caching
- Form library (React Hook Form or equivalent)
- Zod/Yup for validation schemas

---

## Phase 1 - Foundation (High Priority)

## FE-01: Project Structure for Voucher Module

- Create module folders:
  - `src/modules/vouchers/pages`
  - `src/modules/vouchers/components`
  - `src/modules/vouchers/services`
  - `src/modules/vouchers/types`
  - `src/modules/vouchers/state`
- Add route stubs:
  - `/vouchers/new`
  - `/vouchers/:id`
  - `/vouchers/:id/allocations` (or tab route)

Acceptance:

- Routes render base page shell in RTL.

## FE-02: Types and DTO Contracts

- Implement TypeScript interfaces for:
  - Voucher header
  - Voucher line
  - Voucher allocation
  - Posting response
  - API error structure
- Align names exactly with `API_CONTRACT.md`.

Acceptance:

- All service calls use typed request/response models.

## FE-03: Voucher API Service Layer

- Implement endpoints:
  - `getVoucherById`
  - `createVoucher`
  - `updateVoucher`
  - `deleteVoucher`
  - `addVoucherLine`
  - `updateVoucherLine`
  - `deleteVoucherLine`
  - `addAllocation`
  - `updateAllocation`
  - `deleteAllocation`
  - `postVoucher`
  - `reverseVoucher`
- Centralize error mapping by error codes.

Acceptance:

- Service layer returns normalized success/error payloads.

## FE-04: Shared Accounting Selectors

- Build reusable account selector component:
  - Search by code/name
  - Show only active + postable accounts
- Build party selector component:
  - Optional customer/vendor
  - Prevent both selected at once

Acceptance:

- Selector behavior enforces business constraints at UI level.

---

## Phase 2 - Voucher Form UI (High Priority)

## FE-05: Voucher Header Form

- Build fields:
  - `voucher_no`, `voucher_type`, `settlement_mode`, `voucher_date`, `description`
  - optional `customer_id` / `vendor_id`
- Show status chip and read-only state when posted.
- Add local schema validation.

Acceptance:

- Header can be created/edited in `draft` and `approved`.
- Header is locked in `posted`.

## FE-06: Voucher Lines Table

- Build editable table with:
  - add/edit/delete line
  - account selector
  - side selector
  - amount input
  - line description
- Totals footer:
  - total debit
  - total credit
  - difference

Acceptance:

- Totals update instantly.
- Invalid line states are blocked before save.

## FE-07: Voucher Actions Bar

- Implement actions based on status:
  - `Save Draft`
  - `Approve`
  - `Back to Draft`
  - `Post`
  - `Reverse`
  - `Delete` (non-posted)
- Add confirmation dialogs for `Post`, `Reverse`, `Delete`.

Acceptance:

- Only allowed actions are shown/enabled per status.

## FE-08: Posting Guard Logic

- Before `Post`:
  - lines count > 0
  - total debit == total credit
  - for `invoice` mode: at least one allocation exists
- Surface meaningful inline and toast errors.

Acceptance:

- User cannot send invalid post request from UI.

---

## Phase 3 - Allocation Screen (High Priority)

## FE-09: Allocation Tab/Screen Shell

- Display only when:
  - `voucher_type in (receipt, payment)`
  - `settlement_mode = invoice`
- Show helper alert when hidden by mode/type.

Acceptance:

- Allocation UI appears/disappears correctly by voucher configuration.

## FE-10: Open Movements Grid

- Build list/grid of open movements:
  - reference, date, account, open amount, select action
- Add filters:
  - date range, account, party, reference search

Acceptance:

- User can find and select open movement rows quickly.

## FE-11: Selected Allocations Grid

- Build selected allocations table:
  - target movement reference
  - applied amount
  - note
  - remove action
- Show allocation totals.

Acceptance:

- Allocation rows persist through API and reload.

## FE-12: Allocation Validation

- Enforce:
  - applied amount > 0
  - not exceeding open amount
  - cannot modify allocations when posted

Acceptance:

- Invalid allocation edits are blocked with clear messages.

---

## Phase 4 - UX, States, and Quality (Medium Priority)

## FE-13: Loading / Empty / Error States

- Add skeletons/spinners per section.
- Add empty state for lines and allocations.
- Standardize API error banner + field errors.

Acceptance:

- No blank/undefined UI states during fetch/mutation.

## FE-14: Status Chips and Lock Banner

- Implement consistent chips:
  - `draft`, `approved`, `posted`, `cancelled`
- Add posted lock banner:
  - "هذا السند مرحل. التعديل غير متاح. استخدم العكس."

Acceptance:

- Posted state is visually obvious and interaction-safe.

## FE-15: RTL and Visual Consistency Pass

- Validate alignment and spacing against `DESIGN.md`.
- Ensure number columns use monospaced style.
- Ensure table headers are sticky in dense mode.

Acceptance:

- Voucher module follows RTL and visual rules from design system.

## FE-16: Basic E2E Scenarios

- Scenario 1: balanced account-mode voucher posts successfully.
- Scenario 2: unbalanced voucher blocked.
- Scenario 3: invoice-mode voucher blocked without allocations.
- Scenario 4: posted voucher is immutable and supports reverse action.

Acceptance:

- Critical workflows pass in test/staging environment.

---

## Delivery Plan (Suggested)

Sprint 1:

- FE-01 to FE-06

Sprint 2:

- FE-07 to FE-12

Sprint 3:

- FE-13 to FE-16 + polish

## Done Definition

A task is done only when:

- UI behavior matches `SCREEN_SPECS.md`
- API integration matches `API_CONTRACT.md`
- Business rules match `ACCOUNTING_RULES.md`
- No blocking lint/type errors
- QA acceptance criteria passed
