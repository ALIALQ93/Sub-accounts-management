-- =============================================================================
-- patch_invoice_multiple_references.sql — مراجع متعددة للفاتورة
-- =============================================================================
-- يتطلب: patch_invoices.sql (#5)
-- الترتيب: patch #11
-- =============================================================================

create table if not exists public.invoice_reference_links (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  reference_invoice_id uuid not null references public.invoices(id) on delete restrict,
  sort_order int not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),

  constraint invoice_reference_links_unique
    unique (invoice_id, reference_invoice_id),
  constraint invoice_reference_links_not_self
    check (invoice_id <> reference_invoice_id)
);

create index if not exists idx_invoice_reference_links_invoice_id
  on public.invoice_reference_links(invoice_id);

create index if not exists idx_invoice_reference_links_reference_invoice_id
  on public.invoice_reference_links(reference_invoice_id);

-- ---------------------------------------------------------------------------
-- مزامنة المراجع الإضافية (المرجع الرئيسي يبقى في invoices.reference_invoice_id)
-- ---------------------------------------------------------------------------

create or replace function public.sync_invoice_reference_links(
  p_invoice_id uuid,
  p_reference_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_primary uuid;
begin
  select reference_invoice_id into v_primary
  from public.invoices
  where id = p_invoice_id;

  delete from public.invoice_reference_links
  where invoice_id = p_invoice_id;

  if p_reference_ids is null or array_length(p_reference_ids, 1) is null then
    return;
  end if;

  insert into public.invoice_reference_links (invoice_id, reference_invoice_id, sort_order)
  select
    p_invoice_id,
    ref_id,
    ordinality - 1
  from unnest(p_reference_ids) with ordinality as t(ref_id, ordinality)
  where ref_id is not null
    and ref_id <> p_invoice_id
    and (v_primary is null or ref_id <> v_primary)
  on conflict (invoice_id, reference_invoice_id) do nothing;
end;
$$;

grant execute on function public.sync_invoice_reference_links(uuid, uuid[]) to authenticated;
