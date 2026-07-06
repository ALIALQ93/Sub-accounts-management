-- =============================================================================
-- patch_post_invoice.sql — ترحيل الفاتورة إلى قيد + حركة مخزون
-- =============================================================================
-- يتطلب: patch_settlement_foundation.sql
-- =============================================================================

create or replace function public.is_invoice_posting()
returns boolean
language sql
stable
as $$
  select coalesce(current_setting('app.invoice_posting', true), '') = 'true';
$$;

-- ---------------------------------------------------------------------------
-- إدراج سطر قيد مساعد
-- ---------------------------------------------------------------------------

create or replace function public._invoice_add_journal_line(
  p_journal_entry_id uuid,
  p_account_id uuid,
  p_debit numeric,
  p_credit numeric,
  p_description text,
  p_cost_center_id uuid,
  p_branch_id uuid,
  p_currency_id uuid,
  p_exchange_rate numeric,
  p_party_type varchar default null,
  p_party_id uuid default null,
  p_due_date date default null,
  p_payment_terms_days int default null,
  p_source_invoice_id uuid default null,
  p_source_invoice_line_id uuid default null
)
returns uuid
language plpgsql
as $$
declare
  v_line_id uuid;
  v_rate numeric(18, 6);
begin
  if p_account_id is null then
    raise exception 'Journal line requires account_id.';
  end if;

  if (p_debit > 0 and p_credit > 0) or (p_debit = 0 and p_credit = 0) then
    raise exception 'Journal line must have either debit or credit.';
  end if;

  v_rate := coalesce(nullif(p_exchange_rate, 0), 1);

  insert into public.journal_entry_lines (
    journal_entry_id,
    account_id,
    debit,
    credit,
    line_description,
    cost_center_id,
    branch_id,
    currency_id,
    exchange_rate,
    debit_base,
    credit_base,
    party_type,
    party_id,
    due_date,
    payment_terms_days,
    source_invoice_id,
    source_invoice_line_id
  )
  values (
    p_journal_entry_id,
    p_account_id,
    coalesce(p_debit, 0),
    coalesce(p_credit, 0),
    p_description,
    p_cost_center_id,
    p_branch_id,
    p_currency_id,
    v_rate,
    public.to_base_amount(coalesce(p_debit, 0), v_rate),
    public.to_base_amount(coalesce(p_credit, 0), v_rate),
    p_party_type,
    p_party_id,
    p_due_date,
    p_payment_terms_days,
    p_source_invoice_id,
    p_source_invoice_line_id
  )
  returning id into v_line_id;

  return v_line_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- ترحيل الفاتورة
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
  v_invoice_disc numeric(18, 2) := 0;
  v_line_gross numeric(18, 2);
  v_line_disc numeric(18, 2);
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

  -- مواد + قيود حسب النوع التجاري
  case v_pat.commercial_kind
  when 'sale' then
    if v_creditor is null or v_debtor is null then
      raise exception 'Sale invoice requires creditor and debtor accounts.';
    end if;

    for v_row in
      select iml.*, m.purchase_price
      from public.invoice_material_lines iml
      inner join public.materials m on m.id = iml.material_id
      where iml.invoice_id = p_invoice_id
      order by iml.line_no
    loop
      v_line_gross := round((v_row.quantity * v_row.unit_price)::numeric, 2);
      v_line_disc := coalesce(v_row.discount_amount, 0);

      if v_line_disc > 0 then
        if v_discount_acct is null then
          raise exception 'Line discount requires discount_account_id on invoice or pattern.';
        end if;
        perform public._invoice_add_journal_line(
          v_je_id, v_creditor, 0, v_line_gross,
          'مبيعات — ' || v_inv.invoice_no,
          v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null,
          p_invoice_id, v_row.id
        );
        perform public._invoice_add_journal_line(
          v_je_id, v_discount_acct, v_line_disc, 0,
          'خصم سطر — ' || v_inv.invoice_no,
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
        v_line_cost := round((v_row.quantity_base * v_row.purchase_price)::numeric, 2);
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
      select iml.*, m.purchase_price
      from public.invoice_material_lines iml
      inner join public.materials m on m.id = iml.material_id
      where iml.invoice_id = p_invoice_id
      order by iml.line_no
    loop
      v_line_gross := round((v_row.quantity * v_row.unit_price)::numeric, 2);
      v_line_disc := coalesce(v_row.discount_amount, 0);

      if v_line_disc > 0 and v_discount_acct is null then
        raise exception 'Line discount requires discount_account_id on invoice or pattern.';
      end if;

      if v_inv_settings.inventory_method = 'perpetual' then
        if v_inventory is null then
          raise exception 'Perpetual purchase requires inventory account.';
        end if;
        perform public._invoice_add_journal_line(
          v_je_id, v_inventory, case when v_line_disc > 0 then v_line_gross else v_row.line_amount end, 0,
          'مشتريات — مخزون', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
      else
        if v_debtor is null then
          raise exception 'Periodic purchase requires debtor/purchases account.';
        end if;
        perform public._invoice_add_journal_line(
          v_je_id, v_debtor, case when v_line_disc > 0 then v_line_gross else v_row.line_amount end, 0,
          'مشتريات', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
      end if;

      if v_line_disc > 0 then
        perform public._invoice_add_journal_line(
          v_je_id, v_discount_acct, 0, v_line_disc,
          'خصم سطر — ' || v_inv.invoice_no,
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
      select iml.*, m.purchase_price
      from public.invoice_material_lines iml
      inner join public.materials m on m.id = iml.material_id
      where iml.invoice_id = p_invoice_id
      order by iml.line_no
    loop
      v_line_cost := round((v_row.quantity_base * v_row.purchase_price)::numeric, 2);

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
      select iml.*, m.purchase_price
      from public.invoice_material_lines iml
      inner join public.materials m on m.id = iml.material_id
      where iml.invoice_id = p_invoice_id
      order by iml.line_no
    loop
      v_line_cost := round((v_row.quantity_base * v_row.purchase_price)::numeric, 2);

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
        coalesce(v_row.qty_received, v_row.quantity),
        v_row.quantity_base,
        v_row.purchase_price, v_line_cost,
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
      select iml.*, m.purchase_price
      from public.invoice_material_lines iml
      inner join public.materials m on m.id = iml.material_id
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
        v_line_cost := round((v_row.quantity_base * v_row.purchase_price)::numeric, 2);
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
      select iml.*, m.purchase_price
      from public.invoice_material_lines iml
      inner join public.materials m on m.id = iml.material_id
      where iml.invoice_id = p_invoice_id
      order by iml.line_no
    loop
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
          v_je_id, v_inventory, 0, v_row.line_amount,
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
      select iml.*, m.purchase_price
      from public.invoice_material_lines iml
      inner join public.materials m on m.id = iml.material_id
      where iml.invoice_id = p_invoice_id
      order by iml.line_no
    loop
      if v_inv_settings.inventory_method = 'perpetual' then
        if v_inventory is null then
          raise exception 'Opening stock (perpetual) requires inventory account.';
        end if;
        perform public._invoice_add_journal_line(
          v_je_id, v_inventory, v_row.line_amount, 0,
          'مخزون — بضاعة أول المدة', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
        perform public._invoice_add_journal_line(
          v_je_id, v_creditor, 0, v_row.line_amount,
          'بضاعة أول المدة — طرف مقابل', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
      else
        if v_debtor is null then
          raise exception 'Opening stock (periodic) requires debtor account.';
        end if;
        perform public._invoice_add_journal_line(
          v_je_id, v_debtor, v_row.line_amount, 0,
          'بضاعة أول المدة', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
        perform public._invoice_add_journal_line(
          v_je_id, v_creditor, 0, v_row.line_amount,
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

-- ---------------------------------------------------------------------------
-- حماية الفاتورة المرحّلة
-- ---------------------------------------------------------------------------

create or replace function public.invoices_before_update_guard()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'posted' then
    if not public.is_admin() then
      raise exception 'Posted invoice cannot be modified.';
    end if;
    return new;
  end if;

  if new.status = 'posted' and old.status <> 'posted' then
    if not public.is_invoice_posting() then
      raise exception 'Use post_invoice(invoice_id) to post invoices.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_invoices_before_update_guard on public.invoices;
create trigger trg_invoices_before_update_guard
before update on public.invoices
for each row execute function public.invoices_before_update_guard();

create or replace function public.invoice_lines_prevent_change_when_posted()
returns trigger
language plpgsql
as $$
declare
  v_status varchar(20);
begin
  select i.status into v_status
  from public.invoices i
  where i.id = coalesce(new.invoice_id, old.invoice_id);

  if v_status = 'posted' and not public.is_admin() then
    raise exception 'Cannot modify lines of a posted invoice.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_invoice_material_lines_posted_guard on public.invoice_material_lines;
create trigger trg_invoice_material_lines_posted_guard
before insert or update or delete on public.invoice_material_lines
for each row execute function public.invoice_lines_prevent_change_when_posted();

drop trigger if exists trg_invoice_account_lines_posted_guard on public.invoice_account_lines;
create trigger trg_invoice_account_lines_posted_guard
before insert or update or delete on public.invoice_account_lines
for each row execute function public.invoice_lines_prevent_change_when_posted();
