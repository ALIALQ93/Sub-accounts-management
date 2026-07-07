-- =============================================================================
-- patch_invoice_reservation_discount.sql — حجز، تخفيض، مندوبي مبيعات
-- =============================================================================
-- يتطلب: patch_invoices.sql
-- الترتيب: patch #9
-- =============================================================================

-- ---------------------------------------------------------------------------
-- تبويب التخفيض + الحجز على أنماط الفواتير (§14)
-- ---------------------------------------------------------------------------

alter table public.invoice_patterns
  add column if not exists discount_enabled boolean not null default false;

alter table public.invoice_patterns
  add column if not exists max_discount_percent numeric(5, 2) null
    check (max_discount_percent is null or (max_discount_percent >= 0 and max_discount_percent <= 100));

alter table public.invoice_patterns
  add column if not exists discount_applies_to varchar(10) null
    check (discount_applies_to is null or discount_applies_to in ('line', 'invoice'));

alter table public.invoice_patterns
  add column if not exists reservation_enabled boolean not null default false;

alter table public.invoice_patterns
  add column if not exists reserve_on_save boolean not null default true;

alter table public.invoice_patterns
  add column if not exists release_on_cancel boolean not null default true;

alter table public.invoice_patterns
  add column if not exists reservation_days int null
    check (reservation_days is null or reservation_days > 0);

-- ---------------------------------------------------------------------------
-- مندوبو مبيعات (minimal — يُوسَّع لاحقاً مع قسم المندوب)
-- ---------------------------------------------------------------------------

create table if not exists public.sales_reps (
  id uuid primary key default gen_random_uuid(),
  rep_code varchar(20) not null unique,
  name_ar varchar(200) not null,
  name_en varchar(200) null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sales_reps_active on public.sales_reps(is_active);

alter table public.invoices
  add column if not exists sales_rep_id uuid null references public.sales_reps(id) on delete set null;

create index if not exists idx_invoices_sales_rep_id on public.invoices(sales_rep_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.sales_reps enable row level security;

drop policy if exists "sales_reps_select_all" on public.sales_reps;
create policy "sales_reps_select_all" on public.sales_reps
  for select to authenticated using (true);

drop policy if exists "sales_reps_insert_all" on public.sales_reps;
create policy "sales_reps_insert_all" on public.sales_reps
  for insert to authenticated with check (true);

drop policy if exists "sales_reps_update_all" on public.sales_reps;
create policy "sales_reps_update_all" on public.sales_reps
  for update to authenticated using (true) with check (true);

drop trigger if exists trg_sales_reps_updated_at on public.sales_reps;
create trigger trg_sales_reps_updated_at
before update on public.sales_reps
for each row execute function public.set_updated_at();

-- مندوب تجريبي (اختياري — يُحذف أو يُعدَّل من الواجهة لاحقاً)
insert into public.sales_reps (rep_code, name_ar, name_en)
select 'REP01', 'مندوب تجريبي', 'Sample Rep'
where not exists (select 1 from public.sales_reps where rep_code = 'REP01');
