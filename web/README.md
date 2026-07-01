This is the frontend app for Sub Accounts Management built with [Next.js](https://nextjs.org) + TypeScript.

## Getting Started

1. Copy env values:

```bash
cp .env.example .env.local
```

2. Fill:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- Do not place `SUPABASE_SECRET_KEY` in frontend env files.

3. Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

Main implemented routes:

- `/`
- `/vouchers`
- `/vouchers/new`
- `/vouchers/[id]`
- `/accounts`
- `/customers`
- `/vendors`
- `/open-movements`
- `/journals`
- `/reports/trial-balance`

The voucher service is connected to Supabase tables directly via:

- `src/lib/supabase/client.ts`
- `src/modules/vouchers/services/voucher-api.ts`

Shared app shell (sidebar + topbar):

- `src/components/app-shell.tsx`
