-- =============================================================================
-- 03_test_cases.sql — سيناريوهات اختبار (اختياري)
-- =============================================================================
-- شغّل بعد setup_all.sql أو بعد (00_reset + 01_schema + 02_rls)
-- =============================================================================

begin;

-- 1) حسابات فرعية للاختبار
with roots as (
  select code, id from public.accounts where code in ('1', '2', '4', '5', '6', '7')
),
base_currency as (
  select id from public.currencies where is_base = true limit 1
)
insert into public.accounts (code, name_ar, parent_id, currency_id, is_postable, is_active)
select x.code, x.name_ar, x.parent_id, bc.id, true, true
from (
  select '110101'::varchar(30) as code, 'صندوق اختبار'::varchar(200) as name_ar, (select id from roots where code = '1') as parent_id
  union all
  select '110102', 'بنك اختبار', (select id from roots where code = '1')
  union all
  select '110201', 'ذمم عملاء اختبار', (select id from roots where code = '1')
  union all
  select '210101', 'ذمم موردين اختبار', (select id from roots where code = '2')
  union all
  select '410101', 'مبيعات اختبار', (select id from roots where code = '4')
  union all
  select '510101', 'مشتريات اختبار', (select id from roots where code = '5')
  union all
  select '610101', 'مصروف اختبار', (select id from roots where code = '6')
  union all
  select '710101', 'ايرادات اخرى اختبار', (select id from roots where code = '7')
) x
cross join base_currency bc
where x.parent_id is not null
on conflict (code) do nothing;

-- 2) عميل ومورد للاختبار
insert into public.customers (customer_code, name_ar, receivable_account_id, is_active)
select
  'CUST-TST-001',
  'عميل اختبار',
  a.id,
  true
from public.accounts a
where a.code = '110201'
on conflict (customer_code) do nothing;

insert into public.vendors (vendor_code, name_ar, payable_account_id, is_active)
select
  'VEND-TST-001',
  'مورد اختبار',
  a.id,
  true
from public.accounts a
where a.code = '210101'
on conflict (vendor_code) do nothing;

-- 3) حركة مفتوحة — فاتورة مبيعات (ذمم مدينة)
do $$
declare
  v_entry_id uuid;
  v_ar uuid;
  v_sales uuid;
  v_currency uuid;
begin
  if not exists (select 1 from public.journal_entries where entry_no = 'TST-OPEN-SALES-001') then
    select id into v_ar from public.accounts where code = '110201';
    select id into v_sales from public.accounts where code = '410101';
    select id into v_currency from public.currencies where is_base = true;

    insert into public.journal_entries (entry_no, entry_date, description, status, source_type)
    values ('TST-OPEN-SALES-001', current_date, 'Open AR item for test customer invoice', 'posted', 'test')
    returning id into v_entry_id;

    insert into public.journal_entry_lines (journal_entry_id, account_id, debit, credit, line_description)
    values
      (v_entry_id, v_ar, 1000, 0, 'AR open item'),
      (v_entry_id, v_sales, 0, 1000, 'Sales');
  end if;
end $$;

-- 4) حركة مفتوحة — فاتورة مشتريات (ذمم دائنة)
do $$
declare
  v_entry_id uuid;
  v_ap uuid;
  v_purchase uuid;
begin
  if not exists (select 1 from public.journal_entries where entry_no = 'TST-OPEN-PUR-001') then
    select id into v_ap from public.accounts where code = '210101';
    select id into v_purchase from public.accounts where code = '510101';

    insert into public.journal_entries (entry_no, entry_date, description, status, source_type)
    values ('TST-OPEN-PUR-001', current_date, 'Open AP item for test vendor bill', 'posted', 'test')
    returning id into v_entry_id;

    insert into public.journal_entry_lines (journal_entry_id, account_id, debit, credit, line_description)
    values
      (v_entry_id, v_purchase, 800, 0, 'Purchases'),
      (v_entry_id, v_ap, 0, 800, 'AP open item');
  end if;
end $$;

-- 5) سند قبض (وضع فاتورة) — تحصيل جزئي 600
do $$
declare
  v_voucher_id uuid;
  v_cash uuid;
  v_ar uuid;
  v_customer uuid;
  v_target_line uuid;
  v_currency uuid;
begin
  select id into v_voucher_id from public.vouchers where voucher_no = 'TST-RCP-INV-001';
  select id into v_cash from public.accounts where code = '110101';
  select id into v_ar from public.accounts where code = '110201';
  select id into v_customer from public.customers where customer_code = 'CUST-TST-001';
  select id into v_currency from public.currencies where is_base = true;

  if v_voucher_id is null then
    insert into public.vouchers (
      voucher_no, voucher_type, settlement_mode, voucher_date, description, status,
      customer_id, currency_id, exchange_rate
    )
    values (
      'TST-RCP-INV-001', 'receipt', 'invoice', current_date,
      'Partial collection against invoice', 'approved', v_customer, v_currency, 1
    )
    returning id into v_voucher_id;
  end if;

  if not exists (select 1 from public.voucher_lines where voucher_id = v_voucher_id) then
    insert into public.voucher_lines (voucher_id, account_id, side, amount, line_description)
    values
      (v_voucher_id, v_cash, 'debit', 600, 'Cash received'),
      (v_voucher_id, v_ar, 'credit', 600, 'Reduce AR');
  end if;

  select jel.id into v_target_line
  from public.journal_entry_lines jel
  join public.journal_entries je on je.id = jel.journal_entry_id
  join public.accounts a on a.id = jel.account_id
  where je.entry_no = 'TST-OPEN-SALES-001'
    and a.code = '110201'
    and jel.debit > 0
  limit 1;

  if not exists (
    select 1 from public.voucher_allocations
    where voucher_id = v_voucher_id and target_journal_line_id = v_target_line
  ) then
    insert into public.voucher_allocations (voucher_id, target_journal_line_id, applied_amount, note)
    values (v_voucher_id, v_target_line, 600, 'Partial allocation to customer invoice line');
  end if;

  update public.vouchers set status = 'posted' where id = v_voucher_id and status <> 'posted';
end $$;

-- 6) سند صرف (وضع فاتورة) — دفع جزئي 500
do $$
declare
  v_voucher_id uuid;
  v_cash uuid;
  v_ap uuid;
  v_vendor uuid;
  v_target_line uuid;
  v_currency uuid;
begin
  select id into v_voucher_id from public.vouchers where voucher_no = 'TST-PAY-INV-001';
  select id into v_cash from public.accounts where code = '110101';
  select id into v_ap from public.accounts where code = '210101';
  select id into v_vendor from public.vendors where vendor_code = 'VEND-TST-001';
  select id into v_currency from public.currencies where is_base = true;

  if v_voucher_id is null then
    insert into public.vouchers (
      voucher_no, voucher_type, settlement_mode, voucher_date, description, status,
      vendor_id, currency_id, exchange_rate
    )
    values (
      'TST-PAY-INV-001', 'payment', 'invoice', current_date,
      'Partial payment against vendor bill', 'approved', v_vendor, v_currency, 1
    )
    returning id into v_voucher_id;
  end if;

  if not exists (select 1 from public.voucher_lines where voucher_id = v_voucher_id) then
    insert into public.voucher_lines (voucher_id, account_id, side, amount, line_description)
    values
      (v_voucher_id, v_ap, 'debit', 500, 'Reduce AP'),
      (v_voucher_id, v_cash, 'credit', 500, 'Cash payment');
  end if;

  select jel.id into v_target_line
  from public.journal_entry_lines jel
  join public.journal_entries je on je.id = jel.journal_entry_id
  join public.accounts a on a.id = jel.account_id
  where je.entry_no = 'TST-OPEN-PUR-001'
    and a.code = '210101'
    and jel.credit > 0
  limit 1;

  if not exists (
    select 1 from public.voucher_allocations
    where voucher_id = v_voucher_id and target_journal_line_id = v_target_line
  ) then
    insert into public.voucher_allocations (voucher_id, target_journal_line_id, applied_amount, note)
    values (v_voucher_id, v_target_line, 500, 'Partial allocation to vendor bill line');
  end if;

  update public.vouchers set status = 'posted' where id = v_voucher_id and status <> 'posted';
end $$;

-- 7) سند صرف — مرتجع مبيعات (وضع حساب)
do $$
declare
  v_voucher_id uuid;
  v_cash uuid;
  v_sales uuid;
  v_currency uuid;
begin
  select id into v_voucher_id from public.vouchers where voucher_no = 'TST-PAY-RET-001';
  select id into v_cash from public.accounts where code = '110101';
  select id into v_sales from public.accounts where code = '410101';
  select id into v_currency from public.currencies where is_base = true;

  if v_voucher_id is null then
    insert into public.vouchers (
      voucher_no, voucher_type, settlement_mode, voucher_date, description, status,
      currency_id, exchange_rate
    )
    values (
      'TST-PAY-RET-001', 'payment', 'account', current_date,
      'Payment to customer for sales return', 'approved', v_currency, 1
    )
    returning id into v_voucher_id;
  end if;

  if not exists (select 1 from public.voucher_lines where voucher_id = v_voucher_id) then
    insert into public.voucher_lines (voucher_id, account_id, side, amount, line_description)
    values
      (v_voucher_id, v_sales, 'debit', 100, 'Sales return adjustment'),
      (v_voucher_id, v_cash, 'credit', 100, 'Cash out');
  end if;

  update public.vouchers set status = 'posted' where id = v_voucher_id and status <> 'posted';
end $$;

-- 8) سند قبض — مرتجع مشتريات (وضع حساب)
do $$
declare
  v_voucher_id uuid;
  v_cash uuid;
  v_purchase uuid;
  v_currency uuid;
begin
  select id into v_voucher_id from public.vouchers where voucher_no = 'TST-RCP-RET-001';
  select id into v_cash from public.accounts where code = '110101';
  select id into v_purchase from public.accounts where code = '510101';
  select id into v_currency from public.currencies where is_base = true;

  if v_voucher_id is null then
    insert into public.vouchers (
      voucher_no, voucher_type, settlement_mode, voucher_date, description, status,
      currency_id, exchange_rate
    )
    values (
      'TST-RCP-RET-001', 'receipt', 'account', current_date,
      'Receipt from vendor for purchase return', 'approved', v_currency, 1
    )
    returning id into v_voucher_id;
  end if;

  if not exists (select 1 from public.voucher_lines where voucher_id = v_voucher_id) then
    insert into public.voucher_lines (voucher_id, account_id, side, amount, line_description)
    values
      (v_voucher_id, v_cash, 'debit', 120, 'Cash in'),
      (v_voucher_id, v_purchase, 'credit', 120, 'Purchase return adjustment');
  end if;

  update public.vouchers set status = 'posted' where id = v_voucher_id and status <> 'posted';
end $$;

commit;

-- استعلامات تحقق
select
  v.voucher_no,
  v.voucher_type,
  v.settlement_mode,
  v.status,
  je.entry_no as linked_entry_no
from public.vouchers v
left join public.journal_entries je on je.id = v.journal_entry_id
where v.voucher_no like 'TST-%'
order by v.voucher_no;

select
  je.entry_no,
  sum(jel.debit) as total_debit,
  sum(jel.credit) as total_credit
from public.journal_entries je
join public.journal_entry_lines jel on jel.journal_entry_id = je.id
where je.entry_no like 'JE-TST-%' or je.entry_no like 'TST-OPEN-%'
group by je.entry_no
order by je.entry_no;
