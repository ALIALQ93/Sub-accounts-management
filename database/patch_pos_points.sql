-- =============================================================================
-- patch_pos_points.sql (#44)
-- =============================================================================
-- نقاط البيع: تعريف عدة نقاط مع تخصيص الفرع/المستودع/النمط/الحسابات/المواد
-- يتطلب: patch_materials_card_v2.sql + أنماط الفواتير + العملاء
-- =============================================================================

-- ---------------------------------------------------------------------------
-- بطاقة نقطة البيع
-- ---------------------------------------------------------------------------

create table if not exists public.pos_points (
  id uuid primary key default gen_random_uuid(),
  point_code varchar(30) not null unique,
  name_ar varchar(200) not null,
  name_en varchar(200) null,
  branch_id uuid not null references public.branches(id) on delete restrict,
  warehouse_id uuid not null references public.warehouses(id) on delete restrict,
  invoice_pattern_id uuid not null references public.invoice_patterns(id) on delete restrict,
  default_customer_id uuid null references public.customers(id) on delete set null,
  default_debtor_account_id uuid null references public.accounts(id) on delete set null,
  default_creditor_account_id uuid null references public.accounts(id) on delete set null,
  receipt_header text null,
  receipt_footer text null,
  allow_price_override boolean not null default false,
  allow_line_discount boolean not null default true,
  require_customer boolean not null default false,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.pos_points is
  'نقاط البيع — كل نقطة مربوطة بفرع ومستودع ونمط فاتورة بيع';
comment on column public.pos_points.default_debtor_account_id is
  'حساب الصندوق/البنك الافتراضي للتحصيل النقدي (يُغطّي نمط الفاتورة إن وُجد)';
comment on column public.pos_points.default_creditor_account_id is
  'حساب إيراد المبيعات الافتراضي (اختياري — وإلا من النمط)';

create index if not exists idx_pos_points_branch on public.pos_points(branch_id);
create index if not exists idx_pos_points_warehouse on public.pos_points(warehouse_id);
create index if not exists idx_pos_points_pattern on public.pos_points(invoice_pattern_id);
create index if not exists idx_pos_points_active on public.pos_points(is_active);

create or replace function public.pos_points_validate()
returns trigger
language plpgsql
as $$
declare
  v_wh_branch uuid;
  v_kind text;
begin
  select branch_id into v_wh_branch
  from public.warehouses where id = new.warehouse_id;
  if v_wh_branch is distinct from new.branch_id then
    raise exception 'Warehouse must belong to the selected branch.';
  end if;

  select commercial_kind into v_kind
  from public.invoice_patterns where id = new.invoice_pattern_id;
  if v_kind is distinct from 'sale' then
    raise exception 'POS point invoice pattern must be commercial_kind = sale.';
  end if;

  new.point_code := upper(trim(new.point_code));
  new.name_ar := trim(new.name_ar);
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_pos_points_validate on public.pos_points;
create trigger trg_pos_points_validate
  before insert or update on public.pos_points
  for each row
  execute function public.pos_points_validate();

-- ---------------------------------------------------------------------------
-- طرق التحصيل لكل نقطة
-- ---------------------------------------------------------------------------

create table if not exists public.pos_point_payment_methods (
  id uuid primary key default gen_random_uuid(),
  pos_point_id uuid not null references public.pos_points(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete restrict,
  label_ar varchar(100) not null,
  label_en varchar(100) null,
  is_default boolean not null default false,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (pos_point_id, account_id)
);

comment on table public.pos_point_payment_methods is
  'طرق الدفع المعروضة في شاشة البيع (نقد/بطاقة/…) مربوطة بحسابات';

create index if not exists idx_pos_payment_point
  on public.pos_point_payment_methods(pos_point_id);

create unique index if not exists idx_pos_payment_one_default
  on public.pos_point_payment_methods (pos_point_id)
  where is_default = true;

-- ---------------------------------------------------------------------------
-- تخصيص مواد/أصناف للنقطة (فارغ = الاعتماد على النمط أو الكل)
-- ---------------------------------------------------------------------------

create table if not exists public.pos_point_allowed_materials (
  pos_point_id uuid not null references public.pos_points(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete cascade,
  primary key (pos_point_id, material_id)
);

create table if not exists public.pos_point_allowed_categories (
  pos_point_id uuid not null references public.pos_points(id) on delete cascade,
  category_id uuid not null references public.material_categories(id) on delete cascade,
  primary key (pos_point_id, category_id)
);

-- ---------------------------------------------------------------------------
-- ربط الفاتورة بنقطة البيع
-- ---------------------------------------------------------------------------

alter table public.invoices
  add column if not exists pos_point_id uuid null
    references public.pos_points(id) on delete set null;

create index if not exists idx_invoices_pos_point_id
  on public.invoices(pos_point_id);

comment on column public.invoices.pos_point_id is
  'مصدر الفاتورة من نقطة بيع (إن وُجد)';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.pos_points enable row level security;
alter table public.pos_point_payment_methods enable row level security;
alter table public.pos_point_allowed_materials enable row level security;
alter table public.pos_point_allowed_categories enable row level security;

drop policy if exists pos_points_all_authenticated on public.pos_points;
create policy pos_points_all_authenticated
  on public.pos_points for all to authenticated
  using (true) with check (true);

drop policy if exists pos_payment_all_authenticated on public.pos_point_payment_methods;
create policy pos_payment_all_authenticated
  on public.pos_point_payment_methods for all to authenticated
  using (true) with check (true);

drop policy if exists pos_allowed_mat_all_authenticated on public.pos_point_allowed_materials;
create policy pos_allowed_mat_all_authenticated
  on public.pos_point_allowed_materials for all to authenticated
  using (true) with check (true);

drop policy if exists pos_allowed_cat_all_authenticated on public.pos_point_allowed_categories;
create policy pos_allowed_cat_all_authenticated
  on public.pos_point_allowed_categories for all to authenticated
  using (true) with check (true);
