# Sub-accounts-management

**الإصدار الحالي:** `0.1.0` · تجربة أولى (`trial-1`) — راجع [`CHANGELOG.md`](CHANGELOG.md) و[`RELEASE_CHECKLIST.md`](RELEASE_CHECKLIST.md)

Core accounting bootstrap files:

- `database/`: SQL setup for Supabase — see `database/README.md`
  - **`database/setup_all.sql`**: one-shot reset + schema + RLS + storage (recommended)
  - **`database/TRIAL_SETUP.md`**: دليل التجربة الأولى والتحقق من القاعدة
  - `database/03_test_cases.sql`: optional end-to-end test scenarios
- `ACCOUNTING_RULES.md`: human-readable accounting and chart-of-accounts rules.
- `API_CONTRACT.md`: REST API endpoints and payloads for implementation.
- `VOUCHER_WORKFLOW.md`: step-by-step voucher lifecycle and posting behavior.
- `SCREEN_SPECS.md`: implementation-ready UI specs for voucher form and allocation screens.
- `FRONTEND_TASKS.md`: sprint-ready frontend backlog for implementing voucher module UI.

Frontend app:

- `web/`: Next.js + TypeScript frontend with home, vouchers list/form, and accounts screens connected to Supabase.
- `.github/workflows/web-ci.yml`: GitHub Actions workflow for web lint and build.