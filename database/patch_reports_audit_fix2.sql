-- =============================================================================
-- patch_reports_audit_fix2.sql — متابعة إصلاحات تدقيق التقارير (2026-07-26)
-- =============================================================================
-- 1) return_sale: تكلفة المخزون بنفس صيغة القيد (pricing_consumed_mode)
-- 2) open_items_view: مبالغ بالعملة الأساسية (debit_base / applied_amount_base)
-- 3) get_trial_balance: فلتر فرع + فحص صلاحية التقارير
-- 4) assert_can_view_reports + فحص على دوال تقارير SECURITY DEFINER
-- =============================================================================

-- ---------------------------------------------------------------------------
-- صلاحية عرض التقارير (يتوافق مع افتراضيات الأدوار بالواجهة عند غياب user_permissions)
-- ---------------------------------------------------------------------------

create or replace function public.assert_can_view_reports()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
  v_has_custom boolean;
begin
  if public.is_admin() then
    return;
  end if;

  if public.has_permission('reports.view') then
    return;
  end if;

  select p.role
  into v_role
  from public.profiles p
  where p.id = auth.uid();

  select exists (
    select 1 from public.user_permissions up where up.user_id = auth.uid()
  )
  into v_has_custom;

  -- نفس منطق الواجهة: بلا صفوف صلاحيات مخصّصة → افتراضيات الدور
  if not coalesce(v_has_custom, false)
     and v_role in ('admin', 'accountant', 'viewer') then
    return;
  end if;

  raise exception 'ليس لديك صلاحية عرض التقارير (reports.view)';
end;
$$;

comment on function public.assert_can_view_reports() is
  'يرفض الاستدعاء إن لم تتوفر صلاحية reports.view (أو افتراضيات دور accountant/viewer)';

-- ---------------------------------------------------------------------------
-- 1) تكلفة مرتجع المبيعات في inventory_movements
-- ---------------------------------------------------------------------------

create or replace function public.inventory_movements_apply_invoice_line_cost()
returns trigger
language plpgsql
as $$
declare
  v_kind varchar(30);
  v_cost_mode varchar(30);
  v_consumed_mode varchar(30);
  v_affect boolean;
  v_settings public.company_inventory_settings%rowtype;
  v_line_amount numeric(18, 2);
  v_line_gross numeric(18, 2);
  v_line_disc numeric(18, 2);
  v_qty_base numeric(18, 6);
  v_inbound_amount numeric(18, 2);
  v_unit_cost numeric(18, 4);
  v_expiry date;
  v_serial text;
  v_purchase_price numeric(18, 4);
  v_unit_price numeric(18, 4);
  v_factor numeric(18, 6);
  v_movement_date date;
begin
  if new.source_type <> 'invoice' or new.source_line_id is null then
    return new;
  end if;

  select
    ip.commercial_kind,
    ip.pricing_cost_mode,
    ip.pricing_consumed_mode,
    coalesce(ip.line_adjustments_affect_material_cost, true),
    iml.line_amount,
    round((iml.quantity * iml.unit_price)::numeric, 2),
    coalesce(iml.discount_amount, 0),
    iml.quantity_base,
    iml.expiry_date,
    iml.serial_number,
    m.purchase_price,
    iml.unit_price,
    mu.factor_to_base,
    i.invoice_date
  into
    v_kind,
    v_cost_mode,
    v_consumed_mode,
    v_affect,
    v_line_amount,
    v_line_gross,
    v_line_disc,
    v_qty_base,
    v_expiry,
    v_serial,
    v_purchase_price,
    v_unit_price,
    v_factor,
    v_movement_date
  from public.invoice_material_lines iml
  inner join public.invoices i on i.id = iml.invoice_id
  inner join public.invoice_patterns ip on ip.id = i.pattern_id
  inner join public.materials m on m.id = iml.material_id
  inner join public.material_units mu on mu.id = iml.material_unit_id
  where iml.id = new.source_line_id;

  if not found then
    return new;
  end if;

  select * into v_settings from public.company_inventory_settings where id = 1;

  -- مرتجع مبيعات: كمية داخلة، لكن التكلفة = عكس تكلفة الإخراج (مثل القيد المحاسبي)
  if new.quantity_base_delta > 0 and v_kind = 'return_sale' then
    v_unit_cost := public.calc_outbound_unit_cost(
      v_consumed_mode,
      v_settings,
      v_purchase_price,
      v_unit_price,
      v_factor,
      new.material_id,
      new.warehouse_id,
      new.cost_center_id,
      v_expiry,
      v_serial,
      coalesce(new.movement_date, v_movement_date)
    );
    new.unit_cost := v_unit_cost;
    new.total_cost := round((abs(new.quantity_base_delta) * v_unit_cost)::numeric, 2);
    return new;
  end if;

  if new.quantity_base_delta > 0
     and public.invoice_is_inbound_kind(v_kind) then
    v_inbound_amount := public.calc_inbound_inventory_amount(
      v_cost_mode,
      v_affect,
      v_line_amount,
      v_line_gross,
      v_line_disc
    );
    new.total_cost := v_inbound_amount;
    if v_qty_base > 0 then
      new.unit_cost := round((v_inbound_amount / v_qty_base)::numeric, 4);
    else
      new.unit_cost := 0;
    end if;
    return new;
  end if;

  if new.quantity_base_delta < 0
     and public.invoice_is_outbound_kind(v_kind) then
    v_unit_cost := public.calc_outbound_unit_cost(
      v_consumed_mode,
      v_settings,
      v_purchase_price,
      v_unit_price,
      v_factor,
      new.material_id,
      new.warehouse_id,
      new.cost_center_id,
      v_expiry,
      v_serial,
      coalesce(new.movement_date, v_movement_date)
    );
    new.unit_cost := v_unit_cost;
    new.total_cost := round((abs(new.quantity_base_delta) * v_unit_cost)::numeric, 2);
    return new;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2) open_items_view بالمبالغ الأساسية
-- ---------------------------------------------------------------------------
-- CREATE OR REPLACE لا يسمح بإدراج/إعادة تسمية أعمدة وسط التعريف
-- (مثلاً currency_code قبل party_type) — يجب DROP ثم CREATE.

drop view if exists public.open_items_view cascade;

create view public.open_items_view
with (security_invoker = true)
as
with line_allocations as (
  select
    va.target_journal_line_id,
    coalesce(
      sum(coalesce(va.applied_amount_base, va.applied_amount)),
      0
    )::numeric(18, 2) as allocated_amount
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
  cur.code as currency_code,
  jel.party_type,
  jel.party_id,
  jel.source_invoice_id,
  jel.source_return_id,
  jel.due_date,
  jel.payment_terms_days,
  jel.debit,
  jel.credit,
  abs(
    coalesce(jel.debit_base, jel.debit) - coalesce(jel.credit_base, jel.credit)
  )::numeric(18, 2) as original_amount,
  coalesce(la.allocated_amount, 0)::numeric(18, 2) as allocated_amount,
  greatest(
    abs(
      coalesce(jel.debit_base, jel.debit) - coalesce(jel.credit_base, jel.credit)
    ) - coalesce(la.allocated_amount, 0),
    0
  )::numeric(18, 2) as open_amount,
  case
    when coalesce(jel.debit_base, jel.debit) > coalesce(jel.credit_base, jel.credit) then 'debit'
    when coalesce(jel.credit_base, jel.credit) > coalesce(jel.debit_base, jel.debit) then 'credit'
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
left join public.currencies cur on cur.id = jel.currency_id
left join line_allocations la on la.target_journal_line_id = jel.id
where je.status = 'posted'
  and (jel.debit > 0 or jel.credit > 0)
  and greatest(
    abs(
      coalesce(jel.debit_base, jel.debit) - coalesce(jel.credit_base, jel.credit)
    ) - coalesce(la.allocated_amount, 0),
    0
  ) > 0;

comment on view public.open_items_view is
  'حركات مفتوحة — open_amount/original بالعملة الأساسية (debit_base − تخصيصات applied_amount_base)';

grant select on public.open_items_view to authenticated;

-- CASCADE أعلاه يسقط get_open_items (returns setof open_items_view) — إعادة إنشائها
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
-- 3) ميزان المراجعة: فرع + صلاحية
-- ---------------------------------------------------------------------------

drop function if exists public.get_trial_balance(date, date, uuid, uuid, boolean, uuid) cascade;
drop function if exists public.get_trial_balance(date, date, uuid, uuid, boolean, uuid, uuid) cascade;

create or replace function public.get_trial_balance(
  p_from_date date default null,
  p_to_date date default null,
  p_currency_id uuid default null,
  p_account_id uuid default null,
  p_account_subtree boolean default true,
  p_cost_center_id uuid default null,
  p_branch_id uuid default null
)
returns table (
  account_id uuid,
  account_code varchar,
  account_name varchar,
  currency_id uuid,
  parent_id uuid,
  is_postable boolean,
  opening_entry_balance numeric,
  opening_balance numeric,
  period_debit numeric,
  period_credit numeric,
  closing_balance numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_can_view_reports();

  return query
  with scoped_accounts as (
    select a.*
    from public.accounts a
    where a.is_active = true
      and (p_currency_id is null or a.currency_id = p_currency_id)
      and (
        p_account_id is null
        or (
          p_account_subtree
          and a.id in (
            with recursive account_tree as (
              select id
              from public.accounts
              where id = p_account_id
              union all
              select child.id
              from public.accounts child
              inner join account_tree parent on child.parent_id = parent.id
            )
            select id from account_tree
          )
        )
        or (not p_account_subtree and a.id = p_account_id)
      )
  ),
  line_agg as (
    select
      jel.account_id,
      coalesce(sum(
        case
          when coalesce(je.is_opening_entry, false)
            then jel.debit_base - jel.credit_base
          else 0
        end
      ), 0)::numeric(18, 2) as opening_entry_balance,
      coalesce(sum(
        case
          when not coalesce(je.is_opening_entry, false)
            and p_from_date is not null
            and je.entry_date < p_from_date
            then jel.debit_base - jel.credit_base
          else 0
        end
      ), 0)::numeric(18, 2) as opening_balance,
      coalesce(sum(
        case
          when not coalesce(je.is_opening_entry, false)
            and (p_from_date is null or je.entry_date >= p_from_date)
            and (p_to_date is null or je.entry_date <= p_to_date)
            then jel.debit_base
          else 0
        end
      ), 0)::numeric(18, 2) as period_debit,
      coalesce(sum(
        case
          when not coalesce(je.is_opening_entry, false)
            and (p_from_date is null or je.entry_date >= p_from_date)
            and (p_to_date is null or je.entry_date <= p_to_date)
            then jel.credit_base
          else 0
        end
      ), 0)::numeric(18, 2) as period_credit
    from public.journal_entry_lines jel
    inner join public.journal_entries je on je.id = jel.journal_entry_id
    where je.status = 'posted'
      and (p_cost_center_id is null or jel.cost_center_id = p_cost_center_id)
      and (
        p_branch_id is null
        or coalesce(jel.branch_id, je.branch_id) = p_branch_id
      )
    group by jel.account_id
  )
  select
    sa.id as account_id,
    sa.code as account_code,
    sa.name_ar as account_name,
    sa.currency_id,
    sa.parent_id,
    sa.is_postable,
    coalesce(la.opening_entry_balance, 0)::numeric(18, 2) as opening_entry_balance,
    coalesce(la.opening_balance, 0)::numeric(18, 2) as opening_balance,
    coalesce(la.period_debit, 0)::numeric(18, 2) as period_debit,
    coalesce(la.period_credit, 0)::numeric(18, 2) as period_credit,
    (
      coalesce(la.opening_entry_balance, 0)
      + coalesce(la.opening_balance, 0)
      + coalesce(la.period_debit, 0)
      - coalesce(la.period_credit, 0)
    )::numeric(18, 2) as closing_balance
  from scoped_accounts sa
  left join line_agg la on la.account_id = sa.id
  where sa.is_postable = true
  order by sa.code;
end;
$$;

comment on function public.get_trial_balance is
  'ميزان مراجعة — opening_entry منفصل، فلتر فرع اختياري، يتطلب reports.view';

revoke all on function public.get_trial_balance(date, date, uuid, uuid, boolean, uuid, uuid) from public;
grant execute on function public.get_trial_balance(date, date, uuid, uuid, boolean, uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) فحص صلاحية على دوال التقارير الرئيسية (SECURITY DEFINER)
-- ---------------------------------------------------------------------------

create or replace function public.get_cogs_report(
  p_from_date date default null,
  p_to_date date default null,
  p_material_id uuid default null,
  p_warehouse_id uuid default null,
  p_branch_id uuid default null,
  p_group_by varchar default 'material'
)
returns table (
  group_key varchar,
  invoice_id uuid,
  invoice_no varchar,
  invoice_date date,
  material_id uuid,
  material_code varchar,
  material_name_ar varchar,
  warehouse_code varchar,
  branch_code varchar,
  sale_quantity_base numeric,
  return_quantity_base numeric,
  sales_amount numeric,
  cogs_amount numeric,
  return_cogs_amount numeric,
  net_cogs numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_can_view_reports();
  return query
  with scoped as (
    select
      im.movement_kind,
      im.quantity_base_delta,
      im.unit_cost,
      im.total_cost,
      coalesce(iml.line_amount, 0) as line_amount,
      im.material_id,
      im.source_id as invoice_id,
      m.material_code,
      m.name_ar as material_name_ar,
      w.warehouse_code,
      b.branch_code,
      i.invoice_no,
      i.invoice_date
    from public.inventory_movements im
    inner join public.materials m on m.id = im.material_id
    inner join public.warehouses w on w.id = im.warehouse_id
    inner join public.branches b on b.id = im.branch_id
    left join public.invoices i
      on im.source_type = 'invoice' and i.id = im.source_id
    left join public.invoice_material_lines iml
      on im.source_type = 'invoice' and iml.id = im.source_line_id
    where im.movement_kind in ('sale', 'return_sale')
      and (p_from_date is null or im.movement_date >= p_from_date)
      and (p_to_date is null or im.movement_date <= p_to_date)
      and (p_material_id is null or im.material_id = p_material_id)
      and (p_warehouse_id is null or im.warehouse_id = p_warehouse_id)
      and (p_branch_id is null or im.branch_id = p_branch_id)
  )
  select
    case
      when coalesce(p_group_by, 'material') = 'invoice' then
        coalesce(max(s.invoice_no), max(s.invoice_id::text))
      else max(s.material_code)
    end::varchar as group_key,
    case
      when coalesce(p_group_by, 'material') = 'invoice' then (max(s.invoice_id::text))::uuid
      else null::uuid
    end as invoice_id,
    case
      when coalesce(p_group_by, 'material') = 'invoice' then max(s.invoice_no)
      else null::varchar
    end as invoice_no,
    case
      when coalesce(p_group_by, 'material') = 'invoice' then max(s.invoice_date)
      else null::date
    end as invoice_date,
    case
      when coalesce(p_group_by, 'material') = 'material' then (max(s.material_id::text))::uuid
      else null::uuid
    end as material_id,
    case
      when coalesce(p_group_by, 'material') = 'material' then max(s.material_code)
      else null::varchar
    end as material_code,
    case
      when coalesce(p_group_by, 'material') = 'material' then max(s.material_name_ar)
      else null::varchar
    end as material_name_ar,
    case
      when coalesce(p_group_by, 'material') = 'material' then max(s.warehouse_code)
      else null::varchar
    end as warehouse_code,
    case
      when coalesce(p_group_by, 'material') = 'material' then max(s.branch_code)
      else null::varchar
    end as branch_code,
    coalesce(
      sum(case when s.movement_kind = 'sale' then abs(s.quantity_base_delta) else 0 end),
      0
    )::numeric(18, 6) as sale_quantity_base,
    coalesce(
      sum(case when s.movement_kind = 'return_sale' then s.quantity_base_delta else 0 end),
      0
    )::numeric(18, 6) as return_quantity_base,
    coalesce(
      sum(
        case
          when s.movement_kind = 'sale' then coalesce(s.line_amount, 0)
          when s.movement_kind = 'return_sale' then -coalesce(s.line_amount, 0)
          else 0
        end
      ),
      0
    )::numeric(18, 2) as sales_amount,
    coalesce(
      sum(
        case
          when s.movement_kind = 'sale' then
            round((abs(s.quantity_base_delta) * coalesce(s.unit_cost, 0))::numeric, 2)
          else 0
        end
      ),
      0
    )::numeric(18, 2) as cogs_amount,
    coalesce(
      sum(
        case
          when s.movement_kind = 'return_sale' then
            round((s.quantity_base_delta * coalesce(s.unit_cost, 0))::numeric, 2)
          else 0
        end
      ),
      0
    )::numeric(18, 2) as return_cogs_amount,
    coalesce(
      sum(
        case
          when s.movement_kind = 'sale' then
            round((abs(s.quantity_base_delta) * coalesce(s.unit_cost, 0))::numeric, 2)
          when s.movement_kind = 'return_sale' then
            -round((s.quantity_base_delta * coalesce(s.unit_cost, 0))::numeric, 2)
          else 0
        end
      ),
      0
    )::numeric(18, 2) as net_cogs
  from scoped s
  group by
    case
      when coalesce(p_group_by, 'material') = 'invoice' then s.invoice_id::text
      else s.material_id::text
    end
  order by group_key;
end;
$$;

create or replace function public.get_sales_lines_report(
  p_from_date date default null,
  p_to_date date default null,
  p_customer_id uuid default null,
  p_material_id uuid default null,
  p_warehouse_id uuid default null,
  p_branch_id uuid default null,
  p_include_returns boolean default true
)
returns table (
  invoice_id uuid,
  invoice_no varchar,
  invoice_date date,
  commercial_kind varchar,
  customer_name_ar varchar,
  material_id uuid,
  material_code varchar,
  material_name_ar varchar,
  warehouse_code varchar,
  branch_code varchar,
  quantity_base numeric,
  unit_price numeric,
  discount_amount numeric,
  line_amount numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_can_view_reports();
  return query
  select
    i.id as invoice_id,
    i.invoice_no,
    i.invoice_date,
    ip.commercial_kind,
    coalesce(c.name_ar, '—')::varchar as customer_name_ar,
    m.id as material_id,
    m.material_code,
    m.name_ar as material_name_ar,
    w.warehouse_code,
    b.branch_code,
    iml.quantity_base,
    iml.unit_price,
    coalesce(iml.discount_amount, 0)::numeric(18, 2) as discount_amount,
    iml.line_amount
  from public.invoices i
  inner join public.invoice_patterns ip on ip.id = i.pattern_id
  inner join public.invoice_material_lines iml on iml.invoice_id = i.id
  inner join public.materials m on m.id = iml.material_id
  inner join public.warehouses w on w.id = iml.warehouse_id
  inner join public.branches b on b.id = iml.branch_id
  left join public.customers c on c.id = i.customer_id
  where i.status = 'posted'
    and (
      ip.commercial_kind = 'sale'
      or (p_include_returns and ip.commercial_kind = 'return_sale')
    )
    and (p_from_date is null or i.invoice_date >= p_from_date)
    and (p_to_date is null or i.invoice_date <= p_to_date)
    and (p_customer_id is null or i.customer_id = p_customer_id)
    and (p_material_id is null or iml.material_id = p_material_id)
    and (p_warehouse_id is null or iml.warehouse_id = p_warehouse_id)
    and (p_branch_id is null or iml.branch_id = p_branch_id)
  order by i.invoice_date desc, i.invoice_no, iml.line_no;
end;
$$;

create or replace function public.get_purchase_lines_report(
  p_from_date date default null,
  p_to_date date default null,
  p_vendor_id uuid default null,
  p_material_id uuid default null,
  p_warehouse_id uuid default null,
  p_branch_id uuid default null,
  p_include_returns boolean default true
)
returns table (
  invoice_id uuid,
  invoice_no varchar,
  invoice_date date,
  commercial_kind varchar,
  vendor_name_ar varchar,
  material_id uuid,
  material_code varchar,
  material_name_ar varchar,
  warehouse_code varchar,
  branch_code varchar,
  quantity_base numeric,
  unit_price numeric,
  discount_amount numeric,
  line_amount numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_can_view_reports();
  return query
  select
    i.id as invoice_id,
    i.invoice_no,
    i.invoice_date,
    ip.commercial_kind,
    coalesce(v.name_ar, '—')::varchar as vendor_name_ar,
    m.id as material_id,
    m.material_code,
    m.name_ar as material_name_ar,
    w.warehouse_code,
    b.branch_code,
    iml.quantity_base,
    iml.unit_price,
    coalesce(iml.discount_amount, 0)::numeric(18, 2) as discount_amount,
    iml.line_amount
  from public.invoices i
  inner join public.invoice_patterns ip on ip.id = i.pattern_id
  inner join public.invoice_material_lines iml on iml.invoice_id = i.id
  inner join public.materials m on m.id = iml.material_id
  inner join public.warehouses w on w.id = iml.warehouse_id
  inner join public.branches b on b.id = iml.branch_id
  left join public.vendors v on v.id = i.vendor_id
  where i.status = 'posted'
    and (
      ip.commercial_kind in ('purchase', 'opening_stock')
      or (p_include_returns and ip.commercial_kind = 'return_purchase')
    )
    and (p_from_date is null or i.invoice_date >= p_from_date)
    and (p_to_date is null or i.invoice_date <= p_to_date)
    and (p_vendor_id is null or i.vendor_id = p_vendor_id)
    and (p_material_id is null or iml.material_id = p_material_id)
    and (p_warehouse_id is null or iml.warehouse_id = p_warehouse_id)
    and (p_branch_id is null or iml.branch_id = p_branch_id)
  order by i.invoice_date desc, i.invoice_no, iml.line_no;
end;
$$;

create or replace function public.get_inventory_movements_summary(
  p_from_date date default null,
  p_to_date date default null,
  p_material_id uuid default null,
  p_warehouse_id uuid default null,
  p_branch_id uuid default null
)
returns table (
  movement_kind varchar,
  source_type varchar,
  commercial_kind varchar,
  movement_count bigint,
  quantity_in_base numeric,
  quantity_out_base numeric,
  total_value numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_can_view_reports();
  return query
  select
    im.movement_kind,
    im.source_type,
    coalesce(ip.commercial_kind, im.source_type)::varchar as commercial_kind,
    count(*)::bigint as movement_count,
    coalesce(
      sum(case when im.quantity_base_delta > 0 then im.quantity_base_delta else 0 end),
      0
    )::numeric(18, 6) as quantity_in_base,
    coalesce(
      sum(case when im.quantity_base_delta < 0 then abs(im.quantity_base_delta) else 0 end),
      0
    )::numeric(18, 6) as quantity_out_base,
    coalesce(sum(coalesce(im.total_cost, 0)), 0)::numeric(18, 2) as total_value
  from public.inventory_movements im
  inner join public.materials m on m.id = im.material_id
  left join public.invoices i
    on im.source_type = 'invoice' and i.id = im.source_id
  left join public.invoice_patterns ip on ip.id = i.pattern_id
  where m.is_active = true
    and (p_from_date is null or im.movement_date >= p_from_date)
    and (p_to_date is null or im.movement_date <= p_to_date)
    and (p_material_id is null or im.material_id = p_material_id)
    and (p_warehouse_id is null or im.warehouse_id = p_warehouse_id)
    and (p_branch_id is null or im.branch_id = p_branch_id)
  group by im.movement_kind, im.source_type, coalesce(ip.commercial_kind, im.source_type)
  order by im.movement_kind, commercial_kind;
end;
$$;

create or replace function public.get_inventory_balance(
  p_as_of_date date default null,
  p_material_id uuid default null,
  p_warehouse_id uuid default null,
  p_branch_id uuid default null,
  p_category_id uuid default null,
  p_hide_zero boolean default true
)
returns table (
  material_id uuid,
  material_code varchar,
  material_name_ar varchar,
  category_id uuid,
  category_name_ar varchar,
  warehouse_id uuid,
  warehouse_code varchar,
  warehouse_name_ar varchar,
  branch_id uuid,
  branch_code varchar,
  quantity_base numeric,
  inventory_value numeric,
  unit_cost_avg numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_can_view_reports();
  return query
  with scoped_movements as (
    select im.*
    from public.inventory_movements im
    inner join public.materials m on m.id = im.material_id
    where m.is_active = true
      and (p_as_of_date is null or im.movement_date <= p_as_of_date)
      and (p_material_id is null or im.material_id = p_material_id)
      and (p_warehouse_id is null or im.warehouse_id = p_warehouse_id)
      and (p_branch_id is null or im.branch_id = p_branch_id)
      and (p_category_id is null or m.category_id = p_category_id)
  ),
  agg as (
    select
      sm.material_id,
      sm.warehouse_id,
      coalesce(sum(sm.quantity_base_delta), 0)::numeric(18, 6) as quantity_base,
      coalesce(
        sum(sm.quantity_base_delta * coalesce(sm.unit_cost, 0)),
        0
      )::numeric(18, 2) as inventory_value
    from scoped_movements sm
    group by sm.material_id, sm.warehouse_id
  )
  select
    m.id as material_id,
    m.material_code,
    m.name_ar as material_name_ar,
    m.category_id,
    mc.name_ar as category_name_ar,
    w.id as warehouse_id,
    w.warehouse_code,
    w.name_ar as warehouse_name_ar,
    w.branch_id,
    b.branch_code,
    a.quantity_base,
    a.inventory_value,
    case
      when a.quantity_base <> 0 then
        round((a.inventory_value / a.quantity_base)::numeric, 4)
      else null
    end as unit_cost_avg
  from agg a
  inner join public.materials m on m.id = a.material_id
  inner join public.warehouses w on w.id = a.warehouse_id
  inner join public.branches b on b.id = w.branch_id
  left join public.material_categories mc on mc.id = m.category_id
  where (not p_hide_zero or a.quantity_base <> 0)
  order by m.material_code, w.warehouse_code;
end;
$$;

create or replace function public.get_inventory_movement_ledger(
  p_from_date date default null,
  p_to_date date default null,
  p_material_id uuid default null,
  p_warehouse_id uuid default null,
  p_branch_id uuid default null
)
returns table (
  movement_id uuid,
  movement_date date,
  movement_kind varchar,
  material_id uuid,
  material_code varchar,
  material_name_ar varchar,
  warehouse_id uuid,
  warehouse_code varchar,
  warehouse_name_ar varchar,
  branch_code varchar,
  quantity_base_delta numeric,
  unit_cost numeric,
  line_value numeric,
  running_balance_base numeric,
  source_type varchar,
  source_id uuid,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_can_view_reports();
  return query
  with opening as (
    select
      im.material_id,
      im.warehouse_id,
      coalesce(sum(im.quantity_base_delta), 0)::numeric(18, 6) as opening_qty
    from public.inventory_movements im
    where p_from_date is not null
      and im.movement_date < p_from_date
      and (p_material_id is null or im.material_id = p_material_id)
      and (p_warehouse_id is null or im.warehouse_id = p_warehouse_id)
      and (p_branch_id is null or im.branch_id = p_branch_id)
    group by im.material_id, im.warehouse_id
  ),
  filtered as (
    select
      im.id as movement_id,
      im.movement_date,
      im.movement_kind,
      im.material_id,
      m.material_code,
      m.name_ar as material_name_ar,
      im.warehouse_id,
      w.warehouse_code,
      w.name_ar as warehouse_name_ar,
      b.branch_code,
      im.quantity_base_delta,
      im.unit_cost,
      round((im.quantity_base_delta * coalesce(im.unit_cost, 0))::numeric, 2) as line_value,
      im.source_type,
      im.source_id,
      im.created_at,
      coalesce(o.opening_qty, 0)::numeric(18, 6) as opening_qty
    from public.inventory_movements im
    inner join public.materials m on m.id = im.material_id
    inner join public.warehouses w on w.id = im.warehouse_id
    inner join public.branches b on b.id = im.branch_id
    left join opening o
      on o.material_id = im.material_id
     and o.warehouse_id = im.warehouse_id
    where (p_from_date is null or im.movement_date >= p_from_date)
      and (p_to_date is null or im.movement_date <= p_to_date)
      and (p_material_id is null or im.material_id = p_material_id)
      and (p_warehouse_id is null or im.warehouse_id = p_warehouse_id)
      and (p_branch_id is null or im.branch_id = p_branch_id)
  )
  select
    f.movement_id,
    f.movement_date,
    f.movement_kind,
    f.material_id,
    f.material_code,
    f.material_name_ar,
    f.warehouse_id,
    f.warehouse_code,
    f.warehouse_name_ar,
    f.branch_code,
    f.quantity_base_delta,
    f.unit_cost,
    f.line_value,
    (
      f.opening_qty
      + sum(f.quantity_base_delta) over (
          partition by f.material_id, f.warehouse_id
          order by f.movement_date, f.created_at, f.movement_id
          rows between unbounded preceding and current row
        )
    )::numeric(18, 6) as running_balance_base,
    f.source_type,
    f.source_id,
    f.created_at
  from filtered f
  order by f.movement_date, f.created_at, f.movement_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- تصحيح بأثر رجعي: تكاليف return_sale المخزّنة سابقاً بصيغة الإدخال الخاطئة
-- (مرحلة بناء — إعادة حساب زمني لكل حركة مرتجع مبيعات موجودة)
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
  v_settings public.company_inventory_settings%rowtype;
  v_unit_cost numeric(18, 4);
  v_total numeric(18, 2);
  v_count int := 0;
begin
  select * into v_settings from public.company_inventory_settings where id = 1;

  for r in
    select
      im.id,
      im.material_id,
      im.warehouse_id,
      im.cost_center_id,
      im.quantity_base_delta,
      im.movement_date,
      ip.pricing_consumed_mode,
      m.purchase_price,
      iml.unit_price,
      mu.factor_to_base,
      iml.expiry_date,
      iml.serial_number
    from public.inventory_movements im
    inner join public.invoice_material_lines iml on iml.id = im.source_line_id
    inner join public.invoices i on i.id = iml.invoice_id
    inner join public.invoice_patterns ip on ip.id = i.pattern_id
    inner join public.materials m on m.id = im.material_id
    inner join public.material_units mu on mu.id = iml.material_unit_id
    where im.movement_kind = 'return_sale'
      and im.source_type = 'invoice'
      and im.source_line_id is not null
    order by im.movement_date, im.created_at, im.id
  loop
    v_unit_cost := public.calc_outbound_unit_cost(
      r.pricing_consumed_mode,
      v_settings,
      r.purchase_price,
      r.unit_price,
      r.factor_to_base,
      r.material_id,
      r.warehouse_id,
      r.cost_center_id,
      r.expiry_date,
      r.serial_number,
      r.movement_date
    );
    v_total := round((abs(r.quantity_base_delta) * v_unit_cost)::numeric, 2);

    update public.inventory_movements
    set
      unit_cost = v_unit_cost,
      total_cost = v_total
    where id = r.id;

    v_count := v_count + 1;
  end loop;

  raise notice 'reports_audit_fix2: recalculated % return_sale inventory_movements', v_count;
end;
$$;
