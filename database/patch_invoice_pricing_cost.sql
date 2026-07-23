-- =============================================================================
-- patch_invoice_pricing_cost.sql (#39)
-- =============================================================================
-- ربط pricing_cost_mode / pricing_consumed_mode / فصل التكلفة بالصلاحية والتسلسلي
-- بحركات المخزون وقيود الترحيل.
-- يتطلب: patch_inventory_cost_dimensions.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- أنواع الفواتير الإدخالية / الإخراجية
-- ---------------------------------------------------------------------------

create or replace function public.invoice_is_inbound_kind(p_kind varchar)
returns boolean
language sql
immutable
as $$
  select p_kind in ('purchase', 'opening_stock', 'return_sale', 'transfer_in');
$$;

create or replace function public.invoice_is_outbound_kind(p_kind varchar)
returns boolean
language sql
immutable
as $$
  select p_kind in ('sale', 'return_purchase', 'transfer_out');
$$;

create or replace function public.invoice_kind_affects_material_line_cost(p_kind varchar)
returns boolean
language sql
immutable
as $$
  select p_kind in ('purchase', 'opening_stock', 'return_sale', 'transfer_in');
$$;

-- ---------------------------------------------------------------------------
-- تكلفة الإدخال من إعدادات النمط
-- ---------------------------------------------------------------------------

create or replace function public.calc_inbound_inventory_amount(
  p_pricing_cost_mode varchar,
  p_adjustments_affect boolean,
  p_line_amount numeric,
  p_line_gross numeric,
  p_line_disc numeric
)
returns numeric
language sql
immutable
as $$
  select case coalesce(nullif(trim(p_pricing_cost_mode), ''), 'line_net')
    when 'none' then 0::numeric(18, 2)
    when 'line_gross' then round(coalesce(p_line_gross, 0)::numeric, 2)
    else round(
      case
        when coalesce(p_adjustments_affect, true) then coalesce(p_line_amount, 0)
        else coalesce(p_line_gross, 0) - coalesce(p_line_disc, 0)
      end::numeric,
      2
    )
  end;
$$;

comment on function public.calc_inbound_inventory_amount is
  'مبلغ تكلفة المخزون للسطر الإدخالي حسب pricing_cost_mode';

-- ---------------------------------------------------------------------------
-- متوسط تكلفة الوحدة مع أبعاد الفصل
-- ---------------------------------------------------------------------------

create or replace function public.get_scoped_inventory_unit_cost(
  p_material_id uuid,
  p_warehouse_id uuid,
  p_cost_center_id uuid,
  p_expiry_date date,
  p_serial_number text,
  p_as_of_date date,
  p_cost_per_cost_center boolean,
  p_filter_expiry boolean,
  p_filter_serial boolean,
  p_fallback_unit_cost numeric
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select round((
        sum(im.quantity_base_delta * coalesce(im.unit_cost, 0))
        / nullif(sum(im.quantity_base_delta), 0)
      )::numeric, 4)
      from public.inventory_movements im
      where im.material_id = p_material_id
        and im.warehouse_id = p_warehouse_id
        and im.movement_date <= coalesce(p_as_of_date, current_date)
        and (
          not coalesce(p_cost_per_cost_center, false)
          or im.cost_center_id is not distinct from p_cost_center_id
        )
        and (
          not coalesce(p_filter_expiry, false)
          or im.expiry_date is not distinct from p_expiry_date
        )
        and (
          not coalesce(p_filter_serial, false)
          or nullif(trim(coalesce(im.serial_number, '')), '')
            is not distinct from nullif(trim(coalesce(p_serial_number, '')), '')
        )
    ),
    p_fallback_unit_cost,
    0
  );
$$;

comment on function public.get_scoped_inventory_unit_cost is
  'متوسط تكلفة الوحدة مع فلترة CC / صلاحية / تسلسلي';

grant execute on function public.get_scoped_inventory_unit_cost(
  uuid, uuid, uuid, date, text, date, boolean, boolean, boolean, numeric
) to authenticated;

-- ---------------------------------------------------------------------------
-- تكلفة الإخراج per سطر
-- ---------------------------------------------------------------------------

create or replace function public.calc_outbound_unit_cost(
  p_consumed_mode varchar,
  p_settings public.company_inventory_settings,
  p_material_purchase_price numeric,
  p_line_unit_price numeric,
  p_factor_to_base numeric,
  p_material_id uuid,
  p_warehouse_id uuid,
  p_cost_center_id uuid,
  p_expiry_date date,
  p_serial_number text,
  p_as_of_date date
)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_mode varchar(30);
  v_filter_expiry boolean;
  v_filter_serial boolean;
begin
  v_mode := coalesce(nullif(trim(p_consumed_mode), ''), 'weighted_avg');

  if v_mode = 'line_price' then
    if coalesce(p_factor_to_base, 0) > 0 then
      return round((p_line_unit_price / p_factor_to_base)::numeric, 4);
    end if;
    return round(coalesce(p_line_unit_price, 0)::numeric, 4);
  end if;

  if v_mode = 'standard' then
    return round(coalesce(p_material_purchase_price, 0)::numeric, 4);
  end if;

  v_filter_expiry := v_mode = 'lot_cost'
    or coalesce(p_settings.cost_per_expiry_date, false);
  v_filter_serial := v_mode = 'lot_cost'
    or coalesce(p_settings.cost_per_serial_number, false);

  return public.get_scoped_inventory_unit_cost(
    p_material_id,
    p_warehouse_id,
    p_cost_center_id,
    p_expiry_date,
    p_serial_number,
    p_as_of_date,
    coalesce(p_settings.cost_per_cost_center, false),
    v_filter_expiry,
    v_filter_serial,
    p_material_purchase_price
  );
end;
$$;

create or replace function public.calc_outbound_line_total_cost(
  p_consumed_mode varchar,
  p_settings public.company_inventory_settings,
  p_material_purchase_price numeric,
  p_line_unit_price numeric,
  p_factor_to_base numeric,
  p_quantity_base numeric,
  p_material_id uuid,
  p_warehouse_id uuid,
  p_cost_center_id uuid,
  p_expiry_date date,
  p_serial_number text,
  p_as_of_date date
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select round((
    abs(coalesce(p_quantity_base, 0))
    * public.calc_outbound_unit_cost(
      p_consumed_mode,
      p_settings,
      p_material_purchase_price,
      p_line_unit_price,
      p_factor_to_base,
      p_material_id,
      p_warehouse_id,
      p_cost_center_id,
      p_expiry_date,
      p_serial_number,
      p_as_of_date
    )
  )::numeric, 2);
$$;

grant execute on function public.calc_outbound_unit_cost(
  varchar,
  public.company_inventory_settings,
  numeric,
  numeric,
  numeric,
  uuid,
  uuid,
  uuid,
  date,
  text,
  date
) to authenticated;

grant execute on function public.calc_outbound_line_total_cost(
  varchar,
  public.company_inventory_settings,
  numeric,
  numeric,
  numeric,
  numeric,
  uuid,
  uuid,
  uuid,
  date,
  text,
  date
) to authenticated;

-- ---------------------------------------------------------------------------
-- محفز حركة المخزون — تطبيق تكلفة السطر من إعدادات النمط
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

drop trigger if exists trg_inventory_movements_apply_invoice_line_cost
  on public.inventory_movements;

create trigger trg_inventory_movements_apply_invoice_line_cost
  before insert on public.inventory_movements
  for each row
  execute function public.inventory_movements_apply_invoice_line_cost();

-- ---------------------------------------------------------------------------
-- فحوص ما قبل الترحيل (صلاحية + خصم + مرتجع) — تُعاد في #46 أيضاً
-- ---------------------------------------------------------------------------

create or replace function public.assert_invoice_may_post(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.invoices%rowtype;
  v_pat public.invoice_patterns%rowtype;
  v_gross numeric(18, 4);
  v_disc numeric(18, 2);
  v_max numeric(5, 2);
  v_applies varchar(10);
  v_line record;
  v_ref_qty numeric(18, 6);
  v_ret_qty numeric(18, 6);
begin
  if not (
    public.has_permission('invoices.post')
    or public.has_permission('invoices.edit')
  ) then
    raise exception 'Permission denied: invoices.post (or invoices.edit) required to post.';
  end if;

  select * into v_inv from public.invoices where id = p_invoice_id;
  if not found then
    raise exception 'Invoice not found.';
  end if;

  select * into v_pat from public.invoice_patterns where id = v_inv.pattern_id;

  v_max := v_pat.max_discount_percent;
  v_applies := coalesce(v_pat.discount_applies_to, 'line');

  if v_pat.discount_enabled and v_max is not null then
    if v_applies <> 'invoice' then
      for v_line in
        select *
        from public.invoice_material_lines
        where invoice_id = p_invoice_id
      loop
        v_gross := v_line.quantity * v_line.unit_price;
        if coalesce(v_line.discount_percent, 0) > v_max then
          raise exception
            'Line % discount percent (%) exceeds pattern max (%).',
            v_line.line_no, v_line.discount_percent, v_max;
        end if;
        v_disc := coalesce(v_line.discount_amount, 0);
        if v_disc > 0 and v_gross > 0
           and (v_disc / v_gross * 100) > (v_max + 0.01) then
          raise exception
            'Line % discount amount exceeds pattern max percent (%).',
            v_line.line_no, v_max;
        end if;
      end loop;
    end if;

    if v_applies <> 'line' then
      if coalesce(v_inv.invoice_discount_percent, 0) > v_max then
        raise exception
          'Invoice discount percent (%) exceeds pattern max (%).',
          v_inv.invoice_discount_percent, v_max;
      end if;
      if coalesce(v_inv.invoice_discount_amount, 0) > 0
         and coalesce(v_inv.invoice_discount_percent, 0) = 0 then
        select coalesce(sum(iml.line_amount), 0) into v_gross
        from public.invoice_material_lines iml
        where iml.invoice_id = p_invoice_id;
        if v_gross > 0
           and (v_inv.invoice_discount_amount / v_gross * 100) > (v_max + 0.01) then
          raise exception
            'Invoice discount amount exceeds pattern max percent (%).',
            v_max;
        end if;
      end if;
    end if;
  end if;

  if v_pat.commercial_kind in ('return_sale', 'return_purchase') then
    for v_line in
      select *
      from public.invoice_material_lines
      where invoice_id = p_invoice_id
    loop
      select coalesce(sum(src.quantity), 0)
      into v_ref_qty
      from public.invoice_material_lines src
      where src.material_id = v_line.material_id
        and src.material_unit_id = v_line.material_unit_id
        and src.invoice_id in (
          select v_inv.reference_invoice_id
          where v_inv.reference_invoice_id is not null
          union
          select irl.reference_invoice_id
          from public.invoice_reference_links irl
          where irl.invoice_id = p_invoice_id
        );

      select coalesce(sum(ret.quantity), 0)
      into v_ret_qty
      from public.invoice_material_lines ret
      inner join public.invoices ri on ri.id = ret.invoice_id
      inner join public.invoice_patterns rp on rp.id = ri.pattern_id
      where ri.status = 'posted'
        and ri.id is distinct from p_invoice_id
        and rp.commercial_kind = v_pat.commercial_kind
        and ret.material_id = v_line.material_id
        and ret.material_unit_id = v_line.material_unit_id
        and (
          ri.reference_invoice_id in (
            select v_inv.reference_invoice_id
            where v_inv.reference_invoice_id is not null
            union
            select irl.reference_invoice_id
            from public.invoice_reference_links irl
            where irl.invoice_id = p_invoice_id
          )
          or exists (
            select 1
            from public.invoice_reference_links link
            where link.invoice_id = ri.id
              and link.reference_invoice_id in (
                select v_inv.reference_invoice_id
                where v_inv.reference_invoice_id is not null
                union
                select irl.reference_invoice_id
                from public.invoice_reference_links irl
                where irl.invoice_id = p_invoice_id
              )
          )
        );

      if v_line.quantity > (v_ref_qty - v_ret_qty) + 0.000001 then
        raise exception
          'Return qty for line % exceeds remaining reference qty (available %).',
          v_line.line_no, greatest(v_ref_qty - v_ret_qty, 0);
      end if;
    end loop;
  end if;
end;
$$;

grant execute on function public.assert_invoice_may_post(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- post_invoice — قيود التكلفة من إعدادات النمط
-- ---------------------------------------------------------------------------

create or replace function public.post_invoice(p_invoice_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.invoices%rowtype;
  v_pat public.invoice_patterns%rowtype;
  v_inv_settings public.company_inventory_settings%rowtype;
  v_je_id uuid;
  v_entry_no varchar(40);
  v_rate numeric(18, 6);
  v_creditor uuid;
  v_debtor uuid;
  v_cost uuid;
  v_inventory uuid;
  v_transit uuid;
  v_material_total numeric(18, 2) := 0;
  v_account_debit numeric(18, 2) := 0;
  v_account_credit numeric(18, 2) := 0;
  v_je_debit numeric(18, 2);
  v_je_credit numeric(18, 2);
  v_party_type varchar(20);
  v_party_id uuid;
  v_row record;
  v_line_cost numeric(18, 2);
  v_has_materials boolean;
  v_discount_acct uuid;
  v_extra_acct uuid;
  v_invoice_disc numeric(18, 2) := 0;
  v_line_gross numeric(18, 2);
  v_line_disc numeric(18, 2);
  v_line_extra numeric(18, 2);
  v_qty_recv numeric(18, 6);
  v_qty_base_recv numeric(18, 6);
  v_round_step numeric(18, 4);
  v_party_total numeric(18, 2);
  v_rounded_total numeric(18, 2);
  v_rounding_diff numeric(18, 2);
begin
  perform set_config('app.invoice_posting', 'true', true);

  select * into v_inv from public.invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'Invoice not found.';
  end if;

  if v_inv.status = 'posted' then
    raise exception 'Invoice is already posted.';
  end if;

  if v_inv.status = 'cancelled' then
    raise exception 'Cannot post cancelled invoice.';
  end if;

  perform public.assert_invoice_may_post(p_invoice_id);

  perform public.assert_accounting_period_open(v_inv.invoice_date, v_inv.branch_id);

  select * into v_pat from public.invoice_patterns where id = v_inv.pattern_id;
  select * into v_inv_settings from public.company_inventory_settings where id = 1;

  v_creditor := coalesce(v_inv.creditor_account_id, v_pat.default_creditor_account_id);
  v_debtor := coalesce(v_inv.debtor_account_id, v_pat.default_debtor_account_id);
  v_cost := coalesce(v_inv.cost_account_id, v_pat.default_cost_account_id);
  v_inventory := coalesce(v_inv.inventory_account_id, v_pat.default_inventory_account_id);
  v_transit := coalesce(v_inv.transfer_transit_account_id, v_pat.transfer_transit_account_id);
  v_rate := coalesce(nullif(v_inv.exchange_rate, 0), 1);

  select coalesce(sum(iml.line_amount), 0)
  into v_material_total
  from public.invoice_material_lines iml
  where iml.invoice_id = p_invoice_id;

  select
    coalesce(sum(case when ial.side = 'debit' then ial.amount else 0 end), 0),
    coalesce(sum(case when ial.side = 'credit' then ial.amount else 0 end), 0)
  into v_account_debit, v_account_credit
  from public.invoice_account_lines ial
  where ial.invoice_id = p_invoice_id;

  v_has_materials := exists (
    select 1 from public.invoice_material_lines iml where iml.invoice_id = p_invoice_id
  );

  if v_has_materials and v_inv_settings.inventory_method is null then
    raise exception 'Configure inventory_method in company_inventory_settings before posting.';
  end if;

  if not v_has_materials and v_account_debit = 0 and v_account_credit = 0 then
    raise exception 'Cannot post empty invoice.';
  end if;

  if v_inv.customer_id is not null then
    v_party_type := 'customer';
    v_party_id := v_inv.customer_id;
  elsif v_inv.vendor_id is not null then
    v_party_type := 'vendor';
    v_party_id := v_inv.vendor_id;
  else
    v_party_type := null;
    v_party_id := null;
  end if;

  v_entry_no := 'JE-' || v_inv.invoice_no;

  insert into public.journal_entries (
    entry_no,
    entry_date,
    description,
    status,
    source_type,
    source_id,
    branch_id
  )
  values (
    v_entry_no,
    v_inv.invoice_date,
    coalesce(v_inv.description, 'مرحّل من فاتورة ' || v_inv.invoice_no),
    'posted',
    'invoice',
    p_invoice_id,
    v_inv.branch_id
  )
  returning id into v_je_id;

  -- أسطر الحسابات الإضافية
  for v_row in
    select * from public.invoice_account_lines ial
    where ial.invoice_id = p_invoice_id
    order by ial.line_no
  loop
    perform public._invoice_add_journal_line(
      v_je_id,
      v_row.account_id,
      case when v_row.side = 'debit' then v_row.amount else 0 end,
      case when v_row.side = 'credit' then v_row.amount else 0 end,
      coalesce(v_row.description, 'حساب إضافي — فاتورة ' || v_inv.invoice_no),
      v_row.cost_center_id,
      v_row.branch_id,
      v_inv.currency_id,
      v_rate,
      null, null, null, null,
      p_invoice_id,
      v_row.id
    );
  end loop;

  v_discount_acct := coalesce(v_inv.discount_account_id, v_pat.default_discount_account_id);
  v_extra_acct := coalesce(v_inv.extra_account_id, v_pat.default_extra_account_id);

  -- مواد + قيود حسب النوع التجاري
  case v_pat.commercial_kind
  when 'sale' then
    if v_creditor is null or v_debtor is null then
      raise exception 'Sale invoice requires creditor and debtor accounts.';
    end if;

    for v_row in
      select iml.*, m.purchase_price, mu.factor_to_base
      from public.invoice_material_lines iml
      inner join public.materials m on m.id = iml.material_id
      inner join public.material_units mu on mu.id = iml.material_unit_id
      where iml.invoice_id = p_invoice_id
      order by iml.line_no
    loop
      v_line_gross := round((v_row.quantity * v_row.unit_price)::numeric, 2);
      v_line_disc := coalesce(v_row.discount_amount, 0);
      v_line_extra := coalesce(v_row.extra_amount, 0);

      if v_line_disc > 0 and v_discount_acct is null then
        raise exception 'Line discount requires discount_account_id on invoice or pattern.';
      end if;
      if v_line_extra > 0 and v_extra_acct is null then
        raise exception 'Line extra requires extra_account_id on invoice or pattern.';
      end if;

      if v_line_disc > 0 or v_line_extra > 0 then
        perform public._invoice_add_journal_line(
          v_je_id, v_creditor, 0, v_line_gross,
          'مبيعات — ' || v_inv.invoice_no,
          v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null,
          p_invoice_id, v_row.id
        );
        if v_line_disc > 0 then
          perform public._invoice_add_journal_line(
            v_je_id, v_discount_acct, v_line_disc, 0,
            'خصم سطر — ' || v_inv.invoice_no,
            v_row.cost_center_id, v_row.branch_id,
            v_inv.currency_id, v_rate,
            null, null, null, null,
            p_invoice_id, v_row.id
          );
        end if;
        if v_line_extra > 0 then
          perform public._invoice_add_journal_line(
            v_je_id, v_extra_acct, 0, v_line_extra,
            'إضافي سطر — ' || v_inv.invoice_no,
            v_row.cost_center_id, v_row.branch_id,
            v_inv.currency_id, v_rate,
            null, null, null, null,
            p_invoice_id, v_row.id
          );
        end if;
        perform public._invoice_add_journal_line(
          v_je_id, v_debtor, v_row.line_amount, 0,
          case when v_inv.settlement_mode = 'credit' then 'ذمم عميل' else 'نقدي' end,
          coalesce(v_row.cost_center_id, v_inv.cost_center_id), v_row.branch_id,
          v_inv.currency_id, v_rate,
          case when v_inv.settlement_mode = 'credit' then v_party_type else null end,
          case when v_inv.settlement_mode = 'credit' then v_party_id else null end,
          case when v_inv.settlement_mode = 'credit' then v_inv.due_date else null end,
          case when v_inv.settlement_mode = 'credit' then v_inv.payment_terms_days else null end,
          p_invoice_id, v_row.id
        );
      else
        perform public._invoice_add_journal_line(
          v_je_id, v_creditor, 0, v_row.line_amount,
          'مبيعات — ' || v_inv.invoice_no,
          v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null,
          p_invoice_id, v_row.id
        );

        perform public._invoice_add_journal_line(
          v_je_id, v_debtor, v_row.line_amount, 0,
          case when v_inv.settlement_mode = 'credit' then 'ذمم عميل' else 'نقدي' end,
          coalesce(v_row.cost_center_id, v_inv.cost_center_id), v_row.branch_id,
          v_inv.currency_id, v_rate,
          case when v_inv.settlement_mode = 'credit' then v_party_type else null end,
          case when v_inv.settlement_mode = 'credit' then v_party_id else null end,
          case when v_inv.settlement_mode = 'credit' then v_inv.due_date else null end,
          case when v_inv.settlement_mode = 'credit' then v_inv.payment_terms_days else null end,
          p_invoice_id, v_row.id
        );
      end if;

      if v_inv_settings.inventory_method = 'perpetual'
         and v_cost is not null and v_inventory is not null then
        v_line_cost := public.calc_outbound_line_total_cost(
          v_pat.pricing_consumed_mode,
          v_inv_settings,
          v_row.purchase_price,
          v_row.unit_price,
          v_row.factor_to_base,
          v_row.quantity_base,
          v_row.material_id,
          v_row.warehouse_id,
          v_row.cost_center_id,
          v_row.expiry_date,
          v_row.serial_number,
          v_inv.invoice_date
        );
        if v_line_cost > 0 then
          perform public._invoice_add_journal_line(
            v_je_id, v_cost, v_line_cost, 0,
            'تكلفة مبيعات', v_row.cost_center_id, v_row.branch_id,
            v_inv.currency_id, v_rate,
            null, null, null, null, p_invoice_id, v_row.id
          );
          perform public._invoice_add_journal_line(
            v_je_id, v_inventory, 0, v_line_cost,
            'مخزون', v_row.cost_center_id, v_row.branch_id,
            v_inv.currency_id, v_rate,
            null, null, null, null, p_invoice_id, v_row.id
          );
        end if;
      end if;

      insert into public.inventory_movements (
        movement_date, material_id, warehouse_id, branch_id, cost_center_id,
        quantity_delta, quantity_base_delta, unit_cost, total_cost,
        movement_kind, source_type, source_id, source_line_id
      )
      values (
        v_inv.invoice_date, v_row.material_id, v_row.warehouse_id, v_row.branch_id, v_row.cost_center_id,
        -v_row.quantity, -v_row.quantity_base,
        v_row.purchase_price, v_row.line_amount,
        'sale', 'invoice', p_invoice_id, v_row.id
      );
    end loop;

  when 'purchase' then
    if v_creditor is null then
      raise exception 'Purchase invoice requires creditor account (payable/cash).';
    end if;

    for v_row in
      select iml.*, m.purchase_price, mu.factor_to_base
      from public.invoice_material_lines iml
      inner join public.materials m on m.id = iml.material_id
      inner join public.material_units mu on mu.id = iml.material_unit_id
      where iml.invoice_id = p_invoice_id
      order by iml.line_no
    loop
      v_line_gross := round((v_row.quantity * v_row.unit_price)::numeric, 2);
      v_line_disc := coalesce(v_row.discount_amount, 0);
      v_line_extra := coalesce(v_row.extra_amount, 0);

      if v_line_disc > 0
         and not coalesce(v_pat.line_adjustments_affect_material_cost, true)
         and v_discount_acct is null then
        raise exception 'Line discount requires discount_account_id on invoice or pattern.';
      end if;
      if v_line_extra > 0
         and not coalesce(v_pat.line_adjustments_affect_material_cost, true)
         and v_extra_acct is null then
        raise exception 'Line extra requires extra_account_id on invoice or pattern.';
      end if;

      v_line_cost := public.calc_inbound_inventory_amount(
        v_pat.pricing_cost_mode,
        coalesce(v_pat.line_adjustments_affect_material_cost, true),
        v_row.line_amount,
        v_line_gross,
        v_line_disc
      );

      if v_inv_settings.inventory_method = 'perpetual' then
        if v_inventory is null then
          raise exception 'Perpetual purchase requires inventory account.';
        end if;
        perform public._invoice_add_journal_line(
          v_je_id, v_inventory,
          v_line_cost,
          0,
          'مشتريات — مخزون', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
      else
        if v_debtor is null then
          raise exception 'Periodic purchase requires debtor/purchases account.';
        end if;
        perform public._invoice_add_journal_line(
          v_je_id, v_debtor,
          v_line_cost,
          0,
          'مشتريات', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
      end if;

      -- خصم منفصل فقط عندما لا يدخل في تكلفة المخزون (نفس منطق الإضافي)
      if v_line_disc > 0
         and not coalesce(v_pat.line_adjustments_affect_material_cost, true) then
        perform public._invoice_add_journal_line(
          v_je_id, v_discount_acct, 0, v_line_disc,
          'خصم سطر — ' || v_inv.invoice_no,
          v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
      end if;

      if v_line_extra > 0 and not coalesce(v_pat.line_adjustments_affect_material_cost, true) then
        perform public._invoice_add_journal_line(
          v_je_id, v_extra_acct, v_line_extra, 0,
          'إضافي سطر — ' || v_inv.invoice_no,
          v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
      end if;

      perform public._invoice_add_journal_line(
        v_je_id, v_creditor, 0, v_row.line_amount,
        case when v_inv.settlement_mode = 'credit' then 'ذمم مورد' else 'نقدي' end,
        coalesce(v_row.cost_center_id, v_inv.cost_center_id), v_row.branch_id,
        v_inv.currency_id, v_rate,
        case when v_inv.settlement_mode = 'credit' then v_party_type else null end,
        case when v_inv.settlement_mode = 'credit' then v_party_id else null end,
        case when v_inv.settlement_mode = 'credit' then v_inv.due_date else null end,
        case when v_inv.settlement_mode = 'credit' then v_inv.payment_terms_days else null end,
        p_invoice_id, v_row.id
      );

      insert into public.inventory_movements (
        movement_date, material_id, warehouse_id, branch_id, cost_center_id,
        quantity_delta, quantity_base_delta, unit_cost, total_cost,
        movement_kind, source_type, source_id, source_line_id
      )
      values (
        v_inv.invoice_date, v_row.material_id, v_row.warehouse_id, v_row.branch_id, v_row.cost_center_id,
        v_row.quantity, v_row.quantity_base,
        v_row.unit_price, v_row.line_amount,
        'purchase', 'invoice', p_invoice_id, v_row.id
      );
    end loop;

  when 'transfer_out' then
    for v_row in
      select iml.*, m.purchase_price, mu.factor_to_base
      from public.invoice_material_lines iml
      inner join public.materials m on m.id = iml.material_id
      inner join public.material_units mu on mu.id = iml.material_unit_id
      where iml.invoice_id = p_invoice_id
      order by iml.line_no
    loop
      v_line_cost := public.calc_outbound_line_total_cost(
        v_pat.pricing_consumed_mode,
        v_inv_settings,
        v_row.purchase_price,
        v_row.unit_price,
        v_row.factor_to_base,
        v_row.quantity_base,
        v_row.material_id,
        v_row.warehouse_id,
        v_row.cost_center_id,
        v_row.expiry_date,
        v_row.serial_number,
        v_inv.invoice_date
      );

      if v_inv_settings.inventory_method = 'perpetual' then
        if v_inventory is null then
          raise exception 'Transfer out (perpetual) requires inventory account.';
        end if;
        if v_transit is null then
          raise exception 'Transfer out (perpetual) requires transit account on pattern/invoice.';
        end if;
        perform public._invoice_add_journal_line(
          v_je_id, v_transit, v_line_cost, 0,
          'بضاعة بالطريق — إخراج', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
        perform public._invoice_add_journal_line(
          v_je_id, v_inventory, 0, v_line_cost,
          'مخزون مصدر — إخراج', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
      end if;

      insert into public.inventory_movements (
        movement_date, material_id, warehouse_id, branch_id, cost_center_id,
        quantity_delta, quantity_base_delta, unit_cost, total_cost,
        movement_kind, source_type, source_id, source_line_id
      )
      values (
        v_inv.invoice_date, v_row.material_id, v_row.warehouse_id, v_row.branch_id, v_row.cost_center_id,
        -v_row.quantity, -v_row.quantity_base,
        v_row.purchase_price, v_line_cost,
        'transfer_out', 'invoice', p_invoice_id, v_row.id
      );
    end loop;

    if v_inv.inventory_transfer_id is not null then
      update public.inventory_transfers
      set status = 'dispatched', shipped_at = coalesce(shipped_at, now()), out_invoice_id = p_invoice_id
      where id = v_inv.inventory_transfer_id;
    end if;

  when 'transfer_in' then
    for v_row in
      select iml.*, m.purchase_price, mu.factor_to_base
      from public.invoice_material_lines iml
      inner join public.materials m on m.id = iml.material_id
      inner join public.material_units mu on mu.id = iml.material_unit_id
      where iml.invoice_id = p_invoice_id
      order by iml.line_no
    loop
      v_qty_recv := coalesce(v_row.qty_received, v_row.quantity);
      if v_qty_recv < 0 then
        raise exception 'qty_received cannot be negative.';
      end if;
      if v_qty_recv > v_row.quantity then
        raise exception 'qty_received cannot exceed ordered quantity.';
      end if;

      v_qty_base_recv := public.material_quantity_to_base(
        v_row.material_unit_id,
        v_qty_recv
      );

      v_line_gross := round((v_row.quantity * v_row.unit_price)::numeric, 2);
      v_line_cost := public.calc_inbound_inventory_amount(
        v_pat.pricing_cost_mode,
        coalesce(v_pat.line_adjustments_affect_material_cost, true),
        v_row.line_amount,
        v_line_gross,
        0
      );
      if v_line_cost <= 0 then
        v_line_cost := public.calc_outbound_line_total_cost(
          v_pat.pricing_consumed_mode,
          v_inv_settings,
          v_row.purchase_price,
          v_row.unit_price,
          v_row.factor_to_base,
          v_row.quantity_base,
          v_row.material_id,
          v_row.warehouse_id,
          v_row.cost_center_id,
          v_row.expiry_date,
          v_row.serial_number,
          v_inv.invoice_date
        );
      end if;

      -- تناسب التكلفة مع الكمية المستلمة عند الاستلام الجزئي
      if v_row.quantity_base > 0
         and v_qty_base_recv is distinct from v_row.quantity_base then
        v_line_cost := round(
          (v_line_cost * v_qty_base_recv / v_row.quantity_base)::numeric,
          2
        );
      end if;

      if v_inv_settings.inventory_method = 'perpetual' then
        if v_inventory is null or v_transit is null then
          raise exception 'Transfer in (perpetual) requires inventory and transit accounts.';
        end if;
        perform public._invoice_add_journal_line(
          v_je_id, v_inventory, v_line_cost, 0,
          'مخزون هدف — إدخال', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
        perform public._invoice_add_journal_line(
          v_je_id, v_transit, 0, v_line_cost,
          'إغلاق بالطريق — إدخال', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
      end if;

      insert into public.inventory_movements (
        movement_date, material_id, warehouse_id, branch_id, cost_center_id,
        quantity_delta, quantity_base_delta, unit_cost, total_cost,
        movement_kind, source_type, source_id, source_line_id
      )
      values (
        v_inv.invoice_date, v_row.material_id, v_row.warehouse_id, v_row.branch_id, v_row.cost_center_id,
        v_qty_recv,
        v_qty_base_recv,
        case
          when v_qty_base_recv > 0 then round((v_line_cost / v_qty_base_recv)::numeric, 4)
          else v_row.purchase_price
        end,
        v_line_cost,
        'transfer_in', 'invoice', p_invoice_id, v_row.id
      );
    end loop;

    if v_inv.inventory_transfer_id is not null then
      update public.inventory_transfers
      set
        status = case
          when exists (
            select 1 from public.inventory_transfer_lines itl
            where itl.transfer_id = v_inv.inventory_transfer_id
              and itl.qty_received < itl.qty_shipped
              and itl.qty_shipped > 0
          ) then 'partially_received'
          else 'received'
        end,
        received_at = coalesce(received_at, now()),
        in_invoice_id = p_invoice_id
      where id = v_inv.inventory_transfer_id;
    end if;

  when 'return_sale' then
    for v_row in
      select iml.*, m.purchase_price, mu.factor_to_base
      from public.invoice_material_lines iml
      inner join public.materials m on m.id = iml.material_id
      inner join public.material_units mu on mu.id = iml.material_unit_id
      where iml.invoice_id = p_invoice_id
      order by iml.line_no
    loop
      perform public._invoice_add_journal_line(
        v_je_id, v_creditor, v_row.line_amount, 0,
        'مرتجع مبيعات', v_row.cost_center_id, v_row.branch_id,
        v_inv.currency_id, v_rate,
        null, null, null, null, p_invoice_id, v_row.id
      );
      perform public._invoice_add_journal_line(
        v_je_id, v_debtor, 0, v_row.line_amount,
        'ذمم عميل — مرتجع', v_row.cost_center_id, v_row.branch_id,
        v_inv.currency_id, v_rate,
        v_party_type, v_party_id, v_inv.due_date, v_inv.payment_terms_days,
        p_invoice_id, v_row.id
      );

      if v_inv_settings.inventory_method = 'perpetual'
         and v_cost is not null and v_inventory is not null then
        v_line_cost := public.calc_outbound_line_total_cost(
          v_pat.pricing_consumed_mode,
          v_inv_settings,
          v_row.purchase_price,
          v_row.unit_price,
          v_row.factor_to_base,
          v_row.quantity_base,
          v_row.material_id,
          v_row.warehouse_id,
          v_row.cost_center_id,
          v_row.expiry_date,
          v_row.serial_number,
          v_inv.invoice_date
        );
        perform public._invoice_add_journal_line(
          v_je_id, v_inventory, v_line_cost, 0,
          'مخزون — مرتجع', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate, null, null, null, null, p_invoice_id, v_row.id
        );
        perform public._invoice_add_journal_line(
          v_je_id, v_cost, 0, v_line_cost,
          'تكلفة — مرتجع', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate, null, null, null, null, p_invoice_id, v_row.id
        );
      end if;

      insert into public.inventory_movements (
        movement_date, material_id, warehouse_id, branch_id, cost_center_id,
        quantity_delta, quantity_base_delta, unit_cost, total_cost,
        movement_kind, source_type, source_id, source_line_id
      )
      values (
        v_inv.invoice_date, v_row.material_id, v_row.warehouse_id, v_row.branch_id, v_row.cost_center_id,
        v_row.quantity, v_row.quantity_base,
        v_row.purchase_price, v_row.line_amount,
        'return_sale', 'invoice', p_invoice_id, v_row.id
      );
    end loop;

  when 'return_purchase' then
    if v_creditor is null then
      raise exception 'Return purchase requires creditor account (payable).';
    end if;

    for v_row in
      select iml.*, m.purchase_price, mu.factor_to_base
      from public.invoice_material_lines iml
      inner join public.materials m on m.id = iml.material_id
      inner join public.material_units mu on mu.id = iml.material_unit_id
      where iml.invoice_id = p_invoice_id
      order by iml.line_no
    loop
      v_line_cost := public.calc_outbound_line_total_cost(
        v_pat.pricing_consumed_mode,
        v_inv_settings,
        v_row.purchase_price,
        v_row.unit_price,
        v_row.factor_to_base,
        v_row.quantity_base,
        v_row.material_id,
        v_row.warehouse_id,
        v_row.cost_center_id,
        v_row.expiry_date,
        v_row.serial_number,
        v_inv.invoice_date
      );

      if v_inv_settings.inventory_method = 'perpetual' then
        if v_inventory is null then
          raise exception 'Return purchase (perpetual) requires inventory account.';
        end if;
        perform public._invoice_add_journal_line(
          v_je_id, v_creditor, v_row.line_amount, 0,
          'ذمم مورد — مرتجع مشتريات', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          v_party_type, v_party_id, v_inv.due_date, v_inv.payment_terms_days,
          p_invoice_id, v_row.id
        );
        perform public._invoice_add_journal_line(
          v_je_id, v_inventory, 0, v_line_cost,
          'مخزون — مرتجع مشتريات', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
      else
        if v_debtor is null then
          raise exception 'Return purchase (periodic) requires debtor/purchases account.';
        end if;
        perform public._invoice_add_journal_line(
          v_je_id, v_creditor, v_row.line_amount, 0,
          'ذمم مورد — مرتجع مشتريات', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          v_party_type, v_party_id, v_inv.due_date, v_inv.payment_terms_days,
          p_invoice_id, v_row.id
        );
        perform public._invoice_add_journal_line(
          v_je_id, v_debtor, 0, v_row.line_amount,
          'مشتريات — مرتجع', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
      end if;

      insert into public.inventory_movements (
        movement_date, material_id, warehouse_id, branch_id, cost_center_id,
        quantity_delta, quantity_base_delta, unit_cost, total_cost,
        movement_kind, source_type, source_id, source_line_id
      )
      values (
        v_inv.invoice_date, v_row.material_id, v_row.warehouse_id, v_row.branch_id, v_row.cost_center_id,
        -v_row.quantity, -v_row.quantity_base,
        v_row.unit_price, v_row.line_amount,
        'return_purchase', 'invoice', p_invoice_id, v_row.id
      );
    end loop;

  when 'opening_stock' then
    if v_creditor is null then
      raise exception 'Opening stock requires creditor account (opening equity / counterpart).';
    end if;

    for v_row in
      select iml.*, m.purchase_price, mu.factor_to_base
      from public.invoice_material_lines iml
      inner join public.materials m on m.id = iml.material_id
      inner join public.material_units mu on mu.id = iml.material_unit_id
      where iml.invoice_id = p_invoice_id
      order by iml.line_no
    loop
      v_line_cost := public.calc_inbound_inventory_amount(
        v_pat.pricing_cost_mode,
        coalesce(v_pat.line_adjustments_affect_material_cost, true),
        v_row.line_amount,
        round((v_row.quantity * v_row.unit_price)::numeric, 2),
        coalesce(v_row.discount_amount, 0)
      );

      if v_inv_settings.inventory_method = 'perpetual' then
        if v_inventory is null then
          raise exception 'Opening stock (perpetual) requires inventory account.';
        end if;
        perform public._invoice_add_journal_line(
          v_je_id, v_inventory, v_line_cost, 0,
          'مخزون — بضاعة أول المدة', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
        perform public._invoice_add_journal_line(
          v_je_id, v_creditor, 0, v_line_cost,
          'بضاعة أول المدة — طرف مقابل', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
      else
        if v_debtor is null then
          raise exception 'Opening stock (periodic) requires debtor account.';
        end if;
        perform public._invoice_add_journal_line(
          v_je_id, v_debtor, v_line_cost, 0,
          'بضاعة أول المدة', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
        perform public._invoice_add_journal_line(
          v_je_id, v_creditor, 0, v_line_cost,
          'بضاعة أول المدة — طرف مقابل', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
      end if;

      insert into public.inventory_movements (
        movement_date, material_id, warehouse_id, branch_id, cost_center_id,
        quantity_delta, quantity_base_delta, unit_cost, total_cost,
        movement_kind, source_type, source_id, source_line_id
      )
      values (
        v_inv.invoice_date, v_row.material_id, v_row.warehouse_id, v_row.branch_id, v_row.cost_center_id,
        v_row.quantity, v_row.quantity_base,
        v_row.unit_price, v_row.line_amount,
        'opening_stock', 'invoice', p_invoice_id, v_row.id
      );
    end loop;

  else
    raise exception 'Unsupported commercial_kind: %', v_pat.commercial_kind;
  end case;

  -- خصم الفاتورة + تدوير الإجمالي (§9 / §التخفيض)
  if coalesce(v_inv.invoice_discount_percent, 0) > 0 then
    v_invoice_disc := round((v_material_total * v_inv.invoice_discount_percent / 100)::numeric, 2);
  elsif coalesce(v_inv.invoice_discount_amount, 0) > 0 then
    v_invoice_disc := v_inv.invoice_discount_amount;
  end if;

  if v_invoice_disc > 0 then
    if v_discount_acct is null then
      raise exception 'Invoice discount requires discount_account_id on invoice or pattern.';
    end if;
    case v_pat.commercial_kind
    when 'sale' then
      if v_debtor is null then
        raise exception 'Sale discount requires debtor account.';
      end if;
      perform public._invoice_add_journal_line(
        v_je_id, v_discount_acct, v_invoice_disc, 0,
        'خصم فاتورة — ' || v_inv.invoice_no,
        v_inv.cost_center_id, v_inv.branch_id,
        v_inv.currency_id, v_rate,
        null, null, null, null, p_invoice_id, null
      );
      perform public._invoice_add_journal_line(
        v_je_id, v_debtor, 0, v_invoice_disc,
        'تخفيض ذمم — ' || v_inv.invoice_no,
        v_inv.cost_center_id, v_inv.branch_id,
        v_inv.currency_id, v_rate,
        case when v_inv.settlement_mode = 'credit' then v_party_type else null end,
        case when v_inv.settlement_mode = 'credit' then v_party_id else null end,
        null, null, p_invoice_id, null
      );
    when 'purchase' then
      if v_creditor is null then
        raise exception 'Purchase discount requires creditor account.';
      end if;
      perform public._invoice_add_journal_line(
        v_je_id, v_creditor, v_invoice_disc, 0,
        'خصم مشتريات — ' || v_inv.invoice_no,
        v_inv.cost_center_id, v_inv.branch_id,
        v_inv.currency_id, v_rate,
        case when v_inv.settlement_mode = 'credit' then v_party_type else null end,
        case when v_inv.settlement_mode = 'credit' then v_party_id else null end,
        null, null, p_invoice_id, null
      );
      perform public._invoice_add_journal_line(
        v_je_id, v_discount_acct, 0, v_invoice_disc,
        'خصم مكتسب — ' || v_inv.invoice_no,
        v_inv.cost_center_id, v_inv.branch_id,
        v_inv.currency_id, v_rate,
        null, null, null, null, p_invoice_id, null
      );
    else
      null;
    end case;
  end if;

  if v_pat.rounding_enabled
     and coalesce(v_pat.rounding_target, 'invoice_total') in ('invoice_total', 'both')
     and v_pat.commercial_kind in ('sale', 'purchase') then
    v_round_step := coalesce(nullif(v_pat.rounding_step, 0), 1);
    v_party_total := v_material_total - v_invoice_disc;
    v_rounded_total := case coalesce(v_pat.rounding_mode, 'nearest')
      when 'up' then ceil(v_party_total / v_round_step - 0.0000001) * v_round_step
      when 'down' then floor(v_party_total / v_round_step + 0.0000001) * v_round_step
      else round(v_party_total / v_round_step) * v_round_step
    end;
    v_rounding_diff := round((v_rounded_total - v_party_total)::numeric, 2);

    if v_rounding_diff <> 0 then
      case v_pat.commercial_kind
      when 'sale' then
        if v_debtor is null then
          raise exception 'Sale rounding requires debtor account.';
        end if;
        if v_rounding_diff > 0 then
          perform public._invoice_add_journal_line(
            v_je_id, v_debtor, v_rounding_diff, 0,
            'تدوير فاتورة — ' || v_inv.invoice_no,
            v_inv.cost_center_id, v_inv.branch_id,
            v_inv.currency_id, v_rate,
            case when v_inv.settlement_mode = 'credit' then v_party_type else null end,
            case when v_inv.settlement_mode = 'credit' then v_party_id else null end,
            null, null, p_invoice_id, null
          );
        else
          perform public._invoice_add_journal_line(
            v_je_id, v_debtor, 0, abs(v_rounding_diff),
            'تدوير فاتورة — ' || v_inv.invoice_no,
            v_inv.cost_center_id, v_inv.branch_id,
            v_inv.currency_id, v_rate,
            case when v_inv.settlement_mode = 'credit' then v_party_type else null end,
            case when v_inv.settlement_mode = 'credit' then v_party_id else null end,
            null, null, p_invoice_id, null
          );
        end if;
      when 'purchase' then
        if v_creditor is null then
          raise exception 'Purchase rounding requires creditor account.';
        end if;
        if v_rounding_diff > 0 then
          perform public._invoice_add_journal_line(
            v_je_id, v_creditor, 0, v_rounding_diff,
            'تدوير فاتورة — ' || v_inv.invoice_no,
            v_inv.cost_center_id, v_inv.branch_id,
            v_inv.currency_id, v_rate,
            case when v_inv.settlement_mode = 'credit' then v_party_type else null end,
            case when v_inv.settlement_mode = 'credit' then v_party_id else null end,
            null, null, p_invoice_id, null
          );
        else
          perform public._invoice_add_journal_line(
            v_je_id, v_creditor, abs(v_rounding_diff), 0,
            'تدوير فاتورة — ' || v_inv.invoice_no,
            v_inv.cost_center_id, v_inv.branch_id,
            v_inv.currency_id, v_rate,
            case when v_inv.settlement_mode = 'credit' then v_party_type else null end,
            case when v_inv.settlement_mode = 'credit' then v_party_id else null end,
            null, null, p_invoice_id, null
          );
        end if;
      else
        null;
      end case;
    end if;
  end if;

  -- توازن القيد
  select
    coalesce(sum(debit), 0),
    coalesce(sum(credit), 0)
  into v_je_debit, v_je_credit
  from public.journal_entry_lines
  where journal_entry_id = v_je_id;

  if v_je_debit <> v_je_credit then
    raise exception 'Posted invoice journal is unbalanced: debit (%) <> credit (%).', v_je_debit, v_je_credit;
  end if;

  if v_has_materials then
    perform public.lock_company_inventory_foundation(v_inv.invoice_date::timestamptz);
  end if;

  update public.invoices
  set status = 'posted', journal_entry_id = v_je_id, updated_at = now()
  where id = p_invoice_id;

  perform set_config('app.invoice_posting', 'false', true);

  return v_je_id;
exception
  when others then
    perform set_config('app.invoice_posting', 'false', true);
    raise;
end;
$$;


grant execute on function public.post_invoice(uuid) to authenticated;
