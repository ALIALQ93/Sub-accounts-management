-- =============================================================================
-- patch_journal_dimensions.sql — أبعاد القيد + الحركات المفتوحة
-- =============================================================================
-- يتطلب: patch_company_inventory.sql (و patch_branches.sql للـ FK)
-- التالي: patch_invoices.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- توسيع أسطر القيد — فرع، طرف، استحقاق، مصدر الفاتورة
-- ---------------------------------------------------------------------------

alter table public.journal_entry_lines
  add column if not exists branch_id uuid null references public.branches(id) on delete restrict;

alter table public.journal_entry_lines
  add column if not exists due_date date null;

alter table public.journal_entry_lines
  add column if not exists payment_terms_days int null
    check (payment_terms_days is null or payment_terms_days >= 0);

alter table public.journal_entry_lines
  add column if not exists party_type varchar(20) null
    check (party_type is null or party_type in ('customer', 'vendor'));

alter table public.journal_entry_lines
  add column if not exists party_id uuid null;

alter table public.journal_entry_lines
  add column if not exists source_invoice_id uuid null;

alter table public.journal_entry_lines
  add column if not exists source_invoice_line_id uuid null;

alter table public.journal_entry_lines
  add column if not exists source_return_id uuid null;

comment on column public.journal_entry_lines.branch_id is
  'فرع السطر — أساس المقاصة بين الفروع';
comment on column public.journal_entry_lines.party_type is
  'customer | vendor — مع party_id للذمم المفتوحة';
comment on column public.journal_entry_lines.source_invoice_id is
  'FK إلى invoices — يُضاف في patch_invoices.sql';
comment on column public.journal_entry_lines.source_return_id is
  'فاتورة مرتجع مصدر — يُضاف FK لاحقاً';

create index if not exists idx_journal_lines_branch_id
  on public.journal_entry_lines(branch_id);
create index if not exists idx_journal_lines_due_date
  on public.journal_entry_lines(due_date);
create index if not exists idx_journal_lines_party
  on public.journal_entry_lines(party_type, party_id);
create index if not exists idx_journal_lines_source_invoice_id
  on public.journal_entry_lines(source_invoice_id);

-- ---------------------------------------------------------------------------
-- تحقق: party_type و party_id معاً
-- ---------------------------------------------------------------------------

create or replace function public.journal_entry_lines_validate_party()
returns trigger
language plpgsql
as $$
begin
  if (new.party_type is null) <> (new.party_id is null) then
    raise exception 'party_type and party_id must both be set or both be null.';
  end if;

  if new.party_type = 'customer' and new.party_id is not null then
    if not exists (select 1 from public.customers c where c.id = new.party_id) then
      raise exception 'party_id does not reference an existing customer.';
    end if;
  elsif new.party_type = 'vendor' and new.party_id is not null then
    if not exists (select 1 from public.vendors v where v.id = new.party_id) then
      raise exception 'party_id does not reference an existing vendor.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_journal_entry_lines_validate_party on public.journal_entry_lines;
create trigger trg_journal_entry_lines_validate_party
before insert or update on public.journal_entry_lines
for each row execute function public.journal_entry_lines_validate_party();

-- ---------------------------------------------------------------------------
-- عرض الحركات المفتوحة (خصم تخصيصات السندات المرحّلة فقط)
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

comment on view public.open_items_view is
  'حركات قيد مرحّلة ذات رصيد مفتوح — بعد خصم voucher_allocations من السندات المرحّلة';

-- ---------------------------------------------------------------------------
-- خدمة جلب الحركات المفتوحة مع فلاتر
-- ---------------------------------------------------------------------------

create or replace function public.get_open_items(
  p_branch_id uuid default null,
  p_cost_center_id uuid default null,
  p_party_type varchar default null,
  p_party_id uuid default null,
  p_open_side varchar default null,
  p_account_id uuid default null,
  p_eligible_only boolean default false,
  p_include_overdue_only boolean default false
)
returns setof public.open_items_view
language sql
stable
security invoker
set search_path = public
as $$
  select oi.*
  from public.open_items_view oi
  where (p_branch_id is null or oi.branch_id = p_branch_id)
    and (p_cost_center_id is null or oi.cost_center_id = p_cost_center_id)
    and (p_party_type is null or oi.party_type = p_party_type)
    and (p_party_id is null or oi.party_id = p_party_id)
    and (p_open_side is null or oi.open_side = p_open_side)
    and (p_account_id is null or oi.account_id = p_account_id)
    and (not p_eligible_only or oi.is_eligible_for_payment)
    and (not p_include_overdue_only or oi.is_overdue)
  order by oi.due_date nulls last, oi.entry_date, oi.entry_no, oi.journal_line_id;
$$;

comment on function public.get_open_items is
  'جلب الحركات المفتوحة — فلاتر فرع، CC، طرف، مدين/دائن، أهلية استحقاق';

-- ---------------------------------------------------------------------------
-- توسيع journal_entries — فرع اختياري على مستوى القيد (للتقارير)
-- ---------------------------------------------------------------------------

alter table public.journal_entries
  add column if not exists branch_id uuid null references public.branches(id) on delete restrict;

comment on column public.journal_entries.branch_id is
  'فرع القيد — اختياري؛ التفصيل per سطر في journal_entry_lines';

create index if not exists idx_journal_entries_branch_id
  on public.journal_entries(branch_id);

-- ---------------------------------------------------------------------------
-- توسيع السندات — فرع (للمقاصة per فرع)
-- ---------------------------------------------------------------------------

alter table public.vouchers
  add column if not exists branch_id uuid null references public.branches(id) on delete restrict;

comment on column public.vouchers.branch_id is
  'فرع السند — يقيّد التخصيصات والمقاصة per فرع';

create index if not exists idx_vouchers_branch_id on public.vouchers(branch_id);
