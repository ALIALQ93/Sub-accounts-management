-- =============================================================================
-- patch_reverse_voucher_rpc.sql (#27)
-- =============================================================================
-- عكس السند المرحّل ذرّياً: إنشاء سند معكوس + أسطر + ترحيل في معاملة واحدة.
-- =============================================================================

create or replace function public.reverse_posted_voucher(p_voucher_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_src public.vouchers%rowtype;
  v_new_id uuid;
  v_new_no varchar(40);
  v_suffix text;
begin
  if not public.has_permission('vouchers.edit') then
    raise exception 'Permission denied: vouchers.edit required.';
  end if;

  select * into v_src from public.vouchers where id = p_voucher_id;
  if not found then
    raise exception 'Voucher not found.';
  end if;

  if v_src.status <> 'posted' then
    raise exception 'Only posted vouchers can be reversed.';
  end if;

  if v_src.settlement_mode = 'invoice' then
    raise exception
      'Invoice settlement vouchers cannot be reversed automatically.';
  end if;

  v_suffix := right(
    floor(extract(epoch from clock_timestamp()) * 1000)::bigint::text,
    6
  );
  v_new_no := 'RV-' || v_src.voucher_no || '-' || v_suffix;
  if length(v_new_no) > 40 then
    v_new_no := left(v_new_no, 40);
  end if;

  insert into public.vouchers (
    voucher_no,
    voucher_type,
    settlement_mode,
    voucher_date,
    description,
    status,
    customer_id,
    vendor_id,
    currency_id,
    exchange_rate,
    cost_center_id,
    branch_id
  )
  values (
    v_new_no,
    v_src.voucher_type,
    v_src.settlement_mode,
    current_date,
    'عكس السند ' || v_src.voucher_no,
    'approved',
    v_src.customer_id,
    v_src.vendor_id,
    v_src.currency_id,
    v_src.exchange_rate,
    v_src.cost_center_id,
    v_src.branch_id
  )
  returning id into v_new_id;

  insert into public.voucher_lines (
    voucher_id,
    account_id,
    side,
    amount,
    line_description,
    cost_center_id,
    line_category_id,
    category_quantity,
    cc_optional
  )
  select
    v_new_id,
    vl.account_id,
    case when vl.side = 'debit' then 'credit' else 'debit' end,
    vl.amount,
    coalesce('عكس: ' || nullif(trim(vl.line_description), ''), 'عكس سطر'),
    vl.cost_center_id,
    vl.line_category_id,
    vl.category_quantity,
    vl.cc_optional
  from public.voucher_lines vl
  where vl.voucher_id = p_voucher_id;

  update public.vouchers
  set status = 'posted', updated_at = now()
  where id = v_new_id;

  return v_new_id;
end;
$$;

grant execute on function public.reverse_posted_voucher(uuid) to authenticated;

comment on function public.reverse_posted_voucher(uuid) is
  'ينشئ سنداً عكسياً مرحّلاً لسند مرحّل (ما عدا سندات إغلاق الفواتير)';
