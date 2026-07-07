-- =============================================================================
-- patch_settlement_foundation.sql — أساس مقاصة CC والفروع
-- =============================================================================
-- يتطلب: patch_invoice_seeds.sql
-- التالي: patch_post_invoice.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- توسيع voucher_allocations
-- ---------------------------------------------------------------------------

alter table public.voucher_allocations
  add column if not exists allocation_type varchar(20) not null default 'close'
    check (allocation_type in ('close', 'netting_cc', 'netting_branch'));

alter table public.voucher_allocations
  add column if not exists applied_amount_base numeric(18, 2) null
    check (applied_amount_base is null or applied_amount_base >= 0);

alter table public.voucher_allocations
  add column if not exists source_branch_id uuid null references public.branches(id) on delete restrict;

alter table public.voucher_allocations
  add column if not exists target_branch_id uuid null references public.branches(id) on delete restrict;

alter table public.voucher_allocations
  add column if not exists source_cost_center_id uuid null references public.cost_centers(id) on delete restrict;

alter table public.voucher_allocations
  add column if not exists target_cost_center_id uuid null references public.cost_centers(id) on delete restrict;

comment on column public.voucher_allocations.allocation_type is
  'close = إغلاق ذمة | netting_cc | netting_branch';

create index if not exists idx_voucher_allocations_allocation_type
  on public.voucher_allocations(allocation_type);
create index if not exists idx_voucher_allocations_target_branch_id
  on public.voucher_allocations(target_branch_id);

-- تعبئة applied_amount_base من السند عند الإدراج (إن وُجد سعر صرف)
create or replace function public.voucher_allocations_apply_amount_base()
returns trigger
language plpgsql
as $$
declare
  v_rate numeric(18, 6);
begin
  select coalesce(nullif(v.exchange_rate, 0), 1)
  into v_rate
  from public.vouchers v
  where v.id = new.voucher_id;

  new.applied_amount_base := public.to_base_amount(new.applied_amount, v_rate);
  return new;
end;
$$;

drop trigger if exists trg_voucher_allocations_apply_amount_base on public.voucher_allocations;
create trigger trg_voucher_allocations_apply_amount_base
before insert or update on public.voucher_allocations
for each row execute function public.voucher_allocations_apply_amount_base();

-- ---------------------------------------------------------------------------
-- أسطر المقاصة على السند (CC / فرع)
-- ---------------------------------------------------------------------------

create table if not exists public.voucher_netting_lines (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references public.vouchers(id) on delete cascade,
  netting_kind varchar(10) not null check (netting_kind in ('cc', 'branch')),
  from_cc_id uuid null references public.cost_centers(id) on delete restrict,
  to_cc_id uuid null references public.cost_centers(id) on delete restrict,
  from_branch_id uuid null references public.branches(id) on delete restrict,
  to_branch_id uuid null references public.branches(id) on delete restrict,
  amount numeric(18, 2) not null check (amount > 0),
  currency_id uuid null references public.currencies(id) on delete restrict,
  includes_cash boolean not null default false,
  inter_account_id uuid null references public.accounts(id) on delete restrict,
  note text null,
  created_at timestamptz not null default now(),
  constraint voucher_netting_lines_cc_required check (
    netting_kind <> 'cc'
    or (from_cc_id is not null and to_cc_id is not null and from_cc_id <> to_cc_id)
  ),
  constraint voucher_netting_lines_branch_required check (
    netting_kind <> 'branch'
    or (from_branch_id is not null and to_branch_id is not null and from_branch_id <> to_branch_id)
  )
);

create index if not exists idx_voucher_netting_lines_voucher_id
  on public.voucher_netting_lines(voucher_id);

alter table public.voucher_netting_lines enable row level security;

drop policy if exists "voucher_netting_lines_all" on public.voucher_netting_lines;
create policy "voucher_netting_lines_all" on public.voucher_netting_lines
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- إعادة بناء open_items_view (تخصيصات موسّعة — نفس المنطق)
-- ---------------------------------------------------------------------------

create or replace view public.open_items_view
with (security_invoker = true)
as
with line_allocations as (
  select
    va.target_journal_line_id,
    coalesce(sum(va.applied_amount), 0)::numeric(18, 2) as allocated_amount
  from public.voucher_allocations va
  inner join public.vouchers v on v.id = va.voucher_id
  where v.status = 'posted'
  group by va.target_journal_line_id
)
select
  jel.id as journal_line_id,
  je.id as journal_entry_id,
  je.entry_no,
  je.entry_date,
  jel.account_id,
  acc.code as account_code,
  acc.name_ar as account_name,
  jel.branch_id,
  br.branch_code,
  br.name_ar as branch_name,
  jel.cost_center_id,
  cc.code as cost_center_code,
  cc.name_ar as cost_center_name,
  jel.currency_id,
  jel.party_type,
  jel.party_id,
  jel.source_invoice_id,
  jel.source_return_id,
  jel.due_date,
  jel.payment_terms_days,
  jel.debit,
  jel.credit,
  abs(jel.debit - jel.credit)::numeric(18, 2) as original_amount,
  coalesce(la.allocated_amount, 0)::numeric(18, 2) as allocated_amount,
  greatest(
    abs(jel.debit - jel.credit) - coalesce(la.allocated_amount, 0),
    0
  )::numeric(18, 2) as open_amount,
  case
    when jel.debit > jel.credit then 'debit'
    when jel.credit > jel.debit then 'credit'
    else null
  end as open_side,
  case
    when jel.due_date is null then true
    when jel.due_date <= current_date then true
    else false
  end as is_eligible_for_payment,
  case
    when jel.due_date is not null and jel.due_date < current_date then true
    else false
  end as is_overdue,
  jel.line_description,
  jel.created_at as line_created_at
from public.journal_entry_lines jel
inner join public.journal_entries je on je.id = jel.journal_entry_id
inner join public.accounts acc on acc.id = jel.account_id
left join public.branches br on br.id = jel.branch_id
left join public.cost_centers cc on cc.id = jel.cost_center_id
left join line_allocations la on la.target_journal_line_id = jel.id
where je.status = 'posted'
  and (jel.debit > 0 or jel.credit > 0)
  and greatest(
    abs(jel.debit - jel.credit) - coalesce(la.allocated_amount, 0),
    0
  ) > 0;
