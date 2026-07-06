-- =============================================================================
-- patch_invoice_reference_close.sql — إغلاق المرجع يدوياً
-- =============================================================================
-- يتطلب: patch_invoices.sql (#5)
-- الترتيب: patch #12
-- =============================================================================

alter table public.invoices
  add column if not exists reference_closed_at timestamptz null;

create index if not exists idx_invoices_reference_closed_at
  on public.invoices(reference_closed_at)
  where reference_closed_at is not null;

-- ---------------------------------------------------------------------------

create or replace function public.close_invoice_reference(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.invoices%rowtype;
begin
  select * into v_inv
  from public.invoices
  where id = p_invoice_id
  for update;

  if not found then
    raise exception 'Invoice not found.';
  end if;

  if v_inv.status <> 'posted' then
    raise exception 'Only posted invoices can be closed as reference.';
  end if;

  if v_inv.reference_closed_at is not null then
    raise exception 'Invoice reference is already closed.';
  end if;

  update public.invoices
  set reference_closed_at = now(),
      updated_at = now()
  where id = p_invoice_id;
end;
$$;

grant execute on function public.close_invoice_reference(uuid) to authenticated;
