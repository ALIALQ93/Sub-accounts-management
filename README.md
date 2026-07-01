# Sub-accounts-management

Core accounting bootstrap files:

- `accounting_schema.sql`: PostgreSQL/Supabase schema with chart rules, account-based vouchers, invoice allocations, and auto-posting triggers.
- `accounting_test_cases.sql`: end-to-end SQL test scenarios for receipt/payment/settlement behaviors.
- `ACCOUNTING_RULES.md`: human-readable accounting and chart-of-accounts rules.
- `API_CONTRACT.md`: REST API endpoints and payloads for implementation.
- `VOUCHER_WORKFLOW.md`: step-by-step voucher lifecycle and posting behavior.
- `SCREEN_SPECS.md`: implementation-ready UI specs for voucher form and allocation screens.
- `FRONTEND_TASKS.md`: sprint-ready frontend backlog for implementing voucher module UI.

Frontend app:

- `web/`: Next.js + TypeScript UI scaffold with initial voucher form and allocation screens.
- `.github/workflows/web-ci.yml`: GitHub Actions workflow for web lint and build.