-- =============================================================================
-- patch_voucher_atomic_ops.sql (#28)
-- =============================================================================
-- عمليات ذرّية: استبدال أسطر/تخصيصات السند، واستيراد حسابات دفعة واحدة.
-- =============================================================================

create or replace function public.replace_voucher_lines(
  p_voucher_id uuid,
  p_lines jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status varchar(20);
  v_line jsonb;
begin
  select status
  into v_status
  from public.vouchers
  where id = p_voucher_id;

  if not found then
    raise exception 'Voucher not found.';
  end if;

  if v_status = 'posted' then
    raise exception 'Cannot replace lines on posted voucher.';
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'Lines payload must be a JSON array.';
  end if;

  delete from public.voucher_lines
  where voucher_id = p_voucher_id;

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    if coalesce(v_line->>'account_id', '') = '' then
      continue;
    end if;

    if coalesce((v_line->>'amount')::numeric(18, 2), 0) <= 0 then
      continue;
    end if;

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
    values (
      p_voucher_id,
      (v_line->>'account_id')::uuid,
      v_line->>'side',
      (v_line->>'amount')::numeric(18, 2),
      nullif(trim(v_line->>'line_description'), ''),
      nullif(v_line->>'cost_center_id', '')::uuid,
      nullif(v_line->>'line_category_id', '')::uuid,
      nullif(v_line->>'category_quantity', '')::numeric(18, 4),
      coalesce((v_line->>'cc_optional')::boolean, false)
    );
  end loop;
end;
$$;

create or replace function public.replace_voucher_allocations(
  p_voucher_id uuid,
  p_allocations jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status varchar(20);
  v_row jsonb;
  v_target_id uuid;
  v_amount numeric(18, 2);
begin
  select status
  into v_status
  from public.vouchers
  where id = p_voucher_id;

  if not found then
    raise exception 'Voucher not found.';
  end if;

  if v_status = 'posted' then
    raise exception 'Cannot replace allocations on posted voucher.';
  end if;

  if p_allocations is null or jsonb_typeof(p_allocations) <> 'array' then
    raise exception 'Allocations payload must be a JSON array.';
  end if;

  delete from public.voucher_allocations
  where voucher_id = p_voucher_id;

  for v_row in select value from jsonb_array_elements(p_allocations)
  loop
    v_target_id := nullif(v_row->>'target_journal_line_id', '')::uuid;
    v_amount := coalesce((v_row->>'applied_amount')::numeric(18, 2), 0);

    if v_target_id is null or v_amount <= 0 then
      continue;
    end if;

    insert into public.voucher_allocations (
      voucher_id,
      target_journal_line_id,
      applied_amount,
      note
    )
    values (
      p_voucher_id,
      v_target_id,
      v_amount,
      nullif(trim(v_row->>'note'), '')
    );
  end loop;
end;
$$;

create or replace function public.bulk_create_accounts(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_result jsonb := '[]'::jsonb;
  v_account public.accounts%rowtype;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Accounts payload must be a JSON array.';
  end if;

  if jsonb_array_length(p_rows) = 0 then
    raise exception 'At least one account row is required.';
  end if;

  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    if coalesce(trim(v_row->>'code'), '') = '' then
      raise exception 'Account code is required.';
    end if;

    if coalesce(trim(v_row->>'name_ar'), '') = '' then
      raise exception 'Account name_ar is required.';
    end if;

    if coalesce(v_row->>'parent_id', '') = '' then
      raise exception 'Account parent_id is required.';
    end if;

    insert into public.accounts (
      code,
      sub_code,
      name_ar,
      name_en,
      parent_id,
      currency_id,
      is_postable,
      is_active
    )
    values (
      trim(v_row->>'code'),
      nullif(trim(v_row->>'sub_code'), ''),
      trim(v_row->>'name_ar'),
      nullif(trim(v_row->>'name_en'), ''),
      (v_row->>'parent_id')::uuid,
      nullif(v_row->>'currency_id', '')::uuid,
      coalesce((v_row->>'is_postable')::boolean, true),
      coalesce((v_row->>'is_active')::boolean, true)
    )
    returning * into v_account;

    v_result := v_result || jsonb_build_array(to_jsonb(v_account));
  end loop;

  return v_result;
end;
$$;

grant execute on function public.replace_voucher_lines(uuid, jsonb) to authenticated;
grant execute on function public.replace_voucher_allocations(uuid, jsonb) to authenticated;
grant execute on function public.bulk_create_accounts(jsonb) to authenticated;

comment on function public.replace_voucher_lines(uuid, jsonb) is
  'يستبدل كل أسطر سند غير مرحّل في معاملة واحدة';

comment on function public.replace_voucher_allocations(uuid, jsonb) is
  'يستبدل كل تخصيصات سند غير مرحّل في معاملة واحدة';

comment on function public.bulk_create_accounts(jsonb) is
  'ينشئ دفعة حسابات ذرّياً — الأكواد تُحسب مسبقاً بالواجهة';
